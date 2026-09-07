/** Shared gameplay constants so related values stay in sync across the codebase. */

/** Minerals required to buy 1 Vespene Gas (64,000M = 1V), modified by skill tree efficiency. */
export const VESPENE_CONVERSION_RATE = 64_000;

/** Flat HP/s regen bonus granted while the Zealot visits the shop base. */
export const SHOP_REGEN_BONUS = 2_048_000;

// Default starting Zealot base stats (shared by new game, session reset and hard reset).
export const DEFAULT_MAX_HP = 100;
export const DEFAULT_BASE_ATTACK = 15;
export const DEFAULT_BASE_ATTACK_SPEED = 1.0; // attacks per second
export const DEFAULT_BASE_DEFENSE = 5; // flat damage reduction
export const DEFAULT_BASE_HP_REGEN = 1.0; // HP per second
export const DEFAULT_STARTING_MINERALS = 50;
export const DEFAULT_EMERGENCY_TELEPORTS = 2;