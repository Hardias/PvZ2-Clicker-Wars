/** Shared rank ladder. Probes AND wall cycles follow this exact order. */
export const RANK_LADDER = [
  'D-', 'D', 'D+',
  'C-', 'C', 'C+',
  'B-', 'B', 'B+',
  'A-', 'A', 'A+',
  'S',
] as const;

// S ranks run from index 13 (S1) up to S250 (index 262). After that the SS tier starts.
export const S_MAX_INDEX = RANK_LADDER.length - 1 + 250; // 262 = S250
export const SS_START_INDEX = S_MAX_INDEX + 1; // 263 = SS1

/** True when the rank is an SS-tier rank (index >= 263) */
export function isSsRank(index: number): boolean {
  return index >= SS_START_INDEX;
}

/** The SS level: SS1 = 1, SS2 = 2, ... (0 when not an SS rank) */
export function ssLevel(index: number): number {
  if (!isSsRank(index)) return 0;
  return index - SS_START_INDEX + 1;
}

// --- SS+ milestone tiers ---
// The SS counter is continuous and unbounded: every 50 SS levels the probe moves up a tier,
// and the DISPLAYED number restarts at 1 within that tier.
export const SS_LEVELS_PER_TIER = 50;

export const TIER_IDS = ['SS', 'SSS', 'X', 'XD', 'XRD', 'XRFD'] as const;
export type TierId = (typeof TIER_IDS)[number];

/** Tier start SS-level for each tier: SS starts at 1, SSS at 51, X at 101, ... XRFD at 251. */
export const TIER_START_SS_LEVEL: Record<TierId, number> = {
  SS: 1,
  SSS: 51,
  X: 101,
  XD: 151,
  XRD: 201,
  XRFD: 251,
};

/** 0-based ordinal of a tier (SS=0, SSS=1, ... XRFD=5). */
export function getTierOrdinal(tier: TierId): number {
  return TIER_IDS.indexOf(tier);
}

/**
 * The milestone tier of an SS level. ssLevel starts at 1 (SS1). Every 50 levels
 * the tier steps up one: SS -> SSS -> X -> XD -> XRD -> XRFD (the last tier is unbounded).
 */
export function getRankTier(ssLevelNum: number): TierId {
  const idx = Math.floor((Math.max(1, ssLevelNum) - 1) / SS_LEVELS_PER_TIER);
  return TIER_IDS[Math.min(idx, TIER_IDS.length - 1)];
}

/** The 1-based level within the current tier (restarts at 1 each milestone). */
export function getTierLocalLevel(ssLevelNum: number): number {
  return ssLevelNum - TIER_START_SS_LEVEL[getRankTier(ssLevelNum)] + 1;
}

/**
 * Get the rank name for a given rank/cycle index.
 * Probes and walls share this ladder: D- -> D -> D+ -> C- -> ... -> S, then S1..S250,
 * then SS1..SS50, SSS1..SSS50, X1..X50, XD1..XD50, XRD1..XRD50, XRFD1... (unbounded).
 */
export function getRankName(index: number): string {
  if (index < 0) return RANK_LADDER[0];
  if (index < RANK_LADDER.length) return RANK_LADDER[index];
  if (index <= S_MAX_INDEX) return `S${index - RANK_LADDER.length + 1}`;
  const level = ssLevel(index);
  return `${getRankTier(level)}${getTierLocalLevel(level)}`;
}