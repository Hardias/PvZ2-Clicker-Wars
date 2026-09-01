import { Ref } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { InventorySlot } from '../types/Item';
import { ProbeBase } from '../types/ProbeBase';

export function useSaveSystem(
  zealotState: Ref<ZealotStats>,
  inventorySlots: Ref<InventorySlot[]>,
  probeBase: Ref<ProbeBase>
) {
  function saveGame() {
    try {
      localStorage.setItem('pvz2_zealot', JSON.stringify(zealotState.value));
      localStorage.setItem('pvz2_inventory', JSON.stringify(inventorySlots.value));
      localStorage.setItem('pvz2_probe_base', JSON.stringify(probeBase.value));
      console.log('All game states saved to individual keys:', {
        zealot: zealotState.value,
        inventory: inventorySlots.value,
        probeBase: probeBase.value,
      });
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  function loadGame(): { zealot: any; inventory: any; probeBase: any } | null {
    try {
      const zRaw = localStorage.getItem('pvz2_zealot');
      const iRaw = localStorage.getItem('pvz2_inventory');
      const pRaw = localStorage.getItem('pvz2_probe_base');

      if (!zRaw && !iRaw && !pRaw) {
        // Fallback to legacy single key if it exists
        const legacy = localStorage.getItem('pvz2_clicker_wars_save');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          console.log('Loaded from legacy save key:', parsed);
          return {
            zealot: parsed.zealot,
            inventory: parsed.inventory,
            probeBase: parsed.probeBase,
          };
        }
        console.log('No save data found anywhere.');
        return null;
      }

      const result = {
        zealot: zRaw ? JSON.parse(zRaw) : null,
        inventory: iRaw ? JSON.parse(iRaw) : null,
        probeBase: pRaw ? JSON.parse(pRaw) : null,
      };
      console.log('Loaded from individual save keys:', result);
      return result;
    } catch (e) {
      console.error('Failed to load game:', e);
      return null;
    }
  }

  function resetGame() {
    localStorage.removeItem('pvz2_zealot');
    localStorage.removeItem('pvz2_inventory');
    localStorage.removeItem('pvz2_probe_base');
    localStorage.removeItem('pvz2_clicker_wars_save');
    window.location.reload();
  }

  return {
    saveGame,
    loadGame,
    resetGame,
  };
}
