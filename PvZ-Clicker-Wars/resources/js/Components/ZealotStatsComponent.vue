<script setup lang="ts">
import { computed } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { ItemStats } from '../types/Item';
import { formatNumber } from '../utils/format';

interface Props {
  zealot: ZealotStats;
  maxHp: number;
  attackPower: number;
  attackSpeed: number;
  currentDps: number;
  defense: number;
  hpRegen: number;
  equipmentStats: ItemStats & { totalDefenseReduction?: number };
}

const props = defineProps<Props>();

const hpPercentage = computed(() => {
  return Math.min(100, Math.max(0, (props.zealot.hp / props.maxHp) * 100));
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

function formatDps(value: number): string {
  if (value === 0) return '0';
  if (value < 1000) return value.toFixed(1).replace(/\.0$/, '');
  return formatNumber(value);
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
    </div>
  </div>
</template>

<style scoped>
</style>