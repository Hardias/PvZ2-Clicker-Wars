import { BigNum } from '../utils/bigNumber';

export interface ZealotStats {
  hp: BigNum;
  maxHp: BigNum;
  baseAttack: BigNum;
  baseAttackSpeed: number; // attacks per second (stays a plain number)
  baseDefense: number; // flat damage reduction (stays a plain number)
  baseHpRegen: BigNum; // HP per second
  minerals: BigNum;
  vespeneGas: BigNum; // Vespene Gas (V)
  infiniteVespene: boolean; // DEV: infinite Vespene Gas (abracadabra)
  emergencyTeleports: number; // starts at 2
  deaths: number; // death counter
  isImmobilized: boolean;
  wallsKilled: number; // total destroyed walls
  damageDone: BigNum; // total damage dealt
  highestAverageDps: BigNum; // highest DPS ever recorded
}