<script setup lang="ts">
import { ref, computed } from 'vue';
import { Item, ItemCategory, InventorySlot } from '../types/Item';
import { formatNumber } from '../utils/format';

interface Props {
  minerals: number;
  vespeneGas: number;
  availableItems: Item[];
  slots: InventorySlot[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'buyItem', item: Item, slotIndex: number): void;
  (e: 'unequip', slotIndex: number): void;
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

const firstEmptySlotIndex = computed(() => {
  return props.slots.findIndex(s => s.item === null);
});

const hasEmptySlot = computed(() => firstEmptySlotIndex.value !== -1);

function canAfford(item: Item, minerals: number, vespene: number): boolean {
  if (item.currency === 'vespene') {
    return vespene >= item.cost;
  }
  return minerals >= item.cost;
}

function handleBuy(item: Item) {
  const emptyIdx = firstEmptySlotIndex.value;
  if (emptyIdx === -1) {
    alert('Inventaris is vol! Verkoop eerst een item.');
    return;
  }
  if (!canAfford(item, props.minerals, props.vespeneGas)) return;
  emit('buyItem', item, emptyIdx);
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gray-900 border-2 border-cyan-500 rounded-xl p-6 max-w-4xl w-full text-cyan-100 shadow-2xl shadow-cyan-500/25 max-h-[92vh] flex flex-col">
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-cyan-800 pb-4 mb-4">
        <div>
          <h2 class="text-xl font-bold tracking-wider text-amber-400">ZEALOT SHOP & INVENTARIS</h2>
          <p class="text-xs text-gray-400">Gekochte items worden automatisch in een leeg slot geplaatst. Klik op een item in je inventaris om het te verkopen voor een volledige refund.</p>
        </div>
        <div class="flex items-center space-x-3">
          <div class="bg-cyan-950 px-3 py-1.5 rounded border border-cyan-600 font-mono text-sm text-cyan-200 flex items-center space-x-3">
            <span class="flex items-center space-x-1">
              <img src="/crystal.png" class="w-4 h-4 inline-block object-contain" alt="Minerals" />
              <span>{{ formatNumber(minerals) }}M</span>
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

      <!-- Visible & Interactive Inventory inside Shop -->
      <div class="bg-gray-950 border border-cyan-800/60 rounded-xl p-4 mb-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-bold text-cyan-300 uppercase tracking-wider">Jouw Inventaris ({{ slots.filter(s => s.item !== null).length }} / 6 Slots Bezet)</span>
          <span class="text-[10px] text-gray-400">Klik op een item om te verkopen (+volledige kosten terug)</span>
        </div>
        <div class="grid grid-cols-6 gap-2">
          <div 
            v-for="(slot, index) in slots" 
            :key="index"
            class="relative bg-gray-900 border rounded-lg p-2.5 flex flex-col items-center justify-center min-h-[75px] transition-all group select-none"
            :class="slot.item ? 'border-cyan-500 bg-cyan-950/40 shadow-sm' : 'border-gray-800 bg-gray-950/50'"
          >
            <div class="absolute top-1 left-2 text-[9px] text-gray-500 font-mono">
              #{{ index + 1 }}
            </div>
            <div v-if="slot.item" class="text-center mt-2 w-full">
              <div class="text-[11px] font-bold text-cyan-200 truncate px-1" :title="slot.item.name">{{ slot.item.name }}</div>
              <div class="text-[9px] text-green-400 font-mono mt-0.5">
                <span v-if="slot.item.stats.damage">+{{ slot.item.stats.damage }} DMG</span>
                <span v-else-if="slot.item.stats.attackSpeed">+{{ slot.item.stats.attackSpeed }} SPD</span>
                <span v-else-if="slot.item.stats.hp">+{{ slot.item.stats.hp }} HP</span>
                <span v-else-if="slot.item.stats.defense">+{{ slot.item.stats.defense }} DEF</span>
                <span v-else-if="slot.item.stats.hpRegen">+{{ slot.item.stats.hpRegen }} REG</span>
              </div>
              <button 
                @click="emit('unequip', index)" 
                class="absolute inset-0 bg-red-950/95 text-red-200 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-lg cursor-pointer"
                :title="`Verkoop ${slot.item.name} voor ${slot.item.cost}${slot.item.currency === 'vespene' ? 'V' : 'M'}`"
              >
                <span>VERKOOP</span>
                <span class="text-[9px] text-amber-300">+{{ formatNumber(slot.item.cost) }}{{ slot.item.currency === 'vespene' ? 'V' : 'M' }}</span>
              </button>
            </div>
            <div v-else class="text-[10px] text-gray-600 italic mt-2">
              Leeg slot
            </div>
          </div>
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
              {{ item.currency === 'vespene' ? `${item.cost}V` : `${formatNumber(item.cost)}M` }}
            </span>
            <button 
              @click="handleBuy(item)"
              :disabled="!canAfford(item, minerals, vespeneGas) || !hasEmptySlot"
              class="px-4 py-2 rounded text-xs font-bold tracking-wider transition-all shadow-md"
              :class="canAfford(item, minerals, vespeneGas) && hasEmptySlot ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-amber-600/30' : 'bg-gray-800 text-gray-500 cursor-not-allowed'"
            >
              {{ !hasEmptySlot ? 'INVENTARIS VOL' : (canAfford(item, minerals, vespeneGas) ? 'KOOP ITEM' : 'TE WEINIG FUNDS') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-4 pt-4 border-t border-cyan-800 text-center text-xs text-gray-500">
        Items worden automatisch in je eerstvolgende lege inventarisslot geplaatst.
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
