export type WallTier = 'wall' | 'ultra' | 'mega' | 'power' | 'final';

export interface Wall {
  tier: WallTier;
  level: number; // 1-5 for wall/ultra/mega, 1-2 for power, 1 for final
  maxHp: number;
  currentHp: number;
  defense: number;
}

export interface TurretInfo {
  count: number; // 8 normal, 16 for gold baser, scaled for clanned
  level: number; // 1 to 13+
  attackPower: number; // total attack power
}

export type RareProbeType = 'doubleBaser' | 'goldBaser' | 'pather' | 'tripleBaser' | 'trainingProbe' | null;

export interface ProbeBase {
  rankIndex: number;
  rankName: string;
  probeKills: number;
  upgradeCount: number;
  timeUntilUpgrade: number;
  maxUpgradeTime: number;
  wall: Wall;
  turret: TurretInfo;
  ability: 'chrono' | 'voidPrism';
  abilityCooldown: number;
  abilityActiveTimer: number;
  hasStartedCombat: boolean;
  isRare: boolean;
  rareType: RareProbeType;
  isClanned: boolean;
  clanName?: string;
  patherWallsRemaining?: number;
  patherRebuildTimer?: number;
  patherWallsKilledThisSec?: number;
  patherLastSecond?: number;
  trainingState?: 'waiting15' | 'window2' | 'castingVoid' | 'normal';
  trainingTimer?: number;
}
