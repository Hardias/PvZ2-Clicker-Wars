export type SkillBranch = 'vengeance' | 'resilience' | 'wealth';

/**
 * A talent node. Real tree semantics:
 * - `parents` = prerequisite nodes; empty = root. A node is investable when **any** parent
 *   has at least 1 point invested (keystones list every node of their feeding row).
 * - `row` = depth (1..7), `col` = horizontal slot (0..3, fractional allowed for centering).
 *   Hard rule: max 4 talents per row PER tree.
 * - `exclusiveGroup` = of/of pair; investing in one sibling locks the other.
 */
export interface SkillNode {
  id: string;
  branch: SkillBranch;
  row: number;
  col: number;
  name: string;
  description: string;
  icon: string;
  parents: string[];
  maxPoints: number;
  perPointLabel: string;
  exclusiveGroup?: string;
}

export interface SkillTreeState {
  level: number;
  xp: number;
  talentPoints: number;
  ranks: Record<string, number>;
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

/** Max talents per row PER tree (layout contract). */
export const MAX_TALENTS_PER_ROW = 4;

export const XP_CURVE_BASE = 50;
export const XP_CURVE_GROWTH = 1.35;

/** XP required to advance from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return Math.max(1, Math.floor(XP_CURVE_BASE * Math.pow(Math.max(1, level), XP_CURVE_GROWTH)));
}

export const SKILL_NODES: SkillNode[] = [
  // ── Vengeance (Offense) · 7 rows · max 4/row · 18 talents ─────────────
  { id: 'v1', branch: 'vengeance', row: 1, col: 1.5, name: 'Blade Mastery', description: 'The root of every zealot\'s craft. Each point hones your psi-blades into a sharper instrument.', icon: '🗡️', parents: [], maxPoints: 3, perPointLabel: '+2% click damage' },

  { id: 'v2', branch: 'vengeance', row: 2, col: 1, name: 'Sharpen Blades', description: 'Shapers reforge your psi-blades with every lesson. Each point sharpens your edge further.', icon: '⚔️', parents: ['v1'], maxPoints: 5, perPointLabel: '+2% click damage' },
  { id: 'v2b', branch: 'vengeance', row: 2, col: 2, name: 'Quick Strikes', description: 'A disciplined rhythm lets blade follow blade without pause. Nests of speed breed victory.', icon: '⚡', parents: ['v1'], maxPoints: 5, perPointLabel: '+2.5% attack speed' },

  { id: 'v3a', branch: 'vengeance', row: 3, col: 0, name: 'Fury Focus', description: 'Rage channelled into overwhelming force. Each point here spends a point not placed in Critical Edge.', icon: '🔥', parents: ['v2'], maxPoints: 3, perPointLabel: '+3% click damage', exclusiveGroup: 'vengeance-r3' },
  { id: 'v3b', branch: 'vengeance', row: 3, col: 1, name: 'Critical Edge', description: 'Every zealous strike may find the seam in a wall. Each point here forfeits a point in Fury Focus.', icon: '🎯', parents: ['v2'], maxPoints: 3, perPointLabel: '+3% crit chance', exclusiveGroup: 'vengeance-r3' },
  { id: 'v3c', branch: 'vengeance', row: 3, col: 2, name: 'Rapid Cycle', description: 'A manic tempo that never lets the blade rest. Your hands move before your mind does.', icon: '💫', parents: ['v2b'], maxPoints: 5, perPointLabel: '+2% attack speed' },

  { id: 'v4a', branch: 'vengeance', row: 4, col: 0, name: 'Sunder Armor', description: 'Strikes that split plating and spirit alike. Each rank digs deeper into a wall\'s integrity.', icon: '🪓', parents: ['v3a'], maxPoints: 5, perPointLabel: '+3% click damage' },
  { id: 'v4b', branch: 'vengeance', row: 4, col: 1, name: 'Deadly Precision', description: 'The hive mind sharpens your aim until probe defences barely matter.', icon: '💢', parents: ['v3b'], maxPoints: 5, perPointLabel: '+2% crit chance' },
  { id: 'v4c', branch: 'vengeance', row: 4, col: 2, name: 'Berserker Rage', description: 'A zealot lost in combat gains a tempo that cannot be negotiated.', icon: '🌪️', parents: ['v3c'], maxPoints: 5, perPointLabel: '+10 combo max' },
  { id: 'v4d', branch: 'vengeance', row: 4, col: 3, name: 'Adrenal Rush', description: 'Pure adrenaline: the war-psychosis turns your own overdrive into still more speed.', icon: '⚗️', parents: ['v3c'], maxPoints: 5, perPointLabel: '+2% attack speed' },

  { id: 'v5a', branch: 'vengeance', row: 5, col: 0, name: 'Lone Wolf', description: 'A solitary blade, unstoppable once committed. Each point here forfeits a point in Headhunter.', icon: '☠️', parents: ['v4a'], maxPoints: 3, perPointLabel: '+6% click damage', exclusiveGroup: 'vengeance-r5' },
  { id: 'v5b', branch: 'vengeance', row: 5, col: 1, name: 'Headhunter', description: 'Precision above all: find the micro-crack every wall has. Each point here forfeits a point in Lone Wolf.', icon: '🎯', parents: ['v4a'], maxPoints: 3, perPointLabel: '+1.5% crit chance', exclusiveGroup: 'vengeance-r5' },
  { id: 'v5c', branch: 'vengeance', row: 5, col: 2, name: 'Psi-Blade Nova', description: 'The blade suppresses, then detonates: a nova of psionic force on every strike.', icon: '💥', parents: ['v4b'], maxPoints: 5, perPointLabel: '+5% click damage' },
  { id: 'v5d', branch: 'vengeance', row: 5, col: 3, name: 'Rage Escape', description: 'Fury unchecked is a fuel that never runs dry. Every point extends the rampage.', icon: '🌀', parents: ['v4c'], maxPoints: 5, perPointLabel: '+15 combo max' },

  { id: 'v6a', branch: 'vengeance', row: 6, col: 1, name: 'Umbral Rend', description: 'Blades dipped in the Void tear material reality. Reachable from either side of the Lone Wolf split.', icon: '🌑', parents: ['v5a', 'v5b'], maxPoints: 3, perPointLabel: '+6% click damage' },
  { id: 'v6b', branch: 'vengeance', row: 6, col: 2, name: 'Critical Mass', description: 'Enough strikes reach the critical mass where every swing may shatter a wall.', icon: '☄️', parents: ['v5c'], maxPoints: 5, perPointLabel: '+2% crit chance' },
  { id: 'v6c', branch: 'vengeance', row: 6, col: 3, name: 'Bloodthirsty', description: 'The hunt never ends. Each wall you bleed feeds the next rampage.', icon: '🩸', parents: ['v5d'], maxPoints: 5, perPointLabel: '+20 combo max' },

  { id: 'v7', branch: 'vengeance', row: 7, col: 1.5, name: 'Umbral Blender', description: 'The apex of the blade: crits land at triple force and every point of tech amplifies raw damage. (Keystone, 1 point)', icon: '☠️', parents: ['v6a', 'v6b', 'v6c'], maxPoints: 1, perPointLabel: 'Crits 3x · +40% damage' },

  // ── Resilience (Defense) · 7 rows · max 4/row · 18 talents ────────────
  { id: 'r1', branch: 'resilience', row: 1, col: 1.5, name: 'Khala Fortitude', description: 'The root discipline of the Khala: a zealot\'s spirit is armour before steel.', icon: '🛡️', parents: [], maxPoints: 3, perPointLabel: '+3% max HP' },

  { id: 'r2', branch: 'resilience', row: 2, col: 1, name: 'Fortified Body', description: 'Martial discipline thickens your armour of spirit with each rank.', icon: '💪', parents: ['r1'], maxPoints: 5, perPointLabel: '+4% max HP' },
  { id: 'r2b', branch: 'resilience', row: 2, col: 2, name: 'Psionic Recovery', description: 'The Khala flows through you, mending wounds as the fight wears on.', icon: '💠', parents: ['r1'], maxPoints: 5, perPointLabel: '+1% max HP/s regen' },

  { id: 'r3a', branch: 'resilience', row: 3, col: 0, name: 'Kinetic Plating', description: 'Layered shields absorb turret fire. Each point here forfeits a point in Iron Hide.', icon: '🧱', parents: ['r2'], maxPoints: 5, perPointLabel: '-5% turret damage', exclusiveGroup: 'resilience-r3' },
  { id: 'r3b', branch: 'resilience', row: 3, col: 1, name: 'Iron Hide', description: 'A stubborn shell of flesh and psionics. Each point here forfeits a point in Kinetic Plating.', icon: '🪨', parents: ['r2'], maxPoints: 5, perPointLabel: '+4% max HP', exclusiveGroup: 'resilience-r3' },
  { id: 'r3c', branch: 'resilience', row: 3, col: 2, name: 'Psionic Renewal', description: 'Regeneration bound into discipline: the Khala stiches wounds as fast as they open.', icon: '💫', parents: ['r2b'], maxPoints: 5, perPointLabel: '+1% max HP/s regen' },

  { id: 'r4a', branch: 'resilience', row: 4, col: 0, name: 'Aegis Ward', description: 'A focused ward that shaves turret volleys before they land.', icon: '🛡️', parents: ['r3a'], maxPoints: 5, perPointLabel: '-3% turret damage' },
  { id: 'r4b', branch: 'resilience', row: 4, col: 1, name: 'Bulwark', description: 'A mountain of resolve. Each rank stacks more life onto your foundations.', icon: '🗿', parents: ['r3b'], maxPoints: 5, perPointLabel: '+4% max HP' },
  { id: 'r4c', branch: 'resilience', row: 4, col: 2, name: 'Vital Surge', description: 'A deeper current of recovery. The Khala surges where the damage lands.', icon: '🩸', parents: ['r3c'], maxPoints: 5, perPointLabel: '+2% max HP/s regen' },

  { id: 'r5a', branch: 'resilience', row: 5, col: 0, name: 'Reflective Aegis', description: 'Turn the probes\' own fire back against their walls.', icon: '🪞', parents: ['r4a'], maxPoints: 5, perPointLabel: '+5% damage reflection' },
  { id: 'r5b', branch: 'resilience', row: 5, col: 1, name: 'Fortress Heart', description: 'A heart that refuses to yield. Each point walls off a little more mortality.', icon: '🏯', parents: ['r4b'], maxPoints: 5, perPointLabel: '+5% max HP' },
  { id: 'r5c', branch: 'resilience', row: 5, col: 2, name: 'Thorns Aura', description: 'A shield of spite: attackers feel every blow they land. Each point here forfeits a point in Second Wind.', icon: '🌵', parents: ['r4c'], maxPoints: 5, perPointLabel: '+3% damage reflection', exclusiveGroup: 'resilience-r5' },
  { id: 'r5d', branch: 'resilience', row: 5, col: 3, name: 'Second Wind', description: 'Emergency warp reserves. Each point here forfeits a point in Thorns Aura.', icon: '💨', parents: ['r4c'], maxPoints: 2, perPointLabel: '+1 Emergency Teleport', exclusiveGroup: 'resilience-r5' },

  { id: 'r6a', branch: 'resilience', row: 6, col: 0, name: 'Phased Armor', description: 'Armour phased against kinetic fire: turret volleys phase through you harmlessly.', icon: '🌫️', parents: ['r5a'], maxPoints: 5, perPointLabel: '-5% turret damage' },
  { id: 'r6b', branch: 'resilience', row: 6, col: 1, name: 'Iron Bastion', description: 'The final bulwark of the Khala: more life, per invested point.', icon: '🏰', parents: ['r5b'], maxPoints: 5, perPointLabel: '+5% max HP' },
  { id: 'r6c', branch: 'resilience', row: 6, col: 2, name: 'Regenerative Weave', description: 'Shields that knit themselves back together mid-fight. Each point here forfeits a point in Thorns Mastery.', icon: '🧵', parents: ['r5c'], maxPoints: 3, perPointLabel: '+2% max HP/s regen', exclusiveGroup: 'resilience-r6' },
  { id: 'r6d', branch: 'resilience', row: 6, col: 3, name: 'Thorns Mastery', description: 'Reflection honed to an art. Each point here forfeits a point in Regenerative Weave.', icon: '🌵', parents: ['r5c'], maxPoints: 5, perPointLabel: '+5% damage reflection', exclusiveGroup: 'resilience-r6' },

  { id: 'r7', branch: 'resilience', row: 7, col: 1.5, name: 'Undying', description: 'Deny the final blow: survive a fatal hit at 1 HP, then become immune for 3 seconds. (Keystone, 1 point)', icon: '♾️', parents: ['r6a', 'r6b', 'r6c', 'r6d'], maxPoints: 1, perPointLabel: 'Survive fatal hits' },

  // ── Wealth (Economy) · 7 rows · max 4/row · 19 talents ─────────────────
  { id: 'w1', branch: 'wealth', row: 1, col: 1.5, name: 'Commerce Root', description: 'The root principle of war economics: every wall destroyed is raw value.', icon: '🏗️', parents: [], maxPoints: 3, perPointLabel: '+1% of wall max HP as minerals' },

  { id: 'w2', branch: 'wealth', row: 2, col: 1, name: 'Gas Refinery', description: 'Probes taught you their trade secrets; now their gas flows faster into your coffers.', icon: '🛢️', parents: ['w1'], maxPoints: 3, perPointLabel: '+25% vespene conversion rate' },
  { id: 'w2b', branch: 'wealth', row: 2, col: 2, name: 'Bounty Contract', description: 'A cut of every destroyed wall\'s worth lands in your mineral stores.', icon: '💎', parents: ['w1'], maxPoints: 5, perPointLabel: '+1% of wall max HP as minerals' },

  { id: 'w3a', branch: 'wealth', row: 3, col: 1, name: 'Vespene Siphon', description: 'Minerals skimmed automatically fuel your gas reserves.', icon: '🧪', parents: ['w2'], maxPoints: 5, perPointLabel: '+1% of minerals auto-convert to vespene' },
  { id: 'w3b', branch: 'wealth', row: 3, col: 2, name: 'Vespene Tithe', description: 'A tithe of each cracked wall\'s value is harvested wholesale as vespene.', icon: '⚗️', parents: ['w2b'], maxPoints: 5, perPointLabel: '+1% of wall max HP as vespene' },
  { id: 'w3c', branch: 'wealth', row: 3, col: 3, name: 'Salvage Rights', description: 'Claim rights on salvaged wreckage: a moa das cut of every wall returns as minerals.', icon: '🧰', parents: ['w2b'], maxPoints: 5, perPointLabel: '+1% of wall max HP as minerals' },

  { id: 'w4a', branch: 'wealth', row: 4, col: 0, name: 'Auto-Harvester', description: 'Automated drones skim your mineral intake straight into the gas drives.', icon: '⚙️', parents: ['w3a'], maxPoints: 3, perPointLabel: '+2% of minerals auto-convert to vespene' },
  { id: 'w4b', branch: 'wealth', row: 4, col: 1, name: 'Gas Hoard', description: 'A hoard mindset: larger gas reservoirs per cracked wall.', icon: '🧊', parents: ['w3b'], maxPoints: 3, perPointLabel: '+2% of wall max HP as vespene' },
  { id: 'w4c', branch: 'wealth', row: 4, col: 2, name: 'Rich Vein', description: 'A richer lode of mineral bounty. Each point here forfeits a point in Bargain Hunter.', icon: '⛏️', parents: ['w3c'], maxPoints: 5, perPointLabel: '+1.5% of wall max HP as minerals', exclusiveGroup: 'wealth-r4' },
  { id: 'w4d', branch: 'wealth', row: 4, col: 3, name: 'Bargain Hunter', description: 'The war market bends to your reputation. Each point here forfeits a point in Rich Vein.', icon: '🏷️', parents: ['w3c'], maxPoints: 4, perPointLabel: '-5% shop prices', exclusiveGroup: 'wealth-r4' },

  { id: 'w5a', branch: 'wealth', row: 5, col: 0, name: 'Siphon Mastery', description: 'Refined siphons: almost half of what you mine quietly becomes gas.', icon: '💦', parents: ['w4a'], maxPoints: 3, perPointLabel: '+2% of minerals auto-convert to vespene' },
  { id: 'w5b', branch: 'wealth', row: 5, col: 1, name: 'Tithe Apex', description: 'The apex of your gas tithe: a serious share of every wall drinks as vespene.', icon: '🏺', parents: ['w4b'], maxPoints: 3, perPointLabel: '+2% of wall max HP as vespene' },
  { id: 'w5c', branch: 'wealth', row: 5, col: 2, name: 'Loot Hoarder', description: 'Every wall pays rent to your mineral vaults.', icon: '🪙', parents: ['w4c'], maxPoints: 5, perPointLabel: '+2% of wall max HP as minerals' },
  { id: 'w5d', branch: 'wealth', row: 5, col: 3, name: 'Haggle Guru', description: 'Raw bargaining force in a galaxy at war. Shop prices sink per point.', icon: '🎪', parents: ['w4d'], maxPoints: 3, perPointLabel: '-5% shop prices' },

  { id: 'w6a', branch: 'wealth', row: 6, col: 0, name: 'Conversion Engine', description: 'The final siphon: an engine that wrings gas from every mineral flow.', icon: '⚙️', parents: ['w5a'], maxPoints: 3, perPointLabel: '+25% vespene conversion rate' },
  { id: 'w6b', branch: 'wealth', row: 6, col: 1, name: 'Void Warden', description: 'Vespene-store prices crumble before a warden of the Void.', icon: '🔮', parents: ['w5b'], maxPoints: 4, perPointLabel: '-7.5% vespene item cost' },
  { id: 'w6c', branch: 'wealth', row: 6, col: 2, name: 'Trade Baron', description: 'A baron of the black market. Each point here forfeits a point in Reinvest.', icon: '📜', parents: ['w5d'], maxPoints: 3, perPointLabel: '-5% shop prices', exclusiveGroup: 'wealth-r6' },
  { id: 'w6d', branch: 'wealth', row: 6, col: 3, name: 'Reinvest', description: 'Profits ploughed straight back into the war machine. Each point here forfeits a point in Trade Baron.', icon: '💰', parents: ['w5d'], maxPoints: 4, perPointLabel: '+2% of wall max HP as minerals', exclusiveGroup: 'wealth-r6' },

  { id: 'w7', branch: 'wealth', row: 7, col: 1.5, name: 'Khaydarin Engine', description: 'The crown of the economy tree: double conversion and a fat bounty on every wall. (Keystone, 1 point)', icon: '🏆', parents: ['w6a', 'w6b', 'w6c', 'w6d'], maxPoints: 1, perPointLabel: '+100% conversion · +6% minerals bounty' },
];

/** Validate the layout contract so a malformed tree breaks loudly during tests/build review. */
export function validateTreeLayout(): string[] {
  const problems: string[] = [];
  for (const branch of ['vengeance', 'resilience', 'wealth'] as SkillBranch[]) {
    const nodes = SKILL_NODES.filter(n => n.branch === branch);
    for (let row = 1; row <= 7; row++) {
      const inRow = nodes.filter(n => n.row === row);
      if (inRow.length > MAX_TALENTS_PER_ROW) {
        problems.push(`${branch} row ${row} has ${inRow.length} talents (max ${MAX_TALENTS_PER_ROW})`);
      }
    }
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const node of nodes) {
      for (const pid of node.parents) {
        const parent = byId.get(pid);
        if (!parent) {
          problems.push(`${node.id} references unknown parent ${pid}`);
        } else if (parent.row !== node.row - 1) {
          problems.push(`${node.id} parent ${pid} is in row ${parent.row}, expected row ${node.row - 1}`);
        }
      }
    }
  }
  return problems;
}

export interface SkillNodeFx {
  maxPoints: number;
  apply: (b: SkillBonuses, pts: number) => void;
}

export const SKILL_NODE_FX: Record<string, SkillNodeFx> = {
  v1: { maxPoints: 3, apply: (b, p) => { b.damageMultiplier *= 1 + 0.02 * p; } },
  v2: { maxPoints: 5, apply: (b, p) => { b.damageMultiplier *= 1 + 0.02 * p; } },
  v2b: { maxPoints: 5, apply: (b, p) => { b.attackSpeedMultiplier *= 1 + 0.025 * p; } },
  v3a: { maxPoints: 3, apply: (b, p) => { b.damageMultiplier *= 1 + 0.03 * p; } },
  v3b: { maxPoints: 3, apply: (b, p) => { b.critChance += 0.03 * p; } },
  v3c: { maxPoints: 5, apply: (b, p) => { b.attackSpeedMultiplier *= 1 + 0.02 * p; } },
  v4a: { maxPoints: 5, apply: (b, p) => { b.damageMultiplier *= 1 + 0.03 * p; } },
  v4b: { maxPoints: 5, apply: (b, p) => { b.critChance += 0.02 * p; } },
  v4c: { maxPoints: 5, apply: (b, p) => { b.comboMaxBonus += 10 * p; } },
  v4d: { maxPoints: 5, apply: (b, p) => { b.attackSpeedMultiplier *= 1 + 0.02 * p; } },
  v5a: { maxPoints: 3, apply: (b, p) => { b.damageMultiplier *= 1 + 0.06 * p; } },
  v5b: { maxPoints: 3, apply: (b, p) => { b.critChance += 0.015 * p; } },
  v5c: { maxPoints: 5, apply: (b, p) => { b.damageMultiplier *= 1 + 0.05 * p; } },
  v5d: { maxPoints: 5, apply: (b, p) => { b.comboMaxBonus += 15 * p; } },
  v6a: { maxPoints: 3, apply: (b, p) => { b.damageMultiplier *= 1 + 0.06 * p; } },
  v6b: { maxPoints: 5, apply: (b, p) => { b.critChance += 0.02 * p; } },
  v6c: { maxPoints: 5, apply: (b, p) => { b.comboMaxBonus += 20 * p; } },
  v7: { maxPoints: 1, apply: (b) => { b.critMultiplier += 1; b.damageMultiplier *= 1.4; } },

  r1: { maxPoints: 3, apply: (b, p) => { b.maxHpMultiplier *= 1 + 0.03 * p; } },
  r2: { maxPoints: 5, apply: (b, p) => { b.maxHpMultiplier *= 1 + 0.04 * p; } },
  r2b: { maxPoints: 5, apply: (b, p) => { b.hpRegenPercent += 0.01 * p; } },
  r3a: { maxPoints: 5, apply: (b, p) => { b.turretDamageReduction += 0.05 * p; } },
  r3b: { maxPoints: 5, apply: (b, p) => { b.maxHpMultiplier *= 1 + 0.04 * p; } },
  r3c: { maxPoints: 5, apply: (b, p) => { b.hpRegenPercent += 0.01 * p; } },
  r4a: { maxPoints: 5, apply: (b, p) => { b.turretDamageReduction += 0.03 * p; } },
  r4b: { maxPoints: 5, apply: (b, p) => { b.maxHpMultiplier *= 1 + 0.04 * p; } },
  r4c: { maxPoints: 5, apply: (b, p) => { b.hpRegenPercent += 0.02 * p; } },
  r5a: { maxPoints: 5, apply: (b, p) => { b.thornsReflect += 0.05 * p; } },
  r5b: { maxPoints: 5, apply: (b, p) => { b.maxHpMultiplier *= 1 + 0.05 * p; } },
  r5c: { maxPoints: 5, apply: (b, p) => { b.thornsReflect += 0.03 * p; } },
  r5d: { maxPoints: 2, apply: (b, p) => { b.extraTeleports += p; } },
  r6a: { maxPoints: 5, apply: (b, p) => { b.turretDamageReduction += 0.05 * p; } },
  r6b: { maxPoints: 5, apply: (b, p) => { b.maxHpMultiplier *= 1 + 0.05 * p; } },
  r6c: { maxPoints: 3, apply: (b, p) => { b.hpRegenPercent += 0.02 * p; } },
  r6d: { maxPoints: 5, apply: (b, p) => { b.thornsReflect += 0.05 * p; } },
  r7: { maxPoints: 1, apply: (b) => { b.undyingEnabled = true; } },

  w1: { maxPoints: 3, apply: (b, p) => { b.killBountyPercent += 0.01 * p; } },
  w2: { maxPoints: 3, apply: (b, p) => { b.vespeneConversionMultiplier *= 1 + 0.25 * p; } },
  w2b: { maxPoints: 5, apply: (b, p) => { b.killBountyPercent += 0.01 * p; } },
  w3a: { maxPoints: 5, apply: (b, p) => { b.autoVespenePercent += 0.01 * p; } },
  w3b: { maxPoints: 5, apply: (b, p) => { b.vespeneBountyPercent += 0.01 * p; } },
  w3c: { maxPoints: 5, apply: (b, p) => { b.killBountyPercent += 0.01 * p; } },
  w4a: { maxPoints: 3, apply: (b, p) => { b.autoVespenePercent += 0.02 * p; } },
  w4b: { maxPoints: 3, apply: (b, p) => { b.vespeneBountyPercent += 0.02 * p; } },
  w4c: { maxPoints: 5, apply: (b, p) => { b.killBountyPercent += 0.015 * p; } },
  w4d: { maxPoints: 4, apply: (b, p) => { b.shopPriceReduction += 0.05 * p; } },
  w5a: { maxPoints: 3, apply: (b, p) => { b.autoVespenePercent += 0.02 * p; } },
  w5b: { maxPoints: 3, apply: (b, p) => { b.vespeneBountyPercent += 0.02 * p; } },
  w5c: { maxPoints: 5, apply: (b, p) => { b.killBountyPercent += 0.02 * p; } },
  w5d: { maxPoints: 3, apply: (b, p) => { b.shopPriceReduction += 0.05 * p; } },
  w6a: { maxPoints: 3, apply: (b, p) => { b.vespeneConversionMultiplier *= 1 + 0.25 * p; } },
  w6b: { maxPoints: 4, apply: (b, p) => { b.vespeneItemDiscount += 0.075 * p; } },
  w6c: { maxPoints: 3, apply: (b, p) => { b.shopPriceReduction += 0.05 * p; } },
  w6d: { maxPoints: 4, apply: (b, p) => { b.killBountyPercent += 0.02 * p; } },
  w7: { maxPoints: 1, apply: (b) => { b.vespeneConversionMultiplier *= 2; b.killBountyPercent += 0.06; } },
};

/** How many points are invested in a node (clamped, defensive). */
export function investedPoints(ranks: Record<string, number> | undefined, nodeId: string): number {
  const raw = ranks?.[nodeId] ?? 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

/** Whether a node has an unlocked prerequisite: roots always pass, others need ANY parent with ≥1 point. */
export function hasUnlockedParents(node: SkillNode, ranks: Record<string, number> | undefined): boolean {
  if (!node.parents || node.parents.length === 0) return true;
  return node.parents.some(pid => investedPoints(ranks, pid) > 0);
}

/** Whether another node in the same exclusive group already has invested points. */
export function isExclusiveLocked(ranks: Record<string, number> | undefined, node: SkillNode): boolean {
  if (!node.exclusiveGroup) return false;
  return SKILL_NODES.some(
    n => n.exclusiveGroup === node.exclusiveGroup && n.id !== node.id && investedPoints(ranks, n.id) > 0,
  );
}

/** Whether a point may be invested into a node right now (tree prerequisites + exclusive conflict). */
export function canInvestNode(node: SkillNode, ranks: Record<string, number> | undefined, talentPoints: number): boolean {
  if (talentPoints < 1) return false;
  if (investedPoints(ranks, node.id) >= node.maxPoints) return false;
  if (isExclusiveLocked(ranks, node)) return false;
  return hasUnlockedParents(node, ranks);
}

/** Compute the full bonus set from the invested ranks. */
export function computeBonuses(ranks: Record<string, number> | undefined): SkillBonuses {
  const b: SkillBonuses = {
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
  if (!ranks) return b;
  for (const [id, rawPts] of Object.entries(ranks)) {
    const fx = SKILL_NODE_FX[id];
    if (!fx) continue;
    const pts = Math.min(fx.maxPoints, Math.max(0, Math.floor(rawPts ?? 0)));
    if (pts <= 0) continue;
    fx.apply(b, pts);
  }
  return b;
}

export const DEFAULT_SKILL_BONUSES: SkillBonuses = computeBonuses({});