import { ref, computed } from 'vue';
import { ProbeBase, Wall, WallTier, TurretInfo, RareProbeType } from '../types/ProbeBase';
import { ZealotStats } from '../types/Zealot';
import { getRankName, isSsRank, ssLevel, SS_START_INDEX } from '../utils/ranks';
import { WALL_CYCLE_STEPS, WALL_LEVEL_GROWTH, WALL_TIER_GROWTH, WALL_CYCLE_BOUNDARY_GROWTH, SS_WALL_HP_PER_LEVEL, SS_DEFENSE_PER_LEVEL, SS_TURRET_POWER_PER_LEVEL, SS_TURRET_COUNT_PER_LEVEL, SS_REGEN_PER_SECOND } from '../utils/scaling';

/**
 * Composable handling probe base combat, defenses, turret DPS, upgrade timers, and rare/clanned probe mechanics.
 */
export function useCombat() {
  // Whether the zealot is currently engaged in active combat against turrets
  const isEngagedInCombat = ref<boolean>(false);

  // Clan list for Clanned probes appearing every 10 ranks starting from S+ rank
  const clanList = ['PvZWA', 'PvZMA', 'PvZAS', 'PvZNA', 'PvZ50', 'WBGA'];

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

  /** Calculate defense upgrade countdown duration based on rank and wall cycle */
  function calculateUpgradeTime(rankIndex: number, wallCycle = 0): number {
    const base = 45;
    const rankSpeedBonus = Math.pow(0.95, rankIndex); // 5% faster per rank index
    const cycleSpeedBonus = Math.pow(0.9, wallCycle); // 10% faster per completed wall cycle
    return Math.max(10, Math.floor(base * rankSpeedBonus * cycleSpeedBonus)); // Hard cap: an upgrade lasts at least 10s
  }

  /**
   * Total real time (in seconds) for a probe to journey from rank D- (0) all the way to SS1 (263).
   * It is the sum of every per-rank upgrade time, evaluating each rank at its own wall cycle so the
   * 10s floor cap dominates. This value is FROZEN once a probe reaches SS and defines how long
   * SS1 -> SS2 (and every further SS level) takes.
   */
  function computeSsJourneyTime(): number {
    let total = 0;
    for (let i = 0; i < SS_START_INDEX; i++) {
      const wallCycle = Math.floor(i / WALL_CYCLE_STEPS);
      total += calculateUpgradeTime(i, wallCycle);
    }
    return Math.round(total);
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

  /** Position of a wall (tier+level) within one cycle: Wall 1-5 = 0-4, Ultra = 5-9, Mega = 10-14, Power = 15-16, Final = 17 */
  function getWallProgressionPosition(tier: WallTier, level: number): number {
    if (tier === 'wall') return Math.min(4, Math.max(0, level - 1));
    if (tier === 'ultra') return 5 + Math.min(4, Math.max(0, level - 1));
    if (tier === 'mega') return 10 + Math.min(4, Math.max(0, level - 1));
    if (tier === 'power') return 15 + Math.min(1, Math.max(0, level - 1));
    if (tier === 'final') return 17;
    return 0;
  }

  /** Wall & turret level are derived purely from the global upgrade counter (18 steps per cycle)
   *  Wall 1-5 -> Ultra 1-5 -> Mega 1-5 -> Power 1-2 -> Final, then a new cycle starts at Wall 1
   *  with 1.5x the previous final HP. SS-tier ranks (rankIndex >= SS_START_INDEX) apply a bonus. */
  function computeWallFromCount(count: number, rareType: RareProbeType, isClanned: boolean, rankIndex = 0): Wall {
    let tier: WallTier = 'wall';
    let level = 1;
    let maxHp = 200;
    let defense = 2;
    const ssBonus = isSsRank(rankIndex) ? ssLevel(rankIndex) : 0;
    for (let step = 0; step < count; step++) {
      if (tier === 'final') {
        // Final upgrade trigger starts a new wall cycle: back to Wall Lv 1 with 1.5x the previous final HP
        tier = 'wall';
        level = 1;
        maxHp = Math.floor(maxHp * WALL_CYCLE_BOUNDARY_GROWTH);
        defense = 2;
        continue;
      }
      const next = getNextWallTierAndLevel(tier, level);
      const tierChanged = next.tier !== tier;
      tier = next.tier;
      level = next.level;
      maxHp = Math.floor(maxHp * (tierChanged ? WALL_TIER_GROWTH : WALL_LEVEL_GROWTH));
      defense += tierChanged ? 8 : 3;
    }
    // SS Governor bonus: harder walls & resists
    if (ssBonus > 0) {
      maxHp = Math.floor(maxHp * Math.pow(SS_WALL_HP_PER_LEVEL, ssBonus));
      defense = Math.floor(defense * Math.pow(SS_DEFENSE_PER_LEVEL, ssBonus));
    }
    const wall: Wall = { tier, level, maxHp: Math.floor(maxHp), currentHp: Math.floor(maxHp), defense };
    if (rareType === 'doubleBaser') {
      wall.maxHp *= 2;
      wall.currentHp = wall.maxHp;
      wall.defense *= 2;
    } else if (rareType === 'tripleBaser') {
      wall.maxHp *= 3;
      wall.currentHp = wall.maxHp;
      wall.defense *= 3;
    }
    if (isClanned) {
      wall.maxHp *= 3;
      wall.currentHp = wall.maxHp;
    }
    return wall;
  }

  /** Turret level is also derived from the global upgrade counter (level = count + 1), with rare/clan modifiers */
  function buildTurret(count: number, rareType: RareProbeType, isClanned: boolean, rankIndex = 0): TurretInfo {
    const isGold = rareType === 'goldBaser';
    const turret = getTurretInfo(count + 1, isGold);
    if (rareType === 'doubleBaser' || rareType === 'goldBaser') {
      turret.attackPower = Math.floor(turret.attackPower * 1.5);
    } else if (rareType === 'tripleBaser') {
      turret.attackPower = Math.floor(turret.attackPower * 2.0);
    }
    const ssBonus = isSsRank(rankIndex) ? ssLevel(rankIndex) : 0;
    if (ssBonus > 0) {
      turret.count += SS_TURRET_COUNT_PER_LEVEL * ssBonus;
      turret.attackPower = Math.floor(turret.attackPower * Math.pow(SS_TURRET_POWER_PER_LEVEL, ssBonus - 1));
    }
    if (isClanned) {
      turret.count *= 3;
      turret.attackPower *= 3;
    }
    return turret;
  }

  interface SavedProbeData {
    upgradeCount?: number;
    wallCycle?: number;
    wall?: { tier?: WallTier; level?: number };
  }

  /** Restore the global upgrade counter from a save, migrating legacy saves via their wall position */
  function loadUpgradeCount(pb: SavedProbeData, legacyWallCycle: number): number {
    const legacyCount = typeof pb.upgradeCount === 'number' ? pb.upgradeCount : 0;
    const savedWall = pb.wall;
    if (savedWall && savedWall.tier && typeof savedWall.level === 'number') {
      const pos = getWallProgressionPosition(savedWall.tier, savedWall.level);
      return Math.max(legacyCount, pos + WALL_CYCLE_STEPS * legacyWallCycle);
    }
    return legacyCount;
  }

  /** Create a new probe base with stats appropriate to its rank, rare type, and clan */
  function createProbeBase(rankIndex: number, forcedRareType?: RareProbeType, upgradeCount = 0, wallCycle = 0, shopCycle = 0): ProbeBase {
    const rankName = getRankName(rankIndex);
    const { isRare, rareType: initialRareType, isClanned, clanName } = generateRareProbe(rankIndex);
    const rareType = forcedRareType !== undefined ? forcedRareType : initialRareType;

    // Wall & turret level come straight from the global upgrade counter.
    let wall = computeWallFromCount(upgradeCount, rareType, isClanned, rankIndex);
    let turret = buildTurret(upgradeCount, rareType, isClanned, rankIndex);
    let ability = getRandomAbility(rankIndex);
    let abilityCooldown = 40;
    let patherWallsRemaining: number | undefined = undefined;
    let trainingState: 'waiting15' | 'window2' | 'castingVoid' | 'normal' = 'normal';
    let trainingTimer = 0;

    // SS-tier: freeze the ~45 minute journey time so every SS level takes exactly this long.
    const ssJourneyTime = isSsRank(rankIndex) ? computeSsJourneyTime() : undefined;

    if (rareType === 'pather') {
      // Pathers ONLY have level 1 walls and NEVER any turrets.
      patherWallsRemaining = 50;
      wall = { tier: 'wall', level: 1, maxHp: 200, currentHp: 200, defense: 2 };
      turret = { count: 0, level: 1, attackPower: 0 };
    } else if (rareType === 'trainingProbe') {
      ability = 'voidPrism';
      abilityCooldown = 0; // Available immediately
      trainingState = 'waiting15';
      trainingTimer = 15;
    }

    return {
      rankIndex,
      rankName,
      probeKills: 0,
      upgradeCount,
      wallCycle,
      shopCycle,
      timeUntilUpgrade: isSsRank(rankIndex) && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rankIndex, wallCycle),
      maxUpgradeTime: isSsRank(rankIndex) && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rankIndex, wallCycle),
      ssJourneyTime,
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
          const rareType: RareProbeType = isSPlusOrHigher ? (pb.rareType || null) : null;
          const isPather = isSPlusOrHigher && pb.rareType === 'pather';
          const isClanned = isSPlusOrHigher && !!pb.isClanned;
          const legacyWallCycle = typeof pb.wallCycle === 'number' ? pb.wallCycle : 0;
          const upgradeCount = loadUpgradeCount(pb, legacyWallCycle);
          const wallCycle = Math.floor(upgradeCount / WALL_CYCLE_STEPS);
          const ssJourneyTime = isSsRank(rIndex) ? (typeof pb.ssJourneyTime === 'number' ? pb.ssJourneyTime : computeSsJourneyTime()) : undefined;
          const maxUpgradeTime = isSsRank(rIndex) && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rIndex, wallCycle);
          const tLevel = pb.turret && typeof pb.turret.level === 'number' ? pb.turret.level : 1;
          const turret = isPather ? { count: 0, level: tLevel, attackPower: 0 } : buildTurret(upgradeCount, rareType, isClanned, rIndex);
          const wall = pb.wall && typeof pb.wall.maxHp === 'number' ? (pb.wall as Wall) : computeWallFromCount(upgradeCount, rareType, isClanned, rIndex);
          return {
            rankIndex: rIndex,
            rankName: pb.rankName || getRankName(rIndex),
            probeKills: typeof pb.probeKills === 'number' ? pb.probeKills : 0,
            upgradeCount,
            wallCycle,
            shopCycle: typeof pb.shopCycle === 'number' ? pb.shopCycle : 0,
            timeUntilUpgrade: Math.max(1, Math.min(maxUpgradeTime, typeof pb.timeUntilUpgrade === 'number' ? pb.timeUntilUpgrade : maxUpgradeTime)),
            maxUpgradeTime,
            ssJourneyTime,
            wall,
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
      let ssRegenPerSec = 0;
      if (isSsRank(base.rankIndex)) {
        // SS Golden Aura: extra wall regen on top of any rare/clan regen (scales a touch per SS level)
        ssRegenPerSec = SS_REGEN_PER_SECOND * (1 + 0.25 * (ssLevel(base.rankIndex) - 1));
      }
      if (base.rareType === 'doubleBaser') {
        repairMultiplier = 0.25;
        divisor = 5; // 200ms ticks
      } else if (base.rareType === 'tripleBaser') {
        repairMultiplier = 0.75;
        divisor = 5; // 200ms ticks
      } else if (isFastTick) {
        return; // Normal probes repair on 1s ticks
      }

      const repairAmount = (wall.maxHp * repairMultiplier) / divisor + (wall.maxHp * ssRegenPerSec) / divisor;
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
          // SS Elite Probes: abilities fire ~2x more often and last longer
          if (isSsRank(base.rankIndex)) {
            abilityActiveTimer = Math.round(abilityActiveTimer * 1.5);
            abilityCooldown = Math.max(15, Math.floor(abilityCooldown / 2));
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

  /** Upgrade probe defense tier or level - driven purely by the global upgrade counter */
  function upgradeProbeDefenses() {
    const base = probeBase.value;

    // SS probes spend exactly the frozen boss-timer on each level-up
    const ssJourneyTime = isSsRank(base.rankIndex)
      ? (base.ssJourneyTime || computeSsJourneyTime())
      : undefined;
    const maxUpgradeTime = ssJourneyTime || calculateUpgradeTime(base.rankIndex, base.wallCycle);

    // Pathers only ever have level 1 walls and no turrets: the trigger just resets the timer and
    // does NOT advance the counter, so a pather can NEVER level up the wall.
    if (base.rareType === 'pather') {
      probeBase.value = {
        ...base,
        ssJourneyTime,
        maxUpgradeTime,
        timeUntilUpgrade: maxUpgradeTime,
      };
      return;
    }

    const upgradeCount = base.upgradeCount + 1;
    const wallCycle = Math.floor(upgradeCount / WALL_CYCLE_STEPS);
    const wall = computeWallFromCount(upgradeCount, base.rareType, base.isClanned, base.rankIndex);
    const turret = buildTurret(upgradeCount, base.rareType, base.isClanned, base.rankIndex);

    probeBase.value = {
      ...base,
      wall,
      turret,
      upgradeCount,
      wallCycle,
      ssJourneyTime,
      maxUpgradeTime,
      timeUntilUpgrade: maxUpgradeTime,
    };
  }

  /** Handle wall or probe destruction upon reaching 0 HP */
  function handleWallDestruction(zealotState?: ZealotStats): boolean {
    if (zealotState) zealotState.isImmobilized = false;
    const base = probeBase.value;

    // A wall was destroyed (including Pather walls and Training Probe insta-kills)
    if (zealotState) zealotState.wallsKilled = (zealotState.wallsKilled || 0) + 1;

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

    // The global upgrade counter drives wall & turret level, so a fresh probe of the next rank
    // simply derives its defenses from it. Pather triggers never advance the counter, so a pather
    // can never turn the wall into a higher level.
    const newProbe = createProbeBase(nextRankIndex, undefined, base.upgradeCount, base.wallCycle, base.shopCycle);
    newProbe.probeKills = probeKills;
    newProbe.hasStartedCombat = true;

    // Global defense upgrade countdown continues across probe deaths so wall/turret
    // upgrades fire regularly from early ranks onwards. SS probes freeze the ~45 min journey time
    // so every SS level takes exactly as long as reaching SS1 did; that travel time carries over too.
    newProbe.timeUntilUpgrade = isSsRank(nextRankIndex)
      ? (newProbe.maxUpgradeTime || base.timeUntilUpgrade)
      : Math.max(1, base.timeUntilUpgrade);
    newProbe.maxUpgradeTime = Math.max(1, isSsRank(nextRankIndex)
      ? (newProbe.maxUpgradeTime || base.maxUpgradeTime || computeSsJourneyTime())
      : (base.maxUpgradeTime || 45));

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

  /** DEV TOOL: advance the global upgrade counter N full wall cycles (wall rank + shop scale) */
  function advanceWallCycles(times: number): number {
    const base = probeBase.value;
    const cycles = Math.max(1, Math.floor(times));
    const upgradeCount = base.upgradeCount + WALL_CYCLE_STEPS * cycles;
    const wallCycle = Math.floor(upgradeCount / WALL_CYCLE_STEPS);
    const isPather = base.rareType === 'pather';
    const wall = isPather ? base.wall : computeWallFromCount(upgradeCount, base.rareType, base.isClanned, base.rankIndex);
    const turret = isPather ? base.turret : buildTurret(upgradeCount, base.rareType, base.isClanned, base.rankIndex);
    const ssJourneyTime = isSsRank(base.rankIndex) ? (base.ssJourneyTime || computeSsJourneyTime()) : undefined;
    const maxUpgradeTime = ssJourneyTime || calculateUpgradeTime(base.rankIndex, wallCycle);
    probeBase.value = {
      ...base,
      upgradeCount,
      wallCycle,
      wall,
      turret,
      ssJourneyTime,
      maxUpgradeTime,
      timeUntilUpgrade: maxUpgradeTime,
    };
    return wallCycle;
  }

  /** Reroll current probe if it's a Pather probe */
  function rerollIfPather() {
    const base = probeBase.value;
    if (base.rareType === 'pather') {
      probeBase.value = createProbeBase(base.rankIndex, undefined, base.upgradeCount, base.wallCycle, base.shopCycle);
      probeBase.value.hasStartedCombat = true;
    }
  }

  /** Load saved combat state from storage */
  function loadCombatState(savedBase: any) {
    if (savedBase) {
      const rIndex = typeof savedBase.rankIndex === 'number' ? savedBase.rankIndex : 0;
      const isSPlusOrHigher = rIndex >= 14;
      const rareType: RareProbeType = isSPlusOrHigher ? (savedBase.rareType || null) : null;
      const isPather = isSPlusOrHigher && savedBase.rareType === 'pather';
      const isClanned = isSPlusOrHigher && !!savedBase.isClanned;
      const legacyWallCycle = typeof savedBase.wallCycle === 'number' ? savedBase.wallCycle : 0;
      const upgradeCount = loadUpgradeCount(savedBase, legacyWallCycle);
      const wallCycle = Math.floor(upgradeCount / WALL_CYCLE_STEPS);
      const ssJourneyTime = isSsRank(rIndex) ? (typeof savedBase.ssJourneyTime === 'number' ? savedBase.ssJourneyTime : computeSsJourneyTime()) : undefined;
      const maxUpgradeTime = isSsRank(rIndex) && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rIndex, wallCycle);
      const tLevel = savedBase.turret && typeof savedBase.turret.level === 'number' ? savedBase.turret.level : 1;
      const turret = isPather ? { count: 0, level: tLevel, attackPower: 0 } : buildTurret(upgradeCount, rareType, isClanned, rIndex);
      const wall = savedBase.wall && typeof savedBase.wall.maxHp === 'number' ? (savedBase.wall as Wall) : computeWallFromCount(upgradeCount, rareType, isClanned, rIndex);
      probeBase.value = {
        rankIndex: rIndex,
        rankName: savedBase.rankName || getRankName(rIndex),
        probeKills: typeof savedBase.probeKills === 'number' ? savedBase.probeKills : 0,
        upgradeCount,
        wallCycle,
        shopCycle: typeof savedBase.shopCycle === 'number' ? savedBase.shopCycle : 0,
        timeUntilUpgrade: Math.max(1, Math.min(maxUpgradeTime, typeof savedBase.timeUntilUpgrade === 'number' ? savedBase.timeUntilUpgrade : maxUpgradeTime)),
        maxUpgradeTime,
        ssJourneyTime,
        wall,
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
    advanceWallCycles,
  };
}
