import { ref, computed } from 'vue';
import { ProbeBase, WallTier, TurretInfo } from '../types/ProbeBase';

export function useCombat() {
  const currentWave = ref<number>(1);
  const isEngagedInCombat = ref<boolean>(false);

  function getTurretInfo(wave: number): TurretInfo {
    const level = Math.min(13, wave);
    return {
      count: 8,
      level,
      attackPower: 8.0 * level, // 8 turrets * level (1.0/s per turret base)
    };
  }

  const probeBase = ref<ProbeBase>({
    wave: 1,
    wall: {
      tier: 'wall',
      level: 1,
      maxHp: 200,
      currentHp: 200,
      defense: 2,
    },
    turret: getTurretInfo(1),
    bounty: 50,
  });

  const wallOrder: WallTier[] = ['wall', 'ultra', 'mega', 'power', 'final'];

  function getMaxLevelForTier(tier: WallTier): number {
    switch (tier) {
      case 'wall':
      case 'ultra':
      case 'mega':
        return 5;
      case 'power':
        return 2;
      case 'final':
        return 1;
    }
  }

  const totalTurretDps = computed(() => {
    if (!isEngagedInCombat.value) return 0;
    return probeBase.value.turret.attackPower;
  });

  function autoRepairWall() {
    const wall = probeBase.value.wall;
    if (wall.currentHp > 0 && wall.currentHp < wall.maxHp) {
      const repairAmount = wall.maxHp * 0.25; // 25% of max HP per second
      wall.currentHp = Math.min(wall.maxHp, wall.currentHp + repairAmount);
      console.log('Probe Auto-Repair healed wall by:', repairAmount, 'Current HP:', wall.currentHp);
    }
  }

  function advanceWall() {
    const wall = probeBase.value.wall;
    const maxLvl = getMaxLevelForTier(wall.tier);

    if (wall.level < maxLvl) {
      wall.level += 1;
      wall.maxHp = Math.floor(wall.maxHp * 1.6);
      wall.currentHp = wall.maxHp;
      wall.defense += 3;
    } else {
      // Move to next tier
      const currentTierIndex = wallOrder.indexOf(wall.tier);
      if (currentTierIndex < wallOrder.length - 1) {
        const nextTier = wallOrder[currentTierIndex + 1];
        wall.tier = nextTier;
        wall.level = 1;
        wall.maxHp = Math.floor(wall.maxHp * 2.2);
        wall.currentHp = wall.maxHp;
        wall.defense += 8;
      } else {
        // Conquered final wall! Advance wave
        currentWave.value += 1;
        wall.tier = 'wall';
        wall.level = 1;
        wall.maxHp = Math.floor(200 * Math.pow(1.5, currentWave.value - 1));
        wall.currentHp = wall.maxHp;
        probeBase.value.bounty = Math.floor(50 * Math.pow(1.4, currentWave.value - 1));
        probeBase.value.turret = getTurretInfo(currentWave.value);
      }
    }
    isEngagedInCombat.value = false;
  }

  function damageWall(amount: number): { destroyed: boolean; mineralsGained: number } {
    isEngagedInCombat.value = true;
    const wall = probeBase.value.wall;
    const effectiveDamage = Math.max(1, amount - wall.defense * 0.3);
    wall.currentHp = Math.max(0, wall.currentHp - effectiveDamage);

    if (wall.currentHp <= 0) {
      const reward = probeBase.value.bounty;
      advanceWall();
      return { destroyed: true, mineralsGained: reward };
    }

    return { destroyed: false, mineralsGained: 0 };
  }

  function stopCombat() {
    isEngagedInCombat.value = false;
  }

  function loadCombatState(savedWave: number, savedBase: ProbeBase) {
    if (savedWave) currentWave.value = savedWave;
    if (savedBase) {
      probeBase.value = savedBase;
    }
    if (!probeBase.value.turret) {
      probeBase.value.turret = getTurretInfo(currentWave.value);
    }
    isEngagedInCombat.value = false;
  }

  return {
    currentWave,
    probeBase,
    isEngagedInCombat,
    totalTurretDps,
    autoRepairWall,
    damageWall,
    stopCombat,
    loadCombatState,
  };
}
