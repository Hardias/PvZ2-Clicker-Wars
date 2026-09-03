import { ref, computed } from 'vue';
import { Item, InventorySlot, ItemStats } from '../types/Item';

/**
 * Composable managing Zealot 6-slot inventory, item equipping, unequipping, and combined equipment stats.
 */
export function useInventory() {
  /** Load initial 6 equipment slots from storage or empty slots */
  function loadInitialSlots(): InventorySlot[] {
    try {
      const raw = localStorage.getItem('pvz2_slot_A') || localStorage.getItem('pvz2_slot_B') || localStorage.getItem('pvz2_slot_C') || localStorage.getItem('pvz2_autosave') || localStorage.getItem('pvz2_inventory');
      if (raw) {
        const parsed = JSON.parse(raw);
        const savedSlots = parsed.inventory || parsed;
        if (Array.isArray(savedSlots) && savedSlots.length === 6) {
          return savedSlots.map((s, idx) => ({
            slotIndex: idx,
            category: s.item ? s.item.category : 'blades',
            item: s.item || null,
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load inventory from storage:', e);
    }
    return [
      { slotIndex: 0, category: 'blades', item: null },
      { slotIndex: 1, category: 'blades', item: null },
      { slotIndex: 2, category: 'blades', item: null },
      { slotIndex: 3, category: 'blades', item: null },
      { slotIndex: 4, category: 'blades', item: null },
      { slotIndex: 5, category: 'blades', item: null },
    ];
  }

  // Reactive 6 equipment slots
  const slots = ref<InventorySlot[]>(loadInitialSlots());

  // Compute total aggregated stats across all equipped items in the 6 slots
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

    // Auto-attack enabled if gloves equipped OR vespene blade / final item equipped
    stats.hasGloves = slots.value.some(s => s.item && (s.item.category === 'gloves' || s.item.currency === 'vespene' || s.item.category === 'final'));

    let maxAttackSpeed = 0;
    let combinedReduction = 0;

    for (const slot of slots.value) {
      if (slot.item) {
        if (slot.item.stats.damage) stats.damage! += slot.item.stats.damage;
        if (slot.item.stats.hp) stats.hp! += slot.item.stats.hp;
        if (slot.item.stats.defense) stats.defense! += slot.item.stats.defense;
        if (slot.item.stats.hpRegen) stats.hpRegen! += slot.item.stats.hpRegen;

        let spd = slot.item.stats.attackSpeed || 0;
        if (slot.item.category === 'blades' && slot.item.currency === 'vespene') {
          spd = Math.max(spd, 4.0);
        }
        if (slot.item.category === 'final' && slot.item.stats.attackSpeed) {
          spd = Math.max(spd, slot.item.stats.attackSpeed);
        }

        // Attack speed does not stack; take maximum item speed once
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

  /** Equip an item into a specific slot index */
  function equipItem(item: Item, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= slots.value.length) return false;
    slots.value[slotIndex].category = item.category;
    slots.value[slotIndex].item = item;
    return true;
  }

  /** Unequip and remove item from a specific slot index */
  function unequipItem(slotIndex: number): Item | null {
    if (slotIndex < 0 || slotIndex >= slots.value.length) return null;
    const item = slots.value[slotIndex].item;
    slots.value[slotIndex].item = null;
    return item;
  }

  /** Load saved inventory slots */
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
