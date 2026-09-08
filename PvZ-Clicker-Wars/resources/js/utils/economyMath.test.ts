import { describe, it, expect } from 'vitest';
import {
  wallUpgradeGas,
  wallUpgradeMinerals,
  wallUpgradeCost,
  TURRET_MAX_LEVEL,
  TURRET_DPS,
  TURRET_UPGRADE_COSTS,
  turretDpsForLevel,
  defenseUpgradeCost,
  MAX_GENERATOR_LEVEL,
  GENERATOR_UPGRADES,
  nextGeneratorUpgrade,
  generatorRate,
  generatorRequirementMet,
  MINERAL_BUY,
  nextMineralPrice,
  BUILD_TIME_SECONDS,
  MARKET_BUILD_COST,
  UNDERGROUND_MARKET_UPGRADE_COST,
  probeDeathCarry,
  econDefaults,
  econCarryOver,
  MINERS,
  MINER_CAP,
  LUDICROUS_CAP,
  DEPOT_BUILD_COST,
  MinerCounts,
  totalMiners,
  minerRate,
  worstMiner,
  minerSlotAvailable,
  emptyMinerCounts,
  REPOSITORY,
  minerCap,
  hasUltraTier,
  rosterPerfected,
  MINE_LEVELS,
  MINE_CAP_PER_LEVEL,
  MINE_BUILD_TIME,
  MINES,
  mineDef,
  mineRate,
  emptyMineCounts,
} from './economyMath';

describe('wall upgrade costs (gas doubling + Mega minerals)', () => {
  it('doubles gas from W1->W2 (8) up to U5->Mega1 (4096)', () => {
    expect(wallUpgradeGas(0)).toBe(8);
    expect(wallUpgradeGas(1)).toBe(16);
    expect(wallUpgradeGas(2)).toBe(32);
    expect(wallUpgradeGas(3)).toBe(64);
    expect(wallUpgradeGas(4)).toBe(128);
    expect(wallUpgradeGas(5)).toBe(256);
    expect(wallUpgradeGas(9)).toBe(4096);
  });

  it('keeps doubling through the Final wall', () => {
    expect(wallUpgradeGas(10)).toBe(8192);
    expect(wallUpgradeGas(16)).toBe(8 * Math.pow(2, 16));
  });

  it('adds no minerals before the Mega echelon', () => {
    expect(wallUpgradeMinerals(8)).toBe(0);
  });

  it('adds 32 minerals at U5->Mega1, then 64/128 toward Mega2/Mega3', () => {
    expect(wallUpgradeMinerals(9)).toBe(32);
    expect(wallUpgradeMinerals(10)).toBe(64);
    expect(wallUpgradeMinerals(11)).toBe(128);
  });

  it('doubles minerals from Mega3 through the Final', () => {
    expect(wallUpgradeMinerals(12)).toBe(256);
    expect(wallUpgradeMinerals(16)).toBe(4096);
  });

  it('combines gas + minerals from pos 9 onwards', () => {
    expect(wallUpgradeCost(9)).toEqual({ gas: 4096, minerals: 32 });
    expect(wallUpgradeCost(3)).toEqual({ gas: 64, minerals: 0 });
  });
});

describe('turret table (T8e dictaat)', () => {
  it('caps turrets at 13 levels', () => {
    expect(TURRET_MAX_LEVEL).toBe(13);
  });

  it('has the dictated DPS progression 1->12', () => {
    expect(TURRET_DPS.slice(1, 13)).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 400, 700, 40960, 160000]);
  });

  it('stores t13 as display-DPS (524270 per 0.2s, x5)', () => {
    expect(TURRET_DPS[13]).toBe(524270 * 5);
  });

  it('clamps turretDpsForLevel to 1..13', () => {
    expect(turretDpsForLevel(0)).toBe(1);
    expect(turretDpsForLevel(7)).toBe(64);
    expect(turretDpsForLevel(99)).toBe(524270 * 5);
  });

  it('dictates the upgrade ladder: 24g -> 1M gas + 750k minerals, per level', () => {
    expect(TURRET_UPGRADE_COSTS).toHaveLength(12);
    expect(TURRET_UPGRADE_COSTS[0]).toEqual({ toLevel: 2, costGas: 24, costMinerals: 0 });
    expect(TURRET_UPGRADE_COSTS[1]).toEqual({ toLevel: 3, costGas: 32, costMinerals: 0 });
    expect(TURRET_UPGRADE_COSTS[5]).toEqual({ toLevel: 7, costGas: 512, costMinerals: 16 });
    expect(TURRET_UPGRADE_COSTS[9]).toEqual({ toLevel: 11, costGas: 0, costMinerals: 10240 });
    expect(TURRET_UPGRADE_COSTS[11]).toEqual({ toLevel: 13, costGas: 1000000, costMinerals: 750000 });
  });
});

describe('defenseUpgradeCost (T8e: turret cost while leveling, wall cost after cap)', () => {
  it('uses the new turret table for positions 0-11', () => {
    expect(defenseUpgradeCost(0)).toEqual({ gas: 24, minerals: 0 });
    expect(defenseUpgradeCost(5)).toEqual({ gas: 512, minerals: 16 });
    expect(defenseUpgradeCost(11)).toEqual({ gas: 1000000, minerals: 750000 });
  });

  it('reverts to the classic wall cost from position 12 (turret maxed)', () => {
    expect(defenseUpgradeCost(12)).toEqual(wallUpgradeCost(12));
    expect(defenseUpgradeCost(16)).toEqual(wallUpgradeCost(16));
  });
});

describe('generator ladder', () => {
  it('caps at level 10 (Mega Wall 3 requirement on the final row)', () => {
    expect(MAX_GENERATOR_LEVEL).toBe(10);
    const def = nextGeneratorUpgrade(9)!;
    expect(def.nextLevel).toBe(10);
    expect(def.requirement).toEqual({ kind: 'wall', wallPos: 12 });
  });

  it('is fully dictated and unlocked 1->10', () => {
    expect(GENERATOR_UPGRADES.map((u) => u.nextLevel)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('has the dictated costs 1->6', () => {
    expect(GENERATOR_UPGRADES[0]).toMatchObject({ nextLevel: 2, costGas: 50, costMinerals: 0, requirement: { kind: 'wall', wallPos: 0 } });
    expect(GENERATOR_UPGRADES[1]).toMatchObject({ nextLevel: 3, costGas: 100, requirement: { kind: 'wall', wallPos: 3 } });
    expect(GENERATOR_UPGRADES[2]).toMatchObject({ nextLevel: 4, costGas: 200, requirement: { kind: 'market' } });
    expect(GENERATOR_UPGRADES[3]).toMatchObject({ nextLevel: 5, costGas: 400, requirement: { kind: 'wall', wallPos: 5 } });
    expect(GENERATOR_UPGRADES[4]).toMatchObject({ nextLevel: 6, costGas: 800, costMinerals: 30, requirement: { kind: 'undergroundMarket' } });
  });

  it('has the dictated costs 6->10', () => {
    expect(GENERATOR_UPGRADES[5]).toMatchObject({ nextLevel: 7, costGas: 1600, costMinerals: 64, requirement: { kind: 'wall', wallPos: 8 } }); // Ultra Wall 4
    expect(GENERATOR_UPGRADES[6]).toMatchObject({ nextLevel: 8, costGas: 3200, costMinerals: 128, requirement: { kind: 'wall', wallPos: 10 } }); // Mega Wall 1
    expect(GENERATOR_UPGRADES[7]).toMatchObject({ nextLevel: 9, costGas: 6400, costMinerals: 256, requirement: { kind: 'wall', wallPos: 11 } }); // Mega Wall 2
    expect(GENERATOR_UPGRADES[8]).toMatchObject({ nextLevel: 10, costGas: 12800, costMinerals: 512, requirement: { kind: 'wall', wallPos: 12 } }); // Mega Wall 3
  });

  it('doubles production per generator level', () => {
    expect(generatorRate(1)).toBe(1);
    expect(generatorRate(2)).toBe(2);
    expect(generatorRate(3)).toBe(4);
    expect(generatorRate(6)).toBe(32);
    expect(generatorRate(10)).toBe(512);
  });

  it('returns undefined at max level', () => {
    expect(nextGeneratorUpgrade(MAX_GENERATOR_LEVEL)).toBeUndefined();
  });
});

describe('generator requirements', () => {
  const def = GENERATOR_UPGRADES[1]; // Wall 4 requirement
  it('requires the wall position', () => {
    expect(generatorRequirementMet(def, { wallPos: 3, marketState: 'none', undergroundMarketBuilt: false })).toBe(true);
    expect(generatorRequirementMet(def, { wallPos: 2, marketState: 'none', undergroundMarketBuilt: false })).toBe(false);
  });

  it('requires a built (or working) market', () => {
    const marketDef = GENERATOR_UPGRADES[2];
    expect(generatorRequirementMet(marketDef, { wallPos: 2, marketState: 'none', undergroundMarketBuilt: false })).toBe(false);
    expect(generatorRequirementMet(marketDef, { wallPos: 2, marketState: 'built', undergroundMarketBuilt: false })).toBe(true);
  });

  it('requires the underground market built', () => {
    const ugDef = GENERATOR_UPGRADES[4];
    expect(generatorRequirementMet(ugDef, { wallPos: 5, marketState: 'built', undergroundMarketBuilt: false })).toBe(false);
    expect(generatorRequirementMet(ugDef, { wallPos: 5, marketState: 'built', undergroundMarketBuilt: true })).toBe(true);
  });
});

describe('market / minerals', () => {
  it('buys 10 minerals at the base price and escalates +5 per purchase', () => {
    expect(MINERAL_BUY.amount).toBe(10);
    expect(MINERAL_BUY.basePrice).toBe(155);
    expect(MINERAL_BUY.priceStep).toBe(5);
    expect(nextMineralPrice(155)).toBe(160);
    expect(nextMineralPrice(160)).toBe(165);
  });

  it('markets build/upgrade/sell in 4 seconds with dictated costs', () => {
    expect(BUILD_TIME_SECONDS).toBe(4);
    expect(MARKET_BUILD_COST).toBe(64);
    expect(UNDERGROUND_MARKET_UPGRADE_COST).toBe(256);
  });
});

describe('depot + mineworkers (dictated T8b)', () => {
  it('builds the depot for 256 gas and caps rosters at 15 (1 Ludicrous)', () => {
    expect(DEPOT_BUILD_COST).toBe(256);
    expect(MINER_CAP).toBe(15);
    expect(LUDICROUS_CAP).toBe(1);
  });

  it('has the dictated 9 miner tiers (gas cost + minerals/sec)', () => {
    const rows = MINERS.map((m) => [m.costGas, m.rate] as const);
    expect(rows).toEqual([
      [512, 1 / 8],
      [1024, 1 / 4],
      [2048, 1 / 2],
      [4096, 1],
      [15360, 6],
      [71680, 36],
      [275000, 216],
      [1000000, 1296],
      [10000000, 17500],
    ]);
  });

  it('sums roster size and mineral income', () => {
    const counts: MinerCounts = emptyMinerCounts();
    counts.simple = 10;
    counts.perfect = 1;
    expect(totalMiners(counts)).toBe(11);
    expect(minerRate(counts)).toBeCloseTo(10 / 8 + 1296, 10);
  });

  it('reports the weakest tier present', () => {
    const counts: MinerCounts = emptyMinerCounts();
    counts.ultra = 2;
    counts.master = 1;
    expect(worstMiner(counts)).toBe('master');
    expect(worstMiner(emptyMinerCounts())).toBeNull();
  });

  it('slot logic: cap honest for normal miners, single-slot for ludicrous', () => {
    const full = emptyMinerCounts();
    full.master = 15;
    expect(minerSlotAvailable(full, 'ultra')).toBe(false); // at 15-cap
    full.master = 14;
    expect(minerSlotAvailable(full, 'ultra')).toBe(true);
    expect(minerSlotAvailable(full, 'ludicrous')).toBe(true);
    full.ludicrous = 1;
    expect(minerSlotAvailable(full, 'ludicrous')).toBe(false); // only one ludicrous allowed
  });
});

describe('repositories + dynamic miner cap (T8c)', () => {
  it('dictates 5,000,000 gas, +5 cap, max 3', () => {
    expect(REPOSITORY).toEqual({ costGas: 5_000_000, capIncrease: 5, max: 3 });
  });

  it('works out the cap per repository count', () => {
    expect(minerCap(0)).toBe(15);
    expect(minerCap(1)).toBe(20);
    expect(minerCap(2)).toBe(25);
    expect(minerCap(3)).toBe(30);
    expect(minerCap(9)).toBe(30); // clamp at 3
  });

  it('slot logic follows the dynamic cap', () => {
    const roster: MinerCounts = emptyMinerCounts();
    roster.master = 15;
    expect(minerSlotAvailable(roster, 'ultra', 0)).toBe(false); // at cap 15
    expect(minerSlotAvailable(roster, 'ultra', 1)).toBe(true); // repo 1 opens 5 more
    roster.master = 20;
    expect(minerSlotAvailable(roster, 'ultra', 1)).toBe(false); // at cap 20
    expect(minerSlotAvailable(roster, 'ultra', 2)).toBe(true); // repo 2 opens 5 more
  });
});

describe('automated mines (T8c)', () => {
  it('levels 3-8, 100 per level, 4s build', () => {
    expect(MINE_LEVELS).toEqual([3, 4, 5, 6, 7, 8]);
    expect(MINE_CAP_PER_LEVEL).toBe(100);
    expect(MINE_BUILD_TIME).toBe(BUILD_TIME_SECONDS);
  });

  it('dictates mine costs/rates L3-L8', () => {
    expect(MINES.map((m) => [m.level, m.costMinerals, m.rate])).toEqual([
      [3, 1024, 32],
      [4, 4096, 128],
      [5, 16384, 512],
      [6, 65536, 2048],
      [7, 262144, 8192],
      [8, 1_000_000, 32768],
    ]);
  });

  it('sums mine income per second', () => {
    const counts = emptyMineCounts();
    counts[3] = 10;
    counts[8] = 2;
    expect(mineRate(counts)).toBe(10 * 32 + 2 * 32768);
    expect(mineDef(5)).toEqual({ level: 5, costMinerals: 16384, rate: 512 });
  });
});

describe('mine unlock + roster perfection (T8c)', () => {
  it('considers mines from Ultra tier onwards ("ultra or higher")', () => {
    const low: MinerCounts = emptyMinerCounts();
    low.perfect = 0;
    low.master = 15;
    expect(hasUltraTier(low)).toBe(false);
    low.master = 14;
    low.ultra = 1;
    expect(hasUltraTier(low)).toBe(true); // ultra itself
    low.ultra = 0;
    low.legendary = 1;
    expect(hasUltraTier(low)).toBe(true); // higher tiers count too
    const perfected: MinerCounts = emptyMinerCounts();
    perfected.perfect = 14;
    perfected.ludicrous = 1;
    expect(hasUltraTier(perfected)).toBe(true); // opening stays open once reached
  });

  it('roster perfected only when the cap is exactly full of perfect + ludicrous', () => {
    const mixed: MinerCounts = emptyMinerCounts();
    mixed.master = 1;
    expect(rosterPerfected(mixed, 15)).toBe(false); // not full

    const perfect1: MinerCounts = emptyMinerCounts();
    perfect1.perfect = 15;
    expect(rosterPerfected(perfect1, 15)).toBe(true);

    const perfectAndLudicrous: MinerCounts = emptyMinerCounts();
    perfectAndLudicrous.perfect = 14;
    perfectAndLudicrous.ludicrous = 1;
    expect(rosterPerfected(perfectAndLudicrous, 15)).toBe(true);

    const downgraded: MinerCounts = emptyMinerCounts();
    downgraded.master = 1;
    downgraded.perfect = 13;
    downgraded.ludicrous = 1;
    expect(rosterPerfected(downgraded, 15)).toBe(false); // a master fouls it
  });

  it('full meta roster (15 perfect, 0 ludicrous) is not perfected at the base cap', () => {
    const meta: MinerCounts = emptyMinerCounts();
    meta.perfect = 15;
    expect(rosterPerfected(meta, 15)).toBe(true);
    // with a repository the cap grows to 20, so 15 perfect no longer fills it
    expect(rosterPerfected(meta, 20)).toBe(false);
  });
});

describe('probe death carry-over', () => {
  it('scales pools by 1.1 per rank', () => {
    expect(probeDeathCarry(100)).toBe(110);
    expect(probeDeathCarry(1)).toBe(1); // floor(1.1)
  });

  it('fresh defaults (generator 1, empty pools, no market/depot/miners/mines)', () => {
    expect(econDefaults()).toEqual({
      vespene: 0,
      minerals: 0,
      generatorLevel: 1,
      mineralPrice: 155,
      marketState: 'none',
      marketTimer: 0,
      undergroundMarketBuilt: false,
      depotState: 'none',
      depotTimer: 0,
      minerTrainingType: null,
      minerTrainingTimer: 0,
      mineralAccum: 0,
      minerCounts: emptyMinerCounts(),
      mineCounts: emptyMineCounts(),
      mineBuildLevel: null,
      mineBuildTimer: 0,
      repositories: 0,
    });
  });

  it('carry-over keeps price but scales pools and resets buildings', () => {
    const carried = econCarryOver({ vespene: 100, minerals: 50, mineralPrice: 180 });
    expect(carried.vespene).toBe(110);
    expect(carried.minerals).toBe(55);
    expect(carried.mineralPrice).toBe(180);
    expect(carried.marketState).toBe('none');
    expect(carried.depotState).toBe('none');
    expect(carried.minerCounts).toEqual(emptyMinerCounts());
    expect(carried.mineCounts).toEqual(emptyMineCounts());
    expect(carried.mineBuildLevel).toBeNull();
    expect(carried.repositories).toBe(0);
    expect(carried.generatorLevel).toBe(1);
  });
});