export type ItemCategory = 'blades' | 'gloves' | 'amulet' | 'armor' | 'trinket' | 'final';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemStats {
  damage?: number;
  attackSpeed?: number;
  hp?: number;
  defense?: number;
  defenseReduction?: number; // 0 to 1 (e.g. 0.09 for 9%)
  hpRegen?: number;
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  stats: ItemStats;
  cost: number;
  currency: 'minerals' | 'vespene';
  description: string;
}

export interface InventorySlot {
  slotIndex: number;
  category: ItemCategory;
  item: Item | null;
}
