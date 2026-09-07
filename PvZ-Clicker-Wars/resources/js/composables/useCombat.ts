import { ref, shallowRef, computed } from 'vue';
import Decimal from 'break_eternity.js';
import { ProbeBase, RareProbeType } from '../types/ProbeBase';
import { ZealotStats } from '../types/Zealot';
import { BigNum, BigSource, big } from '../utils/bigNumber';
import { getRankName, isSsRank, ssLevel } from '../utils/ranks';
import {
  WALL_CYCLE_STEPS,
  SS_REGEN_PER_SECOND,
  getTierFlags,
  NOVA_VOLLEY_WINDOW,
  NOVA_VOLLEY_DPS_MULT,
  OVERDRIVE_RAMP_PER_SEC,
  OVERDRIVE_CAP,
  OVERDRIVE_FINAL_CAP,
  PHASE_WALL_INTERVAL,
  PHASE_WALL_WINDOW,
  PHASE_WALL_FINAL_BONUS,
  REALITY_DRIFT_CHANCE,
  REALITY_DRIFT_FINAL_CHANCE,
  REALITY_DRIFT_MAX_CHARGES,
  REALITY_DRIFT_REVIVE_HP,
} from '../utils/scaling';
import {
  calculateUpgradeTime,
  getSsJourneyTimeForLevel,
  getRandomAbility,
  generateRareProbe,
  computeWallFromCount,
  buildTurret,
  SavedProbeData,
  coerceSavedProbe,
  loadUpgradeCount,
  deserializeWall,
  initSsMechanics,
} from '../utils/combatMath';

/**
 * Composable handling probe base combat, defenses, turret DPS, upgrade timers, rare/clanned probe
 * mechanics, and the infinite SS+ milestone tiers (SS/SSS/X/XD/XRD/XRFD).
 */
export function useCombat() {
  // Whether the zealot is currently engaged in active combat against turrets
  const isEngagedInCombat = ref<boolean>(false);

  // Clan list for Clanned probes appearing every 10 ranks starting from S+ rank
  const clanList = ['PvZWA', 'PvZMA', 'PvZAS', 'PvZNA', 'PvZ50', 'WBGA'];

  /** Create a new probe base with stats appropriate to its rank, rare type, and clan */
  function createProbeBase(rankIndex: number, forcedRareType?: RareProbeType, upgradeCount = 0, wallCycle = 0, shopCycle = 0): ProbeBase {
    const rankName = getRankName(rankIndex);
    const { isRare, rareType: initialRareType, isClanned, clanName } = generateRareProbe(rankIndex, clanList);
    const rareType = forcedRareType !== undefined ? forcedRareType : initialRareType;
    const ssLv = isSsRank(rankIndex) ? ssLevel(rankIndex) : 0;

    // Wall & turret level come straight from the global upgrade counter.
    let wall = computeWallFromCount(upgradeCount, rareType, isClanned, rankIndex);
    let turret = buildTurret(upgradeCount, rareType, isClanned, rankIndex);
    let ability = getRandomAbility(rankIndex);
    let abilityCooldown = 40;
    let patherWallsRemaining: number | undefined = undefined;
    let trainingState: 'waiting15' | 'window2' | 'castingVoid' | 'normal' = 'normal';
    let trainingTimer = 0;

    // SS-tier: every SS level takes the frozen tier journey time (2640s for SS, escalating per tier).
    const ssJourneyTime = ssLv > 0 ? getSsJourneyTimeForLevel(ssLv) : undefined;
    const ssMechanics = initSsMechanics(ssLv);

    if (rareType === 'pather') {
      // Pathers ONLY have level 1 walls and NEVER any turrets.
      patherWallsRemaining = 50;
      wall = { tier: 'wall', level: 1, maxHp: big(200), currentHp: big(200), defense: big(2) };
      turret = { count: 0, level: 1, attackPower: big(0) };
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
      timeUntilUpgrade: ssLv > 0 && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rankIndex, wallCycle),
      maxUpgradeTime: ssLv > 0 && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rankIndex, wallCycle),
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
      ...ssMechanics,
    };
  }

  /** Load initial probe base from localStorage or default to rank D- */
  function loadInitialProbeBase(): ProbeBase {
    try {
      const raw = localStorage.getItem('pvz2_slot_A') || localStorage.getItem('pvz2_slot_B') || localStorage.getItem('pvz2_slot_C') || localStorage.getItem('pvz2_autosave') || localStorage.getItem('pvz2_probe_base');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const pb = (parsed.probeBase || parsed) as Record<string, unknown>;
        if (pb && typeof pb.rankIndex === 'number') {
          return rebuildProbeFromSave(coerceSavedProbe(pb));
        }
      }
    } catch (e) {
      console.error('Failed to load probe base from storage:', e);
    }
    return createProbeBase(0, null);
  }

  /** Rebuild a full ProbeBase from (possibly legacy, possibly Decimal-string) save data. */
  function rebuildProbeFromSave(pb: SavedProbeData): ProbeBase {
    const rIndex = typeof pb.rankIndex === 'number' ? pb.rankIndex : 0;
    const isSPlusOrHigher = rIndex >= 14;
    const rareType: RareProbeType = isSPlusOrHigher ? (pb.rareType || null) : null;
    const isPather = isSPlusOrHigher && pb.rareType === 'pather';
    const isClanned = isSPlusOrHigher && !!pb.isClanned;
    const legacyWallCycle = typeof pb.wallCycle === 'number' ? pb.wallCycle : 0;
    const upgradeCount = loadUpgradeCount(pb, legacyWallCycle);
    const wallCycle = Math.floor(upgradeCount / WALL_CYCLE_STEPS);
    const ssLv = isSsRank(rIndex) ? ssLevel(rIndex) : 0;
    const ssJourneyTime = ssLv > 0 ? getSsJourneyTimeForLevel(ssLv) : undefined;
    const maxUpgradeTime = ssLv > 0 && ssJourneyTime ? ssJourneyTime : calculateUpgradeTime(rIndex, wallCycle);
    const tLevel = pb.turret && typeof pb.turret.level === 'number' ? pb.turret.level : 1;
    const turret = isPather ? { count: 0, level: tLevel, attackPower: big(0) } : buildTurret(upgradeCount, rareType, isClanned, rIndex);
    const wall =
      pb.wall && pb.wall.maxHp !== undefined && pb.wall.maxHp !== null
        ? deserializeWall(pb.wall)
        : computeWallFromCount(upgradeCount, rareType, isClanned, rIndex);
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
      ...initSsMechanics(ssLv, pb),
    };
  }

  // Reactive probe base state (optimized with shallowRef to eliminate deep proxy overhead on Decimal instances)
  const probeBase = shallowRef<ProbeBase>(loadInitialProbeBase());

  // Total turret DPS active against the zealot during combat (Decimal; includes tier mechanics)
  const totalTurretDps = computed(() => {
    if (!isEngagedInCombat.value) return big(0);
    const base = probeBase.value;
    let dps: BigNum = big(base.turret.attackPower);
    const ssLv = isSsRank(base.rankIndex) ? ssLevel(base.rankIndex) : 0;
    if (ssLv > 0) {
      const flags = getTierFlags(ssLv);
      // SSS Nova Volley: while the probe's ability window is up, turret DPS surges
      if (flags.novaVolley && (base.novaVolleyTimer ?? 0) > 0) {
        dps = dps.mul(NOVA_VOLLEY_DPS_MULT);
      }
      // X Overdrive: DPS ramps the longer the zealot stays engaged
      if (flags.overdrive && (base.overdriveLevel ?? 0) > 0) {
        dps = dps.mul(1 + (base.overdriveLevel ?? 0) * OVERDRIVE_RAMP_PER_SEC);
      }
    }
    return dps;
  });

  /** Automatically repair wall HP over time (supports 200ms fast ticks for double/triple basers) */
  function autoRepairWall(isFastTick = false) {
    const base = probeBase.value;
    const wall = { ...base.wall };
    if (wall.currentHp.gt(0) && wall.currentHp.lt(wall.maxHp)) {
      let repairMultiplier = 0.25;
      let divisor = 1;
      let ssRegenPerSec = 0;
      const ssLv = isSsRank(base.rankIndex) ? ssLevel(base.rankIndex) : 0;
      if (ssLv > 0) {
        // SS Golden Aura: extra wall regen on top of any rare/clan regen (scales a touch per SS level;
        // XRFD Final Apex doubles it)
        const regen = SS_REGEN_PER_SECOND * (1 + 0.25 * (ssLv - 1));
        ssRegenPerSec = getTierFlags(ssLv).finalApex ? regen * 2 : regen;
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

      const repairAmount = wall.maxHp.mul(repairMultiplier).div(divisor).add(wall.maxHp.mul(ssRegenPerSec).div(divisor));
      wall.currentHp = Decimal.min(wall.maxHp, wall.currentHp.add(repairAmount));
      probeBase.value = {
        ...probeBase.value,
        wall,
      };
    }
  }

  /**
   * Tick upgrade countdown timer, probe abilities (Chrono / Void Prism / Training / Pather), and the
   * SS+ tier mechanic timers (Nova Volley window, Overdrive ramp, Phase Wall phase cadence).
   * Returns true when a defense upgrade triggered.
   */
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
            const isImmune = zealotState ? zealotState.abilityImmunityTimer > 0 : false;
            if (isImmune) {
              // Ability immunity: training void prism fizzles, go back to waiting
              probeBase.value.trainingState = 'waiting15';
              probeBase.value.trainingTimer = 15;
              probeBase.value.abilityCooldown = 10;
            } else {
              probeBase.value.trainingState = 'castingVoid';
              probeBase.value.trainingTimer = 15;
              probeBase.value.abilityActiveTimer = 4;
              probeBase.value.abilityCooldown = 45;
              if (zealotState) {
                zealotState.isImmobilized = true;
                zealotState.abilityImmunityTimer = 30;
              }
            }
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

    // --- SS+ tier mechanic timers ---
    let novaVolleyTimer = base.novaVolleyTimer ?? 0;
    let overdriveLevel = base.overdriveLevel ?? 0;
    let wallPhaseInvuln = base.wallPhaseInvuln ?? 0;
    let wallPhaseTimer = base.wallPhaseTimer ?? PHASE_WALL_INTERVAL;
    const ssLv = isSsRank(base.rankIndex) ? ssLevel(base.rankIndex) : 0;
    if (ssLv > 0) {
      const flags = getTierFlags(ssLv);
      // SSS Nova Volley: count down the burst window
      if (flags.novaVolley && novaVolleyTimer > 0) {
        novaVolleyTimer = Math.max(0, novaVolleyTimer - 1);
      }
      // X Overdrive: ramp up while the zealot stays engaged (reset on stopCombat)
      if (flags.overdrive) {
        const cap = flags.finalApex ? OVERDRIVE_FINAL_CAP : OVERDRIVE_CAP;
        if (isEngagedInCombat.value && overdriveLevel < cap) {
          overdriveLevel += 1;
        }
      }
      // XD Phase Walls: periodic invulnerability windows
      if (flags.phaseWalls) {
        const window = flags.finalApex ? PHASE_WALL_WINDOW + PHASE_WALL_FINAL_BONUS : PHASE_WALL_WINDOW;
        if (wallPhaseInvuln > 0) {
          wallPhaseInvuln = Math.max(0, wallPhaseInvuln - 1);
          if (wallPhaseInvuln <= 0) {
            wallPhaseTimer = PHASE_WALL_INTERVAL;
          }
        } else {
          wallPhaseTimer = Math.max(0, wallPhaseTimer - 1);
          if (wallPhaseTimer <= 0) {
            wallPhaseInvuln = window;
            wallPhaseTimer = PHASE_WALL_INTERVAL;
          }
        }
      }
    }

    let timeDecrement = 1;
    let abilityActiveTimer = base.abilityActiveTimer;
    let abilityCooldown = base.abilityCooldown;
    let isImmod = zealotState ? zealotState.isImmobilized : false;
    const isImmune = zealotState ? zealotState.abilityImmunityTimer > 0 : false;

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
          // Ability is about to fire — check zealot ability immunity passive
          if (isImmune) {
            // Ability fizzles: blocked by immunity, put back on a short cooldown
            abilityCooldown = 8;
          } else {
            if (base.ability === 'chrono') {
              abilityActiveTimer = base.rareType === 'doubleBaser' ? 20 : (base.rareType === 'tripleBaser' ? 30 : 10);
              abilityCooldown = 40;
            } else if (base.ability === 'voidPrism') {
              abilityActiveTimer = base.rareType === 'doubleBaser' ? 8 : (base.rareType === 'tripleBaser' ? 12 : 4);
              abilityCooldown = 45;
            }
            // SS Elite Probes: abilities fire ~2x more often and last longer; SSS+ bursts trigger Nova Volley
            if (isSsRank(base.rankIndex)) {
              abilityActiveTimer = Math.round(abilityActiveTimer * 1.5);
              abilityCooldown = Math.max(15, Math.floor(abilityCooldown / 2));
              if (getTierFlags(ssLv).novaVolley) {
                novaVolleyTimer = NOVA_VOLLEY_WINDOW;
              }
            }
            // Passive: being hit by an ability grants 30s immunity against subsequent probe abilities
            if (zealotState) {
              zealotState.abilityImmunityTimer = 30;
            }
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
        novaVolleyTimer,
        overdriveLevel,
        wallPhaseInvuln,
        wallPhaseTimer,
      };
      return false;
    } else {
      if (zealotState && base.rareType !== 'trainingProbe') zealotState.isImmobilized = false;
      // Carry the just-ticked mechanic timers into the level-up rebuild
      probeBase.value = {
        ...probeBase.value,
        novaVolleyTimer,
        overdriveLevel,
        wallPhaseInvuln,
        wallPhaseTimer,
      };
      upgradeProbeDefenses();
      return true;
    }
  }

  /** Upgrade probe defense tier or level - driven purely by the global upgrade counter */
  function upgradeProbeDefenses() {
    const base = probeBase.value;
    const ssLv = isSsRank(base.rankIndex) ? ssLevel(base.rankIndex) : 0;
    const ssJourneyTime = ssLv > 0 ? getSsJourneyTimeForLevel(ssLv) : undefined;
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
      // XRD Reality Drift: fresh revive charges every level-up
      realityDriftCharges: getTierFlags(ssLv).realityDrift ? REALITY_DRIFT_MAX_CHARGES : undefined,
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

      if (Math.random() < 0.2 && zealotState && zealotState.abilityImmunityTimer <= 0) {
        zealotState.isImmobilized = true;
        zealotState.abilityImmunityTimer = 30;
        window.setTimeout(() => {
          if (zealotState) zealotState.isImmobilized = false;
        }, 4000);
      }
      return false;
    }

    const probeKills = base.probeKills + 1;
    let nextRankIndex: number;
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
    // upgrades fire regularly from early ranks onwards. SS probes freeze the tier journey time
    // so each SS level takes exactly as long as reaching that milestone did; it carries over too.
    newProbe.timeUntilUpgrade = isSsRank(nextRankIndex)
      ? (newProbe.maxUpgradeTime || base.timeUntilUpgrade)
      : Math.max(1, base.timeUntilUpgrade);
    newProbe.maxUpgradeTime = Math.max(1, isSsRank(nextRankIndex)
      ? (newProbe.maxUpgradeTime || base.maxUpgradeTime || getSsJourneyTimeForLevel(ssLevel(nextRankIndex)))
      : (base.maxUpgradeTime || 45));

    probeBase.value = newProbe;
    isEngagedInCombat.value = false;
    return true;
  }

  /** Apply damage to probe wall from zealot attack */
  function damageWall(amount: BigSource, zealotState?: ZealotStats): { destroyed: boolean } {
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

    // XD Phase Walls: while invulnerable the wall ignores all damage
    const ssLv = isSsRank(base.rankIndex) ? ssLevel(base.rankIndex) : 0;
    if (ssLv > 0 && getTierFlags(ssLv).phaseWalls && (base.wallPhaseInvuln ?? 0) > 0) {
      return { destroyed: false };
    }

    isEngagedInCombat.value = true;
    const wall = { ...base.wall };
    const effectiveDamage = Decimal.max(big(1), big(amount).sub(wall.defense.mul(0.3)));
    wall.currentHp = Decimal.max(big(0), wall.currentHp.sub(effectiveDamage));

    if (wall.currentHp.lte(0)) {
      // XRD Reality Drift: on the killing blow the wall may resurrect at partial HP instead of dying
      if (ssLv > 0) {
        const flags = getTierFlags(ssLv);
        if (flags.realityDrift && (base.realityDriftCharges ?? 0) > 0) {
          const chance = flags.finalApex ? REALITY_DRIFT_FINAL_CHANCE : REALITY_DRIFT_CHANCE;
          if (Math.random() < chance) {
            wall.currentHp = wall.maxHp.mul(REALITY_DRIFT_REVIVE_HP);
            probeBase.value = {
              ...base,
              wall,
              hasStartedCombat: true,
              realityDriftCharges: (base.realityDriftCharges ?? 0) - 1,
            };
            return { destroyed: false };
          }
        }
      }

      probeBase.value = {
        ...base,
        wall,
        hasStartedCombat: true,
      };

      if (base.rareType === 'pather') {
        probeBase.value.patherWallsKilledThisSec = (base.patherWallsKilledThisSec || 0) + 1;
      }
      const destroyed = handleWallDestruction(zealotState);
      return { destroyed };
    }

    probeBase.value = {
      ...base,
      wall,
      hasStartedCombat: true,
    };

    return { destroyed: false };
  }

  /** Stop active combat engagement (also resets the X Overdrive ramp) */
  function stopCombat(zealotState?: ZealotStats) {
    if (zealotState) zealotState.isImmobilized = false;
    isEngagedInCombat.value = false;
    // X Overdrive ramp resets whenever combat engagement resets
    if (probeBase.value.overdriveLevel) {
      probeBase.value.overdriveLevel = 0;
    }
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
    const ssLv = isSsRank(base.rankIndex) ? ssLevel(base.rankIndex) : 0;
    const ssJourneyTime = ssLv > 0 ? getSsJourneyTimeForLevel(ssLv) : undefined;
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
  function loadCombatState(savedBase: ProbeBase | undefined) {
    if (savedBase) {
      probeBase.value = rebuildProbeFromSave(coerceSavedProbe(savedBase as unknown as Record<string, unknown>));
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