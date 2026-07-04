import { describe, expect, it } from 'vitest';
import { computeNetAmount, computeDiscountLoss } from './pricing.js';

describe('computeNetAmount', () => {
  it('applies the discount to quantity * unit_price', () => {
    // 3 * 499.99 = 1499.97, minus 10% = 1349.973 -> rounded
    expect(computeNetAmount(3, 499.99, 10)).toBe(1349.97);
  });

  it('returns the gross amount when discount is 0', () => {
    expect(computeNetAmount(12, 15.5, 0)).toBe(186);
  });

  it('returns 0 when discount is 100', () => {
    expect(computeNetAmount(5, 20, 100)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    // 1 * 0.115 * 0.9 = 0.1035 -> 0.10
    expect(computeNetAmount(1, 0.115, 10)).toBe(0.1);
  });
});

describe('computeDiscountLoss', () => {
  it('is the gross minus net for a row', () => {
    const gross = 3 * 499.99;
    expect(computeDiscountLoss(3, 499.99, 10)).toBe(Math.round(gross * 0.1 * 100) / 100);
  });

  it('is 0 when there is no discount', () => {
    expect(computeDiscountLoss(4, 100, 0)).toBe(0);
  });
});
