<script setup lang="ts">
import { computed } from 'vue';
import { ProbeBase } from '../types/ProbeBase';
import { formatNumber } from '../utils/format';

interface Props {
  probeBase: ProbeBase;
  currentWave: number;
  attackPower: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'attack'): void;
}>();

const wallHpPercentage = computed(() => {
  const wall = props.probeBase.wall;
  return Math.min(100, Math.max(0, (wall.currentHp / wall.maxHp) * 100));
});
</script>

<template>
  <div class="bg-gray-900 border border-cyan-500/40 rounded-lg p-6 text-cyan-100 shadow-xl shadow-cyan-950/60 flex flex-col items-center justify-between min-h-[420px]">
    <!-- Header / Wave info -->
    <div class="w-full flex justify-between items-center border-b border-cyan-800/50 pb-3">
      <div>
        <span class="text-xs text-gray-400">SECTOR ASSAULT</span>
        <h3 class="text-xl font-bold tracking-wider text-amber-400">WAVE {{ currentWave }}</h3>
      </div>
      <div class="bg-cyan-950 px-3 py-1.5 rounded border border-cyan-700/50 text-xs flex items-center space-x-1">
        <span>Bounty:</span>
        <span class="text-blue-400 font-mono font-bold flex items-center space-x-1">
          <img src="/crystal.png" class="w-4 h-4 inline-block object-contain" alt="Mineral" />
          <span>+{{ formatNumber(probeBase.bounty) }}M</span>
        </span>
      </div>
    </div>

    <!-- Probe Base Interactive Arena -->
    <div class="my-6 w-full flex flex-col items-center">
      <div class="relative w-full max-w-md bg-gray-950 border-2 border-cyan-500/60 rounded-xl p-6 shadow-2xl flex flex-col items-center cursor-pointer select-none transition-transform active:scale-[0.99]" @click="emit('attack')">
        
        <!-- Probe Icon & Status -->
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-12 h-12 rounded-full bg-cyan-900/60 border border-cyan-400 flex items-center justify-center text-2xl animate-pulse">
            🤖
          </div>
          <div>
            <div class="text-sm font-bold text-cyan-300">Probe Command & Defenses</div>
            <div class="text-xs text-gray-400">Click to Assault Wall! (-{{ formatNumber(attackPower) }} DMG)</div>
          </div>
        </div>

        <!-- Auto Repair Indicator with Reserved Space (Prevents layout shift) -->
        <div class="w-full text-center mb-2 h-6 flex items-center justify-center">
          <span 
            class="text-[10px] bg-red-950/80 text-red-300 px-2.5 py-0.5 rounded-full border border-red-700/50 animate-pulse transition-opacity duration-200"
            :class="probeBase.wall.currentHp < probeBase.wall.maxHp ? 'opacity-100 visible' : 'opacity-0 invisible'"
          >
            ⚡ PROBES AUTO-REPAIRING WALL (+25% HP/s) ⚡
          </span>
        </div>

        <!-- Wall Defense Bar -->
        <div class="w-full bg-gray-900 p-4 rounded-lg border border-cyan-800/40 mb-3">
          <div class="flex justify-between text-xs mb-1.5 font-bold uppercase tracking-wider">
            <span class="text-cyan-400">
              {{ probeBase.wall.tier.toUpperCase() }} WALL (Lv. {{ probeBase.wall.level }})
            </span>
            <span class="font-mono">{{ formatNumber(probeBase.wall.currentHp) }} / {{ formatNumber(probeBase.wall.maxHp) }}</span>
          </div>
          <div class="w-full bg-gray-800 h-4 rounded-full overflow-hidden border border-cyan-700/40">
            <div class="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-150" :style="{ width: `${wallHpPercentage}%` }"></div>
          </div>
        </div>

        <!-- Single Turrets Summary Bar (8x Turret) -->
        <div v-if="probeBase.turret" class="w-full">
          <div class="bg-gray-900/80 px-4 py-2.5 rounded-lg border border-red-900/40 flex justify-between items-center text-xs">
            <div class="flex items-center space-x-2">
              <span class="text-red-400 text-base">🛡️</span>
              <span class="font-bold text-gray-200">{{ probeBase.turret.count }}x Turret (Lv. {{ probeBase.turret.level }})</span>
            </div>
            <span class="font-mono text-red-300 font-semibold">ATK: {{ formatNumber(probeBase.turret.attackPower) }}/s</span>
          </div>
        </div>

        <div class="mt-4 text-xs text-cyan-400/80 italic animate-bounce">
          ⚡ CLICK HERE TO ATTACK THE BASE ⚡
        </div>
      </div>
    </div>

    <!-- Quick controls hint -->
    <div class="text-xs text-gray-500 text-center">
      Defeat the Probe Wall to earn minerals, level up your Zealot, and advance to tougher sectors!
    </div>
  </div>
</template>

<style scoped>
</style>
