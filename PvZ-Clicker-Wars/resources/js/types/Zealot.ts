export interface ZealotStats {
  hp: number;
  maxHp: number;
  baseAttack: number;
  baseAttackSpeed: number; // attacks per second
  baseDefense: number;
  baseHpRegen: number; // HP per second
  minerals: number;
  vespeneGas: number; // Vespene Gas (V)
  emergencyTeleports: number; // starts at 2
  deaths: number; // death counter
}
