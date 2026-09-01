<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useZealot } from '../composables/useZealot';
import { useCombat } from '../composables/useCombat';
import { useSaveSystem } from '../composables/useSaveSystem';
import { Item } from '../types/Item';

import GameHeader from '../Components/GameHeader.vue';
import ZealotStatsComponent from '../Components/ZealotStatsComponent.vue';
import InventoryGrid from '../Components/InventoryGrid.vue';
import BattleArea from '../Components/BattleArea.vue';
import ShopModal from '../Components/ShopModal.vue';

const currentView = ref<'battle' | 'shop'>('battle');
const isAtShop = computed(() => currentView.value === 'shop');

// Composables setup
const { slots, totalEquipmentStats, equipItem, unequipItem, loadInventory } = useInventory();
const { state: zealotState, maxHp, attackPower, attackSpeed, defense, hpRegen, takeDamage, heal, gainMinerals, spendCurrency, convertMaxMineralsToVespene, useEmergencyTeleport, loadState, recordClick } = useZealot(totalEquipmentStats, isAtShop);
const { probeBase, isEngagedInCombat, totalTurretDps, autoRepairWall, tickProbeUpgrades, damageWall, stopCombat, loadCombatState } = useCombat();
const { saveGame, loadGame, resetGame } = useSaveSystem(zealotState, slots, probeBase);

const showShopModal = ref(false);
const autoSaveNotification = ref(false);
let notificationTimeout: number | null = null;

function showSaveNotification() {
  autoSaveNotification.value = true;
  if (notificationTimeout) clearTimeout(notificationTimeout);
  notificationTimeout = window.setTimeout(() => {
    autoSaveNotification.value = false;
  }, 3000);
}

function handleManualSave() {
  saveGame();
  showSaveNotification();
}

// Stop turrets and open shop modal when going to shop
watch(currentView, (newView) => {
  if (newView === 'shop') {
    stopCombat();
    showShopModal.value = true;
  } else {
    showShopModal.value = false;
  }
});

// Real-time persistence watchers
watch(probeBase, () => {
  saveGame();
}, { deep: true });

watch(zealotState, () => {
  saveGame();
}, { deep: true });

watch(slots, () => {
  saveGame();
}, { deep: true });

// Full catalog of Zealot Shop items with correct Mineral/Vespene costs
const availableShopItems: Item[] = [
  // --- BLADES ---
  { id: 'b_copper', name: 'Copper blade', category: 'blades', rarity: 'common', stats: { damage: 2 }, cost: 100, currency: 'minerals', description: '100M | +2 Damage' },
  { id: 'b_iron', name: 'Iron blade', category: 'blades', rarity: 'common', stats: { damage: 4 }, cost: 200, currency: 'minerals', description: '200M | +4 Damage' },
  { id: 'b_steel', name: 'Steel blade', category: 'blades', rarity: 'common', stats: { damage: 8 }, cost: 400, currency: 'minerals', description: '400M | +8 Damage' },
  { id: 'b_silver', name: 'Silver blade', category: 'blades', rarity: 'rare', stats: { damage: 16 }, cost: 800, currency: 'minerals', description: '800M | +16 Damage' },
  { id: 'b_golden', name: 'Golden blade', category: 'blades', rarity: 'rare', stats: { damage: 32 }, cost: 1600, currency: 'minerals', description: '1600M | +32 Damage' },
  { id: 'b_platinum', name: 'Platinum blade', category: 'blades', rarity: 'epic', stats: { damage: 64 }, cost: 3200, currency: 'minerals', description: '3200M | +64 Damage' },
  { id: 'b_mithril', name: 'Mithril blade', category: 'blades', rarity: 'epic', stats: { damage: 128 }, cost: 6400, currency: 'minerals', description: '6400M | +128 Damage' },
  { id: 'b_diamond', name: 'Diamond blade', category: 'blades', rarity: 'legendary', stats: { damage: 256 }, cost: 12800, currency: 'minerals', description: '12800M | +256 Damage' },
  { id: 'b_energizer', name: 'Energizer blade', category: 'blades', rarity: 'legendary', stats: { damage: 1280 }, cost: 1, currency: 'vespene', description: '1V | +1280 Damage (Max Glove Effect Built-in)' },
  { id: 'b_pulverizer', name: 'Pulverizer blade', category: 'blades', rarity: 'legendary', stats: { damage: 2560 }, cost: 2, currency: 'vespene', description: '2V | +2560 Damage (Max Glove Effect Built-in)' },
  { id: 'b_atomizer', name: 'Atomizer blade', category: 'blades', rarity: 'legendary', stats: { damage: 10240 }, cost: 8, currency: 'vespene', description: '8V | +10240 Damage (Max Glove Effect Built-in)' },
  { id: 'b_ultimate', name: 'Ultimate blade', category: 'blades', rarity: 'legendary', stats: { damage: 40960 }, cost: 32, currency: 'vespene', description: '32V | +40960 Damage (Max Glove Effect Built-in)' },
  { id: 'b_plutonium', name: 'Plutonium blade', category: 'blades', rarity: 'legendary', stats: { damage: 61440 }, cost: 160, currency: 'vespene', description: '160V | +61440 Damage (Max Glove Effect Built-in)' },
  { id: 'b_radiant', name: 'Radiant blade', category: 'blades', rarity: 'legendary', stats: { damage: 81920 }, cost: 512, currency: 'vespene', description: '512V | +81920 Damage (Max Glove Effect Built-in)' },

  // --- GLOVES (Attack Speed) ---
  { id: 'g_cloth', name: 'Cloth gloves', category: 'gloves', rarity: 'common', stats: { attackSpeed: 0.2 }, cost: 100, currency: 'minerals', description: '100M | +20% Attack Speed' },
  { id: 'g_leather', name: 'Leather gloves', category: 'gloves', rarity: 'common', stats: { attackSpeed: 0.4 }, cost: 200, currency: 'minerals', description: '200M | +40% Attack Speed' },
  { id: 'g_hide', name: 'Reinforced Hide gloves', category: 'gloves', rarity: 'common', stats: { attackSpeed: 0.8 }, cost: 400, currency: 'minerals', description: '400M | +80% Attack Speed' },
  { id: 'g_scale', name: 'Scale gloves', category: 'gloves', rarity: 'rare', stats: { attackSpeed: 1.0 }, cost: 800, currency: 'minerals', description: '800M | +100% Attack Speed' },
  { id: 'g_bone', name: 'Bone gloves', category: 'gloves', rarity: 'rare', stats: { attackSpeed: 1.5 }, cost: 1600, currency: 'minerals', description: '1600M | +150% Attack Speed' },
  { id: 'g_electronic', name: 'Electronic gloves', category: 'gloves', rarity: 'epic', stats: { attackSpeed: 2.0 }, cost: 3200, currency: 'minerals', description: '3200M | +200% Attack Speed' },
  { id: 'g_mega', name: 'Mega gloves', category: 'gloves', rarity: 'epic', stats: { attackSpeed: 3.0 }, cost: 6400, currency: 'minerals', description: '6400M | +300% Attack Speed' },
  { id: 'g_super', name: 'Super gloves', category: 'gloves', rarity: 'legendary', stats: { attackSpeed: 4.0 }, cost: 12800, currency: 'minerals', description: '12800M | +400% Attack Speed' },

  // --- ARMOR (Damage Reduction) ---
  { id: 'ar_wood', name: 'Wooden armor', category: 'armor', rarity: 'common', stats: { defenseReduction: 0.09 }, cost: 100, currency: 'minerals', description: '100M | 9% Damage Reduction' },
  { id: 'ar_rwood', name: 'Reinforced Wooden armor', category: 'armor', rarity: 'common', stats: { defenseReduction: 0.18 }, cost: 200, currency: 'minerals', description: '200M | 18% Damage Reduction' },
  { id: 'ar_iron', name: 'Iron armor', category: 'armor', rarity: 'common', stats: { defenseReduction: 0.27 }, cost: 400, currency: 'minerals', description: '400M | 27% Damage Reduction' },
  { id: 'ar_steel', name: 'Steel armor', category: 'armor', rarity: 'rare', stats: { defenseReduction: 0.36 }, cost: 800, currency: 'minerals', description: '800M | 36% Damage Reduction' },
  { id: 'ar_silver', name: 'Silver armor', category: 'armor', rarity: 'rare', stats: { defenseReduction: 0.45 }, cost: 1600, currency: 'minerals', description: '1600M | 45% Damage Reduction' },
  { id: 'ar_gold', name: 'Gold armor', category: 'armor', rarity: 'epic', stats: { defenseReduction: 0.54 }, cost: 3200, currency: 'minerals', description: '3200M | 54% Damage Reduction' },
  { id: 'ar_plat', name: 'Platinum armor', category: 'armor', rarity: 'epic', stats: { defenseReduction: 0.63 }, cost: 6400, currency: 'minerals', description: '6400M | 63% Damage Reduction' },
  { id: 'ar_titanium', name: 'Titanium armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.72 }, cost: 12800, currency: 'minerals', description: '12800M | 72% Damage Reduction' },
  { id: 'ar_chromite', name: 'Chromite armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.92 }, cost: 1, currency: 'vespene', description: '1V | 92% Damage Reduction' },
  { id: 'ar_pyrite', name: 'Pyrite armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.96 }, cost: 2, currency: 'vespene', description: '2V | 96% Damage Reduction' },
  { id: 'ar_tungsten', name: 'Tungsten armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.98 }, cost: 8, currency: 'vespene', description: '8V | 98% Damage Reduction' },
  { id: 'ar_nano', name: 'Nanocrystalline Diamond armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.99 }, cost: 32, currency: 'vespene', description: '32V | 99% Damage Reduction' },
  { id: 'ar_uranium', name: 'Uranium armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.995 }, cost: 160, currency: 'vespene', description: '160V | 99.5% Damage Reduction' },
  { id: 'ar_rubidium', name: 'Rubidium armor', category: 'armor', rarity: 'legendary', stats: { defenseReduction: 0.9975 }, cost: 512, currency: 'vespene', description: '512V | 99.75% Damage Reduction' },

  // --- AMULETS (Health) ---
  { id: 'am_zircon', name: 'Zircon Amulet', category: 'amulet', rarity: 'common', stats: { hp: 250 }, cost: 100, currency: 'minerals', description: '100M | +250 Health' },
  { id: 'am_amethyst', name: 'Amethyst Amulet', category: 'amulet', rarity: 'common', stats: { hp: 500 }, cost: 200, currency: 'minerals', description: '200M | +500 Health' },
  { id: 'am_topaz', name: 'Topaz Amulet', category: 'amulet', rarity: 'common', stats: { hp: 1000 }, cost: 400, currency: 'minerals', description: '400M | +1000 Health' },
  { id: 'am_spinel', name: 'Spinel Amulet', category: 'amulet', rarity: 'rare', stats: { hp: 2000 }, cost: 800, currency: 'minerals', description: '800M | +2000 Health' },
  { id: 'am_sapphire', name: 'Sapphire Amulet', category: 'amulet', rarity: 'rare', stats: { hp: 4000 }, cost: 1600, currency: 'minerals', description: '1600M | +4000 Health' },
  { id: 'am_emerald', name: 'Emerald Amulet', category: 'amulet', rarity: 'epic', stats: { hp: 8000 }, cost: 3200, currency: 'minerals', description: '3200M | +8000 Health' },
  { id: 'am_ruby', name: 'Ruby Amulet', category: 'amulet', rarity: 'epic', stats: { hp: 16000 }, cost: 6400, currency: 'minerals', description: '6400M | +16000 Health' },
  { id: 'am_corundum', name: 'Corundum Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 32000 }, cost: 12800, currency: 'minerals', description: '12800M | +32000 Health' },
  { id: 'am_titanium', name: 'Titanium Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 160000 }, cost: 1, currency: 'vespene', description: '1V | +160000 Health' },
  { id: 'am_obsidian', name: 'Obsidian Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 320000 }, cost: 2, currency: 'vespene', description: '2V | +320000 Health' },
  { id: 'am_diamond', name: 'Diamond Amulet', category: 'amulet', rarity: 'legendary', stats: { hp: 471000 }, cost: 8, currency: 'vespene', description: '8V | +471000 Health' },

  // --- POTIONS / TRINKETS (Health Regeneration) ---
  { id: 'p_minor', name: 'Minor regeneration potion', category: 'trinket', rarity: 'common', stats: { hpRegen: 6 }, cost: 100, currency: 'minerals', description: '100M | +6/s HP Regen' },
  { id: 'p_lesser', name: 'Lesser regeneration potion', category: 'trinket', rarity: 'common', stats: { hpRegen: 12 }, cost: 200, currency: 'minerals', description: '200M | +12/s HP Regen' },
  { id: 'p_common', name: 'Common regeneration potion', category: 'trinket', rarity: 'common', stats: { hpRegen: 24 }, cost: 400, currency: 'minerals', description: '400M | +24/s HP Regen' },
  { id: 'p_greater', name: 'Greater regeneration potion', category: 'trinket', rarity: 'rare', stats: { hpRegen: 48 }, cost: 800, currency: 'minerals', description: '800M | +48/s HP Regen' },
  { id: 'p_superior', name: 'Superior regeneration potion', category: 'trinket', rarity: 'rare', stats: { hpRegen: 96 }, cost: 1600, currency: 'minerals', description: '1600M | +96/s HP Regen' },
  { id: 'p_major', name: 'Major regeneration potion', category: 'trinket', rarity: 'epic', stats: { hpRegen: 192 }, cost: 3200, currency: 'minerals', description: '3200M | +192/s HP Regen' },
  { id: 'p_ultra', name: 'Ultra regeneration potion', category: 'trinket', rarity: 'epic', stats: { hpRegen: 384 }, cost: 6400, currency: 'minerals', description: '6400M | +384/s HP Regen' },
  { id: 'p_extreme', name: 'Extreme regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 768 }, cost: 12800, currency: 'minerals', description: '12800M | +768/s HP Regen' },
  { id: 'p_mega', name: 'Mega regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 3840 }, cost: 1, currency: 'vespene', description: '1V | +3840/s HP Regen' },
  { id: 'p_eternal', name: 'Eternal regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 7680 }, cost: 2, currency: 'vespene', description: '2V | +7680/s HP Regen' },
  { id: 'p_ultimate', name: 'Ultimate regeneration potion', category: 'trinket', rarity: 'legendary', stats: { hpRegen: 20480 }, cost: 8, currency: 'vespene', description: '8V | +20480/s HP Regen' },

  // --- FINAL ITEMS ---
  { id: 'b_final', name: 'Final blade', category: 'final', rarity: 'legendary', stats: { damage: 819200, attackSpeed: 40.0 }, cost: 1596, currency: 'vespene', description: '1596V | +819,200 Damage & +4000% Attack Speed (Final Tier)' },
  { id: 'p_final', name: 'Final regeneration', category: 'final', rarity: 'legendary', stats: { hpRegen: 2048000 }, cost: 512, currency: 'vespene', description: '512V | +2,048,000/s HP Regen (Final Tier)' },
];

// Attack execution logic
function performAttack() {
  const dmg = attackPower.value;
  gainMinerals(Math.floor(dmg));
  const res = damageWall(dmg);
  if (res.destroyed) {
    saveGame();
  }
}

// User manual attack action against probe base (records click for dynamic attack speed)
function handleAttack() {
  recordClick();
  performAttack();
}

// Purchase item from shop
function buyItem(item: Item, slotIndex: number) {
  if (spendCurrency(item.cost, item.currency || 'minerals')) {
    equipItem(item, slotIndex);
    saveGame();
  }
}

function handleConvertMaxVespene() {
  if (convertMaxMineralsToVespene()) {
    saveGame();
    showSaveNotification();
  }
}

// Game tick loop (Regen, Turret Damage, Auto-Save, Auto-Attack)
let tickInterval: number | null = null;
let saveInterval: number | null = null;
let autoAttackInterval: number | null = null;

onMounted(() => {
  const saved = loadGame();
  if (saved) {
    if (saved.zealot) loadState(saved.zealot);
    if (saved.inventory) loadInventory(saved.inventory);
    if (saved.probeBase) loadCombatState(saved.probeBase);
  }

  // Reliable Auto-Attack Interval when gloves / vespene blade equipped
  let lastAtkTime = Date.now();
  autoAttackInterval = window.setInterval(() => {
    if (totalEquipmentStats.value.hasGloves && currentView.value === 'battle') {
      const now = Date.now();
      const interval = 1000 / Math.max(0.1, attackSpeed.value);
      if (now - lastAtkTime >= interval) {
        performAttack();
        lastAtkTime = now;
      }
    }
  }, 25);

  tickInterval = window.setInterval(() => {
    // Probe Auto Repair every second (25% max HP/s) regardless of location
    autoRepairWall();

    // Probe Defense Upgrade timer tick
    const upgraded = tickProbeUpgrades();
    if (upgraded) {
      saveGame();
    }

    // HP Regeneration
    if (hpRegen.value > 0 && zealotState.value.hp < maxHp.value) {
      heal(hpRegen.value);
    }
    // Turret Damage if engaged in combat
    if (isEngagedInCombat.value && currentView.value === 'battle') {
      if (totalTurretDps.value > 0) {
        takeDamage(totalTurretDps.value);
        if (zealotState.value.hp <= 0) {
          // Check emergency teleport
          const teleported = useEmergencyTeleport();
          if (teleported) {
            stopCombat();
            currentView.value = 'shop';
            alert(`⚠️ EMERGENCY TELEPORT ACTIVATED! (${zealotState.value.emergencyTeleports} remaining) You warped back to the Zealot Shop!`);
          } else {
            // Permadeath!
            stopCombat();
            alert('💀 ZEALOT HAS FALLEN IN BATTLE! Emergency teleports depleted. Permadeath reached. Restarting game...');
            resetGame();
          }
        }
      }
    }
  }, 1000);

  saveInterval = window.setInterval(() => {
    saveGame();
    showSaveNotification();
  }, 120000);
});

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval);
  if (saveInterval) clearInterval(saveInterval);
  if (autoAttackInterval) clearInterval(autoAttackInterval);
  saveGame();
});
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-cyan-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-black">
    <!-- Top Game Header -->
    <GameHeader 
      :minerals="zealotState.minerals" 
      :vespeneGas="zealotState.vespeneGas"
      v-model:currentView="currentView"
      @save="handleManualSave"
      @reset="resetGame"
    />

    <!-- Main Content Layout: Left (Stats), Center (Battle/Shop), Right (Equipment 6 flexible slots) -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      <!-- Left Column: Zealot Stats -->
      <div class="space-y-6 lg:col-span-1">
        <ZealotStatsComponent 
          :zealot="zealotState"
          :maxHp="maxHp"
          :attackPower="attackPower"
          :attackSpeed="attackSpeed"
          :defense="defense"
          :hpRegen="hpRegen"
          :equipmentStats="totalEquipmentStats"
        />
      </div>

      <!-- Center Column: Battle Area or Shop Base view -->
      <div class="lg:col-span-1">
        <div v-if="currentView === 'battle'">
          <BattleArea 
            :probeBase="probeBase"
            :attackPower="attackPower"
            @attack="handleAttack"
          />
        </div>

        <div v-else class="bg-gray-900 border border-cyan-500/40 rounded-lg p-6 text-center shadow-xl">
          <h2 class="text-2xl font-bold text-amber-400 mb-2">ZEALOT SHOPPING AREA</h2>
          <p class="text-sm text-gray-400 mb-6">
            You are at the Zealot Shop Base. Your shields/HP are rapidly regenerating (+2,048,000 HP/s Final Regen). Turrets have ceased fire.
          </p>
          <button 
            @click="showShopModal = true"
            class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-3 rounded-lg shadow-lg shadow-amber-600/30 transition-all text-sm tracking-wider"
          >
            OPEN ZEALOT SHOP ({{ availableShopItems.length }} Items Available)
          </button>
        </div>
      </div>

      <!-- Right Column: Equipment Grid (6 Flexible Slots) -->
      <div class="lg:col-span-1">
        <InventoryGrid :slots="slots" @unequip="(idx) => { unequipItem(idx); saveGame(); }" />
      </div>

    </main>

    <!-- Shop Modal Overlay -->
    <ShopModal 
      v-if="showShopModal"
      :minerals="zealotState.minerals"
      :vespeneGas="zealotState.vespeneGas"
      :availableItems="availableShopItems"
      @buyItem="buyItem"
      @convertMaxVespene="handleConvertMaxVespene"
      @close="showShopModal = false"
    />

    <!-- Auto-save / Manual save Notification Toast -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="autoSaveNotification" class="fixed bottom-4 right-4 bg-cyan-900/90 border border-cyan-400 text-cyan-200 px-4 py-2.5 rounded-lg shadow-2xl text-xs font-bold z-50 flex items-center space-x-2 backdrop-blur-sm">
        <span class="text-sm">💾</span>
        <span>Game saved successfully! (Auto-saves every 2 minutes)</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
</style>
