import { describe, expect, it } from 'vitest';
import { runWithConcurrency, sleep } from './concurrency.js';

describe('runWithConcurrency', () => {
  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const seen: number[] = [];
    await runWithConcurrency(items, 10, async (item) => {
      seen.push(item);
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await runWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 5, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight -= 1;
    });
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1); // and it actually ran concurrently
  });

  it('is faster than sequential execution', async () => {
    const start = Date.now();
    await runWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 10, () => sleep(20));
    const elapsed = Date.now() - start;
    // sequential would be 20 * 20ms = 400ms; pool of 10 ≈ 2 waves ≈ 40ms
    expect(elapsed).toBeLessThan(200);
  });

  it('handles an empty item list', async () => {
    await expect(runWithConcurrency([], 5, async () => {})).resolves.toBeUndefined();
  });
});
