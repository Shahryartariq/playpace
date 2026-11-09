import { describe, expect, it } from 'vitest';
import { speedToFit } from '@/lib/calc';

describe('speedToFit', () => {
  it('says normal speed is enough when there is time', () => {
    expect(speedToFit(3600, 5400)).toEqual({ kind: 'normal', speed: 1, watch: 3600, spare: 1800 });
    expect(speedToFit(3600, 3600)?.kind).toBe('normal');
  });

  it('picks the slowest YouTube speed that fits, in 0.05 steps', () => {
    // 10 h in 6 h 40 m needs exactly 1.5×.
    expect(speedToFit(36000, 24000)).toMatchObject({ kind: 'free', speed: 1.5 });
    // 10 h in 7 h needs 1.4286× → 1.45×.
    const fit = speedToFit(36000, 25200)!;
    expect(fit.speed).toBe(1.45);
    expect(fit.watch).toBeLessThanOrEqual(25200);
    expect(fit.spare).toBeCloseTo(25200 - 36000 / 1.45, 6);
    // Exactly 2× is still free.
    expect(speedToFit(7200, 3600)).toMatchObject({ kind: 'free', speed: 2 });
  });

  it('flags speeds that need YouTube Premium', () => {
    expect(speedToFit(7200, 3500)).toMatchObject({ kind: 'premium', speed: 2.1 });
    expect(speedToFit(14400, 3600)).toMatchObject({ kind: 'premium', speed: 4 });
  });

  it('says when even 4× is not enough', () => {
    expect(speedToFit(14400, 3500)).toEqual({ kind: 'impossible', speed: 4, watch: 3600, spare: 0 });
  });

  it('never rounds a speed down below what is needed', () => {
    for (let available = 1000; available < 10000; available += 37) {
      const fit = speedToFit(10000, available)!;
      if (fit.kind === 'free' || fit.kind === 'premium') expect(fit.watch).toBeLessThanOrEqual(available + 1e-6);
    }
  });

  it('ignores empty input', () => {
    expect(speedToFit(0, 100)).toBeNull();
    expect(speedToFit(100, 0)).toBeNull();
    expect(speedToFit(100, Number.NaN)).toBeNull();
  });
});
