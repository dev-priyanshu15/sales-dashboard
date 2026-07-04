import { describe, expect, it } from 'vitest';
import { validateRow } from './rowValidator.js';
import type { RawRow } from '../types/index.js';

// A row that passes every rule; tests override single fields to
// prove each rule fires independently.
function goodRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    transaction_id: 'TXN-1',
    region: 'North',
    product_category: 'Electronics',
    quantity: '3',
    unit_price: '499.99',
    discount_percent: '10',
    transaction_date: '2025-01-15',
    ...overrides,
  };
}

describe('validateRow', () => {
  it('accepts a fully valid row and parses numeric fields', () => {
    const result = validateRow(goodRow());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.quantity).toBe(3);
      expect(result.row.unitPrice).toBe(499.99);
      expect(result.row.discountPercent).toBe(10);
    }
  });

  it('rejects negative quantity (spec row TXN-1003)', () => {
    const result = validateRow(goodRow({ quantity: '-2' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('quantity must be a number greater than 0');
  });

  it('rejects non-numeric unit_price (spec row TXN-1006)', () => {
    const result = validateRow(goodRow({ unit_price: 'abc' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('unit_price must be a number greater than 0');
  });

  it('rejects a future date (spec row TXN-1007)', () => {
    const result = validateRow(goodRow({ transaction_date: '2099-01-01' }));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContain('transaction_date must be a valid date and not in the future');
  });

  it('rejects missing required fields', () => {
    const result = validateRow(goodRow({ region: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContain('One or more required fields are missing or empty');
  });

  it('rejects discount outside 0-100', () => {
    expect(validateRow(goodRow({ discount_percent: '101' })).ok).toBe(false);
    expect(validateRow(goodRow({ discount_percent: '-5' })).ok).toBe(false);
    expect(validateRow(goodRow({ discount_percent: '0' })).ok).toBe(true);
    expect(validateRow(goodRow({ discount_percent: '100' })).ok).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(validateRow(goodRow({ transaction_date: '2025-02-30' })).ok).toBe(false);
    expect(validateRow(goodRow({ transaction_date: 'not-a-date' })).ok).toBe(false);
  });

  it('collects ALL failures on a row, not just the first', () => {
    const result = validateRow(goodRow({ quantity: '-1', unit_price: 'abc' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
