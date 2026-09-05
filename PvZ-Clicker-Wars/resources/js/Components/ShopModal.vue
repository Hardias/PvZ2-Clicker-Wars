<script setup lang="ts">
import { ref, computed } from 'vue';
import { Item, ItemCategory, InventorySlot } from '../types/Item';
import { formatNumber } from '../utils/format';
import { getShopMultiplierLabel, getShopRankName } from '../utils/shopUpgrade';

interface Props {
  minerals: number;
  vespeneGas: number;
  infiniteVespene?: boolean;
  availableItems: Item[];
  slots: InventorySlot[];
  shopCycle: number;
  wallCycle: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'buyItem', item: Item, slotIndex: number): void;
  (e: 'unequip', slotIndex: number): void;
  (e: 'convertMaxVespene'): void;
  (e: 'upgradeShop'): void;
  (e: 'close'): void;
}>();

const activeTab = ref<ItemCategory>('blades');
const maxPossibleV = computed(() => Math.floor(props.minerals / 64000));

const shopRankName = computed(() => getShopRankName(props.shopCycle));
const shopMultiplierLabel = computed(() => getShopMultiplierLabel(props.shopCycle));
const nextMultiplierLabel = computed(() => getShopMultiplierLabel(props.wallCycle));
const shopUpgradeAvailable = computed(() => props.wallCycle > props.shopCycle);

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

/** With infinite Vespene Gas: vespene items may overwrite slot #1 when inventory is full */
function replacementAllowed(item: Item): boolean {
  return item.currency === 'vespene' && props.infiniteVespene === true;
}

function buySlotFor(item: Item): number {
  const emptyIdx = firstEmptySlotIndex.value;
  if (emptyIdx !== -1) return emptyIdx;
  if (replacementAllowed(item)) return 0;
  return -1;
}

function canAfford(item: Item, minerals: number, vespene: number): boolean {
  if (item.currency === 'vespene') {
    if (props.infiniteVespene) return true;
    return vespene >= item.cost;
  }
  return minerals >= item.cost;
}

function canBuy(item: Item): boolean {
  return canAfford(item, props.minerals, props.vespeneGas) && buySlotFor(item) !== -1;
}

function buttonLabel(item: Item): string {
  if (!canAfford(item, props.minerals, props.vespeneGas)) return 'NOT ENOUGH FUNDS';
  if (buySlotFor(item) === -1) return 'INVENTORY FULL';
  if (!hasEmptySlot.value) return 'BUY (REPLACE #1)';
  return 'BUY ITEM';
}

function handleBuy(item: Item) {
  const idx = buySlotFor(item);
  if (idx === -1) return;
  emit('buyItem', item, idx);
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
    <div class="min-h-full flex items-start sm:items-center justify-center">
      <div class="w-full max-w-4xl bg-gray-900 border-2 border-cyan-500 px-4 sm:px-6 py-5 sm:py-6 text-cyan-100 shadow-2xl shadow-cyan-500/25 rounded-none sm:rounded-xl">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-cyan-800 pb-4 mb-4">
          <div>
            <h2 class="text-lg sm:text-xl font-bold tracking-wider text-amber-400">ZEALOT SHOP &amp; INVENTORY</h2>
            <p class="text-xs text-gray-400 mt-0.5">Purchased items are automatically placed in the first empty slot. Click an item in your inventory to sell it for a full refund.</p>
          </div>
          <div class="flex items-center justify-between gap-2 sm:justify-end">
            <div class="bg-cyan-950 px-3 py-1.5 rounded border border-cyan-600 font-mono text-sm text-cyan-200 flex items-center space-x-3">
              <span class="flex items-center space-x-1">
                <img src="/crystal.png" class="w-4 h-4 inline-block object-contain" alt="Minerals" />
                <span>{{ formatNumber(minerals) }}M</span>
              </span>
              <span class="text-green-400 flex items-center space-x-1">
                <span>🟢</span>
                <span>{{ infiniteVespene ? '∞' : formatNumber(vespeneGas) }}V</span>
              </span>
            </div>
            <button @click="emit('close')" class="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs text-gray-300 font-bold border border-gray-600 cursor-pointer">
              [ X ]
            </button>
          </div>
        </div>

        <!-- Shop Tier + D-Rank Upgrade Banner -->
        <div class="mb-4 space-y-3">
          <div class="flex justify-between items-center bg-gray-950 border border-cyan-800/60 rounded-lg px-4 py-2.5">
            <span class="text-xs font-bold text-cyan-300 uppercase tracking-wider">Shop Tier</span>
            <span class="text-xs font-mono font-bold text-amber-300">
              {{ shopRankName || 'Basic' }} ({{ shopMultiplierLabel }})
            </span>
          </div>

          <div v-if="shopUpgradeAvailable" class="bg-amber-950/70 border-2 border-amber-500 rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between shadow-lg shadow-amber-500/20">
            <div>
              <div class="text-sm font-bold text-amber-300">⬆ SHOP UPGRADE AVAILABLE!</div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                A Final Wall cycle has been completed. Upgrade the shop for free so ALL items scale just as hard as the Final Wall ({{ nextMultiplierLabel }} stats &amp; cost).
              </div>
            </div>
            <button
              @click="emit('upgradeShop')"
              class="w-full sm:w-auto px-4 py-3 rounded-lg text-xs font-bold tracking-wider transition-all shadow-lg bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-amber-600/30 whitespace-nowrap"
            >
              UPGRADE SHOP → {{ nextMultiplierLabel }}
            </button>
          </div>
        </div>

        <!-- Visible & Interactive Inventory inside Shop -->
        <div class="bg-gray-950 border border-cyan-800/60 rounded-xl p-4 mb-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-cyan-300 uppercase tracking-wider">Your Inventory ({{ slots.filter(s => s.item !== null).length }} / 6 Slots Used)</span>
            <span class="text-[10px] text-gray-400">Click an item to sell it (+full cost back)</span>
          </div>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div 
              v-for="(slot, index) in slots" 
              :key="index"
              class="relative bg-gray-900 border rounded-lg p-2.5 flex flex-col items-center justify-center min-h-[75px] transition-all group select-none"
              :class="slot.item ? 'border-cyan-500 bg-cyan-950/40 shadow-sm' : 'border-gray-800 bg-gray-950/50'"
            >
              <div class="absolute top-1 left-2 text-[9px] text-gray-500 font-mono">
                #{{ index + 1 }}
              </div>

              <!-- Touch-friendly sell badge (always visible) -->
              <button
                v-if="slot.item"
                @click.stop="emit('unequip', index)"
                class="absolute top-1 right-1 z-10 w-5 h-5 rounded-md bg-red-950/90 hover:bg-red-800 text-red-300 text-[10px] font-bold leading-none flex items-center justify-center border border-red-700/60 cursor-pointer opacity-80"
                :title="`Sell ${slot.item.name} for ${formatNumber(slot.item.cost)}${slot.item.currency === 'vespene' ? 'V' : 'M'}`"
              >
                ✕
              </button>

              <!-- Desktop hover sell overlay -->
              <button 
                @click.stop="emit('unequip', index)" 
                class="absolute inset-0 bg-red-950/95 text-red-200 text-[10px] font-bold hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-col items-center justify-center rounded-lg cursor-pointer"
                :title="`Sell ${slot.item.name} for ${formatNumber(slot.item.cost)}${slot.item.currency === 'vespene' ? 'V' : 'M'}`"
              >
                <span>SELL</span>
                <span class="text-[9px] text-amber-300">+{{ formatNumber(slot.item.cost) }}{{ slot.item.currency === 'vespene' ? 'V' : 'M' }}</span>
              </button>

              <div v-if="slot.item" class="text-center mt-2 w-full px-1">
                <div class="text-[11px] font-bold text-cyan-200 truncate px-1" :title="slot.item.name">{{ slot.item.name }}</div>
                <div class="text-[9px] text-green-400 font-mono mt-0.5">
                  <span v-if="slot.item.stats.damage">+{{ formatNumber(slot.item.stats.damage) }} DMG</span>
                  <span v-else-if="slot.item.stats.attackSpeed">+{{ formatNumber(slot.item.stats.attackSpeed) }} SPD</span>
                  <span v-else-if="slot.item.stats.hp">+{{ formatNumber(slot.item.stats.hp) }} HP</span>
                  <span v-else-if="slot.item.stats.defense">+{{ formatNumber(slot.item.stats.defense) }} DEF</span>
                  <span v-else-if="slot.item.stats.hpRegen">+{{ formatNumber(slot.item.stats.hpRegen) }} REG</span>
                </div>
              </div>
              <div v-else class="text-[10px] text-gray-600 italic mt-2">
                Empty slot
              </div>
            </div>
          </div>
        </div>

        <!-- Vespene Gas Exchange Section -->
        <div class="bg-gray-950 border border-green-900/60 rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
          <div>
            <div class="text-xs font-bold text-green-400">Max Vespene Gas Exchange</div>
            <div class="text-[10px] text-gray-400">Cost: 64,000 Minerals (64,000M) = 1V (Vespene Gas)</div>
          </div>
          <button 
            @click="emit('convertMaxVespene')"
            :disabled="minerals < 64000"
            class="w-full sm:w-auto px-4 py-2 rounded text-xs font-bold transition-all shadow-lg"
            :class="minerals >= 64000 ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-green-600/30' : 'bg-gray-800 text-gray-500 cursor-not-allowed'"
          >
            BUY MAX VESPENE ({{ maxPossibleV }}V)
          </button>
        </div>

        <!-- Category Tabs (horizontally scrollable on mobile) -->
        <div class="flex items-center space-x-2 overflow-x-auto no-scrollbar border-b border-cyan-800/60 pb-3 mb-3 -mx-1 px-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.key"
            @click="activeTab = tab.key"
            class="px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0"
            :class="activeTab === tab.key ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'bg-gray-950 text-gray-400 hover:text-gray-200 border border-cyan-900'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Items list -->
        <div class="space-y-3 pb-1">
          <div v-for="item in filteredItems" :key="item.id" class="bg-gray-950 border border-cyan-900/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-500/50 transition-all">
            <div class="min-w-0">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-cyan-300">{{ item.name }}</span>
              </div>
              <p class="text-xs text-gray-400 mt-1">{{ item.description }}</p>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <span class="font-mono font-bold text-sm" :class="item.currency === 'vespene' ? 'text-green-400' : 'text-blue-400'">
                {{ item.currency === 'vespene' ? `${item.cost}V` : `${formatNumber(item.cost)}M` }}
              </span>
              <button 
                @click="handleBuy(item)"
                :disabled="!canBuy(item)"
                class="flex-1 sm:flex-none px-4 py-2 rounded text-xs font-bold tracking-wider transition-all shadow-md"
                :class="canBuy(item) ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-amber-600/30' : 'bg-gray-800 text-gray-500 cursor-not-allowed'"
              >
                {{ buttonLabel(item) }}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-4 pt-4 border-t border-cyan-800 text-center text-xs text-gray-500">
          Items are automatically placed in your next empty inventory slot.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>