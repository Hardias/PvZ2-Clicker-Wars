import { ref, computed } from 'vue';
import { ProbeBase, WallTier, TurretInfo, RareProbeType } from '../types/ProbeBase';
import { ZealotStats } from '../types/Zealot';

/**
 * Composable handling probe base combat, defenses, turret DPS, upgrade timers, and rare/clanned probe mechanics.
 */
export function useCombat() {
  // Whether the zealot is currently engaged in active combat against turrets
  const isEngagedInCombat = ref<boolean>(false);

  // Persistent progression backup when encountering a Pather probe
  const prePatherTurret = ref<TurretInfo | null>(null);
  const prePatherUpgradeCount = ref<number>(0);

  // Probe rank list up to A+, followed by S ranks
  const rankList = ['D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

  // Clan list for Clanned probes appearing every 10 ranks starting from S+ rank
  const clanList = ['PvZWA', 'PvZMA', 'PvZAS', 'PvZNA', 'PvZ50', 'WBGA'];

  /** Get rank name string for given rank index */
  function getRankName(index: number): string {
    if (index < rankList.length) {
      return rankList[index];
    }
    return `S-${index - rankList.length + 1}`;
  }

  /** Calculate turret info (count, level, attack power) - turret damage halved to 20 base at level 1 */
  function getTurretInfo(level: number, isGold = false): TurretInfo {
    const basePower = Math.floor((40.0 * Math.pow(1.35, level - 1)) * 0.5); // Halved from 40 to 20 base at level 1
    const count = isGold ? 16 : 8; // Gold baser has double turrets (16)
    const attackPower = basePower * (isGold ? 2 : 1);
    return {
      count,
      level,
      attackPower,
    };
  }

  /** Calculate defense upgrade countdown duration based on rank and upgrade count */
  function calculateUpgradeTime(rankIndex: number, upgradeCount: number): number {
    const base = 45 * Math.pow(1.1, upgradeCount);
    const rankSpeedBonus = Math.pow(0.95, rankIndex); // 5% faster per rank index
    return Math.max(5, Math.floor(base * rankSpeedBonus));
  }

  /** Determine probe ability (Chrono or Void Prism) */
  function getRandomAbility(rankIndex: number): 'chrono' | 'voidPrism' {
    const voidChance = Math.min(0.9, 0.1 + (rankIndex / 12) * 0.8);
    return Math.random() < voidChance ? 'voidPrism' : 'chrono';
  }

  /** Roll whether a probe is rare and what type (STRICTLY available only from S+ rank onwards, rankIndex >= 14) */
  function generateRareProbe(rankIndex: number): { isRare: boolean; rareType: RareProbeType; isClanned: boolean; clanName?: string } {
    if (rankIndex < 14) {
      return { isRare: false, rareType: null, isClanned: false };
    }
    const isRare = Math.random() < 0.5; // 50% chance if rank >= S+
    const isClanned = (rankIndex - 14) % 10 === 0; // Every 10 ranks starting from S+
    const clanName = isClanned ? clanList[Math.floor(Math.random() * clanList.length)] : undefined;

    if (!isRare) return { isRare: false, rareType: null, isClanned, clanName };

    const disablePatherActive = localStorage.getItem('pvz2_disable_pather') === 'true';

    let rareType: RareProbeType = 'doubleBaser';
    let attempts = 0;
    do {
      const roll = Math.random();
      if (roll < 0.20) {
        rareType = 'doubleBaser'; // 20%
      } else if (roll < 0.40) {
        rareType = 'goldBaser'; // 20%
      } else if (roll < 0.60) {
        rareType = 'pather'; // 20%
      } else if (roll < 0.70) {
        rareType = 'tripleBaser'; // 10%
      } else {
        rareType = 'trainingProbe'; // 30%
      }
      attempts++;
    } while (disablePatherActive && rareType === 'pather' && attempts < 20);

    if (disablePatherActive && rareType === 'pather') {
      rareType = 'doubleBaser';
    }

    return { isRare: true, rareType, isClanned, clanName };
  }

  /** Create a new probe base with stats appropriate to its rank, rare type, and clan */
  function createProbeBase(rankIndex: number, forcedRareType?: RareProbeType, currentTurret?: TurretInfo, currentUpgradeCount?: number): ProbeBase {
    const rankName = getRankName(rankIndex);
    const { isRare, rareType: initialRareType, isClanned, clanName } = generateRareProbe(rankIndex);
    const rareType = forcedRareType !== undefined ? forcedRareType : initialRareType;

    const baseHp = Math.floor(200 * Math.pow(1.8, rankIndex));
    let wall = {
      tier: 'wall' as WallTier,
      level: 1,
      maxHp: baseHp,
      currentHp: baseHp,
      defense: 2 + rankIndex * 4,
    };
    let turret = currentTurret ? { ...currentTurret } : getTurretInfo(1, rareType === 'goldBaser');
    let ability = getRandomAbility(rankIndex);
    let abilityCooldown = 40;
    let patherWallsRemaining = undefined;
    let trainingState: 'waiting15' | 'window2' | 'castingVoid' | 'normal' = 'normal';
    let trainingTimer = 0;

    if (rareType === 'doubleBaser') {
      wall.maxHp *= 2;
      wall.currentHp = wall.maxHp;
      wall.defense *= 2;
      turret.attackPower = Math.floor(turret.attackPower * 1.5);
    } else if (rareType === 'goldBaser') {
      turret = getTurretInfo(currentTurret ? currentTurret.level : 1, true);
      turret.attackPower = Math.floor(turret.attackPower * 1.5);
    } else if (rareType === 'pather') {
      if (currentTurret) {
        prePatherTurret.value = { ...currentTurret };
      }
      prePatherUpgradeCount.value = currentUpgradeCount !== undefined ? currentUpgradeCount : 0;

      patherWallsRemaining = 50;
      wall.level = 1; // Pather only has level 1 walls
      turret = { count: 0, level: 1, attackPower: 0 }; // Pather has no turrets
    } else if (rareType === 'tripleBaser') {
      wall.maxHp *= 3;
      wall.currentHp = wall.maxHp;
      wall.defense *= 3;
      turret.attackPower = Math.floor(turret.attackPower * 2.0);
    } else if (rareType === 'trainingProbe') {
      ability = 'voidPrism';
      abilityCooldown = 0; // Available immediately
      trainingState = 'waiting15';
      trainingTimer = 15;
    }

    // Clanned modifier: 3x wall HP and 3x amount of turrets above any rare modifier
    if (isClanned) {
      wall.maxHp *= 3;
      wall.currentHp = wall.maxHp;
      if (rareType !== 'pather') {
        turret.count *= 3;
        turret.attackPower *= 3;
      }
    }

    return {
      rankIndex,
      rankName,
      probeKills: 0,
      upgradeCount: currentUpgradeCount || 0,
      timeUntilUpgrade: 45,
      maxUpgradeTime: 45,
      wall,
      turret,
      ability,
      abilityCooldown,
      abilityActiveTimer: 0,
      hasStartedCombat: false,
      isRare: rankIndex >= 14 && isRare,
      rareType: rankIndex >= 14 ? rareType : null,
      isClanned: rankIndex >= 14 && isClanned,
      clanName: rankIndex >= 14 ? clanName : undefined,
      patherWallsRemaining,
      patherRebuildTimer: 2,
      patherWallsKilledThisSec: 0,
      patherLastSecond: Date.now(),
      trainingState,
      trainingTimer,
    };
  }

  /** Load initial probe base from localStorage or default to rank D- */
  function loadInitialProbeBase(): ProbeBase {
    try {
      const raw = localStorage.getItem('pvz2_slot_A') || localStorage.getItem('pvz2_slot_B') || localStorage.getItem('pvz2_slot_C') || localStorage.getItem('pvz2_autosave') || localStorage.getItem('pvz2_probe_base');
      if (raw) {
        const parsed = JSON.parse(raw);
        const pb = parsed.probeBase || parsed;
        if (pb && typeof pb.rankIndex === 'number') {
          const rIndex = pb.rankIndex;
          const isSPlusOrHigher = rIndex >= 14;
          const isGold = isSPlusOrHigher && pb.rareType === 'goldBaser';
          const isPather = isSPlusOrHigher && pb.rareType === 'pather';
          const isClanned = isSPlusOrHigher && !!pb.isClanned;
          const tLevel = pb.turret && typeof pb.turret.level === 'number' ? pb.turret.level : 1;
          const turret = isPather ? { count: 0, level: tLevel, attackPower: 0 } : getTurretInfo(tLevel, isGold);
          if (isClanned && !isPather) {
            turret.count *= 3;
            turret.attackPower *= 3;
          }
          return {
            rankIndex: rIndex,
            rankName: pb.rankName || getRankName(rIndex),
            probeKills: typeof pb.probeKills === 'number' ? pb.probeKills : 0,
            upgradeCount: typeof pb.upgradeCount === 'number' ? pb.upgradeCount : 0,
            timeUntilUpgrade: typeof pb.timeUntilUpgrade === 'number' ? pb.timeUntilUpgrade : 45,
            maxUpgradeTime: typeof pb.maxUpgradeTime === 'number' ? pb.maxUpgradeTime : 45,
            wall: pb.wall && typeof pb.wall.maxHp === 'number' ? pb.wall : {
              tier: 'wall',
              level: 1,
              maxHp: Math.floor(200 * Math.pow(1.8, rIndex)),
              currentHp: Math.floor(200 * Math.pow(1.8, rIndex)),
              defense: 2 + rIndex * 4,
            },
            turret,
            ability: pb.ability || getRandomAbility(rIndex),
            abilityCooldown: typeof pb.abilityCooldown === 'number' ? pb.abilityCooldown : 40,
            abilityActiveTimer: 0,
            hasStartedCombat: typeof pb.hasStartedCombat === 'boolean' ? pb.hasStartedCombat : true,
            isRare: isSPlusOrHigher && !!pb.isRare,
            rareType: isSPlusOrHigher ? (pb.rareType || null) : null,
            isClanned,
            clanName: isClanned ? pb.clanName : undefined,
            patherWallsRemaining: pb.patherWallsRemaining,
            patherRebuildTimer: pb.patherRebuildTimer || 2,
            patherWallsKilledThisSec: 0,
            patherLastSecond: Date.now(),
            trainingState: pb.trainingState || 'normal',
            trainingTimer: pb.trainingTimer || 0,
          };
        }
      }
    } catch (e) {
      console.error('Failed to load probe base from storage:', e);
    }
    return createProbeBase(0, null);
  }

  // Reactive probe base state
  const probeBase = ref<ProbeBase>(loadInitialProbeBase());

  // Wall tier progression order
  const wallOrder: WallTier[] = ['wall', 'ultra', 'mega', 'power', 'final'];

  /** Get maximum level for a given wall tier */
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

  /** Get next wall tier and level in progression: Wall 1-5 -> Ultra 1-5 -> Mega 1-5 -> Power 1-2 -> Final */
  function getNextWallTierAndLevel(tier: WallTier, level: number): { tier: WallTier; level: number } {
    if (tier === 'wall') {
      if (level < 5) return { tier: 'wall', level: level + 1 };
      return { tier: 'ultra', level: 1 };
    }
    if (tier === 'ultra') {
      if (level < 5) return { tier: 'ultra', level: level + 1 };
      return { tier: 'mega', level: 1 };
    }
    if (tier === 'mega') {
      if (level < 5) return { tier: 'mega', level: level + 1 };
      return { tier: 'power', level: 1 };
    }
    if (tier === 'power') {
      if (level < 2) return { tier: 'power', level: level + 1 };
      return { tier: 'final', level: 1 };
    }
    if (tier === 'final') {
      return { tier: 'final', level: 1 };
    }
    return { tier, level };
  }

  // Total turret DPS active against the zealot during combat
  const totalTurretDps = computed(() => {
    if (!isEngagedInCombat.value) return 0;
    return probeBase.value.turret.attackPower;
  });

  /** Automatically repair wall HP over time (supports 200ms fast ticks for double/triple basers) */
  function autoRepairWall(isFastTick = false) {
    const base = probeBase.value;
    const wall = { ...base.wall };
    if (wall.currentHp > 0 && wall.currentHp < wall.maxHp) {
      let repairMultiplier = 0.25;
      let divisor = 1;
      if (base.rareType === 'doubleBaser') {
        repairMultiplier = 0.25;
        divisor = 5; // 200ms ticks
      } else if (base.rareType === 'tripleBaser') {
        repairMultiplier = 0.75;
        divisor = 5; // 200ms ticks
      } else if (isFastTick) {
        return; // Normal probes repair on 1s ticks
      }

      const repairAmount = (wall.maxHp * repairMultiplier) / divisor;
      wall.currentHp = Math.min(wall.maxHp, wall.currentHp + repairAmount);
      probeBase.value = {
        ...probeBase.value,
        wall,
      };
    }
  }

  /** Tick upgrade countdown timer and probe abilities (Chrono / Void Prism / Training / Pather) */
  function tickProbeUpgrades(zealotState?: ZealotStats): boolean {
    const base = probeBase.value;
    if (!base.hasStartedCombat) {
      return false; // Paused until first attack
    }

    // Training Probe special state handling
    if (base.rareType === 'trainingProbe') {
      if (base.trainingState === 'waiting15') {
        if (base.trainingTimer && base.trainingTimer > 0) {
          probeBase.value.trainingTimer = base.trainingTimer - 1;
        } else {
          probeBase.value.trainingState = 'window2';
          probeBase.value.trainingTimer = 2;
          if (zealotState) zealotState.isImmobilized = false;
        }
      } else if (base.trainingState === 'window2') {
        if (base.trainingTimer && base.trainingTimer > 0) {
          probeBase.value.trainingTimer = base.trainingTimer - 1;
        } else {
          if (base.abilityCooldown <= 0) {
            probeBase.value.trainingState = 'castingVoid';
            probeBase.value.trainingTimer = 15;
            probeBase.value.abilityActiveTimer = 4;
            probeBase.value.abilityCooldown = 45;
            if (zealotState) zealotState.isImmobilized = true;
          } else {
            probeBase.value.trainingState = 'waiting15';
            probeBase.value.trainingTimer = 15;
          }
        }
      } else if (base.trainingState === 'castingVoid') {
        if (base.trainingTimer && base.trainingTimer > 0) {
          probeBase.value.trainingTimer = base.trainingTimer - 1;
        } else {
          probeBase.value.trainingState = 'window2';
          probeBase.value.trainingTimer = 2;
          if (zealotState) zealotState.isImmobilized = false;
        }
      }
    }

    // Pather wall rebuild (1 level 1 wall per 2 seconds)
    if (base.rareType === 'pather' && typeof base.patherWallsRemaining === 'number' && base.patherWallsRemaining < 50) {
      if (base.patherRebuildTimer && base.patherRebuildTimer > 1) {
        probeBase.value.patherRebuildTimer = base.patherRebuildTimer - 1;
      } else {
        probeBase.value.patherWallsRemaining = Math.min(50, base.patherWallsRemaining + 1);
        probeBase.value.patherRebuildTimer = 2;
      }
    }

    let timeDecrement = 1;
    let abilityActiveTimer = base.abilityActiveTimer;
    let abilityCooldown = base.abilityCooldown;
    let isImmod = zealotState ? zealotState.isImmobilized : false;

    if (base.rareType !== 'trainingProbe') {
      if (abilityActiveTimer > 0) {
        abilityActiveTimer -= 1;
        if (base.ability === 'chrono') {
          timeDecrement = base.rareType === 'doubleBaser' ? 1.4 : (base.rareType === 'tripleBaser' ? 1.6 : 1.2);
        } else if (base.ability === 'voidPrism') {
          isImmod = true;
        }
      } else {
        if (abilityCooldown > 0) {
          abilityCooldown -= 1;
        } else {
          if (base.ability === 'chrono') {
            abilityActiveTimer = base.rareType === 'doubleBaser' ? 20 : (base.rareType === 'tripleBaser' ? 30 : 10);
            abilityCooldown = 40;
          } else if (base.ability === 'voidPrism') {
            abilityActiveTimer = base.rareType === 'doubleBaser' ? 8 : (base.rareType === 'tripleBaser' ? 12 : 4);
            abilityCooldown = 45;
          }
        }
      }
    } else {
      if (abilityCooldown > 0) {
        abilityCooldown -= 1;
      }
    }

    if (zealotState && base.rareType !== 'trainingProbe') {
      zealotState.isImmobilized = isImmod;
    }

    const nextTimeUntilUpgrade = Math.max(0, base.timeUntilUpgrade - timeDecrement);

    if (nextTimeUntilUpgrade > 0) {
      probeBase.value = {
        ...base,
        timeUntilUpgrade: nextTimeUntilUpgrade,
        abilityActiveTimer,
        abilityCooldown,
      };
      return false;
    } else {
      if (zealotState && base.rareType !== 'trainingProbe') zealotState.isImmobilized = false;
      upgradeProbeDefenses();
      return true;
    }
  }

  /** Upgrade probe defense tier or level */
  function upgradeProbeDefenses() {
    const base = probeBase.value;

    if (base.rareType === 'pather') {
      const upgradeCount = base.upgradeCount + 1;
      const maxUpgradeTime = calculateUpgradeTime(base.rankIndex, upgradeCount);
      probeBase.value = {
        ...base,
        upgradeCount,
        maxUpgradeTime,
        timeUntilUpgrade: maxUpgradeTime,
      };
      return;
    }

    const wall = { ...base.wall };
    const nextWall = getNextWallTierAndLevel(wall.tier, wall.level);
    const tierChanged = wall.tier !== nextWall.tier;
    
    wall.tier = nextWall.tier;
    wall.level = nextWall.level;
    wall.maxHp = Math.floor(wall.maxHp * (tierChanged ? 2.0 : 1.5));
    wall.currentHp = wall.maxHp;
    wall.defense += tierChanged ? 8 : 3;

    const nextTurretLevel = base.turret.level + 1;
    const turret = getTurretInfo(nextTurretLevel, base.rareType === 'goldBaser');
    if (base.isClanned) {
      turret.count *= 3;
      turret.attackPower *= 3;
    }

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

  /** Handle wall or probe destruction upon reaching 0 HP */
  function handleWallDestruction(zealotState?: ZealotStats): boolean {
    if (zealotState) zealotState.isImmobilized = false;
    const base = probeBase.value;

    // Pather check: probe dies only after all 50 walls are destroyed
    if (base.rareType === 'pather' && typeof base.patherWallsRemaining === 'number' && base.patherWallsRemaining > 1) {
      probeBase.value.patherWallsRemaining = base.patherWallsRemaining - 1;
      probeBase.value.wall.currentHp = base.wall.maxHp;

      if (Math.random() < 0.2 && zealotState) {
        zealotState.isImmobilized = true;
        window.setTimeout(() => {
          if (zealotState) zealotState.isImmobilized = false;
        }, 4000);
      }
      return false;
    }

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

    const newProbe = createProbeBase(nextRankIndex);
    if (base.wall.tier === 'final') {
      const newWallHp = Math.floor(base.wall.maxHp * 1.5);
      newProbe.wall.maxHp = newWallHp;
      newProbe.wall.currentHp = newWallHp;
      newProbe.wall.tier = 'wall';
      newProbe.wall.level = 1;
    }
    newProbe.probeKills = probeKills;
    newProbe.hasStartedCombat = true;

    if (base.rareType === 'pather' && prePatherTurret.value) {
      newProbe.turret = { ...prePatherTurret.value };
      newProbe.upgradeCount = prePatherUpgradeCount.value;
    } else {
      newProbe.turret = { ...base.turret };
      newProbe.upgradeCount = base.upgradeCount;
    }

    probeBase.value = newProbe;
    isEngagedInCombat.value = false;
    return true;
  }

  /** Apply damage to probe wall from zealot attack */
  function damageWall(amount: number, zealotState?: ZealotStats): { destroyed: boolean } {
    if (zealotState && zealotState.isImmobilized) return { destroyed: false };
    
    const base = probeBase.value;

    // Training Probe: 5% chance on first attack to insta-kill the PROBE (not the zealot!)
    if (base.rareType === 'trainingProbe' && !base.hasStartedCombat && Math.random() < 0.05) {
      const destroyed = handleWallDestruction(zealotState);
      return { destroyed };
    }

    // Pather throttle: max 2 walls killed per second
    const now = Date.now();
    if (base.rareType === 'pather') {
      if (!base.patherLastSecond || now - base.patherLastSecond >= 1000) {
        probeBase.value.patherLastSecond = now;
        probeBase.value.patherWallsKilledThisSec = 0;
      }
      if ((base.patherWallsKilledThisSec || 0) >= 2) {
        return { destroyed: false };
      }
    }

    isEngagedInCombat.value = true;
    const wall = { ...base.wall };
    const effectiveDamage = Math.max(1, amount - wall.defense * 0.3);
    wall.currentHp = Math.max(0, wall.currentHp - effectiveDamage);

    probeBase.value = {
      ...base,
      wall,
      hasStartedCombat: true,
    };

    if (wall.currentHp <= 0) {
      if (base.rareType === 'pather') {
        probeBase.value.patherWallsKilledThisSec = (base.patherWallsKilledThisSec || 0) + 1;
      }
      const destroyed = handleWallDestruction(zealotState);
      return { destroyed };
    }

    return { destroyed: false };
  }

  /** Stop active combat engagement */
  function stopCombat(zealotState?: ZealotStats) {
    if (zealotState) zealotState.isImmobilized = false;
    isEngagedInCombat.value = false;
  }

  /** Reroll current probe if it's a Pather probe */
  function rerollIfPather() {
    if (probeBase.value.rareType === 'pather') {
      probeBase.value = createProbeBase(probeBase.value.rankIndex);
    }
  }

  /** Load saved combat state from storage */
  function loadCombatState(savedBase: any) {
    if (savedBase) {
      const rIndex = typeof savedBase.rankIndex === 'number' ? savedBase.rankIndex : 0;
      const isSPlusOrHigher = rIndex >= 14;
      const isGold = isSPlusOrHigher && savedBase.rareType === 'goldBaser';
      const isPather = isSPlusOrHigher && savedBase.rareType === 'pather';
      const isClanned = isSPlusOrHigher && !!savedBase.isClanned;
      const tLevel = savedBase.turret && typeof savedBase.turret.level === 'number' ? savedBase.turret.level : 1;
      const turret = isPather ? { count: 0, level: tLevel, attackPower: 0 } : getTurretInfo(tLevel, isGold);
      if (isClanned && !isPather) {
        turret.count *= 3;
        turret.attackPower *= 3;
      }
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
          maxHp: Math.floor(200 * Math.pow(1.8, rIndex)),
          currentHp: Math.floor(200 * Math.pow(1.8, rIndex)),
          defense: 2 + rIndex * 4,
        },
        turret,
        ability: savedBase.ability || getRandomAbility(rIndex),
        abilityCooldown: typeof savedBase.abilityCooldown === 'number' ? savedBase.abilityCooldown : 40,
        abilityActiveTimer: 0,
        hasStartedCombat: typeof savedBase.hasStartedCombat === 'boolean' ? savedBase.hasStartedCombat : true,
        isRare: isSPlusOrHigher && !!savedBase.isRare,
        rareType: isSPlusOrHigher ? (savedBase.rareType || null) : null,
        isClanned,
        clanName: isClanned ? savedBase.clanName : undefined,
        patherWallsRemaining: savedBase.patherWallsRemaining,
        patherRebuildTimer: savedBase.patherRebuildTimer || 2,
        patherWallsKilledThisSec: 0,
        patherLastSecond: Date.now(),
        trainingState: savedBase.trainingState || 'normal',
        trainingTimer: savedBase.trainingTimer || 0,
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
    rerollIfPather,
    createProbeBase,
  };
}
