import { ref, computed } from 'vue';
import { ProbeBase, WallTier, TurretInfo } from '../types/ProbeBase';

export function useCombat() {
  const isEngagedInCombat = ref<boolean>(false);

  const rankList = ['D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

  function getRankName(index: number): string {
    if (index < rankList.length) {
      return rankList[index];
    }
    return `S-${index - rankList.length + 1}`;
  }

  function getTurretInfo(rankIndex: number, levelOverride = 1): TurretInfo {
    const level = levelOverride + rankIndex;
    const attackPower = Math.floor(40.0 * Math.pow(1.35, level - 1));
    return {
      count: 8,
      level,
      attackPower,
    };
  }

  function calculateUpgradeTime(rankIndex: number, upgradeCount: number): number {
    const base = 45 * Math.pow(1.1, upgradeCount);
    const rankSpeedBonus = Math.pow(0.95, rankIndex); // 5% faster per rank index
    return Math.max(5, Math.floor(base * rankSpeedBonus));
  }

  const probeBase = ref<ProbeBase>({
    rankIndex: 0,
    rankName: 'D-',
    probeKills: 0,
    upgradeCount: 0,
    timeUntilUpgrade: 45,
    maxUpgradeTime: 45,
    wall: {
      tier: 'wall',
      level: 1,
      maxHp: 200,
      currentHp: 200,
      defense: 2,
    },
    turret: getTurretInfo(0, 1),
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
    const wall = { ...probeBase.value.wall };
    if (wall.currentHp > 0 && wall.currentHp < wall.maxHp) {
      const repairAmount = wall.maxHp * 0.25; // 25% max HP per second
      wall.currentHp = Math.min(wall.maxHp, wall.currentHp + repairAmount);
      probeBase.value = {
        ...probeBase.value,
        wall,
      };
    }
  }

  function tickProbeUpgrades(): boolean {
    const base = probeBase.value;
    if (base.timeUntilUpgrade > 0) {
      probeBase.value = {
        ...base,
        timeUntilUpgrade: base.timeUntilUpgrade - 1,
      };
      return false;
    } else {
      upgradeProbeDefenses();
      return true;
    }
  }

  function upgradeProbeDefenses() {
    const base = probeBase.value;
    const wall = { ...base.wall };
    const maxLvl = getMaxLevelForTier(wall.tier);

    if (wall.level < maxLvl) {
      wall.level += 1;
      wall.maxHp = Math.floor(wall.maxHp * 1.5);
      wall.currentHp = wall.maxHp;
      wall.defense += 3;
    } else {
      const currentTierIndex = wallOrder.indexOf(wall.tier);
      if (currentTierIndex < wallOrder.length - 1) {
        const nextTier = wallOrder[currentTierIndex + 1];
        wall.tier = nextTier;
        wall.level = 1;
        wall.maxHp = Math.floor(wall.maxHp * 2.0);
        wall.currentHp = wall.maxHp;
        wall.defense += 8;
      }
    }

    const turret = { ...base.turret };
    turret.level += 1;
    turret.attackPower = Math.floor(40.0 * Math.pow(1.35, turret.level - 1));

    const upgradeCount = base.upgradeCount + 1;
    const maxUpgradeTime = calculateUpgradeTime(base.rankIndex, upgradeCount);

    probeBase.value = {
      ...base,
      wall,
      turret,
      upgradeCount,
      maxUpgradeTime,
      timeUntilUpgrade: maxUpgradeTime,
    };
  }

  function handleWallDestruction() {
    const base = probeBase.value;
    const probeKills = base.probeKills + 1;

    let nextRankIndex = base.rankIndex;
    if (base.rankIndex === 0 && probeKills <= 5) {
      if (Math.random() < 0.5) {
        nextRankIndex = 0;
      } else {
        nextRankIndex = 1;
      }
    } else {
      nextRankIndex = base.rankIndex + 1;
    }

    const wall = { ...base.wall };
    wall.currentHp = wall.maxHp;

    // Scale turret info with new rank index
    const turret = getTurretInfo(nextRankIndex, base.turret.level);

    probeBase.value = {
      ...base,
      rankIndex: nextRankIndex,
      rankName: getRankName(nextRankIndex),
      probeKills,
      wall,
      turret,
    };

    isEngagedInCombat.value = false;
  }

  function damageWall(amount: number): { destroyed: boolean } {
    isEngagedInCombat.value = true;
    const base = probeBase.value;
    const wall = { ...base.wall };
    const effectiveDamage = Math.max(1, amount - wall.defense * 0.3);
    wall.currentHp = Math.max(0, wall.currentHp - effectiveDamage);

    probeBase.value = {
      ...base,
      wall,
    };

    if (wall.currentHp <= 0) {
      handleWallDestruction();
      return { destroyed: true };
    }

    return { destroyed: false };
  }

  function stopCombat() {
    isEngagedInCombat.value = false;
  }

  function loadCombatState(savedBase: any) {
    console.log('Loading combat state, savedBase:', savedBase);
    if (savedBase) {
      const rIndex = typeof savedBase.rankIndex === 'number' ? savedBase.rankIndex : 0;
      probeBase.value = {
        rankIndex: rIndex,
        rankName: savedBase.rankName || getRankName(rIndex),
        probeKills: typeof savedBase.probeKills === 'number' ? savedBase.probeKills : 0,
        upgradeCount: typeof savedBase.upgradeCount === 'number' ? savedBase.upgradeCount : 0,
        timeUntilUpgrade: typeof savedBase.timeUntilUpgrade === 'number' ? savedBase.timeUntilUpgrade : 45,
        maxUpgradeTime: typeof savedBase.maxUpgradeTime === 'number' ? savedBase.maxUpgradeTime : 45,
        wall: savedBase.wall && typeof savedBase.wall.maxHp === 'number' ? savedBase.wall : {
          tier: 'wall',
          level: 1,
          maxHp: 200,
          currentHp: 200,
          defense: 2,
        },
        turret: savedBase.turret && typeof savedBase.turret.level === 'number' ? savedBase.turret : getTurretInfo(rIndex, 1),
      };
    }
    isEngagedInCombat.value = false;
  }

  return {
    probeBase,
    isEngagedInCombat,
    totalTurretDps,
    autoRepairWall,
    tickProbeUpgrades,
    damageWall,
    stopCombat,
    loadCombatState,
  };
}
