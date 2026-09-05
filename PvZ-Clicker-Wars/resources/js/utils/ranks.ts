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

/**
 * Get the rank name for a given rank/cycle index.
 * Probes and walls share this ladder: D- -> D -> D+ -> C- -> ... -> S, then S1..S250, then SS1, SS2, ...
 */
export function getRankName(index: number): string {
  if (index < 0) return RANK_LADDER[0];
  if (index < RANK_LADDER.length) return RANK_LADDER[index];
  if (index <= S_MAX_INDEX) return `S${index - RANK_LADDER.length + 1}`;
  return `SS${index - SS_START_INDEX + 1}`;
}