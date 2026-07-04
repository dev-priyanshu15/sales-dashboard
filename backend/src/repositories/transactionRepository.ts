import { pool } from '../config/db.js';
import type { RawRow, ValidRow } from '../types/index.js';

export interface PendingRow {
  id: number;
  rowNumber: number;
  raw: RawRow;
}

export const transactionRepository = {
  // Bulk insert raw rows in chunks using multi-row VALUES.
  // 10k rows => ~20 queries instead of 10k round trips.
  async insertRawRows(jobId: number, rows: RawRow[]): Promise<void> {
    const CHUNK = 500;
    for (let offset = 0; offset < rows.length; offset += CHUNK) {
      const chunk = rows.slice(offset, offset + CHUNK);
      const values: unknown[] = [];
      const placeholders = chunk
        .map((row, i) => {
          values.push(jobId, offset + i + 1, row.transaction_id ?? null, JSON.stringify(row));
          const base = i * 4;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
        })
        .join(', ');

      await pool.query(
        `INSERT INTO transactions (job_id, row_number, transaction_id, raw_data)
         VALUES ${placeholders}`,
        values
      );
    }
  },

  // Marks every repeat of a transaction_id (keeping the FIRST
  // occurrence by row_number) as duplicate, in one SQL statement.
  async markDuplicates(jobId: number): Promise<number> {
    const { rowCount } = await pool.query(
      `UPDATE transactions SET validation_status = 'duplicate',
              error_reasons = ARRAY['duplicate transaction_id']
       WHERE job_id = $1
         AND transaction_id IS NOT NULL AND transaction_id <> ''
         AND id NOT IN (
           SELECT MIN(id) FROM transactions
           WHERE job_id = $1 AND transaction_id IS NOT NULL AND transaction_id <> ''
           GROUP BY transaction_id
         )`,
      [jobId]
    );
    return rowCount ?? 0;
  },

  async fetchPendingRows(jobId: number): Promise<PendingRow[]> {
    const { rows } = await pool.query(
      `SELECT id, row_number, raw_data FROM transactions
       WHERE job_id = $1 AND validation_status = 'pending'
       ORDER BY row_number`,
      [jobId]
    );
    return rows.map((r) => ({ id: r.id, rowNumber: r.row_number, raw: r.raw_data }));
  },

  // One UPDATE for a whole batch of validated rows, joined against a
  // VALUES list — 50 rows = 1 round trip instead of 50.
  async markValidBatch(items: { id: number; row: ValidRow; netAmount: number }[]): Promise<void> {
    if (items.length === 0) return;
    const values: unknown[] = [];
    const tuples = items
      .map((item, i) => {
        values.push(
          item.id,
          item.row.region,
          item.row.productCategory,
          item.row.quantity,
          item.row.unitPrice,
          item.row.discountPercent,
          item.row.transactionDate,
          item.netAmount
        );
        const b = i * 8;
        return `($${b + 1}::int, $${b + 2}, $${b + 3}, $${b + 4}::numeric, $${b + 5}::numeric, $${b + 6}::numeric, $${b + 7}::date, $${b + 8}::numeric)`;
      })
      .join(', ');

    await pool.query(
      `UPDATE transactions AS t
       SET validation_status = 'valid', region = v.region, product_category = v.product_category,
           quantity = v.quantity, unit_price = v.unit_price, discount_percent = v.discount_percent,
           transaction_date = v.transaction_date, net_amount = v.net_amount, error_reasons = NULL
       FROM (VALUES ${tuples})
         AS v(id, region, product_category, quantity, unit_price, discount_percent, transaction_date, net_amount)
       WHERE t.id = v.id`,
      values
    );
  },

  async markInvalidBatch(items: { id: number; errors: string[] }[]): Promise<void> {
    if (items.length === 0) return;
    const values: unknown[] = [];
    const tuples = items
      .map((item, i) => {
        values.push(item.id, item.errors);
        return `($${i * 2 + 1}::int, $${i * 2 + 2}::text[])`;
      })
      .join(', ');

    await pool.query(
      `UPDATE transactions AS t
       SET validation_status = 'invalid', error_reasons = v.errors
       FROM (VALUES ${tuples}) AS v(id, errors)
       WHERE t.id = v.id`,
      values
    );
  },

  // Every row + outcome, for the annotated results download.
  async fetchAllForExport(
    jobId: number
  ): Promise<
    { rowNumber: number; raw: RawRow; status: string; netAmount: number | null; errors: string[] | null }[]
  > {
    const { rows } = await pool.query(
      `SELECT row_number, raw_data, validation_status, net_amount::float AS net_amount, error_reasons
       FROM transactions WHERE job_id = $1 ORDER BY row_number`,
      [jobId]
    );
    return rows.map((r) => ({
      rowNumber: r.row_number,
      raw: r.raw_data,
      status: r.validation_status,
      netAmount: r.net_amount,
      errors: r.error_reasons,
    }));
  },

  async countByStatus(jobId: number): Promise<Record<string, number>> {
    const { rows } = await pool.query(
      `SELECT validation_status, COUNT(*)::int AS count
       FROM transactions WHERE job_id = $1 GROUP BY validation_status`,
      [jobId]
    );
    const counts: Record<string, number> = { valid: 0, invalid: 0, duplicate: 0, pending: 0 };
    for (const r of rows) counts[r.validation_status] = r.count;
    return counts;
  },
};

export type TransactionRepository = typeof transactionRepository;
