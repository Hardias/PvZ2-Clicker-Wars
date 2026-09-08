import type { Ref, ComputedRef } from 'vue';
import Decimal from 'break_eternity.js';
import type { ZealotStats } from '../types/Zealot';
import type { ProbeBase } from '../types/ProbeBase';
import type { SkillBonuses } from '../types/SkillTree';
import type { BigNum, BigSource } from '../utils/bigNumber';
import { big } from '../utils/bigNumber';
import { TURRET_MAX_LEVEL } from '../utils/economyMath';
import type { SfxName } from '../audio/types';

/**
 * All state/functions the game loops depend on, injected once at setup.
 * Refs are passed by reference so the loops always read the live values.
 */
export interface GameLoopContext {
  // Reactive state
  zealotState: Ref<ZealotStats>;
  maxHp: ComputedRef<BigNum>;
  attackSpeed: ComputedRef<number>;
  currentDps: ComputedRef<BigNum>;
  hpRegen: ComputedRef<BigNum>;
  hasGloves: ComputedRef<boolean>;
  currentView: Ref<'battle' | 'shop'>;
  isEngagedInCombat: Ref<boolean>;
  totalTurretDps: ComputedRef<BigNum>;
  probeBase: Ref<ProbeBase>;
  autosaveEnabled: Ref<boolean>;
  skillBonuses: ComputedRef<SkillBonuses>;
  // Combat/zealot actions
  heal: (amount: BigSource) => void;
  takeDamage: (amount: BigSource) => Decimal;
  computeReducedDamage: (amount: BigSource) => Decimal;
  useEmergencyTeleport: () => boolean;
  stopCombat: (zealotState?: ZealotStats) => void;
  autoRepairWall: (isFastTick?: boolean) => void;
  tickProbeUpgrades: (zealotState?: ZealotStats) => boolean;
  tickProbeEconomy: () => boolean;
  damageWall: (amount: BigSource, zealotState?: ZealotStats) => { destroyed: boolean };
  // Combo notifications
  registerAutoAttackClick: () => void;
  registerDamageTaken: () => void;
  // Audio
  playSfx: (name: SfxName) => void;
  // Callbacks owned by Game.vue (they build on the shared state)
  performAttack: () => void;
  handleWallDestroyed: (wallMaxHpAtKill: ReturnType<typeof big>, destroyedWallLevel: number) => void;
  autoSave: () => void;
  showSaveNotification: (text?: string, icon?: string) => void;
  handleReset: () => void;
  // Called after a successful emergency teleport so the UI can show a blocking
  // "click to continue" overlay. A teleport can then NEVER be missed.
  onEmergencyTeleport: () => void;
}

/** The subset of loop context needed to resolve a fatal (hp <= 0) situation. */
export interface FatalDamageContext {
  zealotState: Ref<ZealotStats>;
  useEmergencyTeleport: () => boolean;
  playSfx: (name: SfxName) => void;
  stopCombat: (zealotState?: ZealotStats) => void;
  currentView: Ref<'battle' | 'shop'>;
  autosaveEnabled: Ref<boolean>;
  autoSave: () => void;
  showSaveNotification: (text?: string, icon?: string) => void;
  handleReset: () => void;
  onEmergencyTeleport: () => void;
}

/**
 * Single, unconditional death guard: whenever the zealot's HP is 0 or lower,
 * the emergency teleport fires. The zealot can only actually die (hard reset)
 * once EVERY teleport has been spent.
 * Runs every fast tick, outside the combat/immunity/training gates, so it can
 * never be bypassed.
 */
export function handleFatalDamage(ctx: FatalDamageContext): void {
  if (!ctx.zealotState.value.hp.lte(0)) return;

  const teleported = ctx.useEmergencyTeleport();
  if (teleported) {
    ctx.playSfx('teleport');
    ctx.stopCombat(ctx.zealotState.value);
    ctx.currentView.value = 'shop';
    if (ctx.autosaveEnabled.value) ctx.autoSave();
    ctx.showSaveNotification(
      `⚠️ EMERGENCY TELEPORT ACTIVATED! (${ctx.zealotState.value.emergencyTeleports} remaining) You warped back to the Zealot Shop!`,
      '⚠️',
    );
    ctx.onEmergencyTeleport();
  } else {
    ctx.playSfx('death');
    ctx.stopCombat(ctx.zealotState.value);
    ctx.showSaveNotification('💀 ZEALOT HAS FALLEN IN BATTLE! No emergency teleports remaining. Hard resetting session...', '💀');
    ctx.handleReset();
  }
}

/**
 * Turret damage dealt on a single 100ms fast tick (T8e).
 * Levels 1-12 spread their table DPS over 10 ticks (DPS/10 each); turret 13 (t13) fires one full
 * volley every 200ms — `volleyStep` toggles the cadence: odd steps deal the volley (DPS/5, i.e.
 * 524270 + bonuses), even steps deal 0.
 */
export function turretDamageThisTick(turretLevel: number, volleyStep: number, totalDps: BigNum): BigNum {
  if (turretLevel >= TURRET_MAX_LEVEL) {
    return volleyStep % 2 === 1 ? totalDps.div(5) : big(0);
  }
  return totalDps.div(10);
}

interface LoopHandles {
  autoAttack: number | null;
  fastTick: number | null;
  slowTick: number | null;
  save: number | null;
}

export const FAST_TICK_MS = 100;
export const SLOW_TICK_MS = 1000;
export const AUTO_ATTACK_MS = 25;
export const AUTO_SAVE_MS = 120000;

/**
 * Owns the four game-loop intervals (auto-attack, fast tick, slow tick, autosave).
 * Extracted from Game.vue: scheduling is centralized, start is idempotent so it can
 * safely be called multiple times, and stopLoops() tears everything down.
 */
export function useGameLoop(ctx: GameLoopContext) {
  const handles: LoopHandles = {
    autoAttack: null,
    fastTick: null,
    slowTick: null,
    save: null,
  };

  function startLoops() {
    // Idempotent: never stack duplicate intervals when start is called repeatedly.
    if (handles.autoAttack !== null || handles.fastTick !== null || handles.slowTick !== null || handles.save !== null) {
      return;
    }

    // Reliable Auto-Attack Interval when gloves / vespene blade equipped
    let lastAtkTime = Date.now();
    handles.autoAttack = window.setInterval(() => {
      if (ctx.zealotState.value.isImmobilized) return;
      if (ctx.hasGloves.value && ctx.currentView.value === 'battle') {
        const now = Date.now();
        const interval = 1000 / Math.max(0.1, ctx.attackSpeed.value);
        if (now - lastAtkTime >= interval) {
          ctx.performAttack();
          ctx.registerAutoAttackClick();
          lastAtkTime = now;
        }
      }
    }, AUTO_ATTACK_MS);

    // Fast tick (100ms) for smooth HP regen, smooth Turret combat damage, and 200ms wall repair for double/triple basers
    let wallRepairCounter = 0;
    let turretVolleyStep = 0;
    handles.fastTick = window.setInterval(() => {
      // Track highest average DPS ever recorded
      if (ctx.currentDps.value.gt(ctx.zealotState.value.highestAverageDps)) {
        ctx.zealotState.value.highestAverageDps = ctx.currentDps.value;
      }

      // HP Regeneration (per 100ms)
      if (ctx.hpRegen.value.gt(0) && ctx.zealotState.value.hp.lt(ctx.maxHp.value)) {
        ctx.heal(ctx.hpRegen.value.div(10));
      }

      // 200ms wall repair check for double/triple basers (every 2nd 100ms tick = 200ms)
      wallRepairCounter++;
      if (wallRepairCounter >= 2) {
        wallRepairCounter = 0;
        if (ctx.probeBase.value.rareType === 'doubleBaser' || ctx.probeBase.value.rareType === 'tripleBaser') {
          ctx.autoRepairWall(true);
        }
      }

      // Turret Damage if engaged in combat (per 100ms) - PAUSED during Training Probe waiting15 or castingVoid states so zealot never dies helplessly!
      if (ctx.isEngagedInCombat.value && ctx.currentView.value === 'battle') {
        const isTrainingBlocked = ctx.probeBase.value.rareType === 'trainingProbe' && (ctx.probeBase.value.trainingState === 'waiting15' || ctx.probeBase.value.trainingState === 'castingVoid');
        if (ctx.totalTurretDps.value.gt(0) && !isTrainingBlocked) {
          turretVolleyStep++;
          const damageThisTick = turretDamageThisTick(ctx.probeBase.value.turret.level, turretVolleyStep, ctx.totalTurretDps.value);
          // Undying skill: survive a fatal blow once per fight at 1 HP, then 3s full damage immunity
          if (ctx.zealotState.value.damageImmunityTimer <= 0 && damageThisTick.gt(0)) {
            const reducedDamage = ctx.computeReducedDamage(damageThisTick);
            let tookHit = false;
            if (
              ctx.skillBonuses.value.undyingEnabled &&
              !ctx.zealotState.value.undyingUsedThisFight &&
              ctx.zealotState.value.hp.lte(reducedDamage)
            ) {
              ctx.zealotState.value.hp = big(1);
              ctx.zealotState.value.undyingUsedThisFight = true;
              ctx.zealotState.value.damageImmunityTimer = 3;
              ctx.playSfx('teleport');
            } else {
              ctx.takeDamage(damageThisTick);
              tookHit = true;
            }
            if (damageThisTick.gte(1)) {
              ctx.playSfx('turretHit');
              ctx.registerDamageTaken();
            }
            // Reflective Aegis: reflect a fraction of damage actually taken back at the wall
            const thorns = ctx.skillBonuses.value.thornsReflect;
            if (tookHit && thorns > 0) {
              const reflected = damageThisTick.mul(thorns).floor();
              if (reflected.gt(0)) {
                const reflectWallMaxHp = ctx.probeBase.value.wall.maxHp;
                const reflectWallLevel = ctx.probeBase.value.wall.level || 0;
                const reflectRes = ctx.damageWall(reflected, ctx.zealotState.value);
                if (reflectRes.destroyed) {
                  ctx.handleWallDestroyed(reflectWallMaxHp, reflectWallLevel);
                }
              }
            }
          }
        }
      }

      // Unconditional death guard: hp <= 0 always fires the emergency teleport;
      // the zealot can only actually die (hard reset) once ALL teleports are spent.
      handleFatalDamage(ctx);
    }, FAST_TICK_MS);

    // Slow tick (1000ms) for upgrade timers and normal wall auto-repair
    handles.slowTick = window.setInterval(() => {
      // Run-based play time counter (1 second per tick)
      ctx.zealotState.value.totalPlayTimeSeconds += 1;

      if (ctx.probeBase.value.rareType !== 'doubleBaser' && ctx.probeBase.value.rareType !== 'tripleBaser') {
        ctx.autoRepairWall(false);
      }

      // Ability immunity timer counts down every second
      if (ctx.zealotState.value.abilityImmunityTimer > 0) {
        ctx.zealotState.value.abilityImmunityTimer -= 1;
      }

      // Undying damage immunity window counts down every second
      if (ctx.zealotState.value.damageImmunityTimer > 0) {
        ctx.zealotState.value.damageImmunityTimer -= 1;
      }

      // Probe abilities & SS-tier mechanic timers every second; wall upgrades are driven by the
      // T8 probe economy (vespene/minerals) — trigger an autosave whenever a wall level-up fires.
      ctx.tickProbeUpgrades(ctx.zealotState.value);
      const upgraded = ctx.tickProbeEconomy();
      if (upgraded) {
        if (ctx.autosaveEnabled.value) ctx.autoSave();
      }
    }, SLOW_TICK_MS);

    // Autosave interval every 2 minutes
    handles.save = window.setInterval(() => {
      if (ctx.autosaveEnabled.value) {
        ctx.autoSave();
        ctx.showSaveNotification('Autosave updated!');
      }
    }, AUTO_SAVE_MS);
  }

  function stopLoops() {
    if (handles.autoAttack !== null) {
      clearInterval(handles.autoAttack);
      handles.autoAttack = null;
    }
    if (handles.fastTick !== null) {
      clearInterval(handles.fastTick);
      handles.fastTick = null;
    }
    if (handles.slowTick !== null) {
      clearInterval(handles.slowTick);
      handles.slowTick = null;
    }
    if (handles.save !== null) {
      clearInterval(handles.save);
      handles.save = null;
    }
  }

  return { startLoops, stopLoops };
}
