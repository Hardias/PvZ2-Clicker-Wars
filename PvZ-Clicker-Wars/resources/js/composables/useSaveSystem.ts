import { Ref } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { InventorySlot } from '../types/Item';
import { ProbeBase } from '../types/ProbeBase';

const SAVE_KEY = 'pvz2_clicker_save_v4';

export interface GameSaveData {
  zealot: ZealotStats;
  inventory: InventorySlot[];
  wave: number;
  probeBase: ProbeBase;
  lastSaved: number;
}

export function useSaveSystem(
  zealotState: Ref<ZealotStats>,
  inventorySlots: Ref<InventorySlot[]>,
  currentWave: Ref<number>,
  probeBase: Ref<ProbeBase>
) {
  function saveGame() {
    const data: GameSaveData = {
      zealot: zealotState.value,
      inventory: inventorySlots.value,
      wave: currentWave.value,
      probeBase: probeBase.value,
      lastSaved: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  function loadGame(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        // Clear all older versions of saves
        localStorage.removeItem('pvz2_clicker_save_v1');
        localStorage.removeItem('pvz2_clicker_save_v2');
        localStorage.removeItem('pvz2_clicker_save_v3');
        return null;
      }
      const data: GameSaveData = JSON.parse(raw);
      // Sanitize probe base turrets in saved data
      if (data.probeBase && data.probeBase.turrets) {
        data.probeBase.turrets.forEach((t, idx) => {
          t.name = `Turret ${idx + 1}`;
        });
      }
      return data;
    } catch (e) {
      console.error('Failed to load game:', e);
      return null;
    }
  }

  function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('pvz2_clicker_save_v1');
    localStorage.removeItem('pvz2_clicker_save_v2');
    localStorage.removeItem('pvz2_clicker_save_v3');
    window.location.reload();
  }

  return {
    saveGame,
    loadGame,
    resetGame,
  };
}
