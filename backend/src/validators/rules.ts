import type { RawRow } from '../types/index.js';

export interface ValidationRule {
  name: string;
  message: string;
  // Returns true when the row PASSES this rule.
  check: (row: RawRow) => boolean;
}

export const REQUIRED_FIELDS = [
  'transaction_id',
  'region',
  'product_category',
  'quantity',
  'unit_price',
  'discount_percent',
  'transaction_date',
] as const;

function isFiniteNumber(value: string): boolean {
  return value !== undefined && value !== '' && Number.isFinite(Number(value));
}

// yyyy-mm-dd that parses to a real calendar date
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Open/Closed principle: to add a validation rule, append an entry —
// nothing else in the pipeline changes.
export const rules: ValidationRule[] = [
  {
    name: 'required_fields',
    message: 'One or more required fields are missing or empty',
    check: (row) => REQUIRED_FIELDS.every((f) => row[f] !== undefined && row[f].trim() !== ''),
  },
  {
    name: 'quantity_positive_number',
    message: 'quantity must be a number greater than 0',
    check: (row) => isFiniteNumber(row.quantity) && Number(row.quantity) > 0,
  },
  {
    name: 'unit_price_positive_number',
    message: 'unit_price must be a number greater than 0',
    check: (row) => isFiniteNumber(row.unit_price) && Number(row.unit_price) > 0,
  },
  {
    name: 'discount_in_range',
    message: 'discount_percent must be a number between 0 and 100',
    check: (row) =>
      isFiniteNumber(row.discount_percent) &&
      Number(row.discount_percent) >= 0 &&
      Number(row.discount_percent) <= 100,
  },
  {
    name: 'date_valid_not_future',
    message: 'transaction_date must be a valid date and not in the future',
    check: (row) =>
      isValidDate(row.transaction_date) && new Date(row.transaction_date) <= new Date(),
  },
];
