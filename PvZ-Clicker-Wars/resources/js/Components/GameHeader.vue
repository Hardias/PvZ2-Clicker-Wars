<script setup lang="ts">
import { ref } from 'vue';
import { formatNumber } from '../utils/format';

interface Props {
  minerals: number;
  vespeneGas: number;
  currentView: 'battle' | 'shop';
  autosaveEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:currentView', view: 'battle' | 'shop'): void;
  (e: 'save'): void;
  (e: 'load'): void;
  (e: 'reset'): void;
  (e: 'toggleAutosave'): void;
  (e: 'toggleMusicMute'): void;
  (e: 'toggleSfxMute'): void;
  (e: 'setMusicVolume', value: number): void;
  (e: 'setSfxVolume', value: number): void;
}>();

const showAudioPanel = ref(false);
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

      <!-- Audio Controls -->
      <div class="relative">
        <button
          @click="showAudioPanel = !showAudioPanel"
          class="bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded text-xs font-bold border border-purple-700/50 flex items-center space-x-1 transition-all"
          :class="(!musicMuted || !sfxMuted) ? 'text-purple-300' : 'text-gray-500'"
          title="Audio Settings"
        >
          <span v-if="!musicMuted || !sfxMuted">🔊</span>
          <span v-else>🔇</span>
          <span>AUDIO</span>
        </button>

        <!-- Audio Panel Dropdown -->
        <Transition
          enter-active-class="transition ease-out duration-150"
          enter-from-class="opacity-0 scale-95 -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-1"
        >
          <div
            v-if="showAudioPanel"
            class="absolute right-0 top-full mt-2 bg-gray-900 border border-purple-500/40 rounded-lg p-4 shadow-2xl shadow-purple-900/50 z-50 w-64"
          >
            <!-- Music Volume -->
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Music</span>
                <button
                  @click="emit('toggleMusicMute')"
                  class="text-sm px-1.5 py-0.5 rounded border transition-all"
                  :class="musicMuted ? 'bg-red-950/60 text-red-400 border-red-700' : 'bg-green-950/60 text-green-400 border-green-700'"
                >
                  {{ musicMuted ? '🔇' : '🔊' }}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                :value="musicVolume * 100"
                @input="emit('setMusicVolume', Number(($event.target as HTMLInputElement).value) / 100)"
                class="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500 bg-gray-700"
                :disabled="musicMuted"
              />
              <div class="text-right text-[9px] text-gray-500 mt-0.5">{{ Math.round(musicVolume * 100) }}%</div>
            </div>

            <!-- SFX Volume -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider">SFX</span>
                <button
                  @click="emit('toggleSfxMute')"
                  class="text-sm px-1.5 py-0.5 rounded border transition-all"
                  :class="sfxMuted ? 'bg-red-950/60 text-red-400 border-red-700' : 'bg-green-950/60 text-green-400 border-green-700'"
                >
                  {{ sfxMuted ? '🔇' : '🔊' }}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                :value="sfxVolume * 100"
                @input="emit('setSfxVolume', Number(($event.target as HTMLInputElement).value) / 100)"
                class="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-500 bg-gray-700"
                :disabled="sfxMuted"
              />
              <div class="text-right text-[9px] text-gray-500 mt-0.5">{{ Math.round(sfxVolume * 100) }}%</div>
            </div>
          </div>
        </Transition>
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
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #a855f7;
  cursor: pointer;
  border: 2px solid #7c3aed;
  box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
}
input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #a855f7;
  cursor: pointer;
  border: 2px solid #7c3aed;
  box-shadow: 0 0 6px rgba(168, 85, 247, 0.5);
}
input[type="range"]:disabled::-webkit-slider-thumb {
  background: #4b5563;
  border-color: #374151;
  box-shadow: none;
}
input[type="range"]:disabled::-moz-range-thumb {
  background: #4b5563;
  border-color: #374151;
  box-shadow: none;
}
</style>
