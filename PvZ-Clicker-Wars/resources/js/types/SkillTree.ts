export type SkillBranch = 'vengeance' | 'resilience' | 'wealth';

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  row: number;
  name: string;
  description: string;
  icon: string;
  cost: number;
  requiresPrevious: boolean;
}

export interface SkillTreeState {
  unlockedNodes: string[];
  xp: number;
  spentXp: number;
}

export interface SkillBonuses {
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  critChance: number;
  critMultiplier: number;
  comboMaxBonus: number;
  maxHpMultiplier: number;
  hpRegenPercent: number;
  turretDamageReduction: number;
  thornsReflect: number;
  extraTeleports: number;
  undyingEnabled: boolean;
  vespeneConversionMultiplier: number;
  autoVespenePercent: number;
  killBountyPercent: number;
  vespeneBountyPercent: number;
  shopPriceReduction: number;
  vespeneItemDiscount: number;
}

export const SKILL_BRANCHES: Record<SkillBranch, { name: string; icon: string; color: string }> = {
  vengeance: { name: 'Vengeance', icon: '\u2694\uFE0F', color: 'red' },
  resilience: { name: 'Resilience', icon: '\uD83D\uDEE1\uFE0F', color: 'green' },
  wealth: { name: 'Wealth', icon: '\uD83D\uDCB0', color: 'blue' },
};

export const SKILL_NODES: SkillNode[] = [
  // Vengeance (Offense)
  { id: 'v1', branch: 'vengeance', row: 1, name: 'Sharpen Blades', description: '+15% click damage', icon: '🗡️', cost: 50, requiresPrevious: false },
  { id: 'v2', branch: 'vengeance', row: 2, name: 'Quick Strikes', description: '+10% attack speed', icon: '⚡', cost: 100, requiresPrevious: true },
  { id: 'v3', branch: 'vengeance', row: 3, name: 'Critical Edge', description: '8% crit chance, 2x damage', icon: '🎯', cost: 250, requiresPrevious: true },
  { id: 'v4', branch: 'vengeance', row: 4, name: 'Fury Focus', description: '+25% click damage', icon: '🔥', cost: 500, requiresPrevious: true },
  { id: 'v5', branch: 'vengeance', row: 5, name: 'Deadly Precision', description: '+12% crit chance', icon: '💢', cost: 1000, requiresPrevious: true },
  { id: 'v6', branch: 'vengeance', row: 6, name: 'Berserker Rage', description: 'Combo max +25 (75)', icon: '🌪️', cost: 2000, requiresPrevious: true },
  { id: 'v7', branch: 'vengeance', row: 7, name: 'Umbral Blender', description: 'Crits 3x, +40% damage', icon: '☠️', cost: 5000, requiresPrevious: true },

  // Resilience (Defense)
  { id: 'r1', branch: 'resilience', row: 1, name: 'Fortified Body', description: '+40% max HP', icon: '🛡️', cost: 50, requiresPrevious: false },
  { id: 'r2', branch: 'resilience', row: 2, name: 'Psionic Recovery', description: '+2% max HP per second regen', icon: '💠', cost: 100, requiresPrevious: true },
  { id: 'r3', branch: 'resilience', row: 3, name: 'Kinetic Plating', description: '-15% turret damage (stacks with armor)', icon: '🧱', cost: 250, requiresPrevious: true },
  { id: 'r4', branch: 'resilience', row: 4, name: 'Second Wind', description: '+1 Emergency Teleport', icon: '💨', cost: 500, requiresPrevious: true },
  { id: 'r5', branch: 'resilience', row: 5, name: 'Iron Bastion', description: '+30% max HP, -10% turret damage', icon: '🗿', cost: 1000, requiresPrevious: true },
  { id: 'r6', branch: 'resilience', row: 6, name: 'Reflective Aegis', description: 'Reflect 25% of damage taken back to the wall', icon: '🪞', cost: 2000, requiresPrevious: true },
  { id: 'r7', branch: 'resilience', row: 7, name: 'Undying', description: 'Survive a fatal hit at 1 HP, then 3s damage immunity', icon: '♾️', cost: 5000, requiresPrevious: true },

  // Wealth (Economy) - Vespene Titans
  { id: 'w1', branch: 'wealth', row: 1, name: 'Gas Refinery', description: '+100% vespene conversion rate (64,000M -> 32,000M per V)', icon: '🛢️', cost: 50, requiresPrevious: false },
  { id: 'w2', branch: 'wealth', row: 2, name: 'Bounty Contract', description: '+3% of wall max HP as minerals on kill', icon: '💎', cost: 100, requiresPrevious: true },
  { id: 'w3', branch: 'wealth', row: 3, name: 'Vespene Siphon', description: '5% of minerals earned auto-converts to vespene', icon: '🧪', cost: 250, requiresPrevious: true },
  { id: 'w4', branch: 'wealth', row: 4, name: 'Vespene Tithe', description: '+3% of wall max HP as vespene on kill', icon: '⚗️', cost: 500, requiresPrevious: true },
  { id: 'w5', branch: 'wealth', row: 5, name: 'Bargain Hunter', description: '-25% shop prices', icon: '🏷️', cost: 1000, requiresPrevious: true },
  { id: 'w6', branch: 'wealth', row: 6, name: 'Void Warden', description: '-30% cost on vespene shop items', icon: '🔮', cost: 2000, requiresPrevious: true },
  { id: 'w7', branch: 'wealth', row: 7, name: 'Khaydarin Engine', description: '+100% vespene conversion, +6% wall max HP minerals bounty', icon: '🏆', cost: 5000, requiresPrevious: true },
];

export const DEFAULT_SKILL_BONUSES: SkillBonuses = {
  damageMultiplier: 1.0,
  attackSpeedMultiplier: 1.0,
  critChance: 0,
  critMultiplier: 2.0,
  comboMaxBonus: 0,
  maxHpMultiplier: 1.0,
  hpRegenPercent: 0,
  turretDamageReduction: 0,
  thornsReflect: 0,
  extraTeleports: 0,
  undyingEnabled: false,
  vespeneConversionMultiplier: 1.0,
  autoVespenePercent: 0,
  killBountyPercent: 0,
  vespeneBountyPercent: 0,
  shopPriceReduction: 0,
  vespeneItemDiscount: 0,
};
