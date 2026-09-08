/**
 * Centralized localStorage keys for the whole game.
 * Import these constants instead of scattering string literals across files,
 * so a rename/refactor only ever touches this single module.
 */

/** Slot template keys (one per save slot letter, e.g. pvz2_slot_A). */
export const SAVE_SLOT_KEY = 'pvz2_slot_';

/** Autosave slot key. */
export const AUTOSAVE_KEY = 'pvz2_autosave';

/** Legacy per-system keys (used during initial load for migration). */
export const LEGACY_PROBE_BASE_KEY = 'pvz2_probe_base';
export const LEGACY_INVENTORY_KEY = 'pvz2_inventory';
export const LEGACY_ZEALOT_KEY = 'pvz2_zealot';

/** Death counter (persisted separately from save slots). */
export const ZEALOT_DEATHS_KEY = 'pvz2_zealot_deaths';

/** Audio settings. */
export const MUSIC_VOLUME_KEY = 'pvz2_music_volume';
export const SFX_VOLUME_KEY = 'pvz2_sfx_volume';
export const MUSIC_MUTED_KEY = 'pvz2_music_muted';
export const SFX_MUTED_KEY = 'pvz2_sfx_muted';
export const VISUALIZER_ENABLED_KEY = 'pvz2_visualizer_enabled';
export const MUSIC_TRACK_KEY = 'pvz2_music_track';
export const TRACK_PACK_KEY = 'pvz2_track_pack';

/** Settings / UI preferences. */
export const AUTOSAVE_ENABLED_KEY = 'pvz2_autosave_enabled';
export const DISABLE_PATHER_KEY = 'pvz2_disable_pather';
export const DEV_SCREEN_TYPE_KEY = 'pvz2_dev_screen_type';
export const TUTORIAL_COMPLETED_KEY = 'pvz2_tutorial_completed';

/** Build the full save-slot key for a given slot identifier. */
export function saveSlotKey(slot: 'A' | 'B' | 'C'): string {
  return `${SAVE_SLOT_KEY}${slot}`;
}
