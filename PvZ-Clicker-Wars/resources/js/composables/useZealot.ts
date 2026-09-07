import { ref, computed, Ref } from 'vue';
import Decimal from 'break_eternity.js';
import { ZealotStats } from '../types/Zealot';
import { SkillBonuses, DEFAULT_SKILL_BONUSES } from '../types/SkillTree';
import { BigSource, big, desBig, toNum } from '../utils/bigNumber';
import {
  DEFAULT_MAX_HP,
  DEFAULT_BASE_ATTACK,
  DEFAULT_BASE_ATTACK_SPEED,
  DEFAULT_BASE_DEFENSE,
  DEFAULT_BASE_HP_REGEN,
  DEFAULT_STARTING_MINERALS,
  DEFAULT_EMERGENCY_TELEPORTS,
  VESPENE_CONVERSION_RATE,
  SHOP_REGEN_BONUS,
} from '../utils/constants';

/** Build a fresh Zealot state with the shared default base stats. */
export function createDefaultZealotState(overrides: Partial<ZealotStats> = {}): ZealotStats {
  return {
    hp: big(DEFAULT_MAX_HP),
    maxHp: big(DEFAULT_MAX_HP),
    baseAttack: big(DEFAULT_BASE_ATTACK),
    baseAttackSpeed: DEFAULT_BASE_ATTACK_SPEED,
    baseDefense: DEFAULT_BASE_DEFENSE,
    baseHpRegen: big(DEFAULT_BASE_HP_REGEN),
    minerals: big(DEFAULT_STARTING_MINERALS),
    vespeneGas: big(0),
    infiniteVespene: false,
    emergencyTeleports: DEFAULT_EMERGENCY_TELEPORTS,
    deaths: 0,
    isImmobilized: false,
    wallsKilled: 0,
    damageDone: big(0),
    highestAverageDps: big(0),
    abilityImmunityTimer: 0,
    damageImmunityTimer: 0,
    undyingUsedThisFight: false,
    totalMineralsEarned: big(0),
    totalVespeneEarned: big(0),
    totalPlayTimeSeconds: 0,
    ...overrides,
  };
}

/**
 * Composable managing Zealot player stats, HP, attack power, dynamic click speed (CPS), currency, and persistence.
 * All growing values are break_eternity Decimals so the game stays playable indefinitely.
 */
export function useZealot(
  equipmentStats: ReturnType<typeof import('./useInventory').useInventory>['totalEquipmentStats'],
  isAtShop?: Ref<boolean>,
  skillBonuses?: Ref<SkillBonuses>
) {
  // Default base statistics for a new Zealot
  const defaultState = createDefaultZealotState();

  /** Coerce a saved (JSON string/number/Decimal) zealot object into a proper Decimal-backed state. */
  function deserializeZealot(z: Record<string, unknown>, base: ZealotStats): ZealotStats {
    const baseAttackSpeed = typeof z?.baseAttackSpeed === 'number' ? (z.baseAttackSpeed as number) : base.baseAttackSpeed;
    const baseDefense = typeof z?.baseDefense === 'number' ? (z.baseDefense as number) : base.baseDefense;
    const emergencyTeleports = typeof z?.emergencyTeleports === 'number' ? (z.emergencyTeleports as number) : base.emergencyTeleports;
    const deaths = typeof z?.deaths === 'number' ? (z.deaths as number) : base.deaths;
    const wallsKilled = typeof z?.wallsKilled === 'number' ? (z.wallsKilled as number) : base.wallsKilled;
    const abilityImmunityTimer = typeof z?.abilityImmunityTimer === 'number' ? (z.abilityImmunityTimer as number) : 0;
    const damageImmunityTimer = typeof z?.damageImmunityTimer === 'number' ? (z.damageImmunityTimer as number) : 0;
    const totalPlayTimeSeconds = typeof z?.totalPlayTimeSeconds === 'number' ? (z.totalPlayTimeSeconds as number) : base.totalPlayTimeSeconds;

    return {
      hp: desBig(z?.hp, base.hp),
      maxHp: desBig(z?.maxHp, base.maxHp),
      baseAttack: desBig(z?.baseAttack, base.baseAttack),
      baseAttackSpeed,
      baseDefense,
      baseHpRegen: desBig(z?.baseHpRegen, base.baseHpRegen),
      minerals: desBig(z?.minerals, base.minerals),
      vespeneGas: desBig(z?.vespeneGas, base.vespeneGas),
      infiniteVespene: z?.infiniteVespene === true,
      emergencyTeleports,
      deaths,
      isImmobilized: false,
      wallsKilled,
      damageDone: desBig(z?.damageDone, base.damageDone),
      highestAverageDps: desBig(z?.highestAverageDps, base.highestAverageDps),
      abilityImmunityTimer,
      damageImmunityTimer,
      undyingUsedThisFight: z?.undyingUsedThisFight === true,
      totalMineralsEarned: desBig(z?.totalMineralsEarned, base.totalMineralsEarned),
      totalVespeneEarned: desBig(z?.totalVespeneEarned, base.totalVespeneEarned),
      totalPlayTimeSeconds,
    };
  }

  /** Load initial Zealot state from storage or fallback to defaults */
  function loadInitialState(): ZealotStats {
    let savedDeaths = 0;
    try {
      const dRaw = localStorage.getItem('pvz2_zealot_deaths');
      if (dRaw) savedDeaths = parseInt(dRaw, 10) || 0;
    } catch {}

    try {
      const raw = localStorage.getItem('pvz2_slot_A') || localStorage.getItem('pvz2_slot_B') || localStorage.getItem('pvz2_slot_C') || localStorage.getItem('pvz2_autosave') || localStorage.getItem('pvz2_zealot');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const zState = (parsed.zealot || parsed) as Record<string, unknown>;
        const savedDeathsNum = typeof zState.deaths === 'number' ? (zState.deaths as number) : 0;
        const merged = deserializeZealot(zState, { ...defaultState, deaths: savedDeaths });
        merged.deaths = Math.max(savedDeaths, savedDeathsNum);
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

  // Helper to get current skill bonuses (with fallback to defaults)
  function getBonuses(): SkillBonuses {
    return skillBonuses?.value ?? DEFAULT_SKILL_BONUSES;
  }

  // Total max HP including equipment and skill tree bonuses
  const maxHp = computed(() => {
    const base = state.value.maxHp.add(equipmentStats.value.hp || 0);
    return base.mul(getBonuses().maxHpMultiplier);
  });
  // Total attack power including equipment blade bonuses and skill tree damage multiplier
  const attackPower = computed(() => {
    const base = state.value.baseAttack.add(equipmentStats.value.damage || 0);
    return base.mul(getBonuses().damageMultiplier);
  });

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

  // Effective attack speed based on gloves and CPS, modified by skill tree
  const attackSpeed = computed(() => {
    if (!equipmentStats.value.hasGloves) return 0;
    const base = state.value.baseAttackSpeed;
    const itemMultiplier = 1 + (equipmentStats.value.attackSpeed || 0);
    const raw = Math.max(0.2, base + (itemMultiplier * averageCps.value));
    return raw * getBonuses().attackSpeedMultiplier;
  });

  // Current damage per second: gloves use the auto-attack rate, otherwise manual clicks (CPS)
  const currentDps = computed(() => {
    const rate = equipmentStats.value.hasGloves ? attackSpeed.value : averageCps.value;
    return attackPower.value.mul(rate);
  });

  // Effective defense including equipment armor
  const defense = computed(() => state.value.baseDefense + toNum(equipmentStats.value.defense || 0));

  // HP regeneration per second (+SHOP_REGEN_BONUS HP/s when visiting the shop base,
  // +skill tree % of max HP regen which scales forever)
  const hpRegen = computed(() => {
    const base = state.value.baseHpRegen.add(equipmentStats.value.hpRegen || 0);
    const shopRegenBonus = isAtShop && isAtShop.value ? SHOP_REGEN_BONUS : 0;
    const skillFlat = getBonuses().hpRegenPercent;
    return base.add(shopRegenBonus).add(maxHp.value.mul(skillFlat));
  });

  /** Compute the actual (post-mitigation) damage a given amount would deal, without applying it. */
  function computeReducedDamage(amount: BigSource): Decimal {
    const reduction = equipmentStats.value.totalDefenseReduction || 0;
    const skillReduction = getBonuses().turretDamageReduction;
    const totalReduction = Math.min(0.9999, 1 - (1 - reduction) * (1 - skillReduction));
    return big(amount).mul(1 - totalReduction);
  }

  /** Apply incoming damage: armor reduction (from equipment) stacked multiplicatively with skill tree turret resist. Returns the actual (reduced) damage dealt as a Decimal. */
  function takeDamage(amount: BigSource): Decimal {
    const reducedDamage = computeReducedDamage(amount);
    state.value.hp = Decimal.max(big(0), state.value.hp.sub(Decimal.max(big(1), reducedDamage)));
    return reducedDamage;
  }

  /** Heal zealot HP up to max HP */
  function heal(amount: BigSource) {
    state.value.hp = Decimal.min(maxHp.value, state.value.hp.add(big(amount)));
  }

  /** Gain mineral currency */
  function gainMinerals(amount: BigSource) {
    const amt = big(amount);
    state.value.minerals = state.value.minerals.add(amt);
    state.value.totalMineralsEarned = state.value.totalMineralsEarned.add(amt);
  }

  /** Gain vespene gas currency, tracking the run total */
  function addVespene(amount: BigSource) {
    const amt = big(amount);
    state.value.vespeneGas = state.value.vespeneGas.add(amt);
    state.value.totalVespeneEarned = state.value.totalVespeneEarned.add(amt);
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

  /** Convert all possible minerals into vespene gas */
  function convertMaxMineralsToVespene(): boolean {
    const costPerV = VESPENE_CONVERSION_RATE / (getBonuses().vespeneConversionMultiplier || 1);
    const maxVD = state.value.minerals.div(costPerV).floor();
    const maxV = maxVD.toNumber();
    const safe = maxVD.gt(0) && maxV > 0 && Number.isFinite(maxV) && maxV <= Number.MAX_SAFE_INTEGER;
    if (safe) {
      const totalCost = costPerV * maxV;
      state.value.minerals = state.value.minerals.sub(totalCost);
      addVespene(maxV);
      return true;
    }
    return false;
  }

  /** Use emergency teleport upon fatal damage (increments death counter only if teleports are depleted) */
  function useEmergencyTeleport(): boolean {
    const bonusTeleports = getBonuses().extraTeleports;
    const totalAvailable = state.value.emergencyTeleports + bonusTeleports;
    if (totalAvailable > 0) {
      if (state.value.emergencyTeleports > 0) {
        state.value.emergencyTeleports -= 1;
      }
      state.value.hp = maxHp.value;
      state.value.isImmobilized = false;
      state.value.abilityImmunityTimer = 10;
      return true;
    }
    // Permadeath (when teleports depleted): increments deaths
    state.value.deaths += 1;
    try {
      localStorage.setItem('pvz2_zealot_deaths', String(state.value.deaths));
    } catch {}
    return false;
  }

  /** Load saved zealot state */
  function loadState(savedState: ZealotStats | Record<string, unknown> | undefined) {
    if (savedState) {
      const currentDeaths = state.value.deaths;
      const savedObj = (savedState as Record<string, unknown>);
      const savedDeaths = typeof savedObj.deaths === 'number' ? (savedObj.deaths as number) : 0;
      const merged = deserializeZealot(savedObj, { ...defaultState, deaths: currentDeaths });
      merged.deaths = Math.max(currentDeaths, savedDeaths);
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
    computeReducedDamage,
    heal,
    gainMinerals,
    addVespene,
    spendCurrency,
    convertMaxMineralsToVespene,
    useEmergencyTeleport,
    loadState,
    recordClick,
  };
}