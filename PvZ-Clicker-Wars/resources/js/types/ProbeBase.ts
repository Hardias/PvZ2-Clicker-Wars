export type WallTier = 'wall' | 'ultra' | 'mega' | 'power' | 'final';

export interface Wall {
  tier: WallTier;
  level: number; // 1-5 for wall/ultra/mega, 1-2 for power, 1 for final
  maxHp: number;
  currentHp: number;
  defense: number;
}

export interface TurretInfo {
  count: number; // always 8
  level: number; // 1 to 13+
  attackPower: number; // total attack power
}

export interface ProbeBase {
  rankIndex: number;
  rankName: string;
  probeKills: number;
  upgradeCount: number;
  timeUntilUpgrade: number;
  maxUpgradeTime: number;
  wall: Wall;
  turret: TurretInfo;
}
