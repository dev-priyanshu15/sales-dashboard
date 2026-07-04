import { rules } from './rules.js';
import type { RawRow, ValidationResult } from '../types/index.js';

// Runs every rule and collects ALL failures (not just the first),
// so the error report tells the user everything wrong with a row.
export function validateRow(raw: RawRow): ValidationResult {
  const errors = rules.filter((rule) => !rule.check(raw)).map((rule) => rule.message);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    row: {
      transactionId: raw.transaction_id.trim(),
      region: raw.region.trim(),
      productCategory: raw.product_category.trim(),
      quantity: Number(raw.quantity),
      unitPrice: Number(raw.unit_price),
      discountPercent: Number(raw.discount_percent),
      transactionDate: raw.transaction_date.trim(),
    },
  };
}
