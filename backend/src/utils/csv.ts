import { parse } from 'csv-parse/sync';
import { HttpError } from '../middleware/errorHandler.js';
import type { RawRow } from '../types/index.js';

// Parses an uploaded CSV buffer into raw string records keyed by the
// header row. Structural problems (bad quoting, inconsistent column
// counts) are a 400 for the whole file; per-row DATA problems are
// handled later by the validator, never here.
export function parseCsvBuffer(buffer: Buffer): RawRow[] {
  try {
    return parse(buffer, {
      columns: true,          // first line = header names
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // short rows become missing fields -> caught by validation
    }) as RawRow[];
  } catch (err) {
    throw new HttpError(400, `Could not parse CSV file: ${(err as Error).message}`);
  }
}
