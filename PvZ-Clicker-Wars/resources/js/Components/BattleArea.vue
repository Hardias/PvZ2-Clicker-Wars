<script setup lang="ts">
import { computed } from 'vue';
import { ProbeBase } from '../types/ProbeBase';
import { formatNumber } from '../utils/format';
import { getRankName, isSsRank, ssLevel, getRankTier, TierId } from '../utils/ranks';
import { BigNum } from '../utils/bigNumber';
import ComboCounter from './ComboCounter.vue';
import AbilityImmunityIndicator from './AbilityImmunityIndicator.vue';

interface Props {
  probeBase: ProbeBase;
  attackPower: BigNum;
  isImmobilized?: boolean;
  comboCount?: number;
  comboMax?: number;
  comboMultiplier?: number;
  abilityImmunitySeconds?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'attack'): void;
}>();

const isSs = computed(() => isSsRank(props.probeBase.rankIndex));

/** The probe's current milestone tier (SS and beyond). */
const tierId = computed<TierId | null>(() => {
  if (!isSs.value) return null;
  return getRankTier(ssLevel(props.probeBase.rankIndex));
});

// Per-tier visual style (aura = arena border, banner = special-probe strip, label = mechanic)
const TIER_STYLES: Record<TierId, { aura: string; header: string; banner: string; label: string; mechanic: string }> = {
  SS: {
    aura: 'border-amber-400/80 shadow-amber-950/50',
    header: 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]',
    banner: 'from-amber-950 via-yellow-950 to-amber-950 border-amber-400/70 text-amber-200',
    label: 'SS ELITE PROBE',
    mechanic: 'GOLDEN AURA (wall regen)',
  },
  SSS: {
    aura: 'border-purple-500/80 shadow-purple-950/50',
    header: 'text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]',
    banner: 'from-purple-950 via-fuchsia-950 to-purple-950 border-purple-400/70 text-purple-200',
    label: 'SSS ELITE PROBE',
    mechanic: 'NOVA VOLLEY (turret burst)',
  },
  X: {
    aura: 'border-red-500/80 shadow-red-950/50',
    header: 'text-red-300 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]',
    banner: 'from-red-950 via-rose-950 to-red-950 border-red-500/70 text-red-200',
    label: 'X ELITE PROBE',
    mechanic: 'OVERDRIVE (turret ramp)',
  },
  XD: {
    aura: 'border-orange-400/80 shadow-orange-950/50',
    header: 'text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]',
    banner: 'from-orange-950 via-amber-950 to-orange-950 border-orange-400/70 text-orange-200',
    label: 'XD ELITE PROBE',
    mechanic: 'PHASE WALLS (periodic invulnerability)',
  },
  XRD: {
    aura: 'border-cyan-400/80 shadow-cyan-950/50',
    header: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]',
    banner: 'from-cyan-950 via-sky-950 to-cyan-950 border-cyan-400/70 text-cyan-200',
    label: 'XRD ELITE PROBE',
    mechanic: 'REALITY DRIFT (wall resurrection)',
  },
  XRFD: {
    aura: 'border-white/80 shadow-gray-950/50',
    header: 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]',
    banner: 'from-gray-950 via-fuchsia-900/30 to-gray-950 border-white/70 text-white',
    label: 'THE FINAL — XRFD',
    mechanic: 'FINAL APEX (all powers active)',
  },
};

const tierHeaderClass = computed(() => (tierId.value ? TIER_STYLES[tierId.value].header : ''));
const tierAuraClass = computed(() => (tierId.value ? TIER_STYLES[tierId.value].aura : ''));
const tierBannerClass = computed(() => (tierId.value ? TIER_STYLES[tierId.value].banner : ''));
const tierLabel = computed(() => (tierId.value ? TIER_STYLES[tierId.value].label : ''));
const tierMechanic = computed(() => (tierId.value ? TIER_STYLES[tierId.value].mechanic : ''));

/** Live status of active tier mechanics (Nova Volley window / Phase Wall invulnerability / Overdrive ramp). */
const tierMechanicStatus = computed(() => {
  const base = props.probeBase;
  const parts: string[] = [];
  if ((base.novaVolleyTimer ?? 0) > 0) {
    parts.push(`🔥 NOVA VOLLEY ACTIVE (${formatTimer(base.novaVolleyTimer ?? 0)})`);
  }
  if ((base.wallPhaseInvuln ?? 0) > 0) {
    parts.push(`⛅ PHASE WALLS INVULNERABLE (${formatTimer(base.wallPhaseInvuln ?? 0)})`);
  }
  if ((base.overdriveLevel ?? 0) > 0) {
    const pct = Math.round((base.overdriveLevel || 0) * 15);
    parts.push(`⚙️ OVERDRIVE +${pct}%`);
  }
  return parts.join(' · ');
});

const wallHpPercentage = computed(() => {
  const wall = props.probeBase.wall;
  if (wall.maxHp.lte(0)) return 0;
  const pct = wall.currentHp.div(wall.maxHp).mul(100);
  return Math.min(100, Math.max(0, Number(pct.toNumber())));
});

const upgradeProgressPercentage = computed(() => {
  const base = props.probeBase;
  if (!base.maxUpgradeTime || base.maxUpgradeTime <= 0) return 0;
  return Math.min(100, Math.max(0, ((base.maxUpgradeTime - base.timeUntilUpgrade) / base.maxUpgradeTime) * 100));
});

const wallCycleName = computed(() => getRankName(props.probeBase.wallCycle || 0));

// From Wall Lv 1 (D- Rank) onwards the wall's rank is visible on the wall itself, following the probe rank ladder
const wallDisplayName = computed(() => {
  const base = props.probeBase;
  if (base.rareType === 'pather') {
    return `Pather Wall (${base.patherWallsRemaining || 0}/50)`;
  }
  const rank = `${wallCycleName.value} Rank`;
  const tier = base.wall.tier;
  switch (tier) {
    case 'wall': return `${rank} Wall`;
    case 'ultra': return `${rank} Ultra Wall`;
    case 'mega': return `${rank} Mega Wall`;
    case 'power': return `${rank} Power Wall`;
    case 'final': return `${rank} Final Wall`;
    default: return `${rank} Wall`;
  }
});

const rareProbeLabel = computed(() => {
  const t = props.probeBase.rareType;
  switch (t) {
    case 'doubleBaser': return '✨ Double Baser (2x Stats)';
    case 'goldBaser': return '🌟 Gold Baser (Double Turrets)';
    case 'pather': return '🐍 Pather (50 Walls & Void Traps)';
    case 'tripleBaser': return '💥 Triple Baser (3x Stats)';
    case 'trainingProbe': return '🎯 Training Probe (Void Reflexes)';
    default: return '';
  }
});

const abilityName = computed(() => {
  return props.probeBase.ability === 'chrono' ? 'Chrono Boost' : 'Void Prism';
});

const abilityDescription = computed(() => {
  if (props.probeBase.rareType === 'trainingProbe') {
    return 'Training Void Prism (Active reflexes)';
  }
  if (props.probeBase.ability === 'chrono') {
    return '20% faster upgrade timer (10s duration, 40s cooldown)';
  }
  return 'Immobilizes Zealot for 4s (45s cooldown)';
});

function formatTimer(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}s`;
  }
  return String(rounded).replace('.', ',') + 's';
}
</script>

<template>
  <div class="bg-gray-900 border border-cyan-500/40 rounded-lg p-4 sm:p-6 text-cyan-100 shadow-xl shadow-cyan-950/60 flex flex-col items-center justify-between min-h-[360px] sm:min-h-[420px]">
    <!-- Header / Probe Rank & Kills info -->
    <div class="flex justify-between items-center border-b border-cyan-800/50 pb-3 gap-2">
      <div class="min-w-0">
        <span class="text-[10px] sm:text-xs text-gray-400">DEFENDING PROBE</span>
        <h3
          class="text-lg sm:text-xl font-bold tracking-wider transition-colors truncate"
          :class="isSs ? tierHeaderClass : 'text-amber-400'"
        >
          {{ isSs ? '⚡ ' : '' }}RANK: {{ probeBase.rankName }}<span v-if="isSs" class="text-cyan-300 text-xs align-top ml-1">⛔</span>
        </h3>
        <span class="text-[10px] text-cyan-500 font-bold tracking-wider">WALL CYCLE: {{ wallCycleName }}</span>
      </div>
      <div class="flex space-x-2 shrink-0">
        <div class="bg-cyan-950 px-2.5 sm:px-3 py-1.5 rounded border border-cyan-700/50 text-xs flex items-center space-x-1">
          <span class="hidden sm:inline">Kills:</span>
          <span class="text-amber-300 font-mono font-bold">{{ probeBase.probeKills }}</span>
        </div>
      </div>
    </div>

    <!-- Probe Base Interactive Arena -->
    <div class="my-3 w-full flex flex-col items-center">
      <div 
        class="relative w-full max-w-md bg-gray-950 border-2 rounded-xl p-4 sm:p-6 shadow-2xl flex flex-col items-center cursor-pointer select-none transition-transform active:scale-[0.98] touch-manipulation data-clickable"
        :class="isImmobilized ? 'border-purple-500/80 bg-purple-950/20' : (isSs ? tierAuraClass : 'border-cyan-500/60')"
        @click="emit('attack')"
      >
        
        <!-- Probe Icon & Status -->
        <div class="flex items-center space-x-3 mb-3">
          <div class="w-12 h-12 rounded-full bg-cyan-900/60 border border-cyan-400 flex items-center justify-center text-2xl animate-pulse">
            🤖
          </div>
          <div>
            <div class="text-sm font-bold text-cyan-300">Probe Command (Rank <span :class="isSs ? 'text-amber-300' : ''">{{ probeBase.rankName }}</span>)</div>
            <div class="text-xs text-gray-400">
              {{ isImmobilized ? '⚠️ ZEALOT IMMOBILIZED BY VOID PRISM!' : `Click to attack the wall! (-${formatNumber(attackPower)} DMG)` }}
            </div>
          </div>
        </div>

        <!-- Probe Ability Status Banner -->
        <div class="w-full mb-3 bg-gray-900/90 px-3 py-2 rounded border border-purple-500/40 text-xs flex flex-col items-center">
          <div class="flex justify-between w-full font-bold text-purple-300 mb-0.5">
            <span>ABILITY: {{ abilityName.toUpperCase() }}</span>
            <span class="font-mono">
              <span v-if="probeBase.abilityActiveTimer > 0" class="text-amber-400 animate-pulse">
                ACTIVE ({{ formatTimer(probeBase.abilityActiveTimer) }})
              </span>
              <span v-else class="text-gray-400">
                CD: {{ formatTimer(probeBase.abilityCooldown) }}
              </span>
            </span>
          </div>
          <div class="text-[10px] text-gray-400 italic text-center">{{ abilityDescription }}</div>
          <div v-if="isSs && tierMechanicStatus" class="mt-1.5 text-[10px] font-bold text-cyan-300 text-center">
            {{ tierMechanicStatus }}
          </div>
        </div>

        <!-- Upgrade Timer / Progress Bar -->
        <div class="w-full mb-3 bg-gray-900 px-3 py-2 rounded border border-amber-900/40">
          <div class="flex justify-between text-[10px] text-amber-300 mb-1 font-bold">
            <span>PROBES UPGRADING DEFENSES {{ !probeBase.hasStartedCombat ? '(PAUSED)' : (probeBase.ability === 'chrono' && probeBase.abilityActiveTimer > 0 ? '(+20% SPEED)' : '') }}</span>
            <span class="font-mono">{{ formatTimer(probeBase.timeUntilUpgrade) }}</span>
          </div>
          <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden border border-amber-700/40">
            <div class="bg-amber-500 h-full transition-all duration-1000" :style="{ width: `${upgradeProgressPercentage}%` }"></div>
          </div>
        </div>

        <!-- Auto Repair Indicator with Reserved Space -->
        <div class="w-full text-center mb-2 h-6 flex items-center justify-center">
          <span class="text-[10px] bg-red-950/80 text-red-300 px-2.5 py-0.5 rounded-full border border-red-700/50 animate-pulse transition-opacity duration-200"
            :class="probeBase.wall.currentHp.lt(probeBase.wall.maxHp) ? 'opacity-100 visible' : 'opacity-0 invisible'"
          >
            ⚡ {{ isSs ? tierMechanic.toUpperCase() : 'PROBES AUTO-REPAIR' }} ({{ isSs ? '25% + 2%' : (probeBase.rareType === 'doubleBaser' ? '2x' : (probeBase.rareType === 'tripleBaser' ? '3x' : '25%')) }} HP/s) ⚡
          </span>
        </div>

        <!-- Wall Defense Bar -->
        <div class="w-full bg-gray-900 p-4 rounded-lg border border-cyan-800/40 mb-3">
          <div class="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs mb-1.5 font-bold uppercase tracking-wider">
            <span class="text-cyan-400">
              {{ wallDisplayName }} <span v-if="probeBase.rareType !== 'pather' && probeBase.wall.tier !== 'final'">(Lv. {{ probeBase.wall.level }})</span>
            </span>
            <span class="font-mono whitespace-nowrap">{{ formatNumber(probeBase.wall.currentHp) }} / {{ formatNumber(probeBase.wall.maxHp) }}</span>
          </div>
          <div class="w-full bg-gray-800 h-4 rounded-full overflow-hidden border border-cyan-700/40">
            <div class="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-150" :style="{ width: `${wallHpPercentage}%` }"></div>
            </div>
        </div>

        <!-- Single Turrets Summary Bar -->
        <div v-if="probeBase.turret && probeBase.turret.count > 0" class="w-full">
          <div class="bg-gray-900/80 px-4 py-2.5 rounded-lg border border-red-900/40 flex justify-between items-center text-xs">
            <div class="flex items-center space-x-2">
              <span class="text-red-400 text-base">🛡️</span>
              <span class="font-bold text-gray-200">{{ probeBase.turret.count }}x Turret (Lv. {{ probeBase.turret.level }})</span>
            </div>
            <span class="font-mono text-red-300 font-semibold">ATK: {{ formatNumber(probeBase.turret.attackPower) }}/s</span>
          </div>
        </div>
        <div v-else class="w-full bg-gray-900/80 px-4 py-2.5 rounded-lg border border-gray-800 flex justify-between items-center text-xs text-gray-500">
          <span>🛡️ No Turrets ({{ probeBase.rareType === 'trainingProbe' ? 'Training Unit' : 'Pather Unit' }})</span>
        </div>

        <!-- Combo Counter + Ability Immunity Status -->
        <div class="w-full space-y-2 mb-2">
          <ComboCounter
            :combo-count="props.comboCount ?? 0"
            :combo-max="props.comboMax ?? 50"
            :multiplier="props.comboMultiplier ?? 1.0"
          />
          <AbilityImmunityIndicator :seconds-remaining="props.abilityImmunitySeconds ?? 0" />
        </div>

        <div class="mt-2 text-xs text-cyan-400/80 italic animate-bounce" :class="isImmobilized ? 'text-purple-400' : ''">
          {{ isImmobilized ? '🛑 ZEALOT CANNOT ATTACK WHILE IMMOBILIZED! 🛑' : '⚡ CLICK HERE TO ATTACK THE WALL ⚡' }}
        </div>
      </div>
    </div>

    <!-- Special probe status banners (below the arena, so the attack button stays at the top) -->
    <div class="w-full space-y-1.5 mt-3 mb-1">
      <div v-if="probeBase.isClanned" class="w-full bg-gradient-to-r from-blue-950 via-cyan-950 to-blue-950 border border-cyan-400/60 rounded-lg py-1.5 px-3 text-center text-cyan-200 font-bold text-xs shadow-lg animate-pulse select-none">
        🛡️ CLANNED PROBE [{{ probeBase.clanName || 'Clan' }}] (3x HP &amp; Turrets)
      </div>

      <div v-if="isSs" class="w-full bg-gradient-to-r border rounded-lg py-1.5 px-3 text-center font-bold text-xs shadow-lg animate-pulse select-none" :class="tierBannerClass">
        ⚡ {{ tierLabel }} — {{ tierMechanic }} ⚡
      </div>

      <div v-if="probeBase.isRare" class="w-full bg-gradient-to-r from-purple-950 via-amber-950 to-purple-950 border border-amber-500/60 rounded-lg py-1.5 px-3 text-center text-amber-300 font-bold text-xs shadow-lg animate-pulse select-none">
        {{ rareProbeLabel || 'Rare Probe' }}
      </div>
    </div>

    <!-- Quick controls hint -->
    <div class="text-xs text-gray-500 text-center">
      Defeat the Probe Wall to destroy the defending Probe, raise Probe Rank, and claim rewards!
    </div>
  </div>
</template>

<style scoped>
</style>
