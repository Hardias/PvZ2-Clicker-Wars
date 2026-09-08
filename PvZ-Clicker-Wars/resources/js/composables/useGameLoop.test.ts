import { describe, it, expect, vi } from 'vitest';
import { computed, ref } from 'vue';
import { useZealot } from './useZealot';
import { handleFatalDamage, turretDamageThisTick, type FatalDamageContext } from './useGameLoop';
import { big } from '../utils/bigNumber';

function equipmentStats() {
  return computed(() => ({ hasGloves: false, totalDefenseReduction: 0 }));
}

function buildCtx(zealot: ReturnType<typeof useZealot>) {
  const currentView = ref<'battle' | 'shop'>('battle');
  const autosaveEnabled = ref(true);
  const playSfx = vi.fn();
  const stopCombat = vi.fn();
  const autoSave = vi.fn();
  const showSaveNotification = vi.fn();
  const handleReset = vi.fn();
  const onEmergencyTeleport = vi.fn();

  const ctx: FatalDamageContext = {
    zealotState: zealot.state,
    useEmergencyTeleport: () => zealot.useEmergencyTeleport(),
    playSfx,
    stopCombat,
    currentView,
    autosaveEnabled,
    autoSave,
    showSaveNotification,
    handleReset,
    onEmergencyTeleport,
  };

  return { ctx, zealot, currentView, autoSave, handleReset, onEmergencyTeleport, playSfx };
}

describe('handleFatalDamage (unconditional death guard)', () => {
  it('does nothing while hp is above 0', () => {
    const { ctx, currentView, autoSave, handleReset, onEmergencyTeleport, playSfx } = buildCtx(useZealot(equipmentStats()));
    ctx.zealotState.value.hp = big(50);

    handleFatalDamage(ctx);

    expect(ctx.zealotState.value.hp.toString()).toBe(big(50).toString());
    expect(currentView.value).toBe('battle');
    expect(autoSave).not.toHaveBeenCalled();
    expect(handleReset).not.toHaveBeenCalled();
    expect(onEmergencyTeleport).not.toHaveBeenCalled();
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('fires the emergency teleport when hp hits 0 — never resets while teleports remain', () => {
    const { ctx, zealot, currentView, autoSave, handleReset, onEmergencyTeleport, playSfx } = buildCtx(useZealot(equipmentStats()));
    zealot.state.value.hp = big(0);
    zealot.state.value.emergencyTeleports = 2;
    const maxHpStr = zealot.maxHp.value.toString();

    handleFatalDamage(ctx);

    expect(zealot.state.value.emergencyTeleports).toBe(1);
    expect(zealot.state.value.hp.toString()).toBe(maxHpStr);
    expect(zealot.state.value.damageImmunityTimer).toBe(5);
    expect(zealot.state.value.abilityImmunityTimer).toBe(10);
    expect(currentView.value).toBe('shop');
    expect(onEmergencyTeleport).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith('teleport');
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(handleReset).not.toHaveBeenCalled();
  });

  it('treats negative hp as fatal too (overkill overflow still teleports)', () => {
    const { ctx, zealot, currentView, handleReset, onEmergencyTeleport } = buildCtx(useZealot(equipmentStats()));
    zealot.state.value.hp = big(-1);

    handleFatalDamage(ctx);

    expect(currentView.value).toBe('shop');
    expect(onEmergencyTeleport).toHaveBeenCalledTimes(1);
    expect(handleReset).not.toHaveBeenCalled();
  });

  it('hard-resets the run only when every emergency teleport is spent', () => {
    const { ctx, zealot, autoSave, handleReset, onEmergencyTeleport, playSfx } = buildCtx(useZealot(equipmentStats()));
    zealot.state.value.hp = big(0);
    zealot.state.value.emergencyTeleports = 0;
    const deathsBefore = zealot.state.value.deaths;

    handleFatalDamage(ctx);

    expect(zealot.state.value.deaths).toBe(deathsBefore + 1);
    expect(playSfx).toHaveBeenCalledWith('death');
    expect(handleReset).toHaveBeenCalledTimes(1);
    expect(onEmergencyTeleport).not.toHaveBeenCalled();
    expect(autoSave).not.toHaveBeenCalled();
  });
});

describe('turretDamageThisTick (T8e volley cadence)', () => {
  const dps = big(524270 * 5); // full t13 DPS incl. bonuses

  it('t1-12 spread their DPS evenly over the 100ms ticks', () => {
    for (const level of [1, 4, 12]) {
      expect(turretDamageThisTick(level, 1, dps).toString()).toBe(dps.div(10).toString());
      expect(turretDamageThisTick(level, 2, dps).toString()).toBe(dps.div(10).toString());
    }
  });

  it('t13 fires one full volley (DPS/5) every 200ms, silence in between', () => {
    expect(turretDamageThisTick(13, 1, dps).toString()).toBe(big(524270).toString());
    expect(turretDamageThisTick(13, 2, dps).toString()).toBe(big(0).toString());
    expect(turretDamageThisTick(13, 3, dps).toString()).toBe(big(524270).toString());
    expect(turretDamageThisTick(13, 4, dps).toString()).toBe(big(0).toString());
  });

  it('averages to the total DPS over a full second at t13', () => {
    const sum = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map((step) => turretDamageThisTick(13, step, dps).toNumber())
      .reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(524270 * 5, 6);
  });
});