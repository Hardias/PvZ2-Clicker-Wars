import { ref, computed, Ref } from 'vue';
import Decimal from 'break_eternity.js';
import { ZealotStats } from '../types/Zealot';
import { BigSource, big, desBig, toNum } from '../utils/bigNumber';

/**
 * Composable managing Zealot player stats, HP, attack power, dynamic click speed (CPS), currency, and persistence.
 * All growing values are break_eternity Decimals so the game stays playable indefinitely.
 */
export function useZealot(
  equipmentStats: ReturnType<typeof import('./useInventory').useInventory>['totalEquipmentStats'],
  isAtShop?: Ref<boolean>
) {
  // Default base statistics for a new Zealot
  const defaultState: ZealotStats = {
    hp: big(100),
    maxHp: big(100),
    baseAttack: big(15),
    baseAttackSpeed: 1.0, // 1 attack per second
    baseDefense: 5,
    baseHpRegen: big(1.0), // HP per second
    minerals: big(50),
    vespeneGas: big(0),
    infiniteVespene: false,
    emergencyTeleports: 2,
    deaths: 0,
    isImmobilized: false,
    wallsKilled: 0,
    damageDone: big(0),
    highestAverageDps: big(0),
  };

  /** Coerce a saved (JSON string/number/Decimal) zealot object into a proper Decimal-backed state. */
  function deserializeZealot(z: any, base: ZealotStats): ZealotStats {
    return {
      hp: desBig(z?.hp, base.hp),
      maxHp: desBig(z?.maxHp, base.maxHp),
      baseAttack: desBig(z?.baseAttack, base.baseAttack),
      baseAttackSpeed: typeof z?.baseAttackSpeed === 'number' ? z.baseAttackSpeed : base.baseAttackSpeed,
      baseDefense: typeof z?.baseDefense === 'number' ? z.baseDefense : base.baseDefense,
      baseHpRegen: desBig(z?.baseHpRegen, base.baseHpRegen),
      minerals: desBig(z?.minerals, base.minerals),
      vespeneGas: desBig(z?.vespeneGas, base.vespeneGas),
      infiniteVespene: z?.infiniteVespene === true,
      emergencyTeleports: typeof z?.emergencyTeleports === 'number' ? z.emergencyTeleports : base.emergencyTeleports,
      deaths: typeof z?.deaths === 'number' ? z.deaths : base.deaths,
      isImmobilized: false,
      wallsKilled: typeof z?.wallsKilled === 'number' ? z.wallsKilled : base.wallsKilled,
      damageDone: desBig(z?.damageDone, base.damageDone),
      highestAverageDps: desBig(z?.highestAverageDps, base.highestAverageDps),
    };
  }

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
        const merged = deserializeZealot(zState, { ...defaultState, deaths: savedDeaths });
        merged.deaths = Math.max(savedDeaths, zState.deaths || 0);
        return merged;
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
  const maxHp = computed(() => state.value.maxHp.add(equipmentStats.value.hp || 0));
  // Total attack power including equipment blade bonuses
  const attackPower = computed(() => state.value.baseAttack.add(equipmentStats.value.damage || 0));

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
    return attackPower.value.mul(rate);
  });

  // Effective defense including equipment armor
  const defense = computed(() => state.value.baseDefense + toNum(equipmentStats.value.defense || 0));

  // HP regeneration per second (+2,048,000 HP/s bonus when visiting the shop base)
  const hpRegen = computed(() => {
    const base = state.value.baseHpRegen.add(equipmentStats.value.hpRegen || 0);
    const shopRegenBonus = isAtShop && isAtShop.value ? 2048000 : 0;
    return base.add(shopRegenBonus);
  });

  /** Apply incoming damage with armor reduction */
  function takeDamage(amount: BigSource) {
    const reduction = equipmentStats.value.totalDefenseReduction || 0;
    const reducedDamage = big(amount).mul(1 - reduction);
    state.value.hp = Decimal.max(big(0), state.value.hp.sub(Decimal.max(big(1), reducedDamage)));
  }

  /** Heal zealot HP up to max HP */
  function heal(amount: BigSource) {
    state.value.hp = Decimal.min(maxHp.value, state.value.hp.add(big(amount)));
  }

  /** Gain mineral currency */
  function gainMinerals(amount: BigSource) {
    state.value.minerals = state.value.minerals.add(big(amount));
  }

  /** Spend currency (minerals or vespene gas) if affordable */
  function spendCurrency(cost: BigSource, currency: 'minerals' | 'vespene'): boolean {
    if (currency === 'minerals') {
      const c = big(cost);
      if (state.value.minerals.gte(c)) {
        state.value.minerals = state.value.minerals.sub(c);
        return true;
      }
    } else if (currency === 'vespene') {
      // DEV: infinite Vespene Gas never depletes
      if (state.value.infiniteVespene) return true;
      const c = big(cost);
      if (state.value.vespeneGas.gte(c)) {
        state.value.vespeneGas = state.value.vespeneGas.sub(c);
        return true;
      }
    }
    return false;
  }

  /** Convert minerals to vespene gas (64,000M = 1V) */
  function convertMineralsToVespene(vCount: number = 1): boolean {
    const costPerV = 64_000;
    const totalCost = costPerV * vCount;
    if (state.value.minerals.gte(totalCost)) {
      state.value.minerals = state.value.minerals.sub(totalCost);
      state.value.vespeneGas = state.value.vespeneGas.add(vCount);
      return true;
    }
    return false;
  }

  /** Convert all possible minerals into vespene gas */
  function convertMaxMineralsToVespene(): boolean {
    const costPerV = 64_000;
    const maxV = state.value.minerals.div(costPerV).floor().toNumber();
    if (maxV > 0) {
      const totalCost = costPerV * maxV;
      state.value.minerals = state.value.minerals.sub(totalCost);
      state.value.vespeneGas = state.value.vespeneGas.add(maxV);
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
  function loadState(savedState: any) {
    if (savedState) {
      const currentDeaths = state.value.deaths;
      const merged = deserializeZealot(savedState, { ...defaultState, deaths: currentDeaths });
      merged.deaths = Math.max(currentDeaths, savedState?.deaths || 0);
      state.value = merged;
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