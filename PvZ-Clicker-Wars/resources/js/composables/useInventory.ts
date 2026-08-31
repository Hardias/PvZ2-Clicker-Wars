import { ref, computed } from 'vue';
import { Item, InventorySlot, ItemStats } from '../types/Item';

export function useInventory() {
  const slots = ref<InventorySlot[]>([
    { slotIndex: 0, category: 'blades', item: null },
    { slotIndex: 1, category: 'blades', item: null },
    { slotIndex: 2, category: 'blades', item: null },
    { slotIndex: 3, category: 'blades', item: null },
    { slotIndex: 4, category: 'blades', item: null },
    { slotIndex: 5, category: 'blades', item: null },
  ]);

  const totalEquipmentStats = computed<ItemStats & { hasGloves: boolean; totalDefenseReduction: number }>(() => {
    const stats: ItemStats & { hasGloves: boolean; totalDefenseReduction: number } = {
      damage: 0,
      attackSpeed: 0,
      hp: 0,
      defense: 0,
      defenseReduction: 0,
      hpRegen: 0,
      hasGloves: false,
      totalDefenseReduction: 0,
    };

    // Auto-attack enabled if gloves equipped OR any vespene gas blade equipped (which has max glove effect built-in)
    stats.hasGloves = slots.value.some(s => s.item && (s.item.category === 'gloves' || s.item.currency === 'vespene'));

    let maxAttackSpeed = 0;
    let combinedReduction = 0;

    for (const slot of slots.value) {
      if (slot.item) {
        if (slot.item.stats.damage) stats.damage! += slot.item.stats.damage;
        if (slot.item.stats.hp) stats.hp! += slot.item.stats.hp;
        if (slot.item.stats.defense) stats.defense! += slot.item.stats.defense;
        if (slot.item.stats.hpRegen) stats.hpRegen! += slot.item.stats.hpRegen;

        let spd = slot.item.stats.attackSpeed || 0;
        // Vespene gas blades have max glove effect built-in (+4.0 max speed)
        if (slot.item.category === 'blades' && slot.item.currency === 'vespene') {
          spd = Math.max(spd, 4.0);
        }

        // Attack speed does not stack; only the MAX item is counted ONCE
        if (spd > maxAttackSpeed) {
          maxAttackSpeed = spd;
        }

        if (slot.item.stats.defenseReduction !== undefined) {
          combinedReduction = 1 - (1 - combinedReduction) * (1 - slot.item.stats.defenseReduction);
        }
      }
    }

    stats.attackSpeed = maxAttackSpeed;
    stats.totalDefenseReduction = Math.min(0.999, combinedReduction);

    return stats;
  });

  function equipItem(item: Item, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= slots.value.length) return false;
    slots.value[slotIndex].category = item.category;
    slots.value[slotIndex].item = item;
    return true;
  }

  function unequipItem(slotIndex: number): Item | null {
    if (slotIndex < 0 || slotIndex >= slots.value.length) return null;
    const item = slots.value[slotIndex].item;
    slots.value[slotIndex].item = null;
    return item;
  }

  function loadInventory(savedSlots: any[]) {
    if (savedSlots && Array.isArray(savedSlots) && savedSlots.length === 6) {
      slots.value = savedSlots.map((s, idx) => ({
        slotIndex: idx,
        category: s.item ? s.item.category : 'blades',
        item: s.item || null,
      }));
    }
  }

  return {
    slots,
    totalEquipmentStats,
    equipItem,
    unequipItem,
    loadInventory,
  };
}
