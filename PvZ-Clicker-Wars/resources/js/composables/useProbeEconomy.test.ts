import { describe, it, expect, vi } from 'vitest';
import { useProbeEconomy } from './useProbeEconomy';
import { probeBaseMock } from '../utils/testMocks';
import { emptyMinerCounts, MinerCounts } from '../utils/economyMath';

function makeRef(initial = probeBaseMock()) {
  let v = initial;
  return {
    get value() {
      return v;
    },
    set value(next) {
      v = next;
    },
  };
}

function fullMasters(): MinerCounts {
  const c = emptyMinerCounts();
  c.master = 15;
  return c;
}

describe('useProbeEconomy', () => {
  it('eco-first: builds a wall when gas is affordable and nothing is being invested', () => {
    const probe = makeRef(probeBaseMock({ vespene: 0, generatorLevel: 1, upgradeCount: 0 }));
    const upgradeWall = vi.fn(() => {
      probe.value = { ...probe.value, upgradeCount: probe.value.upgradeCount + 1 };
    });
    const eco = useProbeEconomy(probe, () => 0, () => false, upgradeWall);

    // 23 seconds of 1 gas/s: still below the 24-gas defence cost (t1->t2 turret table).
    for (let i = 0; i < 23; i++) eco.tickProbeEconomy();
    expect(probe.value.vespene).toBe(23);
    expect(upgradeWall).not.toHaveBeenCalled();

    // 24th second: pool reaches 24 gas -> the defence upgrade fires (1 action).
    const upgraded = eco.tickProbeEconomy();
    expect(probe.value.vespene).toBe(0);
    expect(upgradeWall).toHaveBeenCalledTimes(1);
    expect(upgraded).toBe(true);
  });

  it('eco-first: invests in the generator before spending on the wall', () => {
    const probe = makeRef(probeBaseMock({ vespene: 100, generatorLevel: 1, upgradeCount: 0 }));
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 0, () => false, upgradeWall);

    const upgraded = eco.tickProbeEconomy();
    expect(probe.value.generatorLevel).toBe(2); // 50 gas spent on gen 1->2
    expect(probe.value.vespene).toBe(51); // 100 + 1 income - 50
    expect(upgradeWall).not.toHaveBeenCalled();
    expect(upgraded).toBe(false);
  });

  it('wall threat priority: upgrades the wall before the economy when under fire', () => {
    const probe = makeRef(probeBaseMock({ vespene: 100, generatorLevel: 1, upgradeCount: 0 }));
    const upgradeWall = vi.fn(() => {
      probe.value = { ...probe.value, upgradeCount: probe.value.upgradeCount + 1 };
    });
    const eco = useProbeEconomy(probe, () => 0, () => true, upgradeWall);

    const upgraded = eco.tickProbeEconomy();
    expect(upgradeWall).toHaveBeenCalledTimes(1);
    expect(probe.value.vespene).toBe(77); // 100 + 1 - 24 defence cost (t1->t2)
    expect(probe.value.generatorLevel).toBe(1);
    expect(upgraded).toBe(true);
  });

  it('builds the Market on the spot when minerals are needed (gen req / Mega wall)', () => {
    const probe = makeRef(probeBaseMock({ vespene: 1000, generatorLevel: 5, marketState: 'none', minerals: 0 }));
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 9, () => false, upgradeWall); // t10->t11 defence needs 10.240 minerals

    eco.tickProbeEconomy();
    expect(probe.value.marketState).toBe('building');
    expect(probe.value.vespene).toBe(952); // 1000 + 16 income - 64 market build
    expect(upgradeWall).not.toHaveBeenCalled();
  });

  it('buys mineral packs once the market is built (155 -> 160 gas pricing)', () => {
    const probe = makeRef(
      probeBaseMock({ vespene: 1000, generatorLevel: 5, marketState: 'built', minerals: 0, mineralPrice: 155, undergroundMarketBuilt: true }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 9, () => false, upgradeWall);

    const upgraded = eco.tickProbeEconomy();
    expect(probe.value.minerals).toBe(10);
    expect(probe.value.mineralPrice).toBe(160);
    expect(probe.value.vespene).toBe(861); // 1000 + 16 - 155
    expect(upgraded).toBe(false);

    eco.tickProbeEconomy();
    expect(probe.value.minerals).toBe(20);
    expect(probe.value.mineralPrice).toBe(165);
  });

  it('pathers generate gas but never upgrade the wall', () => {
    const probe = makeRef(probeBaseMock({ vespene: 0, generatorLevel: 6, rareType: 'pather', upgradeCount: 0 }));
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 0, () => true, upgradeWall);

    eco.tickProbeEconomy();
    expect(probe.value.vespene).toBe(32); // income beats threat priority (wall upgrade skipped for pathers)
    expect(upgradeWall).not.toHaveBeenCalled();
    expect(probe.value.upgradeCount).toBe(0);
  });

  it('builds the depot (256 gas, 4s) once generator level 6 is reached', () => {
    const probe = makeRef(probeBaseMock({ vespene: 1000, generatorLevel: 6, depotState: 'none' }));
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 9, () => false, upgradeWall);

    eco.tickProbeEconomy();
    expect(probe.value.depotState).toBe('building');
    expect(probe.value.vespene).toBe(776); // 1000 + 32 income - 256 depot
    for (let i = 0; i < 4; i++) eco.tickProbeEconomy();
    expect(probe.value.depotState).toBe('built');
    expect(probe.value.depotTimer).toBe(0);
  });

  it('trains the best affordable miner as a 4s job after the depot exists', () => {
    const probe = makeRef(probeBaseMock({ vespene: 1032, generatorLevel: 6, depotState: 'built', minerals: 0 }));
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 9, () => false, upgradeWall);

    eco.tickProbeEconomy(); // average (1024) affordable; gen 7 (1600) is not
    expect(probe.value.minerTrainingType).toBe('average');
    expect(probe.value.vespene).toBe(40); // 1032 + 32 - 1024
    for (let i = 0; i < 4; i++) eco.tickProbeEconomy();
    expect(probe.value.minerTrainingType).toBeNull();
    expect(probe.value.minerCounts.average).toBe(1);
  });

  it('harvests minerals from trained miners (1 simple = 0.125/s)', () => {
    const counts = emptyMinerCounts();
    counts.simple = 1;
    const probe = makeRef(probeBaseMock({ vespene: 0, generatorLevel: 6, depotState: 'built', minerals: 1000, minerCounts: counts }));
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 0, () => false, upgradeWall);

    for (let i = 0; i < 8; i++) eco.tickProbeEconomy();
    expect(probe.value.minerals).toBe(1001); // 8 * 0.125 = 1 mined mineral
    expect(probe.value.mineralAccum).toBeCloseTo(0, 5);
  });

  it('at the 15-cap: destructs the weakest miner (no refund) then trains a strictly better one', () => {
    const probe = makeRef(
      probeBaseMock({ vespene: 80000, generatorLevel: 10, depotState: 'built', minerals: 1000, minerCounts: fullMasters() }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 9, () => false, upgradeWall);

    eco.tickProbeEconomy(); // ultra (71680) affordable & better than master -> destruct one master, no refund
    expect(probe.value.minerCounts.master).toBe(14);
    expect(probe.value.vespene).toBe(80512); // nothing spent on the destruct

    eco.tickProbeEconomy(); // roster is 14 now -> start training an ultra (4s job)
    expect(probe.value.minerTrainingType).toBe('ultra');
    expect(probe.value.minerCounts.ultra).toBe(0);

    for (let i = 0; i < 4; i++) eco.tickProbeEconomy();
    expect(probe.value.minerCounts.ultra).toBe(1);
    expect(probe.value.minerCounts.master).toBe(14);
  });

  it('never trains a second Ludicrous miner (cap 1 per probe)', () => {
    const counts = emptyMinerCounts();
    counts.ludicrous = 1;
    counts.simple = 14; // full roster, ludicrous already present
    const probe = makeRef(
      probeBaseMock({ vespene: 11000000, generatorLevel: 10, depotState: 'built', minerals: 1000, minerCounts: counts }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 9, () => false, upgradeWall);

    eco.tickProbeEconomy(); // ludicrous skipped (cap), a perfect replaces a simple instead
    expect(probe.value.minerCounts.ludicrous).toBe(1);
    expect(probe.value.minerCounts.simple).toBe(13);
    expect(probe.value.minerTrainingType).toBeNull();
  });

  it('T8c: from an ultra-tier roster, builds an automated mine (4s job) when minerals suffice', () => {
    const counts = emptyMinerCounts();
    counts.master = 14;
    counts.ultra = 1; // ultra tier reached; full 15-roster (120 minerals/s, integer harvest)
    const probe = makeRef(
      probeBaseMock({ vespene: 500, generatorLevel: 10, depotState: 'built', minerals: 1124, minerCounts: counts }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 12, () => false, upgradeWall); // wall needs 32768 gas -> never affordable

    eco.tickProbeEconomy(); // gen max, roster full, wall too far -> L3 mine (1024 minerals) starts
    expect(probe.value.mineBuildLevel).toBe(3);
    expect(probe.value.mineBuildTimer).toBe(4);
    expect(probe.value.minerals).toBe(220); // 1124 + 120 income - 1024

    for (let i = 0; i < 4; i++) eco.tickProbeEconomy(); // 4s build completes on the 4th tick
    expect(probe.value.mineBuildLevel).toBeNull();
    expect(probe.value.mineCounts[3]).toBe(1);
    expect(probe.value.minerals).toBe(700); // completion tick is "busy" -> no buy that second
    expect(probe.value.mineralPrice).toBe(155);

    eco.tickProbeEconomy(); // mine now adds 32 gas/s: 3060 + 512 gen - 155 buy = 3449, +10 minerals
    expect(probe.value.vespene).toBe(3449);
    expect(probe.value.minerals).toBe(830); // 700 + 120 harvest + 10 pack
    expect(probe.value.mineralPrice).toBe(160);
  });

  it('T8c: repository builds over a mine run when the roster is perfected (15 -> 20 cap)', () => {
    const counts = emptyMinerCounts();
    counts.perfect = 14;
    counts.ludicrous = 1; // perfected at cap 15, no ultra present — ultra-or-higher still holds
    const probe = makeRef(
      probeBaseMock({ vespene: 5200000, generatorLevel: 10, depotState: 'built', minerals: 0, minerCounts: counts }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 20, () => false, upgradeWall); // wall at 8.4M gas -> never affordable

    eco.tickProbeEconomy();
    expect(probe.value.repositories).toBe(1);
    expect(probe.value.vespene).toBe(200512); // 5.2M + 512 income - 5M
    expect(probe.value.mineBuildLevel).toBeNull(); // repo took the action
    expect(upgradeWall).not.toHaveBeenCalled();
  });

  it('T8c: a perfected roster (no ultra) can still build mines once the repository is unaffordable', () => {
    const counts = emptyMinerCounts();
    counts.perfect = 14;
    counts.ludicrous = 1;
    const probe = makeRef(
      probeBaseMock({ vespene: 2000, generatorLevel: 10, depotState: 'built', minerals: 2000, minerCounts: counts }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 20, () => false, upgradeWall);

    eco.tickProbeEconomy(); // repo needs 5M gas -> skipped; best affordable mine is L5 (16384)
    expect(probe.value.repositories).toBe(0);
    expect(probe.value.mineBuildLevel).toBe(5);
    expect(probe.value.minerals).toBe(21260); // 2000 + 35644 harvest - 16384

    for (let i = 0; i < 4; i++) eco.tickProbeEconomy();
    expect(probe.value.mineCounts[5]).toBe(1);
    expect(probe.value.mineBuildLevel).toBeNull(); // completion tick is busy; next mine starts a tick later
  });

  it('T8c: ignores mines entirely before the ultra tier is reached', () => {
    const counts = emptyMinerCounts();
    counts.master = 15; // full roster but no ultra-or-higher
    const probe = makeRef(
      probeBaseMock({ vespene: 0, generatorLevel: 10, depotState: 'built', minerals: 10000, minerCounts: counts }),
    );
    const upgradeWall = vi.fn();
    const eco = useProbeEconomy(probe, () => 20, () => false, upgradeWall);

    for (let i = 0; i < 5; i++) eco.tickProbeEconomy();
    expect(probe.value.mineBuildLevel).toBeNull();
    expect(probe.value.repositories).toBe(0);
    expect(probe.value.mineCounts[3]).toBe(0);
  });
});