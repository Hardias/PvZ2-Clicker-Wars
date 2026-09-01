<script setup lang="ts">
import { ref, computed } from 'vue';
import { Item, ItemCategory } from '../types/Item';

interface Props {
  minerals: number;
  vespeneGas: number;
  availableItems: Item[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'buyItem', item: Item, slotIndex: number): void;
  (e: 'convertMaxVespene'): void;
  (e: 'close'): void;
}>();

const activeTab = ref<ItemCategory>('blades');
const maxPossibleV = computed(() => Math.floor(props.minerals / 64000));

const tabs: { key: ItemCategory; label: string }[] = [
  { key: 'blades', label: '⚔️ Blades' },
  { key: 'gloves', label: '🥊 Gloves' },
  { key: 'armor', label: '🛡️ Armor' },
  { key: 'amulet', label: '📿 Amulets' },
  { key: 'trinket', label: '🧪 Potions' },
  { key: 'final', label: '✨ Final Items' },
];

const filteredItems = computed(() => {
  return props.availableItems.filter(item => item.category === activeTab.value);
});

function canAfford(item: Item, minerals: number, vespene: number): boolean {
  if (item.currency === 'vespene') {
    return vespene >= item.cost;
  }
  return minerals >= item.cost;
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gray-900 border-2 border-cyan-500 rounded-xl p-6 max-w-3xl w-full text-cyan-100 shadow-2xl shadow-cyan-500/25 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-cyan-800 pb-4 mb-4">
        <div>
          <h2 class="text-xl font-bold tracking-wider text-amber-400">ZEALOT SHOP</h2>
          <p class="text-xs text-gray-400">Equip items in any of your 6 flexible slots. Convert Minerals into Vespene Gas (64,000M = 1V).</p>
        </div>
        <div class="flex items-center space-x-3">
          <div class="bg-cyan-950 px-3 py-1.5 rounded border border-cyan-600 font-mono text-sm text-cyan-200 flex items-center space-x-3">
            <span class="flex items-center space-x-1">
              <img src="/crystal.png" class="w-4 h-4 inline-block object-contain" alt="Minerals" />
              <span>{{ minerals.toLocaleString() }}M</span>
            </span>
            <span class="text-green-400 flex items-center space-x-1">
              <span>🟢</span>
              <span>{{ vespeneGas }}V</span>
            </span>
          </div>
          <button @click="emit('close')" class="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs text-gray-300 font-bold border border-gray-600">
            [ X ]
          </button>
        </div>
      </div>

      <!-- Vespene Gas Exchange Section -->
      <div class="bg-gray-950 border border-green-900/60 rounded-lg p-3 mb-4 flex justify-between items-center">
        <div>
          <div class="text-xs font-bold text-green-400">Max Vespene Gas Exchange</div>
          <div class="text-[10px] text-gray-400">Cost: 64,000 Minerals (64,000M) = 1V (Vespene Gas)</div>
        </div>
        <div>
          <button 
            @click="emit('convertMaxVespene')"
            :disabled="minerals < 64000"
            class="px-4 py-2 rounded text-xs font-bold transition-all shadow-lg"
            :class="minerals >= 64000 ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-green-600/30' : 'bg-gray-800 text-gray-500 cursor-not-allowed'"
          >
            BUY MAX VESPENE ({{ maxPossibleV }}V)
          </button>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="flex space-x-2 border-b border-cyan-800/60 pb-3 mb-3">
        <button 
          v-for="tab in tabs" 
          :key="tab.key"
          @click="activeTab = tab.key"
          class="px-4 py-2 rounded-lg text-xs font-bold transition-all"
          :class="activeTab === tab.key ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'bg-gray-950 text-gray-400 hover:text-gray-200 border border-cyan-900'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Items list -->
      <div class="overflow-y-auto space-y-3 pr-2 flex-1">
        <div v-for="item in filteredItems" :key="item.id" class="bg-gray-950 border border-cyan-900/60 rounded-lg p-4 flex justify-between items-center hover:border-cyan-500/50 transition-all">
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-bold text-cyan-300">{{ item.name }}</span>
            </div>
            <p class="text-xs text-gray-400 mt-1">{{ item.description }}</p>
          </div>

          <div class="flex items-center space-x-4">
            <span class="font-mono font-bold text-sm" :class="item.currency === 'vespene' ? 'text-green-400' : 'text-blue-400'">
              {{ item.currency === 'vespene' ? `${item.cost}V` : `${item.cost.toLocaleString()}M` }}
            </span>
            <div class="flex space-x-1">
              <button 
                v-for="slotIdx in 6"
                :key="slotIdx"
                @click="emit('buyItem', item, slotIdx - 1)"
                :disabled="!canAfford(item, minerals, vespeneGas)"
                class="px-2 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all"
                :class="canAfford(item, minerals, vespeneGas) ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'"
                :title="`Equip in Slot ${slotIdx}`"
              >
                S{{ slotIdx }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-4 pt-4 border-t border-cyan-800 text-center text-xs text-gray-500">
        Click S1-S6 to purchase and equip items directly into your 6 flexible slots.
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
