import Decimal from 'break_eternity.js';
import { Item } from '../types/Item';
import { BigNum, big } from './bigNumber';
import { getRankName } from './ranks';
import { WALL_FINAL_GROWTH_PER_CYCLE } from './scaling';
import { formatNumber } from './format';

export const SHOP_UPGRADE_FACTOR = WALL_FINAL_GROWTH_PER_CYCLE;

/** Get the stat/cost multiplier for a given shop cycle count (a Decimal; unbounded). */
export function getShopMultiplier(shopCycle: number): BigNum {
  return Decimal.pow(SHOP_UPGRADE_FACTOR, shopCycle);
}

/** Format a shop cycle multiplier for display, e.g. "x1.5" */
export function getShopMultiplierLabel(shopCycle: number): string {
  return 'x' + formatNumber(getShopMultiplier(shopCycle));
}

/** Get the rank label for a given shop cycle count, using the probe/wall rank ladder
   *  (1 => "D Rank", 2 => "D+ Rank", 3 => "C- Rank", ...; 0 = base items, secretly D-, not shown) */
export function getShopRankName(shopCycle: number): string {
  if (shopCycle <= 0) return '';
  return `${getRankName(shopCycle)} Rank`;
}

/** Build a fresh description from scaled stats so old hardcoded numbers never leak */
function buildScaledDescription(item: Item): string {
  const costLabel = item.currency === 'vespene' ? `${formatNumber(item.cost)}V` : `${formatNumber(item.cost)}M`;
  const parts: string[] = [];
  if (item.stats.damage) parts.push(`+${formatNumber(item.stats.damage)} Damage`);
  if (item.stats.attackSpeed) parts.push(`+${Math.round(item.stats.attackSpeed * 100)}% Attack Speed`);
  if (item.stats.hp) parts.push(`+${formatNumber(item.stats.hp)} Health`);
  if (item.stats.defense) parts.push(`+${formatNumber(item.stats.defense)} Defense`);
  if (item.stats.defenseReduction !== undefined) {
    const rpct = item.stats.defenseReduction * 100;
    parts.push(`${rpct >= 99.9 ? rpct.toFixed(4) : rpct.toFixed(2)}% Damage Reduction`);
  }
  if (item.stats.hpRegen) parts.push(`+${formatNumber(item.stats.hpRegen)}/s HP Regen`);
  const suffix = item.category === 'final' ? ' (Final Tier)' : '';
  return `${costLabel} | ${parts.join(' & ')}${suffix}`;
}

/** Maximum attack-speed bonus a glove item can reach (prevents overflow silliness). */
const MAX_ATTACK_SPEED_BONUS = 1e6;

/** Create an upgraded (next-rank) copy of a shop item; stats/costs scale exactly like the Final Wall HP */
export function scaleShopItem(item: Item, multiplier: BigNum, rankName?: string): Item {
  const stats = { ...item.stats };
  if (stats.damage !== undefined) stats.damage = big(stats.damage).mul(multiplier).floor();
  if (stats.attackSpeed !== undefined) {
    const scaled = Math.min(stats.attackSpeed * multiplier.toNumber(), MAX_ATTACK_SPEED_BONUS);
    stats.attackSpeed = Math.round(scaled * 100) / 100;
  }
  if (stats.hp !== undefined) stats.hp = big(stats.hp).mul(multiplier).floor();
  if (stats.defense !== undefined) stats.defense = big(stats.defense).mul(multiplier).floor();
  if (stats.hpRegen !== undefined) stats.hpRegen = big(stats.hpRegen).mul(multiplier).floor();
  // Armor scales via its effective mitigation (survival multiplier = 1/(1-reduction)) so it keeps pace
  // with wall HP and blade damage instead of being clamped to 0.999 (which only made it more expensive).
  if (stats.defenseReduction !== undefined) {
    const mitigation = 1 / Math.max(1e-6, 1 - stats.defenseReduction);
    stats.defenseReduction = 1 - 1 / Math.max(1, mitigation * multiplier.toNumber());
  }

  const cost = big(item.cost).mul(multiplier).floor();
  const name = rankName ? `${item.name} [${rankName}]` : item.name;
  const scaled: Item = {
    ...item,
    name,
    stats,
    cost,
  };
  scaled.description = buildScaledDescription(scaled);
  return scaled;
}