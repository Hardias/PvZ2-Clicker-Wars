<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useInventory, createEmptyInventorySlots } from '../composables/useInventory';
import { useZealot, createDefaultZealotState } from '../composables/useZealot';
import { useCombat } from '../composables/useCombat';
import { useSaveSystem, SlotMeta } from '../composables/useSaveSystem';
import { useAudio } from '../composables/useAudio';
import { useCombo } from '../composables/useCombo';
import { useGameLoop } from '../composables/useGameLoop';
import { useSkillTree, createDefaultSkillTreeState } from '../composables/useSkillTree';
import { Item, InventorySlot } from '../types/Item';
import type { ZealotStats } from '../types/Zealot';
import type { ProbeBase } from '../types/ProbeBase';
import { scaleShopItem, getShopMultiplier, getShopMultiplierLabel, getShopRankName } from '../utils/shopUpgrade';
import { formatNumber } from '../utils/format';
import { big } from '../utils/bigNumber';
import { AUTOSAVE_ENABLED_KEY, DISABLE_PATHER_KEY, DEV_SCREEN_TYPE_KEY, TUTORIAL_COMPLETED_KEY } from '../utils/keys';
import { SKILL_NODES, SkillTreeState } from '../types/SkillTree';
import { AVAILABLE_SHOP_ITEMS } from '../data/shopCatalog';

import GameHeader from '../Components/GameHeader.vue';
import AudioVisualizer from '../Components/AudioVisualizer.vue';
import ZealotStatsComponent from '../Components/ZealotStatsComponent.vue';
import InventoryGrid from '../Components/InventoryGrid.vue';
import BattleArea from '../Components/BattleArea.vue';
import ShopModal from '../Components/ShopModal.vue';
import SaveModal from '../Components/SaveModal.vue';
import LoadModal from '../Components/LoadModal.vue';
import DevTerminal from '../Components/DevTerminal.vue';
import TutorialOverlay from '../Components/TutorialOverlay.vue';
import SkillTreeModal from '../Components/SkillTreeModal.vue';
import ZealotXpBar from '../Components/ZealotXpBar.vue';

const currentView = ref<'battle' | 'shop'>('battle');
const isAtShop = computed(() => currentView.value === 'shop');

const autosaveEnabled = ref<boolean>(localStorage.getItem(AUTOSAVE_ENABLED_KEY) !== 'false');

watch(autosaveEnabled, (val) => {
  localStorage.setItem(AUTOSAVE_ENABLED_KEY, String(val));
});

function toggleAutosave() {
  autosaveEnabled.value = !autosaveEnabled.value;
  showSaveNotification(autosaveEnabled.value ? 'Auto-save enabled!' : 'Auto-save disabled!');
}

// Composables setup
const { slots, totalEquipmentStats, equipItem, unequipItem, loadInventory } = useInventory();
const skillTree = useSkillTree();
const { state: zealotState, maxHp, attackPower, attackSpeed, currentDps, defense, hpRegen, takeDamage, computeReducedDamage, heal, gainMinerals, addVespene, spendCurrency, convertMaxMineralsToVespene, useEmergencyTeleport, loadState, recordClick } = useZealot(totalEquipmentStats, isAtShop, skillTree.bonuses);
const { probeBase, isEngagedInCombat, totalTurretDps, autoRepairWall, tickProbeUpgrades, tickProbeEconomy, damageWall, stopCombat, loadCombatState, rerollIfPather, createProbeBase, advanceWallCycles } = useCombat();
const { saveToSlot, autoSave, loadFromSlot, getAllSlotMetadata, getMostRecentSlot, loadLatestGame, deleteSlot, deleteAllSlots, saveTrigger } = useSaveSystem(zealotState, slots, probeBase, skillTree.state);
const combo = useCombo();
const audio = useAudio();

// Centralized game-loop scheduler (auto-attack, fast/slow tick, autosave)
const hasGloves = computed(() => totalEquipmentStats.value.hasGloves);
const { startLoops, stopLoops } = useGameLoop({
  zealotState,
  maxHp,
  attackSpeed,
  currentDps,
  hpRegen,
  hasGloves,
  currentView,
  isEngagedInCombat,
  totalTurretDps,
  probeBase,
  autosaveEnabled,
  skillBonuses: skillTree.bonuses,
  heal,
  takeDamage,
  computeReducedDamage,
  useEmergencyTeleport,
  stopCombat,
  autoRepairWall,
  tickProbeUpgrades,
  tickProbeEconomy,
  damageWall,
  registerAutoAttackClick: () => combo.registerClick(),
  registerDamageTaken: () => combo.registerDamageTaken(),
  playSfx: (name) => audio.playSfx(name),
  performAttack,
  handleWallDestroyed,
  autoSave,
  showSaveNotification,
  handleReset,
  onEmergencyTeleport: triggerEmergencyTeleportModal,
});

// Apply skill tree combo max bonus to combo system
watch(skillTree.bonuses, (b) => {
  combo.setMaxCombo(50 + b.comboMaxBonus);
});
combo.setMaxCombo(50 + skillTree.bonuses.value.comboMaxBonus);

const showShopModal = ref(false);
const showSaveModal = ref(false);
const showLoadModal = ref(false);
const showDevTerminal = ref(false);
const showTutorial = ref(false);
const showSkillTreeModal = ref(false);
const saveNotificationText = ref('Game loaded!');
const saveNotificationIcon = ref<string>('💾');
const autoSaveNotification = ref(false);
let notificationTimeout: number | null = null;

const disablePather = ref<boolean>(localStorage.getItem(DISABLE_PATHER_KEY) === 'true');

const devScreenType = ref<'auto' | 'mobile' | 'desktop'>(
  localStorage.getItem(DEV_SCREEN_TYPE_KEY) === 'mobile'
    ? 'mobile'
    : localStorage.getItem(DEV_SCREEN_TYPE_KEY) === 'desktop'
      ? 'desktop'
      : 'auto',
);

function toggleDevScreenType(): 'mobile' | 'desktop' {
  const next = devScreenType.value === 'desktop' ? 'mobile' : 'desktop';
  devScreenType.value = next;
  localStorage.setItem(DEV_SCREEN_TYPE_KEY, next);
  return next;
}

function toggleDisablePather() {
  disablePather.value = !disablePather.value;
  localStorage.setItem(DISABLE_PATHER_KEY, String(disablePather.value));
  if (disablePather.value) {
    rerollIfPather();
  }
  showSaveNotification(disablePather.value ? 'Pather probes disabled (Reroll executed)!' : 'Pather probes enabled!');
}

const slotMetadata = computed<Record<'A' | 'B' | 'C' | 'autosave', SlotMeta>>(() => {
  void saveTrigger.value;
  return getAllSlotMetadata();
});

const mostRecentSlot = computed(() => {
  void saveTrigger.value;
  return getMostRecentSlot();
});

function showSaveNotification(text = 'Game saved!', icon = '💾') {
  saveNotificationText.value = text;
  saveNotificationIcon.value = icon;
  autoSaveNotification.value = true;
  if (notificationTimeout) clearTimeout(notificationTimeout);
  notificationTimeout = window.setTimeout(() => {
    autoSaveNotification.value = false;
  }, 3000);
}

// Blocking "Emergency Teleport" overlay: shown after every successful emergency
// teleport. The zealot can only continue by clicking the button, so a teleport
// can never be missed.
const showEmergencyTeleportModal = ref(false);

function triggerEmergencyTeleportModal() {
  showEmergencyTeleportModal.value = true;
}

function handleOpenSaveModal() {
  showSaveModal.value = true;
}

function handleOpenLoadModal() {
  showLoadModal.value = true;
}

function handleSaveSlot(slot: 'A' | 'B' | 'C') {
  saveToSlot(slot);
  audio.playSfx('save');
  showSaveModal.value = false;
  showSaveNotification(`Game saved successfully to Slot ${slot}!`);
}

function handleLoadSlot(slot: 'A' | 'B' | 'C' | 'autosave') {
  const saved = loadFromSlot(slot);
  if (saved) {
    if (saved.zealot) loadState(saved.zealot);
    if (saved.inventory) loadInventory(saved.inventory);
    if (saved.probeBase) loadCombatState(saved.probeBase);
    if (saved.skillTree) skillTree.deserialize(saved.skillTree);
    combo.resetCombo();
    showLoadModal.value = false;
    const slotName = slot === 'autosave' ? 'Autosave' : `Slot ${slot}`;
    showSaveNotification(`Game loaded from ${slotName}!`);
  } else {
    showSaveNotification(`Save slot ${slot === 'autosave' ? 'Autosave' : slot} is empty and contains no saved game.`);
  }
}

function handleDeleteSlot(slot: 'A' | 'B' | 'C' | 'autosave') {
  deleteSlot(slot);
  const slotName = slot === 'autosave' ? 'Autosave' : `Slot ${slot}`;
  showSaveNotification(`${slotName} save deleted!`);
}

function handleDeleteAllSlots() {
  deleteAllSlots();
  showSaveNotification('All saves destroyed!');
}

// Dynamic fresh game state: built purely from the default factories, so any new field
// added to ZealotStats / ProbeBase / inventory slots / skill tree is reset automatically.
function buildFreshGameState(): {
  zealot: ZealotStats;
  probeBase: ProbeBase;
  slots: InventorySlot[];
  skillTree: SkillTreeState;
} {
  return {
    zealot: createDefaultZealotState(),
    probeBase: createProbeBase(0, null),
    slots: createEmptyInventorySlots(),
    skillTree: createDefaultSkillTreeState(),
  };
}

// Captured once at app start as the reference "begin state". Resets use the same factories,
// so the reset never has to be rewritten when a new field is added to a default state.
// Reset current session without deleting save slots, keeping only the death counter.
// Everything else (zealot, probe base, inventory, shop cycle, skill tree, combo) returns
// to the values the start state was built from.
function handleReset() {
  const start = buildFreshGameState();
  zealotState.value = { ...start.zealot, deaths: zealotState.value.deaths };
  slots.value = start.slots;
  probeBase.value = start.probeBase;
  skillTree.reset();
  stopCombat(zealotState.value);
  combo.resetCombo();
  showSaveNotification('Game reset to the starting state!');
}

// Unequip item and refund full cost
function handleUnequip(slotIndex: number) {
  const item = unequipItem(slotIndex);
  if (item) {
    if (item.currency === 'vespene') {
      addVespene(item.cost);
    } else {
      gainMinerals(item.cost);
    }
    if (autosaveEnabled.value) autoSave();
    showSaveNotification(`Item ${item.name} sold for ${formatNumber(item.cost)}${item.currency === 'vespene' ? 'V' : 'M'}!`);
  }
}

// Stop turrets and open shop modal when going to shop
watch(currentView, (newView) => {
  if (newView === 'shop') {
    audio.playSfx('shopOpen');
    stopCombat(zealotState.value);
    showShopModal.value = true;
  } else {
    showShopModal.value = false;
    stopCombat(zealotState.value);
  }
});

// Full catalog of Zealot Shop items with correct Mineral/Vespene costs
const availableShopItems: Item[] = AVAILABLE_SHOP_ITEMS;

// Shop catalog scaled to the current D-rank shop cycle (x1.5 stats & costs per cycle)
// Bargain Hunter reduces all shop prices; Void Warden additionally discounts vespene items
const shopItems = computed<Item[]>(() => {
  const discount = 1 - (skillTree.bonuses.value.shopPriceReduction || 0);
  const vespeneDiscount = 1 - (skillTree.bonuses.value.vespeneItemDiscount || 0);
  return availableShopItems.map(item => {
    const scaled = scaleShopItem(item, getShopMultiplier(probeBase.value.shopCycle), getShopRankName(probeBase.value.shopCycle));
    let cost = big(scaled.cost);
    if (discount < 1) {
      cost = cost.mul(discount);
    }
    if (scaled.currency === 'vespene' && vespeneDiscount < 1) {
      cost = cost.mul(vespeneDiscount);
    }
    if (cost.lt(scaled.cost)) {
      return { ...scaled, cost: cost.floor() };
    }
    return scaled;
  });
});

// Upgrade the shop to D-rank items (free, once per completed Final Wall cycle)
function handleShopUpgrade() {
  if (probeBase.value.shopCycle >= probeBase.value.wallCycle) return;
  const newCycle = probeBase.value.wallCycle;
  probeBase.value = { ...probeBase.value, shopCycle: newCycle };
  if (autosaveEnabled.value) autoSave();
  showSaveNotification(`Shop upgraded: all items are now ${getShopRankName(newCycle)} (${getShopMultiplierLabel(newCycle)})!`);
}

// DEV Terminal action handlers
const devActions = {
  grantVespene() {
    zealotState.value.infiniteVespene = true;
    addVespene(500_000_000);
    if (autosaveEnabled.value) autoSave();
    showSaveNotification('∞ Vespene gas granted (DEV)! Infinite!');
  },
  grantXp(amount: number) {
    skillTree.grantXp(amount);
    if (autosaveEnabled.value) autoSave();
    showSaveNotification(`${amount} Zealot XP granted (DEV)!`);
  },
  hardReset() {
    const minerals = zealotState.value.minerals;
    const vespeneGas = zealotState.value.vespeneGas;
    zealotState.value = createDefaultZealotState({
      minerals,
      vespeneGas,
      infiniteVespene: zealotState.value.infiniteVespene,
    });
    probeBase.value = createProbeBase(0, null);
    stopCombat(zealotState.value);
    if (autosaveEnabled.value) autoSave();
    showSaveNotification('World reset (inventory & resources kept)!');
  },
  rankup(times: number) {
    const cycle = advanceWallCycles(times);
    probeBase.value = { ...probeBase.value, shopCycle: cycle };
    if (autosaveEnabled.value) autoSave();
    showSaveNotification(`Wall + shop upgraded to cycle ${cycle + 1} (${getShopMultiplierLabel(cycle)})!`);
  },
  switchScreenType() {
    const next = toggleDevScreenType();
    showSaveNotification(`DEV: Switched to ${next.toUpperCase()} view`);
    return next;
  },
};

// Attack execution logic — applies combo multiplier and critical hits
function performAttack() {
  if (zealotState.value.isImmobilized) return;

  let dmg = attackPower.value;
  const comboTimes = big(combo.comboMultiplier.value);
  dmg = dmg.mul(comboTimes);

  // Critical hit chance from skill tree
  const critChance = skillTree.bonuses.value.critChance;
  const isCrit = Math.random() < critChance;
  if (isCrit) {
    dmg = dmg.mul(skillTree.bonuses.value.critMultiplier);
  }

  zealotState.value.damageDone = zealotState.value.damageDone.add(dmg);
  const mineralsGained = dmg;
  gainMinerals(mineralsGained.floor());
  // Vespene Siphon: a fraction of every minerals gain is auto-harvested as vespene
  const siphon = skillTree.bonuses.value.autoVespenePercent;
  if (siphon > 0) {
    addVespene(mineralsGained.mul(siphon).floor());
  }
  audio.playSfx('wallHit');
  // Capture wall max HP + level so kill rewards (bounty % and XP) use the wall that was actually destroyed
  const wallMaxHp = probeBase.value.wall.maxHp;
  const wallLevel = probeBase.value.wall.level || 0;
  const res = damageWall(dmg, zealotState.value);
  if (res.destroyed) {
    audio.playSfx('wallDestroy');
    combo.registerWallDestroyed();
    handleWallDestroyed(wallMaxHp, wallLevel);
  }
}

// Shared kill-reward logic (XP + kill bounty + undying reset) — runs for both attack kills and reflect kills
function handleWallDestroyed(wallMaxHpAtKill: ReturnType<typeof big>, destroyedWallLevel: number) {
  // XP gain on probe/wall destruction (uses the destroyed wall's level, not the newly spawned one)
  const wallXp = 10 + destroyedWallLevel;
  const probeXp = probeBase.value.isRare ? 50 : 25;
  const bonusXp = Math.min(50, Math.floor(probeBase.value.rankIndex / 3));
  skillTree.grantXp(wallXp + probeXp + bonusXp);
  // Bounty Contract / Khaydarin Engine: minerals = % of the destroyed wall's max HP
  const bounty = skillTree.bonuses.value.killBountyPercent;
  if (bounty > 0) {
    gainMinerals(big(wallMaxHpAtKill).mul(bounty).floor());
  }
  // Vespene Tithe: a share of the destroyed wall's max HP is harvested directly as vespene
  const tithe = skillTree.bonuses.value.vespeneBountyPercent;
  if (tithe > 0) {
    addVespene(big(wallMaxHpAtKill).mul(tithe).floor());
  }
  // Reset Undying for the new probe fight
  if (zealotState.value.undyingUsedThisFight) {
    zealotState.value.undyingUsedThisFight = false;
  }
  if (autosaveEnabled.value) autoSave();
}

// User manual attack action against probe base (records click for dynamic attack speed)
function handleAttack() {
  if (zealotState.value.isImmobilized) return;
  recordClick();
  combo.registerClick();
  audio.playSfx('attack');
  performAttack();
}

// Purchase item from shop
function buyItem(item: Item, slotIndex: number) {
  if (spendCurrency(item.cost, item.currency || 'minerals')) {
    // With infinite Vespene Gas the shop may overwrite an occupied slot (slot #1) — refund the replaced item
    const existing = unequipItem(slotIndex);
    if (existing) {
      if (existing.currency === 'vespene') {
        addVespene(existing.cost);
      } else {
        gainMinerals(existing.cost);
      }
    }
    equipItem(item, slotIndex);
    audio.playSfx('shopBuy');
    if (autosaveEnabled.value) autoSave();
    showSaveNotification(`Item ${item.name} bought and equipped!`);
  }
}

function handleConvertMaxVespene() {
  if (convertMaxMineralsToVespene()) {
    if (autosaveEnabled.value) autoSave();
    showSaveNotification('Vespene gas converted and auto-saved!');
  }
}

// Invest a talent point into a skill tree node
function handleInvest(nodeId: string) {
  const node = SKILL_NODES.find(n => n.id === nodeId);
  if (!node) return;
  if (skillTree.investPoint(nodeId)) {
    const rank = skillTree.getRank(nodeId);
    audio.playSfx('shopBuy');
    if (autosaveEnabled.value) autoSave();
    showSaveNotification(`${node.name} ranked up to ${rank}/${node.maxPoints}!`);
  }
}

// TIJDELIJKE respec (evaluate before final build): refunds all invested talent points.
// Lets a player switch exclusive of/of choices without losing level/XP.
function handleRespec() {
  const refunded = skillTree.spentPoints.value;
  if (refunded <= 0) return;
  skillTree.respec();
  audio.playSfx('shopOpen');
  if (autosaveEnabled.value) autoSave();
  showSaveNotification(`RESPEC (TIJDELIJK): ${refunded} talent points refunded!`);
}

// Game loops (auto-attack, fast/slow tick, autosave) now live in useGameLoop.
// startLoops/stopLoops own the interval lifecycle (idempotent start + teardown).

function handleTutorialComplete() {
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
  showTutorial.value = false;
  startLoops();
}

function handleOpenTutorial() {
  showTutorial.value = true;
}

function handleTutorialClose() {
  showTutorial.value = false;
  // If this was a new game (loops never started), start them now to not soft-lock the player
  startLoops();
}

onMounted(() => {
  const saved = loadLatestGame();
  if (saved) {
    if (saved.zealot) loadState(saved.zealot);
    if (saved.inventory) loadInventory(saved.inventory);
    if (saved.probeBase) loadCombatState(saved.probeBase);
    if (saved.skillTree) skillTree.deserialize(saved.skillTree);
  }

  // Init audio on first user interaction (browser autoplay policy)
  const initAudioOnce = () => {
    audio.initOnInteraction();
    document.removeEventListener('click', initAudioOnce);
document.removeEventListener('keydown', initAudioOnce);
  };
  document.addEventListener('click', initAudioOnce, { once: true });
  document.addEventListener('keydown', initAudioOnce, { once: true });

  // New player detection: no save exists + tutorial never completed -> start paused with tutorial
  const tutorialCompleted = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
  if (!saved && !tutorialCompleted) {
    showTutorial.value = true;
  } else {
    startLoops();
  }
});

onUnmounted(() => {
  stopLoops();
  if (autosaveEnabled.value) {
    autoSave();
  }
  audio.stopMusic();
});
</script>

<template>
  <div
    class="min-h-[100dvh] text-cyan-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-black"
    :class="{ 'dev-mobile-view': devScreenType === 'mobile', 'dev-desktop-view': devScreenType === 'desktop' }"
  >
    <!-- Solid background layer (Protoss glow) -->
    <div class="fixed inset-0 protoss-bg" style="z-index: 0;"></div>

    <!-- Audio Equalizer Visualizer (above background, below content) -->
    <AudioVisualizer
      :active="!audio.musicMuted.value && audio.isPlaying.value && audio.visualizerEnabled.value"
      :get-frequency-data="audio.getFrequencyData"
      :quality-mode="devScreenType"
    />

    <!-- Content layer -->
    <div class="relative flex-1 flex flex-col" style="z-index: 10;" data-dev="content">

    <!-- Top Game Header -->
     <GameHeader 
       :minerals="zealotState.minerals" 
       :vespeneGas="zealotState.vespeneGas"
       :infiniteVespene="zealotState.infiniteVespene"
       :autosaveEnabled="autosaveEnabled"
       :musicVolume="audio.musicVolume.value"
       :sfxVolume="audio.sfxVolume.value"
       :musicMuted="audio.musicMuted.value"
       :sfxMuted="audio.sfxMuted.value"
       :visualizerEnabled="audio.visualizerEnabled.value"
       :currentTrackName="audio.currentTrackName.value"
       :currentTrackEmoji="audio.currentTrackEmoji.value"
       :trackPack="audio.trackPack.value"
       :talentPoints="skillTree.talentPoints.value"
       @save="handleOpenSaveModal"
       @load="handleOpenLoadModal"
       @reset="handleReset"
       @toggleAutosave="toggleAutosave"
       @toggleMusicMute="audio.toggleMusicMute"
       @toggleSfxMute="audio.toggleSfxMute"
       @setMusicVolume="audio.setMusicVolume"
       @setSfxVolume="audio.setSfxVolume"
       @nextTrack="audio.nextTrack"
       @setTrackPack="audio.setTrackPack"
       @toggleVisualizer="audio.toggleVisualizer"
       @openTutorial="handleOpenTutorial"
       @openSkillTree="showSkillTreeModal = true"
     />

    <!-- Sticky View Switcher (BATTLE / SHOP) -->
    <nav class="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-md border-b border-cyan-800/60 shadow-lg">
      <div class="max-w-7xl mx-auto flex justify-center gap-1 p-1.5 px-3 sm:px-6">
        <button
          @click="currentView = 'battle'"
          class="flex-1 sm:flex-none sm:px-6 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition-all"
          :class="currentView === 'battle' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-gray-400 hover:text-gray-200'"
          data-dev="nav-battle"
        >
          ⚔️ BATTLE AREA
        </button>
        <button
          @click="currentView = 'shop'"
          class="flex-1 sm:flex-none sm:px-6 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition-all"
          :class="currentView === 'shop' ? 'bg-amber-500 text-black font-extrabold ring-2 ring-amber-300 shadow-md scale-105' : 'text-gray-400 hover:text-gray-200'"
          data-dev="nav-shop"
        >
          🏛️ ZEALOT SHOP
        </button>
      </div>
    </nav>

    <!-- Main Content Layout: mobile = Battle (primary) > Stats > Equipment; lg = Stats | Battle | Equipment -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start" data-dev="layout-main">

      <!-- Primary Column: Battle Area or Shop Base view (first on mobile) -->
      <div class="order-1 lg:order-2 lg:col-span-1" data-dev="layout-battle">
        <div v-if="currentView === 'battle'">
          <BattleArea 
            :probeBase="probeBase"
            :attackPower="attackPower"
            :zealot-hp="zealotState.hp"
            :zealot-max-hp="maxHp"
            :isImmobilized="zealotState.isImmobilized"
            :combo-count="combo.comboCount.value"
            :combo-max="combo.comboMax.value"
            :combo-multiplier="combo.comboMultiplier.value"
            :ability-immunity-seconds="zealotState.abilityImmunityTimer"
            @attack="handleAttack"
          />
        </div>

        <div v-else class="bg-gray-900 border border-cyan-500/40 rounded-lg p-5 sm:p-6 text-center shadow-xl">
          <h2 class="text-xl sm:text-2xl font-bold text-amber-400 mb-2">ZEALOT SHOPPING AREA</h2>
          <p class="text-xs sm:text-sm text-gray-400 mb-6">
            You are at the Zealot Shop Base. Your HP is rapidly regenerating (+2,048,000 HP/s Final Regen). Turrets have ceased fire.
          </p>
          <button 
            @click="showShopModal = true"
            class="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-4 sm:py-3 rounded-lg shadow-lg shadow-amber-600/30 transition-all text-sm tracking-wider"
          >
            OPEN ZEALOT SHOP ({{ shopItems.length }} Items Available)
          </button>
        </div>
      </div>

      <!-- Left Column (desktop): Zealot Stats -->
      <div class="order-2 lg:order-1 lg:col-span-1 space-y-4 sm:space-y-6" data-dev="layout-stats">
        <ZealotStatsComponent 
          :zealot="zealotState"
          :attackPower="attackPower"
          :attackSpeed="attackSpeed"
          :currentDps="currentDps"
          :defense="defense"
          :hpRegen="hpRegen"
          :equipmentStats="totalEquipmentStats"
          :bonuses="skillTree.bonuses.value"
        />

        <div class="bg-gray-900 border border-cyan-500/40 rounded-lg p-3">
          <div class="relative">
            <button
              @click="showSkillTreeModal = true"
              class="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-lg shadow-lg shadow-amber-900/30 transition-all text-sm tracking-wider flex items-center justify-center gap-2"
            >
              ⚡ OPEN SKILL TREE
            </button>
            <span
              v-if="skillTree.talentPoints.value > 0"
              class="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-amber-400 border border-amber-200 text-black text-xs font-black flex items-center justify-center shadow-lg shadow-amber-500/50 skill-btn-point-pulse"
              title="Talent points available"
            >
              ✦{{ skillTree.talentPoints.value }}
            </span>
          </div>
          <ZealotXpBar
            :level="skillTree.level.value"
            :xp-into-level="skillTree.xpIntoLevel.value"
            :xp-for-next="skillTree.xpForNext.value"
            :talent-points="skillTree.talentPoints.value"
          />
        </div>
      </div>

      <!-- Right Column (desktop): Equipment Grid (6 Flexible Slots) -->
      <div class="order-3 lg:order-3 lg:col-span-1" data-dev="layout-equipment">
        <InventoryGrid :slots="slots" @unequip="handleUnequip" />
      </div>

    </main>

    <!-- Skill Tree Modal Overlay -->
    <SkillTreeModal
      v-if="showSkillTreeModal"
      :level="skillTree.level.value"
      :xp-into-level="skillTree.xpIntoLevel.value"
      :xp-for-next="skillTree.xpForNext.value"
      :talent-points="skillTree.talentPoints.value"
      :ranks="skillTree.ranks.value"
      @invest="handleInvest"
      @respec="handleRespec"
      @close="showSkillTreeModal = false"
    />

    <!-- Shop Modal Overlay -->
    <ShopModal 
      v-if="showShopModal"
      :minerals="zealotState.minerals"
      :vespeneGas="zealotState.vespeneGas"
      :infiniteVespene="zealotState.infiniteVespene"
      :availableItems="shopItems"
      :slots="slots"
      :shopCycle="probeBase.shopCycle"
      :wallCycle="probeBase.wallCycle"
      @buyItem="buyItem"
      @unequip="handleUnequip"
      @convertMaxVespene="handleConvertMaxVespene"
      @upgradeShop="handleShopUpgrade"
      @close="showShopModal = false"
    />

    <!-- Save Modal Overlay (Slots A, B, C) -->
    <SaveModal 
      v-if="showSaveModal"
      :slotMetadata="slotMetadata"
      @saveSlot="handleSaveSlot"
      @deleteSlot="handleDeleteSlot"
      @deleteAllSlots="handleDeleteAllSlots"
      @close="showSaveModal = false"
    />

    <!-- Load Modal Overlay (Slots A, B, C, Autosave + Most Recent indicator) -->
    <LoadModal 
      v-if="showLoadModal"
      :slotMetadata="slotMetadata"
      :mostRecentSlot="mostRecentSlot"
      @loadSlot="handleLoadSlot"
      @deleteSlot="handleDeleteSlot"
      @deleteAllSlots="handleDeleteAllSlots"
      @close="showLoadModal = false"
    />

    <!-- Tutorial Overlay (first-time players & reopened via header Help button) -->
    <TutorialOverlay
      v-if="showTutorial"
      @complete="handleTutorialComplete"
      @close="handleTutorialClose"
    />
    </div> <!-- end content layer -->

    <!-- TEMPORARY DISABLE PATHER (Toggle button, bottom right) -->
    <button 
      @click="toggleDisablePather"
      class="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 sm:right-4 text-xs font-bold px-3 py-2 rounded-lg shadow-2xl border z-50 flex items-center space-x-1.5 cursor-pointer transition-all"
      :class="disablePather ? 'bg-red-950 text-red-200 border-red-500 shadow-red-500/30' : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'"
      title="Toggle disable Pather probes (Rerolls if active)"
    >
      <span>🐍</span>
      <span>PATHER: {{ disablePather ? 'OFF (Reroll)' : 'ON' }}</span>
    </button>

    <!-- DEV Tools Terminal (Toggle button, bottom left) -->
    <button
      @click="showDevTerminal = !showDevTerminal"
      class="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 sm:left-4 text-xs font-bold px-3 py-2 rounded-lg shadow-2xl border z-50 flex items-center space-x-1.5 cursor-pointer transition-all bg-black text-green-400 border-green-700 hover:bg-gray-900"
      title="DEV Tools (secret terminal)"
    >
      <span>⚙️</span>
      <span>DEV Tools</span>
    </button>

    <DevTerminal
      v-if="showDevTerminal"
      :actions="devActions"
      @close="showDevTerminal = false"
    />

    <!-- In-Game Notification Popup (non-blocking, stays inside the game layout so it never breaks mobile) -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 scale-95 translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-1"
    >
      <div v-if="autoSaveNotification" class="fixed top-[calc(env(safe-area-inset-top)+8rem)] left-1/2 -translate-x-1/2 z-40 pointer-events-none w-auto max-w-[min(92vw,30rem)] bg-gray-950/90 backdrop-blur-md border border-cyan-400/60 px-4 py-2.5 rounded-xl shadow-2xl shadow-cyan-900/40 ring-1 ring-cyan-400/30 flex items-center gap-2.5">
        <span class="text-sm shrink-0">{{ saveNotificationIcon }}</span>
        <span class="text-cyan-100 font-bold text-xs sm:text-sm leading-snug text-center">{{ saveNotificationText }}</span>
      </div>
    </Transition>

    <!-- Blocking Emergency Teleport Overlay: requires a click before the zealot can continue -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="showEmergencyTeleportModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm emergency-teleport-flash">
        <div class="bg-gray-900 border-2 border-amber-400/80 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-amber-500/20 max-w-md w-full">
          <div class="text-5xl sm:text-6xl mb-2">🛸</div>
          <h2 class="text-2xl sm:text-3xl font-black text-amber-400 tracking-wide mb-2">EMERGENCY TELEPORT</h2>
          <p class="text-sm text-gray-300 mb-1">The damage was too heavy — you warped back to the Zealot Shop.</p>
          <p class="text-sm text-cyan-200 mb-6">
            Emergency teleports remaining:
            <span class="font-black text-amber-300 text-lg">{{ zealotState.emergencyTeleports }}</span>
          </p>
          <button
            @click="showEmergencyTeleportModal = false"
            class="w-full bg-amber-500 hover:bg-amber-400 text-black font-black px-6 py-3.5 rounded-xl shadow-lg shadow-amber-600/40 transition-all text-lg tracking-widest cursor-pointer"
          >
            CONTINUE
          </button>
          <p class="text-[11px] text-gray-500 mt-3">You are safe at the shop with {{ zealotState.damageImmunityTimer }}s of damage immunity.</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.skill-btn-point-pulse {
  animation: skill-btn-glow 1.6s ease-in-out infinite;
}

@keyframes skill-btn-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
  50% {
    box-shadow: 0 0 14px 2px rgba(245, 158, 11, 0.55);
  }
}

.emergency-teleport-flash {
  animation: emergency-teleport-flash 1.4s ease-out;
}

@keyframes emergency-teleport-flash {
  0% {
    box-shadow: inset 0 0 0 0 rgba(251, 191, 36, 0);
  }
  30% {
    box-shadow: inset 0 0 140px 50px rgba(251, 191, 36, 0.35);
  }
  100% {
    box-shadow: inset 0 0 0 0 rgba(251, 191, 36, 0);
  }
}
</style>

