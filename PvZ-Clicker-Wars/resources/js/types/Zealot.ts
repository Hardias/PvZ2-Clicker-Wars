export interface ZealotStats {
  hp: number;
  maxHp: number;
  baseAttack: number;
  baseAttackSpeed: number; // attacks per second
  baseDefense: number;
  baseHpRegen: number; // HP per second
  minerals: number;
  vespeneGas: number; // Vespene Gas (V)
  infiniteVespene: boolean; // DEV: infinite Vespene Gas (abracadabra)
  emergencyTeleports: number; // starts at 2
  deaths: number; // death counter
  isImmobilized: boolean;
  wallsKilled: number; // total destroyed walls
  damageDone: number; // total damage dealt
  highestAverageDps: number; // highest DPS ever recorded
}
