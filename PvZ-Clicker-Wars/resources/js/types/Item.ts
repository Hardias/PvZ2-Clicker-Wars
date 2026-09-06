import { BigNum } from '../utils/bigNumber';

export type ItemCategory = 'blades' | 'gloves' | 'amulet' | 'armor' | 'trinket' | 'final';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

// Loose numeric union so the hand-authored base catalog stays type-safe: raw items use plain
// numbers, runtime/derived items use Decimals (coerce with big()/desBig()).
export type LooseNumber = BigNum | number;

export interface ItemStats {
  damage?: LooseNumber;
  attackSpeed?: number; // % attack speed bonus (0-1e6% cap)
  hp?: LooseNumber;
  defense?: LooseNumber;
  defenseReduction?: number; // 0 to <1 (e.g. 0.09 for 9%) — stays a plain number
  hpRegen?: LooseNumber;
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  stats: ItemStats;
  cost: LooseNumber;
  currency: 'minerals' | 'vespene';
  description: string;
}

export interface InventorySlot {
  slotIndex: number;
  category: ItemCategory;
  item: Item | null;
}