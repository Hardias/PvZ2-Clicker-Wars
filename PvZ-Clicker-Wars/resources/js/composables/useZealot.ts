import { ref, computed, Ref } from 'vue';
import { ZealotStats } from '../types/Zealot';
import { ItemStats } from '../types/Item';

export function useZealot(
  equipmentStats: ReturnType<typeof import('./useInventory').useInventory>['totalEquipmentStats'],
  isAtShop?: Ref<boolean>
) {
  const state = ref<ZealotStats>({
    hp: 100,
    maxHp: 100,
    baseAttack: 15,
    baseAttackSpeed: 1.0, // 1 attack per second
    baseDefense: 5,
    baseHpRegen: 1.0, // HP per second
    minerals: 50,
    vespeneGas: 0,
    emergencyTeleports: 2,
    deaths: 0,
  });

  const maxHp = computed(() => state.value.maxHp + (equipmentStats.value.hp || 0));
  const attackPower = computed(() => state.value.baseAttack + (equipmentStats.value.damage || 0));
  
  const clickTimestamps = ref<number[]>([]);

  function recordClick() {
    const now = Date.now();
    clickTimestamps.value.push(now);
    // 3 sec max for average taking (prune clicks older than 3000ms)
    clickTimestamps.value = clickTimestamps.value.filter(t => now - t <= 3000);
  }

  const averageCps = computed(() => {
    const now = Date.now();
    const validClicks = clickTimestamps.value.filter(t => now - t <= 3000);
    return validClicks.length / 3.0;
  });

  const attackSpeed = computed(() => {
    if (!equipmentStats.value.hasGloves) return 0;
    const base = state.value.baseAttackSpeed;
    const itemMultiplier = 1 + (equipmentStats.value.attackSpeed || 0);
    return Math.max(0.2, base + (itemMultiplier * averageCps.value));
  });

  const defense = computed(() => state.value.baseDefense + (equipmentStats.value.defense || 0));
  
  const hpRegen = computed(() => {
    const base = state.value.baseHpRegen + (equipmentStats.value.hpRegen || 0);
    // When visiting the Shop Base, gain the effect of Final Regen (2,048,000 HP/s)
    const shopRegenBonus = isAtShop && isAtShop.value ? 2048000 : 0;
    return base + shopRegenBonus;
  });

  function takeDamage(amount: number) {
    const reduction = (equipmentStats.value as any).totalDefenseReduction || 0;
    const reducedDamage = amount * (1 - reduction);
    state.value.hp = Math.max(0, state.value.hp - Math.max(1, reducedDamage));
  }

  function heal(amount: number) {
    state.value.hp = Math.min(maxHp.value, state.value.hp + amount);
  }

  function gainMinerals(amount: number) {
    state.value.minerals += amount;
  }

  function spendCurrency(cost: number, currency: 'minerals' | 'vespene'): boolean {
    if (currency === 'minerals') {
      if (state.value.minerals >= cost) {
        state.value.minerals -= cost;
        return true;
      }
    } else if (currency === 'vespene') {
      if (state.value.vespeneGas >= cost) {
        state.value.vespeneGas -= cost;
        return true;
      }
    }
    return false;
  }

  function convertMineralsToVespene(vCount: number = 1): boolean {
    const costPerV = 64_000; // 64,000 Minerals = 1V
    const totalCost = costPerV * vCount;
    if (state.value.minerals >= totalCost) {
      state.value.minerals -= totalCost;
      state.value.vespeneGas += vCount;
      return true;
    }
    return false;
  }

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

  function useEmergencyTeleport(): boolean {
    if (state.value.emergencyTeleports > 0) {
      state.value.emergencyTeleports -= 1;
      state.value.deaths += 1;
      state.value.hp = maxHp.value;
      return true;
    }
    state.value.deaths += 1;
    return false;
  }

  function loadState(savedState: ZealotStats) {
    if (savedState) {
      state.value = { ...savedState };
      if (typeof state.value.vespeneGas !== 'number') state.value.vespeneGas = 0;
      if (typeof state.value.emergencyTeleports !== 'number') state.value.emergencyTeleports = 2;
      if (typeof state.value.deaths !== 'number') state.value.deaths = 0;
    }
  }

  return {
    state,
    maxHp,
    attackPower,
    attackSpeed,
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
