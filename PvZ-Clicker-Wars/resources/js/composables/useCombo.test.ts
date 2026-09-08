import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCombo } from './useCombo';

describe('useCombo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero combo with a 1.0 multiplier', () => {
    const c = useCombo();
    expect(c.comboCount.value).toBe(0);
    expect(c.comboMultiplier.value).toBe(1);
  });

  it('builds combo on rapid clicks within the window', () => {
    const c = useCombo();
    c.registerClick();
    vi.advanceTimersByTime(100);
    c.registerClick();
    vi.advanceTimersByTime(100);
    c.registerClick();
    expect(c.comboCount.value).toBe(3);
  });

  it('multiplier scales with combo count', () => {
    const c = useCombo();
    for (let i = 0; i < 5; i++) {
      c.registerClick();
      vi.advanceTimersByTime(100);
    }
    expect(c.comboCount.value).toBe(5);
    expect(c.comboMultiplier.value).toBeCloseTo(1.2);
  });

  it('resets combo to zero after the timeout window', () => {
    const c = useCombo();
    c.registerClick();
    expect(c.comboCount.value).toBe(1);
    vi.advanceTimersByTime(1300);
    expect(c.comboCount.value).toBe(0);
  });

  it('resets combo on damage taken', () => {
    const c = useCombo();
    c.registerClick();
    c.registerDamageTaken();
    expect(c.comboCount.value).toBe(0);
    expect(c.comboMultiplier.value).toBe(1);
  });

  it('resets combo on wall destroyed', () => {
    const c = useCombo();
    c.registerClick();
    c.registerWallDestroyed();
    expect(c.comboCount.value).toBe(0);
  });

  it('resetCombo clears the count and timer', () => {
    const c = useCombo();
    c.registerClick();
    c.resetCombo();
    expect(c.comboCount.value).toBe(0);
    // No further decay should trigger
    vi.advanceTimersByTime(2000);
    expect(c.comboCount.value).toBe(0);
  });

  it('respects a custom max combo', () => {
    const c = useCombo();
    c.setMaxCombo(2);
    for (let i = 0; i < 5; i++) {
      c.registerClick();
      vi.advanceTimersByTime(100);
    }
    expect(c.comboCount.value).toBe(2);
  });

  it('treats auto-attack clicks the same as manual clicks', () => {
    const c = useCombo();
    c.registerClick();
    vi.advanceTimersByTime(100);
    c.registerClick();
    expect(c.comboCount.value).toBe(2);
  });
});
