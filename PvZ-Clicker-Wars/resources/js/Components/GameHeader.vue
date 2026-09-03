<script setup lang="ts">
import { formatNumber } from '../utils/format';

interface Props {
  minerals: number;
  vespeneGas: number;
  currentView: 'battle' | 'shop';
  autosaveEnabled: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:currentView', view: 'battle' | 'shop'): void;
  (e: 'save'): void;
  (e: 'load'): void;
  (e: 'reset'): void;
  (e: 'toggleAutosave'): void;
}>();
</script>

<template>
  <header class="bg-gray-900 border-b border-cyan-500/40 px-6 py-4 flex justify-between items-center shadow-lg">
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 rounded bg-cyan-600/30 border border-cyan-400 flex items-center justify-center font-bold text-cyan-300">
        ⚡
      </div>
      <h1 class="text-lg font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
        PROBES VS ZEALOT 2: CLICKER WARS
      </h1>
    </div>

    <div class="flex items-center space-x-4">
      <!-- Currency Counters -->
      <div class="flex space-x-2">
        <div class="bg-gray-950 px-3 py-2 rounded-lg border border-cyan-800/60 flex items-center space-x-1.5" title="Minerals (M)">
          <img src="/crystal.png" class="w-4 h-4 inline-block object-contain" alt="Minerals" />
          <span class="font-mono font-bold text-cyan-200 text-sm">{{ formatNumber(minerals) }}M</span>
        </div>
        <div class="bg-gray-950 px-3 py-2 rounded-lg border border-green-800/60 flex items-center space-x-1.5" title="Vespene Gas (V)">
          <span class="text-green-400 font-bold">🟢</span>
          <span class="font-mono font-bold text-green-300 text-sm">{{ formatNumber(vespeneGas) }}V</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex bg-gray-950 p-1 rounded-lg border border-cyan-900">
        <button 
          @click="emit('update:currentView', 'battle')"
          class="px-4 py-1.5 rounded text-xs font-bold transition-all"
          :class="currentView === 'battle' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'"
        >
          ⚔️ BATTLE AREA
        </button>
        <button 
          @click="emit('update:currentView', 'shop')"
          class="px-4 py-1.5 rounded text-xs font-bold transition-all shadow"
          :class="currentView === 'shop' ? 'bg-amber-500 text-black font-extrabold ring-2 ring-amber-300 scale-105' : 'text-gray-400 hover:text-gray-200'"
        >
          🏛️ ZEALOT SHOP
        </button>
      </div>

      <!-- Save / Load / Autosave Toggle / Reset Group -->
      <div class="flex flex-col space-y-1.5 items-end">
        <div class="flex space-x-2">
          <button @click="emit('save')" class="bg-gray-800 hover:bg-gray-700 text-cyan-300 px-3 py-1.5 rounded text-xs font-bold border border-cyan-700/50 flex items-center space-x-1">
            <span>💾</span>
            <span>SAVE</span>
          </button>
          <button @click="emit('load')" class="bg-gray-800 hover:bg-gray-700 text-purple-300 px-3 py-1.5 rounded text-xs font-bold border border-purple-700/50 flex items-center space-x-1">
            <span>📂</span>
            <span>LOAD</span>
          </button>
          <button @click="emit('reset')" class="bg-red-950/60 hover:bg-red-900 text-red-300 px-3 py-1.5 rounded text-xs font-bold border border-red-800/50">
            🔄 RESET
          </button>
        </div>
        <!-- Autosave Toggle Button (Top right, under save buttons, obvious active indicator) -->
        <button 
          @click="emit('toggleAutosave')" 
          class="px-2.5 py-1 rounded text-[10px] font-bold border transition-all flex items-center space-x-1.5 shadow-sm"
          :class="autosaveEnabled ? 'bg-green-950/90 text-green-200 border-green-400 shadow-green-500/40' : 'bg-gray-900 text-gray-400 border-gray-700'"
        >
          <span class="w-2.5 h-2.5 rounded-full" :class="autosaveEnabled ? 'bg-green-400 shadow-[0_0_10px_#4ade80] animate-ping' : 'bg-gray-500'"></span>
          <span>AUTO-SAVE: {{ autosaveEnabled ? 'AAN' : 'UIT' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
</style>
