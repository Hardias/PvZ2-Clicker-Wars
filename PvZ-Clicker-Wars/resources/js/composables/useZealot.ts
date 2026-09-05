import { ref, computed, Ref } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { ItemStats } from '../types/Item';

/**
 * Composable managing Zealot player stats, HP, attack power, dynamic click speed (CPS), currency, and persistence.
 */
export function useZealot(
  equipmentStats: ReturnType<typeof import('./useInventory').useInventory>['totalEquipmentStats'],
  isAtShop?: Ref<boolean>
) {
  // Default base statistics for a new Zealot
  const defaultState: ZealotStats = {
    hp: 100,
    maxHp: 100,
    baseAttack: 15,
    baseAttackSpeed: 1.0, // 1 attack per second
    baseDefense: 5,
    baseHpRegen: 1.0, // HP per second
    minerals: 50,
    vespeneGas: 0,
    infiniteVespene: false,
    emergencyTeleports: 2,
    deaths: 0,
    isImmobilized: false,
    wallsKilled: 0,
    damageDone: 0,
    highestAverageDps: 0,
  };

  /** Load initial Zealot state from storage or fallback to defaults */
  function loadInitialState(): ZealotStats {
    let savedDeaths = 0;
    try {
      const dRaw = localStorage.getItem('pvz2_zelot_deaths');
      if (dRaw) savedDeaths = parseInt(dRaw, 10) || 0;
    } catch {}

    try {
      const raw = localStorage.getItem('pvz2_slot_A') || localStorage.getItem('pvz2_slot_B') || localStorage.getItem('pvz2_slot_C') || localStorage.getItem('pvz2_autosave') || localStorage.getItem('pvz2_zealot');
      if (raw) {
        const parsed = JSON.parse(raw);
        const zState = parsed.zealot || parsed;
        return {
          ...defaultState,
          ...zState,
          deaths: Math.max(savedDeaths, zState.deaths || 0),
          isImmobilized: false,
        };
      }
    } catch (e) {
      console.error('Failed to load zealot state from storage:', e);
    }
    return {
      ...defaultState,
      deaths: savedDeaths,
    };
  }

  // Reactive zealot state
  const state = ref<ZealotStats>(loadInitialState());

  // Total max HP including equipment bonuses
  const maxHp = computed(() => state.value.maxHp + (equipmentStats.value.hp || 0));
  // Total attack power including equipment blade bonuses
  const attackPower = computed(() => state.value.baseAttack + (equipmentStats.value.damage || 0));
  
  // Timestamps of manual clicks for dynamic attack speed calculation (CPS)
  const clickTimestamps = ref<number[]>([]);

  /** Record a manual click and prune clicks older than 3 seconds */
  function recordClick() {
    if (state.value.isImmobilized) return;
    const now = Date.now();
    clickTimestamps.value.push(now);
    clickTimestamps.value = clickTimestamps.value.filter(t => now - t <= 3000);
  }

  // Calculate average clicks per second (CPS) over the last 3 seconds
  const averageCps = computed(() => {
    const now = Date.now();
    const validClicks = clickTimestamps.value.filter(t => now - t <= 3000);
    return validClicks.length / 3.0;
  });

  // Effective attack speed based on gloves and CPS
  const attackSpeed = computed(() => {
    if (!equipmentStats.value.hasGloves) return 0;
    const base = state.value.baseAttackSpeed;
    const itemMultiplier = 1 + (equipmentStats.value.attackSpeed || 0);
    return Math.max(0.2, base + (itemMultiplier * averageCps.value));
  });

  // Current damage per second: gloves use the auto-attack rate, otherwise manual clicks (CPS)
  const currentDps = computed(() => {
    const rate = equipmentStats.value.hasGloves ? attackSpeed.value : averageCps.value;
    return rate * attackPower.value;
  });

  // Effective defense including equipment armor
  const defense = computed(() => state.value.baseDefense + (equipmentStats.value.defense || 0));
  
  // HP regeneration per second (+2,048,000 HP/s bonus when visiting the shop base)
  const hpRegen = computed(() => {
    const base = state.value.baseHpRegen + (equipmentStats.value.hpRegen || 0);
    const shopRegenBonus = isAtShop && isAtShop.value ? 2048000 : 0;
    return base + shopRegenBonus;
  });

  /** Apply incoming damage with armor reduction */
  function takeDamage(amount: number) {
    const reduction = (equipmentStats.value as any).totalDefenseReduction || 0;
    const reducedDamage = amount * (1 - reduction);
    state.value.hp = Math.max(0, state.value.hp - Math.max(1, reducedDamage));
  }

  /** Heal zealot HP up to max HP */
  function heal(amount: number) {
    state.value.hp = Math.min(maxHp.value, state.value.hp + amount);
  }

  /** Gain mineral currency */
  function gainMinerals(amount: number) {
    state.value.minerals += amount;
  }

  /** Spend currency (minerals or vespene gas) if affordable */
  function spendCurrency(cost: number, currency: 'minerals' | 'vespene'): boolean {
    if (currency === 'minerals') {
      if (state.value.minerals >= cost) {
        state.value.minerals -= cost;
        return true;
      }
    } else if (currency === 'vespene') {
      // DEV: infinite Vespene Gas never depletes
      if (state.value.infiniteVespene) return true;
      if (state.value.vespeneGas >= cost) {
        state.value.vespeneGas -= cost;
        return true;
      }
    }
    return false;
  }

  /** Convert minerals to vespene gas (64,000M = 1V) */
  function convertMineralsToVespene(vCount: number = 1): boolean {
    const costPerV = 64_000;
    const totalCost = costPerV * vCount;
    if (state.value.minerals >= totalCost) {
      state.value.minerals -= totalCost;
      state.value.vespeneGas += vCount;
      return true;
    }
    return false;
  }

  /** Convert all possible minerals into vespene gas */
  function convertMaxMineralsToVespene(): boolean {
    const costPerV = 64_000;
    const maxV = Math.floor(state.value.minerals / costPerV);
    if (maxV > 0) {
      const totalCost = costPerV * maxV;
      state.value.minerals -= totalCost;
      state.value.vespeneGas += maxV;
      return true;
    }
    return false;
  }

  /** Use emergency teleport upon fatal damage (increments death counter only if teleports are depleted) */
  function useEmergencyTeleport(): boolean {
    if (state.value.emergencyTeleports > 0) {
      state.value.emergencyTeleports -= 1;
      state.value.hp = maxHp.value;
      state.value.isImmobilized = false;
      return true;
    }
    // Permadeath (when teleports depleted): increments deaths
    state.value.deaths += 1;
    try {
      localStorage.setItem('pvz2_zelot_deaths', String(state.value.deaths));
    } catch {}
    return false;
  }

  /** Load saved zealot state */
  function loadState(savedState: ZealotStats) {
    if (savedState) {
      const currentDeaths = state.value.deaths;
      state.value = {
        ...defaultState,
        ...savedState,
        deaths: Math.max(currentDeaths, savedState.deaths || 0),
        isImmobilized: false,
      };
      if (typeof state.value.vespeneGas !== 'number') state.value.vespeneGas = 0;
      if (typeof state.value.emergencyTeleports !== 'number') state.value.emergencyTeleports = 2;
      if (typeof state.value.deaths !== 'number') state.value.deaths = savedState.deaths || currentDeaths;
    }
  }

  return {
    state,
    maxHp,
    attackPower,
    attackSpeed,
    currentDps,
    defense,
    hpRegen,
    takeDamage,
    heal,
    gainMinerals,
    spendCurrency,
    convertMineralsToVespene,
    convertMaxMineralsToVespene,
    useEmergencyTeleport,
    loadState,
    recordClick,
  };
}
