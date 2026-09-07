import { ref, computed } from 'vue';
import { Item, InventorySlot, ItemStats } from '../types/Item';
import { big, desBig, BigNum } from '../utils/bigNumber';

/**
 * Composable managing Zealot 6-slot inventory, item equipping, unequipping, and combined equipment stats.
 */

/** Build the 6 empty inventory slots (single source of truth for fresh inventories). */
export function createEmptyInventorySlots(): InventorySlot[] {
  return [
    { slotIndex: 0, category: 'blades', item: null },
    { slotIndex: 1, category: 'blades', item: null },
    { slotIndex: 2, category: 'blades', item: null },
    { slotIndex: 3, category: 'blades', item: null },
    { slotIndex: 4, category: 'blades', item: null },
    { slotIndex: 5, category: 'blades', item: null },
  ];
}

export function useInventory() {
  /** Deserialize a saved item (legacy numeric saves get upgraded to Decimals). */
  function deserializeItem(item: Record<string, unknown>): Item {
    const stats = (item?.stats || {}) as Record<string, unknown>;
    return {
      id: (item?.id as string) || '',
      name: (item?.name as string) || 'Unknown item',
      category: (item?.category as Item['category']) || 'blades',
      rarity: (item?.rarity as Item['rarity']) || 'common',
      stats: {
        damage: stats.damage !== undefined ? desBig(stats.damage, 0) : undefined,
        attackSpeed: typeof stats.attackSpeed === 'number' ? (stats.attackSpeed as number) : undefined,
        hp: stats.hp !== undefined ? desBig(stats.hp, 0) : undefined,
        defense: stats.defense !== undefined ? desBig(stats.defense, 0) : undefined,
        defenseReduction: typeof stats.defenseReduction === 'number' ? (stats.defenseReduction as number) : undefined,
        hpRegen: stats.hpRegen !== undefined ? desBig(stats.hpRegen, 0) : undefined,
      },
      cost: desBig(item?.cost, 0),
      currency: (item?.currency as Item['currency']) || 'minerals',
      description: (item?.description as string) || '',
    };
  }

  /** Load initial 6 equipment slots from storage or empty slots */
  function loadInitialSlots(): InventorySlot[] {
    try {
      const raw = localStorage.getItem('pvz2_slot_A') || localStorage.getItem('pvz2_slot_B') || localStorage.getItem('pvz2_slot_C') || localStorage.getItem('pvz2_autosave') || localStorage.getItem('pvz2_inventory');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const savedSlots = (parsed.inventory || parsed) as Array<Record<string, unknown>>;
        if (Array.isArray(savedSlots) && savedSlots.length === 6) {
          return savedSlots.map((s, idx) => {
            const itemObj = s.item as Record<string, unknown> | undefined;
            return {
              slotIndex: idx,
              category: (itemObj?.category as Item['category']) || 'blades',
              item: itemObj ? deserializeItem(itemObj) : null,
            };
          });
        }
      }
    } catch (e) {
      console.error('Failed to load inventory from storage:', e);
    }
    return createEmptyInventorySlots();
  }

  // Reactive 6 equipment slots
  const slots = ref<InventorySlot[]>(loadInitialSlots());

  // Compute total aggregated stats across all equipped items in the 6 slots
  const totalEquipmentStats = computed<ItemStats & { hasGloves: boolean; totalDefenseReduction: number }>(() => {
    const stats: ItemStats & { hasGloves: boolean; totalDefenseReduction: number } = {
      damage: big(0),
      attackSpeed: 0,
      hp: big(0),
      defense: big(0),
      defenseReduction: 0,
      hpRegen: big(0),
      hasGloves: false,
      totalDefenseReduction: 0,
    };

    // Auto-attack enabled if gloves equipped OR vespene blade / final item equipped
    stats.hasGloves = slots.value.some(s => s.item && (s.item.category === 'gloves' || s.item.currency === 'vespene' || s.item.category === 'final'));

    let maxAttackSpeed = 0;
    let combinedReduction = 0;

    for (const slot of slots.value) {
      if (slot.item) {
        if (slot.item.stats.damage) stats.damage = (stats.damage as BigNum).add(slot.item.stats.damage);
        if (slot.item.stats.hp) stats.hp = (stats.hp as BigNum).add(slot.item.stats.hp);
        if (slot.item.stats.defense) stats.defense = (stats.defense as BigNum).add(slot.item.stats.defense);
        if (slot.item.stats.hpRegen) stats.hpRegen = (stats.hpRegen as BigNum).add(slot.item.stats.hpRegen);

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
  function loadInventory(savedSlots: InventorySlot[] | Array<Record<string, unknown>>) {
    if (savedSlots && Array.isArray(savedSlots) && savedSlots.length === 6) {
      slots.value = savedSlots.map((s, idx) => {
        const rawItem = (s as Record<string, unknown>).item as Record<string, unknown> | undefined;
        return {
          slotIndex: idx,
          category: (rawItem?.category as Item['category']) || 'blades',
          item: rawItem ? deserializeItem(rawItem) : null,
        };
      });
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