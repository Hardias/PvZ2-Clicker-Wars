<script setup lang="ts">
import { SlotMeta } from '../composables/useSaveSystem';

interface Props {
  slotMetadata: Record<'A' | 'B' | 'C' | 'autosave', SlotMeta>;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'saveSlot', slot: 'A' | 'B' | 'C'): void;
  (e: 'deleteSlot', slot: 'A' | 'B' | 'C' | 'autosave'): void;
  (e: 'deleteAllSlots'): void;
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
          <span>💾</span>
          <span>SAVE GAME</span>
        </h2>
        <button 
          @click="emit('close')"
          class="text-gray-400 hover:text-white font-bold text-lg px-2 py-1 rounded transition-colors"
        >
          ✕
        </button>
      </div>

      <p class="text-xs text-gray-300">
        Choose a save slot to store your current progress:
      </p>

      <div class="space-y-3">
        <!-- Slot A -->
        <div class="w-full bg-gray-950 hover:bg-cyan-950/60 border border-cyan-700/50 hover:border-cyan-400 rounded-lg p-4 text-left transition-all flex items-center justify-between gap-3 group">
          <button
            @click="emit('saveSlot', 'A')"
            class="flex-1 flex flex-col space-y-1 text-left"
          >
            <div class="flex justify-between items-center font-bold text-cyan-200 group-hover:text-cyan-100">
              <span>SAVE SLOT A</span>
              <span class="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">Save</span>
            </div>
            <span class="text-xs text-gray-400">
              Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.A.updatedAt) }}</strong>
            </span>
          </button>
          <button
            @click="emit('deleteSlot', 'A')"
            class="text-xs font-bold px-2 py-1.5 rounded border transition-colors shrink-0 text-red-400 border-red-800/60 hover:bg-red-950/60 hover:text-red-300"
            title="Delete save slot A"
          >
            🗑 DEL
          </button>
        </div>

        <!-- Slot B -->
        <div class="w-full bg-gray-950 hover:bg-cyan-950/60 border border-cyan-700/50 hover:border-cyan-400 rounded-lg p-4 text-left transition-all flex items-center justify-between gap-3 group">
          <button
            @click="emit('saveSlot', 'B')"
            class="flex-1 flex flex-col space-y-1 text-left"
          >
            <div class="flex justify-between items-center font-bold text-cyan-200 group-hover:text-cyan-100">
              <span>SAVE SLOT B</span>
              <span class="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">Save</span>
            </div>
            <span class="text-xs text-gray-400">
              Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.B.updatedAt) }}</strong>
            </span>
          </button>
          <button
            @click="emit('deleteSlot', 'B')"
            class="text-xs font-bold px-2 py-1.5 rounded border transition-colors shrink-0 text-red-400 border-red-800/60 hover:bg-red-950/60 hover:text-red-300"
            title="Delete save slot B"
          >
            🗑 DEL
          </button>
        </div>

        <!-- Slot C -->
        <div class="w-full bg-gray-950 hover:bg-cyan-950/60 border border-cyan-700/50 hover:border-cyan-400 rounded-lg p-4 text-left transition-all flex items-center justify-between gap-3 group">
          <button
            @click="emit('saveSlot', 'C')"
            class="flex-1 flex flex-col space-y-1 text-left"
          >
            <div class="flex justify-between items-center font-bold text-cyan-200 group-hover:text-cyan-100">
              <span>SAVE SLOT C</span>
              <span class="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">Save</span>
            </div>
            <span class="text-xs text-gray-400">
              Last saved: <strong class="text-gray-300">{{ formatDate(slotMetadata.C.updatedAt) }}</strong>
            </span>
          </button>
          <button
            @click="emit('deleteSlot', 'C')"
            class="text-xs font-bold px-2 py-1.5 rounded border transition-colors shrink-0 text-red-400 border-red-800/60 hover:bg-red-950/60 hover:text-red-300"
            title="Delete save slot C"
          >
            🗑 DEL
          </button>
        </div>
      </div>

      <div class="pt-2 flex justify-between items-center gap-2">
        <button
          @click="emit('deleteAllSlots')"
          class="bg-red-950/60 hover:bg-red-900 text-red-300 font-bold px-4 py-2 rounded text-xs border border-red-800/60 transition-colors"
        >
          💥 Destroy All Saves
        </button>
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

