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
  abilityImmunityTimer: number; // seconds of ability immunity remaining (passive after being hit by probe ability)
  damageImmunityTimer: number; // seconds of full damage immunity remaining (Undying skill window)
  undyingUsedThisFight: boolean; // tracks if Undying skill triggered for current probe fight
  totalMineralsEarned: BigNum; // run-based: total minerals earned this run
  totalVespeneEarned: BigNum; // run-based: total vespene gas earned this run
  totalPlayTimeSeconds: number; // run-based: total seconds played this run
}