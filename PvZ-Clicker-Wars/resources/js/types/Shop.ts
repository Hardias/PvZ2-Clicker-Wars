import { Item } from './Item';

export interface ShopUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  costMultiplier: number;
  level: number;
  maxLevel?: number;
  effectValue: number;
}

export interface ShopState {
  isAtShop: boolean;
  availableItems: Item[];
  availableUpgrades: ShopUpgrade[];
}
