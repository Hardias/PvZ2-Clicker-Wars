<script setup lang="ts">
import { SlotMeta } from '../composables/useSaveSystem';

interface Props {
  slotMetadata: Record<'A' | 'B' | 'C' | 'autosave', SlotMeta>;
  mostRecentSlot: 'A' | 'B' | 'C' | 'autosave' | null;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'loadSlot', slot: 'A' | 'B' | 'C' | 'autosave'): void;
  (e: 'close'): void;
}>();

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Never saved';
  return new Date(timestamp).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto p-4 flex">
    <div class="bg-gray-900 border-2 border-cyan-500/60 rounded-xl p-6 max-w-md w-full shadow-2xl text-cyan-100 flex flex-col space-y-5 m-auto">
      
      <div class="flex justify-between items-center border-b border-cyan-800/60 pb-3">
        <h2 class="text-xl font-bold tracking-wider text-amber-400 flex items-center space-x-2">
          <span>📂</span>
          <span>LOAD GAME</span>
        </h2>
        <button 
          @click="emit('close')"
          class="text-gray-400 hover:text-white font-bold text-lg px-2 py-1 rounded transition-colors"
        >
          ✕
        </button>
      </div>

      <p class="text-xs text-gray-300">
        Choose a save slot or the autosave to load:
      </p>

      <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        
        <!-- Autosave Slot -->
        <button 
          @click="emit('loadSlot', 'autosave')"
          class="w-full bg-gray-950 hover:bg-cyan-950/60 border rounded-lg p-4 text-left transition-all flex flex-col space-y-1 group relative overflow-hidden"
          :class="mostRecentSlot === 'autosave' ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-purple-800/60 hover:border-purple-400'"
        >
          <div v-if="mostRecentSlot === 'autosave'" class="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-extrabold px-2 py-0.5 rounded-bl">
            ⭐ MOST RECENT SAVE
          </div>
          <div class="flex justify-between items-center font-bold text-purple-300 group-hover:text-purple-200">
            <span>AUTOSAVE SLOT (Load only)</span>
            <span class="text-xs text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-700/50">Load</span>
          </div>
          <span class="text-xs text-gray-400">
            Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.autosave.updatedAt) }}</strong>
          </span>
          <span v-if="!slotMetadata.autosave.exists" class="text-[10px] text-red-400 italic">No autosave available</span>
        </button>

        <!-- Slot A -->
        <button 
          @click="emit('loadSlot', 'A')"
          class="w-full bg-gray-950 hover:bg-cyan-950/60 border rounded-lg p-4 text-left transition-all flex flex-col space-y-1 group relative overflow-hidden"
          :class="mostRecentSlot === 'A' ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-cyan-700/50 hover:border-cyan-400'"
        >
          <div v-if="mostRecentSlot === 'A'" class="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-extrabold px-2 py-0.5 rounded-bl">
            ⭐ MOST RECENT SAVE
          </div>
          <div class="flex justify-between items-center font-bold text-cyan-200 group-hover:text-cyan-100">
            <span>SAVE SLOT A</span>
            <span class="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">Load</span>
          </div>
          <span class="text-xs text-gray-400">
            Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.A.updatedAt) }}</strong>
          </span>
          <span v-if="!slotMetadata.A.exists" class="text-[10px] text-red-400 italic">Slot is empty</span>
        </button>

        <!-- Slot B -->
        <button 
          @click="emit('loadSlot', 'B')"
          class="w-full bg-gray-950 hover:bg-cyan-950/60 border rounded-lg p-4 text-left transition-all flex flex-col space-y-1 group relative overflow-hidden"
          :class="mostRecentSlot === 'B' ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-cyan-700/50 hover:border-cyan-400'"
        >
          <div v-if="mostRecentSlot === 'B'" class="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-extrabold px-2 py-0.5 rounded-bl">
            ⭐ MOST RECENT SAVE
          </div>
          <div class="flex justify-between items-center font-bold text-cyan-200 group-hover:text-cyan-100">
            <span>SAVE SLOT B</span>
            <span class="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">Load</span>
          </div>
          <span class="text-xs text-gray-400">
            Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.B.updatedAt) }}</strong>
          </span>
          <span v-if="!slotMetadata.B.exists" class="text-[10px] text-red-400 italic">Slot is empty</span>
        </button>

        <!-- Slot C -->
        <button 
          @click="emit('loadSlot', 'C')"
          class="w-full bg-gray-950 hover:bg-cyan-950/60 border rounded-lg p-4 text-left transition-all flex flex-col space-y-1 group relative overflow-hidden"
          :class="mostRecentSlot === 'C' ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-cyan-700/50 hover:border-cyan-400'"
        >
          <div v-if="mostRecentSlot === 'C'" class="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-extrabold px-2 py-0.5 rounded-bl">
            ⭐ MOST RECENT SAVE
          </div>
          <div class="flex justify-between items-center font-bold text-cyan-200 group-hover:text-cyan-100">
            <span>SAVE SLOT C</span>
            <span class="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">Load</span>
          </div>
          <span class="text-xs text-gray-400">
            Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.C.updatedAt) }}</strong>
          </span>
          <span v-if="!slotMetadata.C.exists" class="text-[10px] text-red-400 italic">Slot is empty</span>
        </button>

      </div>

      <div class="pt-2 flex justify-end">
        <button 
          @click="emit('close')"
          class="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-4 py-2 rounded text-xs transition-colors"
        >
          Cancel
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
</style>
