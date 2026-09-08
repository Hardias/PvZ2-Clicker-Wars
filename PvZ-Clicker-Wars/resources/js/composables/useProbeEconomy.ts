import { ref, shallowRef } from 'vue';
import { ProbeBase } from '../types/ProbeBase';
import {
  nextGeneratorUpgrade,
  generatorRequirementMet,
  generatorRate,
  defenseUpgradeCost,
  ProbeEconomyState,
  MINERAL_BUY,
  nextMineralPrice,
  BUILD_TIME_SECONDS,
  MARKET_BUILD_COST,
  UNDERGROUND_MARKET_UPGRADE_COST,
  DEPOT_BUILD_COST,
  MINER_TRAINING_TIME,
  LUDICROUS_CAP,
  MINERS,
  MinerType,
  MinerCounts,
  minerRate,
  minerCap,
  totalMiners,
  worstMiner,
  minerSlotAvailable,
  hasUltraTier,
  rosterPerfected,
  REPOSITORY,
  MINE_CAP_PER_LEVEL,
  MINE_BUILD_TIME,
  MINES,
  MineLevel,
  MineCounts,
  mineDef,
  mineRate,
} from '../utils/economyMath';

// Probe-side economy (T8/T8b/T8c). The probe auto-runs a single shared vespene pool: generator
// upgrades double production (eco-first when the wall is safe), wall upgrades cost gas (double
// per level, minerals from the Mega echelon up), minerals come from the Market (155 gas/10, +5
// each), depot-trained miners (from gen 6) and automated mines (from an Ultra miner, levels 3-8),
// while repositories increase the miner cap. The upgrade timer is gone: pacing comes from income
// (1 action/s) vs. exponentially growing costs.

/**
 * Create the probe-economy controller. `probeRef` is the reactive ProbeBase, `getWallPos` returns
 * the current wall-cycle position (source of wall upgrade costs), `getWallThreat` tells the policy
 * whether the wall is being chipped faster than it repairs (then wall upgrades win; otherwise
 * eco-first), and `upgradeWall` performs the wall upgrade itself (owned by useCombat).
 */
export function useProbeEconomy(
  probeRef: { value: ProbeBase },
  getWallPos: () => number,
  getWallThreat: () => boolean,
  upgradeWall: () => void,
) {
  // Reactive readouts for the battle UI.
  const nextWallCost = ref({ gas: 0, minerals: 0 });
  const nextGeneratorUpgradeAvailable = shallowRef(false);
  const nextGeneratorCost = ref({ gas: 0, minerals: 0 });

  function refreshTargets() {
    const b = probeRef.value;
    nextWallCost.value = defenseUpgradeCost(getWallPos());
    const def = nextGeneratorUpgrade(b.generatorLevel);
    if (def) {
      nextGeneratorUpgradeAvailable.value = true;
      nextGeneratorCost.value = { gas: def.costGas, minerals: def.costMinerals };
    } else {
      nextGeneratorUpgradeAvailable.value = false;
      nextGeneratorCost.value = { gas: 0, minerals: 0 };
    }
  }

function commit(
  patch: Partial<ProbeEconomyState & { minerCounts?: MinerCounts; minerTrainingType?: MinerType | null; mineCounts?: MineCounts; mineBuildLevel?: MineLevel | null }>,
) {
  const b = probeRef.value;
  probeRef.value = { ...b, ...patch };
}

  function spend(gas: number, minerals: number): boolean {
    const b = probeRef.value;
    if (b.vespene < gas || b.minerals < minerals) return false;
    commit({ vespene: b.vespene - gas, minerals: b.minerals - minerals });
    return true;
  }

  /** Advance the Market/Depot/training job timers; returns true while a timer is still processing. */
  function tickEngineTimers(): boolean {
    let busy = false;

    const m = probeRef.value;
    if (m.marketState !== 'none' && m.marketTimer > 0) {
      busy = true;
      const remaining = m.marketTimer - 1;
      if (remaining > 0) {
        commit({ marketTimer: remaining });
      } else {
        switch (m.marketState) {
          case 'building':
            commit({ marketState: 'built', marketTimer: 0 });
            break;
          case 'upgrading':
            commit({ marketState: 'built', marketTimer: 0, undergroundMarketBuilt: true });
            break;
          case 'selling':
            commit({ marketState: 'none', marketTimer: 0, vespene: probeRef.value.vespene + MARKET_BUILD_COST });
            break;
        }
      }
    }

    const d = probeRef.value;
    if (d.depotState === 'building' && d.depotTimer > 0) {
      busy = true;
      const remaining = d.depotTimer - 1;
      commit(remaining > 0 ? { depotTimer: remaining } : { depotState: 'built', depotTimer: 0 });
    }

    const t = probeRef.value;
    if (t.minerTrainingType !== null && t.minerTrainingTimer > 0) {
      busy = true;
      const remaining = t.minerTrainingTimer - 1;
      if (remaining > 0) {
        commit({ minerTrainingTimer: remaining });
      } else {
        const type = t.minerTrainingType;
        commit({
          minerTrainingType: null,
          minerTrainingTimer: 0,
          minerCounts: { ...t.minerCounts, [type]: (t.minerCounts[type] ?? 0) + 1 },
        });
      }
    }

    const mi = probeRef.value;
    if (mi.mineBuildLevel !== null && mi.mineBuildTimer > 0) {
      busy = true;
      const remaining = mi.mineBuildTimer - 1;
      if (remaining > 0) {
        commit({ mineBuildTimer: remaining });
      } else {
        const level = mi.mineBuildLevel;
        commit({ mineBuildLevel: null, mineBuildTimer: 0, mineCounts: { ...mi.mineCounts, [level]: (mi.mineCounts[level] ?? 0) + 1 } });
      }
    }

    return busy;
  }

  /** Attempt a generator ladder step (build prerequisite buildings first, then upgrade). */
  function tryGeneratorStep(): boolean {
    const b = probeRef.value;
    const def = nextGeneratorUpgrade(b.generatorLevel);
    if (!def) return false;

    // The Underground upgrade still needs a plain Market as its base.
    const needsMarketBase = def.requirement.kind === 'market' || (def.requirement.kind === 'undergroundMarket' && !b.undergroundMarketBuilt);
    if (needsMarketBase && b.marketState === 'none') {
      if (b.vespene >= MARKET_BUILD_COST) {
        commit({ vespene: b.vespene - MARKET_BUILD_COST, marketState: 'building', marketTimer: BUILD_TIME_SECONDS });
        return true;
      }
      return false;
    }
    if (def.requirement.kind === 'undergroundMarket' && b.marketState === 'built' && !b.undergroundMarketBuilt) {
      if (b.vespene >= UNDERGROUND_MARKET_UPGRADE_COST) {
        commit({ vespene: b.vespene - UNDERGROUND_MARKET_UPGRADE_COST, marketState: 'upgrading', marketTimer: BUILD_TIME_SECONDS });
        return true;
      }
      return false;
    }
    if (
      generatorRequirementMet(def, {
        wallPos: getWallPos(),
        marketState: b.marketState,
        undergroundMarketBuilt: b.undergroundMarketBuilt,
      })
    ) {
      if (spend(def.costGas, def.costMinerals)) {
        commit({ generatorLevel: b.generatorLevel + 1 });
        // A generator upgrade that consumed the plain Market frees its 64 gas back (4s sell).
        const wasMarketPrereq = def.requirement.kind === 'market';
        if (wasMarketPrereq) {
          commit({ marketState: 'selling', marketTimer: BUILD_TIME_SECONDS });
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Depot + miner management (from generator level 6).
   * Builds the Depot (256g / 4s), trains the best affordable miner (4s job), and — once at the
   * 15-miner cap — auto-destructs the weakest miner (no refund) before training a strictly
   * better one. Only one Ludicrous miner may ever exist per probe.
   */
  function tryMinerAction(): boolean {
    const b = probeRef.value;
    if (b.generatorLevel < 6) return false;

    if (b.depotState === 'none') {
      if (b.vespene >= DEPOT_BUILD_COST) {
        commit({ vespene: b.vespene - DEPOT_BUILD_COST, depotState: 'building', depotTimer: BUILD_TIME_SECONDS });
        return true;
      }
      return false;
    }
    if (b.depotState !== 'built' || b.minerTrainingType !== null) return false;

    const counts = b.minerCounts;
    const atCap = totalMiners(counts) >= minerCap(b.repositories);
    const worst = worstMiner(counts);
    const worstIdx = worst ? MINERS.findIndex((m) => m.type === worst) : -1;

    // Best affordable miner this run can field (Ludicrous honours its per-probe cap).
    let candidate: { type: MinerType; costGas: number } | null = null;
    for (let i = MINERS.length - 1; i >= 0; i--) {
      const def = MINERS[i];
      if (b.vespene < def.costGas) continue;
      if (atCap && i <= worstIdx) break; // nothing strictly better left below this tier
      if (!atCap && !minerSlotAvailable(counts, def.type, b.repositories)) continue;
      if (def.type === 'ludicrous' && (counts.ludicrous ?? 0) >= LUDICROUS_CAP) continue;
      candidate = def;
      break;
    }
    if (!candidate) return false;

    if (atCap && worst) {
      // Replace the weakest miner: destruct (no refund) this tick, training starts next tick.
      commit({ minerCounts: { ...counts, [worst]: counts[worst] - 1 } });
      return true;
    }
    commit({
      vespene: b.vespene - candidate.costGas,
      minerTrainingType: candidate.type,
      minerTrainingTimer: MINER_TRAINING_TIME,
    });
    return true;
  }

  /** Repository: +5 miner cap, max 3, once the roster is perfected at the current cap. */
  function tryRepository(): boolean {
    const b = probeRef.value;
    if (b.repositories >= REPOSITORY.max) return false;
    if (b.vespene < REPOSITORY.costGas) return false;
    if (!rosterPerfected(b.minerCounts, minerCap(b.repositories))) return false;
    commit({ vespene: b.vespene - REPOSITORY.costGas, repositories: b.repositories + 1 });
    return true;
  }

  /**
   * Automated mines (levels 3-8): once an Ultra-tier miner exists, build the best affordable
   * level (independent ladder) as a 4s job, up to 100 mines per level — or, when the roster is
   * perfected, build a repository instead (+5 miner cap).
   */
  function tryMineAction(): boolean {
    const b = probeRef.value;
    if (!hasUltraTier(b.minerCounts)) return false;

    if (tryRepository()) return true;

    let best: MineLevel | null = null;
    for (let i = MINES.length - 1; i >= 0; i--) {
      const def = MINES[i];
      if (b.minerals < def.costMinerals) continue;
      if ((b.mineCounts[def.level] ?? 0) >= MINE_CAP_PER_LEVEL) continue;
      best = def.level;
      break;
    }
    if (best === null) return false;
    commit({
      minerals: b.minerals - mineDef(best).costMinerals,
      mineBuildLevel: best,
      mineBuildTimer: MINE_BUILD_TIME,
    });
    return true;
  }

  /** Buy one pack of minerals (10 minerals) when the pool will need them soon. */
  function tryBuyMinerals(): boolean {
    const b = probeRef.value;
    const defenseCost = defenseUpgradeCost(getWallPos());
    const def = nextGeneratorUpgrade(b.generatorLevel);
    const needForWall = defenseCost.minerals > 0 && b.minerals < defenseCost.minerals;
    const needForGen = def !== undefined && def.costMinerals > 0 && b.minerals < def.costMinerals;
    const needForMine =
      hasUltraTier(b.minerCounts) &&
      MINES.some((m) => (b.mineCounts[m.level] ?? 0) < MINE_CAP_PER_LEVEL) &&
      b.minerals < MINES[0].costMinerals;
    if (!needForWall && !needForGen && !needForMine) return false;

    // A wall upgrade that needs minerals requires the Market to buy them — build it on the spot.
    if (b.marketState === 'none' && b.vespene >= MARKET_BUILD_COST) {
      commit({ vespene: b.vespene - MARKET_BUILD_COST, marketState: 'building', marketTimer: BUILD_TIME_SECONDS });
      return true;
    }
    if (b.marketState !== 'built') return false;
    if (b.vespene < b.mineralPrice) return false;
    commit({
      vespene: b.vespene - b.mineralPrice,
      minerals: b.minerals + MINERAL_BUY.amount,
      mineralPrice: nextMineralPrice(b.mineralPrice),
    });
    return true;
  }

  /** Attempt the wall upgrade (spend gas + minerals). Returns true if performed. */
  function tryUpgradeWall(): boolean {
    const b = probeRef.value;
    if (b.rareType === 'pather') return false; // Pathers only ever have level-1 walls.
    const cost = defenseUpgradeCost(getWallPos());
    if (!spend(cost.gas, cost.minerals)) return false;
    upgradeWall();
    return true;
  }

  /**
   * Tick the economy by one second. Adds generator + mine gas income and miner mineral income,
   * runs the building timers, then performs at most ONE economic action (the single shared queue).
   * Policy: wall under threat -> wall upgrade wins (defense); otherwise eco-first
   * (generator -> miners -> walls -> mines/repository -> market buys). Returns true when a wall
   * upgrade was performed (used to trigger an autosave).
   */
  function tickProbeEconomy(): boolean {
    const b = probeRef.value;

    // Gas income from the generator (+ automated mines) & mineral harvest from trained miners.
    const mined = minerRate(b.minerCounts);
    const withMinerAccum = b.mineralAccum + mined;
    const mineralsMined = Math.floor(withMinerAccum);
    commit({
      vespene: b.vespene + generatorRate(b.generatorLevel) + mineRate(b.mineCounts),
      minerals: b.minerals + mineralsMined,
      mineralAccum: withMinerAccum - mineralsMined,
    });

    if (tickEngineTimers()) return false;

    const countBefore = probeRef.value.upgradeCount;
    const wallThreat = getWallThreat();
    const acted = wallThreat
      ? tryUpgradeWall() || tryGeneratorStep() || tryMinerAction() || tryMineAction() || tryBuyMinerals()
      : tryGeneratorStep() || tryMinerAction() || tryUpgradeWall() || tryMineAction() || tryBuyMinerals();

    if (acted) refreshTargets();
    return acted && probeRef.value.upgradeCount !== countBefore;
  }

  refreshTargets();

  return {
    tickProbeEconomy,
    nextWallCost,
    nextGeneratorUpgradeAvailable,
    nextGeneratorCost,
  };
}