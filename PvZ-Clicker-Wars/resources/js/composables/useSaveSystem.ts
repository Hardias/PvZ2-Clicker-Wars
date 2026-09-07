import { Ref, ref } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { InventorySlot } from '../types/Item';
import { ProbeBase } from '../types/ProbeBase';
import { SkillTreeState } from '../types/SkillTree';

export interface SaveData {
  zealot: ZealotStats;
  inventory: InventorySlot[];
  probeBase: ProbeBase;
  skillTree?: SkillTreeState;
  updatedAt: number;
}

export interface SlotMeta {
  slot: 'A' | 'B' | 'C' | 'autosave';
  updatedAt: number | null;
  exists: boolean;
}

/**
 * Composable handling multi-slot game saves (Slots A, B, C), Autosave, timestamps, and loading.
 */
export function useSaveSystem(
  zealotState: Ref<ZealotStats>,
  inventorySlots: Ref<InventorySlot[]>,
  probeBase: Ref<ProbeBase>,
  skillTreeState: Ref<SkillTreeState>
) {
  // Reactive counter bumped on every save so that computed values derived from
  // localStorage (e.g. slot metadata) can react to storage updates.
  const saveTrigger = ref(0);

  /** Build a full save payload from current reactive state */
  function buildSaveData(): SaveData {
    return {
      zealot: zealotState.value,
      inventory: inventorySlots.value,
      probeBase: probeBase.value,
      skillTree: skillTreeState.value,
      updatedAt: Date.now(),
    };
  }

  /** Get localStorage key for a specific slot */
  function getSlotKey(slot: 'A' | 'B' | 'C' | 'autosave'): string {
    return `pvz2_slot_${slot}`;
  }

  /** Save game state to a specific manual slot (A, B, or C) */
  function saveToSlot(slot: 'A' | 'B' | 'C') {
    try {
      const data: SaveData = buildSaveData();
      localStorage.setItem(getSlotKey(slot), JSON.stringify(data));
      localStorage.setItem('pvz2_zealot_deaths', String(zealotState.value.deaths || 0));
      saveTrigger.value++;
    } catch (e) {
      console.error(`Failed to save game to Slot ${slot}:`, e);
    }
  }

  /** Automatically save game state to the autosave slot */
  function autoSave() {
    try {
      const data: SaveData = buildSaveData();
      localStorage.setItem(getSlotKey('autosave'), JSON.stringify(data));
      localStorage.setItem('pvz2_zealot_deaths', String(zealotState.value.deaths || 0));
      saveTrigger.value++;
    } catch (e) {
      console.error('Failed to auto-save game:', e);
    }
  }

  /** Validate that a parsed save has a usable shape */
  function isValidSave(data: unknown): data is Record<string, unknown> {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return typeof d.updatedAt === 'number' && d.updatedAt > 0;
  }

  /** Load save data from a specific slot */
  function loadFromSlot(slot: 'A' | 'B' | 'C' | 'autosave'): SaveData | null {
    try {
      const raw = localStorage.getItem(getSlotKey(slot));
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (!isValidSave(parsed)) {
          console.warn(`Save slot ${slot} is malformed or empty; ignoring.`);
          return null;
        }
        return parsed as unknown as SaveData;
      }
    } catch (e) {
      console.error(`Failed to load game from Slot ${slot}:`, e);
    }
    return null;
  }

  /** Get metadata (timestamps, existence) for all save slots */
  function getAllSlotMetadata(): Record<'A' | 'B' | 'C' | 'autosave', SlotMeta> {
    const slots: ('A' | 'B' | 'C' | 'autosave')[] = ['A', 'B', 'C', 'autosave'];
    const meta: Partial<Record<'A' | 'B' | 'C' | 'autosave', SlotMeta>> = {};

    for (const s of slots) {
      const raw = localStorage.getItem(getSlotKey(s));
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (isValidSave(parsed)) {
            meta[s] = {
              slot: s,
              updatedAt: (parsed as Record<string, unknown>).updatedAt as number,
              exists: true,
            };
          } else {
            meta[s] = { slot: s, updatedAt: null, exists: false };
          }
        } catch {
          meta[s] = { slot: s, updatedAt: null, exists: false };
        }
      } else {
        meta[s] = { slot: s, updatedAt: null, exists: false };
      }
    }
    return meta as Record<'A' | 'B' | 'C' | 'autosave', SlotMeta>;
  }

  /** Determine which save slot has the most recent timestamp */
  function getMostRecentSlot(): 'A' | 'B' | 'C' | 'autosave' | null {
    const meta = getAllSlotMetadata();
    let newestSlot: 'A' | 'B' | 'C' | 'autosave' | null = null;
    let maxTime = 0;

    for (const key of ['A', 'B', 'C', 'autosave'] as const) {
      const m = meta[key];
      if (m.exists && typeof m.updatedAt === 'number' && m.updatedAt > maxTime) {
        maxTime = m.updatedAt;
        newestSlot = key;
      }
    }
    return newestSlot;
  }

  /** Load the most recent save game across all slots */
  function loadLatestGame(): SaveData | null {
    const newest = getMostRecentSlot();
    if (newest) {
      return loadFromSlot(newest);
    }
    return null;
  }

  /** Delete a single save slot (A, B, C, or autosave) */
  function deleteSlot(slot: 'A' | 'B' | 'C' | 'autosave') {
    localStorage.removeItem(getSlotKey(slot));
    saveTrigger.value++;
  }

  /** Delete every save slot (A, B, C, and autosave) at once */
  function deleteAllSlots() {
    localStorage.removeItem(getSlotKey('A'));
    localStorage.removeItem(getSlotKey('B'));
    localStorage.removeItem(getSlotKey('C'));
    localStorage.removeItem(getSlotKey('autosave'));
    saveTrigger.value++;
  }

  return {
    saveToSlot,
    autoSave,
    loadFromSlot,
    getAllSlotMetadata,
    getMostRecentSlot,
    loadLatestGame,
    deleteSlot,
    deleteAllSlots,
    saveTrigger,
  };
}
