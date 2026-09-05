<script setup lang="ts">
import { ref } from 'vue';
import { formatNumber } from '../utils/format';

interface Props {
  minerals: number;
  vespeneGas: number;
  infiniteVespene?: boolean;
  autosaveEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  currentTrackName: string;
  currentTrackEmoji: string;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'save'): void;
  (e: 'load'): void;
  (e: 'reset'): void;
  (e: 'toggleAutosave'): void;
  (e: 'toggleMusicMute'): void;
  (e: 'toggleSfxMute'): void;
  (e: 'setMusicVolume', value: number): void;
  (e: 'setSfxVolume', value: number): void;
  (e: 'nextTrack'): void;
  (e: 'openTutorial'): void;
}>();

const showAudioPanel = ref(false);
const menuOpen = ref(false);

function closeFor(action: 'save' | 'load' | 'reset' | 'tutorial') {
  menuOpen.value = false;
  emit(action);
}
</script>

<template>
  <header class="bg-gray-900/95 border-b border-cyan-500/40 shadow-lg" style="padding-top: env(safe-area-inset-top);">
    <div class="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3">
      <!-- Logo -->
      <div class="flex items-center space-x-2 min-w-0">
        <div class="w-8 h-8 sm:w-9 sm:h-9 rounded bg-cyan-600/30 border border-cyan-400 flex items-center justify-center font-bold text-cyan-300 shrink-0">
          ⚡
        </div>
        <h1 class="text-sm sm:text-lg font-extrabold tracking-wider truncate bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          PROBES VS ZEALOT 2<span class="hidden sm:inline">: CLICKER WARS</span>
        </h1>
      </div>

      <!-- Currency counters (all screens) -->
      <div class="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        <div class="bg-gray-950/90 px-2 py-1.5 sm:px-3 rounded-lg border border-cyan-800/60 flex items-center space-x-1.5" title="Minerals (M)">
          <img src="/crystal.png" class="w-4 h-4 inline-block object-contain" alt="Minerals" />
          <span class="font-mono font-bold text-cyan-200 text-xs sm:text-sm">{{ formatNumber(minerals) }}M</span>
        </div>
        <div class="bg-gray-950/90 px-2 py-1.5 sm:px-3 rounded-lg border border-green-800/60 flex items-center space-x-1.5" title="Vespene Gas (V)">
          <span class="text-green-400 font-bold">🟢</span>
          <span class="font-mono font-bold text-green-300 text-xs sm:text-sm">{{ infiniteVespene ? '∞' : formatNumber(vespeneGas) }}V</span>
        </div>
      </div>

      <!-- Mobile: hamburger menu button -->
      <button
        @click="menuOpen = true"
        class="lg:hidden bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded text-xs font-bold border border-cyan-700/60 text-cyan-200 flex items-center space-x-1 transition-all shrink-0"
        title="Menu"
      >
        <span class="text-sm leading-none">☰</span>
        <span>MENU</span>
      </button>

      <!-- Desktop: audio + actions -->
      <div class="hidden lg:flex items-center space-x-4">
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
              <!-- Music Track Selector -->
              <div class="mb-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Track</span>
                  <span class="text-[10px] font-bold text-purple-200">{{ currentTrackEmoji }} {{ currentTrackName }}</span>
                </div>
                <button
                  @click="emit('nextTrack')"
                  class="w-full bg-purple-800/50 hover:bg-purple-700/60 text-purple-100 px-3 py-1.5 rounded text-xs font-bold border border-purple-500/50 transition-all"
                  :disabled="musicMuted"
                >
                  NEXT TRACK ▶▶
                </button>
              </div>

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

        <!-- Save / Load / Reset / Help -->
        <div class="flex space-x-2">
          <button @click="emit('openTutorial')" class="bg-gray-800 hover:bg-gray-700 text-amber-300 px-3 py-1.5 rounded text-xs font-bold border border-amber-700/50 flex items-center space-x-1" title="Show the tutorial again">
            <span>📖</span>
            <span>HELP</span>
          </button>
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

        <!-- Autosave toggle -->
        <button
          @click="emit('toggleAutosave')"
          class="px-2.5 py-1 rounded text-[10px] font-bold border transition-all flex items-center space-x-1.5 shadow-sm"
          :class="autosaveEnabled ? 'bg-green-950/90 text-green-200 border-green-400 shadow-green-500/40' : 'bg-gray-900 text-gray-400 border-gray-700'"
        >
          <span class="w-2.5 h-2.5 rounded-full" :class="autosaveEnabled ? 'bg-green-400 shadow-[0_0_10px_#4ade80] animate-ping' : 'bg-gray-500'"></span>
          <span>AUTO-SAVE: {{ autosaveEnabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
    </div>

    <!-- Mobile: bottom sheet menu -->
    <Transition
      enter-active-class="transition ease-out duration-300 opacity-0"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="menuOpen" class="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/75 backdrop-blur-sm" @click="menuOpen = false"></div>

        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="translate-y-full"
          enter-to-class="translate-y-0"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="translate-y-0"
          leave-to-class="translate-y-full"
        >
          <div
            v-if="menuOpen"
            class="absolute inset-x-0 bottom-0 bg-gray-900 border-t-2 border-cyan-500/70 rounded-t-2xl shadow-2xl shadow-cyan-900/40 p-4"
            style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);"
          >
            <!-- Sheet header -->
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-bold tracking-widest text-cyan-300 uppercase">⚡ Menu</span>
              <button
                @click="menuOpen = false"
                class="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs text-gray-300 font-bold border border-gray-600"
              >
                [ X ]
              </button>
            </div>

            <!-- Actions grid -->
            <div class="grid grid-cols-2 gap-2 mb-3">
              <button @click="closeFor('save')" class="bg-gray-800 hover:bg-gray-700 text-cyan-300 px-3 py-3 rounded-lg text-xs font-bold border border-cyan-700/50 flex items-center justify-center space-x-1.5">
                <span>💾</span><span>SAVE</span>
              </button>
              <button @click="closeFor('load')" class="bg-gray-800 hover:bg-gray-700 text-purple-300 px-3 py-3 rounded-lg text-xs font-bold border border-purple-700/50 flex items-center justify-center space-x-1.5">
                <span>📂</span><span>LOAD</span>
              </button>
              <button @click="closeFor('tutorial')" class="bg-gray-800 hover:bg-gray-700 text-amber-300 px-3 py-3 rounded-lg text-xs font-bold border border-amber-700/50 flex items-center justify-center space-x-1.5">
                <span>📖</span><span>HELP</span>
              </button>
              <button @click="closeFor('reset')" class="bg-red-950/60 hover:bg-red-900 text-red-300 px-3 py-3 rounded-lg text-xs font-bold border border-red-800/50 flex items-center justify-center space-x-1.5">
                <span>🔄</span><span>RESET</span>
              </button>
            </div>

            <!-- Autosave toggle -->
            <button
              @click="emit('toggleAutosave')"
              class="w-full px-3 py-2 rounded text-xs font-bold border transition-all flex items-center justify-center space-x-1.5 mb-3"
              :class="autosaveEnabled ? 'bg-green-950/90 text-green-200 border-green-400' : 'bg-gray-900 text-gray-400 border-gray-700'"
            >
              <span class="w-2.5 h-2.5 rounded-full" :class="autosaveEnabled ? 'bg-green-400 shadow-[0_0_10px_#4ade80] animate-ping' : 'bg-gray-500'"></span>
              <span>AUTO-SAVE: {{ autosaveEnabled ? 'ON' : 'OFF' }}</span>
            </button>

            <!-- Audio section -->
            <div class="bg-gray-950 border border-purple-500/40 rounded-xl p-3">
              <div class="mb-2.5">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Track</span>
                  <span class="text-[10px] font-bold text-purple-200">{{ currentTrackEmoji }} {{ currentTrackName }}</span>
                </div>
                <button
                  @click="emit('nextTrack')"
                  class="w-full bg-purple-800/50 hover:bg-purple-700/60 text-purple-100 px-3 py-2 rounded text-xs font-bold border border-purple-500/50 transition-all"
                  :disabled="musicMuted"
                >
                  NEXT TRACK ▶▶
                </button>
              </div>

              <div class="mb-2.5">
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
          </div>
        </Transition>
      </div>
    </Transition>
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