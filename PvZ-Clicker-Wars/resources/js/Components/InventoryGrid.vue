<script setup lang="ts">
import { InventorySlot } from '../types/Item';

interface Props {
  slots: InventorySlot[];
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'unequip', slotIndex: number): void;
}>();
</script>

<template>
  <div class="bg-gray-900 border border-cyan-500/40 rounded-lg p-4 text-cyan-100 shadow-lg shadow-cyan-950/50">
    <div class="flex justify-between items-center mb-3 border-b border-cyan-800/50 pb-2">
      <h2 class="text-lg font-bold tracking-wider text-cyan-400">EQUIPMENT (6 SLOTS)</h2>
    </div>

    <div class="grid grid-cols-3 gap-2.5">
      <div 
        v-for="(slot, index) in slots" 
        :key="index"
        class="relative bg-gray-950 border rounded-lg p-3 flex flex-col items-center justify-center min-h-[90px] transition-all group"
        :class="slot.item ? 'border-cyan-500 shadow-sm shadow-cyan-500/20 bg-cyan-950/20' : 'border-gray-800'"
      >
        <div class="absolute top-1 left-2 text-[10px] text-gray-500 uppercase tracking-widest">
          {{ index + 1 }}
        </div>

        <!-- Touch-friendly remove (always visible on mobile, small ✕ badge) -->
        <button
          v-if="slot.item"
          @click.stop="emit('unequip', index)"
          class="absolute top-1 right-1 z-10 w-5 h-5 rounded-md bg-red-950/90 hover:bg-red-800 text-red-300 text-[10px] font-bold leading-none flex items-center justify-center border border-red-700/60 cursor-pointer opacity-80"
          :title="`Sell ${slot.item.name}`"
        >
          ✕
        </button>

        <!-- Desktop hover remove overlay -->
        <button
          v-if="slot.item"
          @click.stop="emit('unequip', index)"
          class="absolute inset-0 bg-red-950/90 text-red-200 text-xs font-bold hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity items-center justify-center rounded-lg cursor-pointer"
          :title="`Sell ${slot.item.name}`"
        >
          Remove
        </button>

        <div v-if="slot.item" class="text-center mt-3 px-1.5">
          <div class="text-xs font-bold text-cyan-200 truncate max-w-[90px]">{{ slot.item.name }}</div>
          <div class="text-[10px] text-green-400 font-mono mt-1">
            <span v-if="slot.item.stats.damage">+{{ slot.item.stats.damage }} DMG</span>
            <span v-else-if="slot.item.stats.attackSpeed">+{{ slot.item.stats.attackSpeed }} SPD</span>
            <span v-else-if="slot.item.stats.hp">+{{ slot.item.stats.hp }} HP</span>
            <span v-else-if="slot.item.stats.defense">+{{ slot.item.stats.defense }} DEF</span>
            <span v-else-if="slot.item.stats.hpRegen">+{{ slot.item.stats.hpRegen }} REG</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>