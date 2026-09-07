<script setup lang="ts">
import { computed } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { ItemStats } from '../types/Item';
import { SkillBonuses, DEFAULT_SKILL_BONUSES } from '../types/SkillTree';
import { formatNumber } from '../utils/format';
import { BigNum, big } from '../utils/bigNumber';

interface Props {
  zealot: ZealotStats;
  maxHp: BigNum;
  attackPower: BigNum;
  attackSpeed: number;
  currentDps: BigNum;
  defense: number;
  hpRegen: BigNum;
  equipmentStats: ItemStats & { totalDefenseReduction?: number };
  bonuses?: SkillBonuses;
}

const props = defineProps<Props>();

const activeBonuses = computed(() => props.bonuses ?? DEFAULT_SKILL_BONUSES);

const hasSkillBonuses = computed(() => {
  const b = activeBonuses.value;
  return b.damageMultiplier > 1
    || b.attackSpeedMultiplier > 1
    || b.critChance > 0
    || b.critMultiplier > 2
    || b.maxHpMultiplier > 1
    || b.hpRegenPercent > 0
    || b.turretDamageReduction > 0
    || b.thornsReflect > 0
    || b.extraTeleports > 0
    || b.vespeneConversionMultiplier > 1
    || b.autoVespenePercent > 0
    || b.killBountyPercent > 0
    || b.vespeneBountyPercent > 0
    || b.shopPriceReduction > 0
    || b.vespeneItemDiscount > 0
    || b.comboMaxBonus > 0;
});

const hpPercentage = computed(() => {
  if (big(props.maxHp).lte(0)) return 0;
  const pct = big(props.zealot.hp).div(props.maxHp).mul(100);
  return Math.min(100, Math.max(0, pct.toNumber()));
});

function formatDefenseReduction(reduction: number): string {
  const pct = (reduction || 0) * 100;
  if (pct === 0) return '0%';
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return String(rounded).replace('.', ',') + '%';
}

function formatDps(value: BigNum | number): string {
  const n = big(value).toNumber();
  if (!n) return '0';
  if (n < 1000) return n.toFixed(1).replace(/\.0$/, '');
  return formatNumber(big(value));
}

function formatPlayTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatCritChance(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}
</script>

<template>
  <div class="bg-gray-900 border border-cyan-500/40 rounded-lg p-4 text-cyan-100 shadow-lg shadow-cyan-950/50">
    <div class="flex justify-between items-center mb-3 border-b border-cyan-800/50 pb-2">
      <h2 class="text-lg font-bold tracking-wider text-cyan-400">ZEALOT WARRIOR</h2>
      <div class="flex space-x-2 text-xs">
        <div class="bg-cyan-950 px-2 py-1 rounded border border-cyan-600/40 text-cyan-300">
          Teleports: <span class="font-bold text-amber-400">{{ zealot.emergencyTeleports ?? 2 }}/2</span>
        </div>
        <div class="bg-red-950 px-2 py-1 rounded border border-red-600/40 text-red-300">
          Deaths: <span class="font-bold text-red-400">{{ zealot.deaths ?? 0 }}</span>
        </div>
      </div>
    </div>

    <!-- HP Bar -->
    <div class="mb-4">
      <div class="flex justify-between text-xs mb-1">
        <span>HP</span>
        <span class="font-mono">{{ formatNumber(zealot.hp) }} / {{ formatNumber(maxHp) }}</span>
      </div>
      <div class="w-full bg-gray-800 h-3 rounded-full overflow-hidden border border-cyan-700/30">
        <div class="bg-gradient-to-r from-cyan-600 to-cyan-400 h-full transition-all duration-300" :style="{ width: `${hpPercentage}%` }"></div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 gap-2 text-sm bg-gray-950/60 p-3 rounded border border-cyan-900/40">
      <div class="flex justify-between">
        <span class="text-gray-400">Attack:</span>
        <span class="font-mono text-cyan-300 font-semibold">
          {{ formatNumber(attackPower) }}
          <span v-if="equipmentStats.damage" class="text-xs text-green-400">(+{{ formatNumber(equipmentStats.damage) }})</span>
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400">Speed:</span>
        <span class="font-mono text-cyan-300 font-semibold">{{ attackSpeed.toFixed(1) }}/s</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400" title="Damage Reduction Percentage">Defense:</span>
        <span class="font-mono text-cyan-300 font-semibold">
          {{ formatDefenseReduction(equipmentStats.totalDefenseReduction || 0) }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400">Regen:</span>
        <span class="font-mono text-cyan-300 font-semibold">{{ formatNumber(hpRegen) }}/s</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400">Walls killed:</span>
        <span class="font-mono text-amber-300 font-semibold">{{ formatNumber(zealot.wallsKilled ?? 0) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400">Damage done:</span>
        <span class="font-mono text-amber-300 font-semibold">{{ formatNumber(zealot.damageDone ?? 0) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400">Highest avg DPS:</span>
        <span class="font-mono text-purple-300 font-semibold">{{ formatDps(zealot.highestAverageDps ?? 0) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400">Current DPS:</span>
        <span class="font-mono text-purple-300 font-semibold">{{ formatDps(currentDps) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400" title="Total minerals earned this run">Minerals earned:</span>
        <span class="font-mono text-amber-300 font-semibold">{{ formatNumber(zealot.totalMineralsEarned ?? 0) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400" title="Total vespene gas earned this run">Vespene earned:</span>
        <span class="font-mono text-green-300 font-semibold">{{ formatNumber(zealot.totalVespeneEarned ?? 0) }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-400" title="Total time played this run">Play time:</span>
        <span class="font-mono text-cyan-300 font-semibold">{{ formatPlayTime(zealot.totalPlayTimeSeconds ?? 0) }}</span>
      </div>
    </div>

    <!-- Skill Tree Bonus Summary -->
    <div v-if="hasSkillBonuses"
      class="mt-3 bg-amber-950/40 border border-amber-800/40 rounded p-2.5 text-[10px] grid grid-cols-2 gap-1 text-amber-200">
      <div v-if="activeBonuses.damageMultiplier > 1" class="flex justify-between">
        <span class="text-gray-400">Dmg mult:</span>
        <span class="font-mono font-semibold text-amber-300">+{{ Math.round((activeBonuses.damageMultiplier - 1) * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.attackSpeedMultiplier > 1" class="flex justify-between">
        <span class="text-gray-400">Speed:</span>
        <span class="font-mono font-semibold text-amber-300">+{{ Math.round((activeBonuses.attackSpeedMultiplier - 1) * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.critChance > 0" class="flex justify-between">
        <span class="text-gray-400">Crit chance:</span>
        <span class="font-mono font-semibold text-amber-300">{{ formatCritChance(activeBonuses.critChance) }}</span>
      </div>
      <div v-if="activeBonuses.critMultiplier > 2" class="flex justify-between">
        <span class="text-gray-400">Crit dmg:</span>
        <span class="font-mono font-semibold text-amber-300">{{ activeBonuses.critMultiplier }}x</span>
      </div>
      <div v-if="activeBonuses.maxHpMultiplier > 1" class="flex justify-between">
        <span class="text-gray-400">HP mult:</span>
        <span class="font-mono font-semibold text-amber-300">+{{ Math.round((activeBonuses.maxHpMultiplier - 1) * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.hpRegenPercent > 0" class="flex justify-between">
        <span class="text-gray-400">Regen:</span>
        <span class="font-mono font-semibold text-amber-300">{{ (activeBonuses.hpRegenPercent * 100).toLocaleString() }}% HP/s</span>
      </div>
      <div v-if="activeBonuses.turretDamageReduction > 0" class="flex justify-between">
        <span class="text-gray-400">Turret resist:</span>
        <span class="font-mono font-semibold text-amber-300">-{{ Math.round(activeBonuses.turretDamageReduction * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.thornsReflect > 0" class="flex justify-between">
        <span class="text-gray-400">Reflect:</span>
        <span class="font-mono font-semibold text-amber-300">{{ Math.round(activeBonuses.thornsReflect * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.extraTeleports > 0" class="flex justify-between">
        <span class="text-gray-400">Teleports:</span>
        <span class="font-mono font-semibold text-amber-300">+{{ activeBonuses.extraTeleports }}</span>
      </div>
      <div v-if="activeBonuses.killBountyPercent > 0" class="flex justify-between">
        <span class="text-gray-400">Kill bounty:</span>
        <span class="font-mono font-semibold text-amber-300">{{ Math.round(activeBonuses.killBountyPercent * 100) }}% wall HP</span>
      </div>
      <div v-if="activeBonuses.vespeneBountyPercent > 0" class="flex justify-between">
        <span class="text-gray-400">Vespene bounty:</span>
        <span class="font-mono font-semibold text-amber-300">{{ Math.round(activeBonuses.vespeneBountyPercent * 100) }}% wall HP</span>
      </div>
      <div v-if="activeBonuses.autoVespenePercent > 0" class="flex justify-between">
        <span class="text-gray-400">Vespene siphon:</span>
        <span class="font-mono font-semibold text-amber-300">{{ Math.round(activeBonuses.autoVespenePercent * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.vespeneConversionMultiplier > 1" class="flex justify-between">
        <span class="text-gray-400">V conversion:</span>
        <span class="font-mono font-semibold text-amber-300">+{{ Math.round((activeBonuses.vespeneConversionMultiplier - 1) * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.shopPriceReduction > 0" class="flex justify-between">
        <span class="text-gray-400">Shop discount:</span>
        <span class="font-mono font-semibold text-amber-300">-{{ Math.round(activeBonuses.shopPriceReduction * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.vespeneItemDiscount > 0" class="flex justify-between">
        <span class="text-gray-400">V shop items:</span>
        <span class="font-mono font-semibold text-amber-300">-{{ Math.round(activeBonuses.vespeneItemDiscount * 100) }}%</span>
      </div>
      <div v-if="activeBonuses.comboMaxBonus > 0" class="flex justify-between">
        <span class="text-gray-400">Combo max:</span>
        <span class="font-mono font-semibold text-amber-300">+{{ activeBonuses.comboMaxBonus }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>