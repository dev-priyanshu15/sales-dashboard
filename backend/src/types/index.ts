// Shared domain types used across layers.

export type Role = 'user' | 'admin';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  role: Role;
}

// What we embed in the JWT — never the password hash.
export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: Role;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: number;
  userId: number;
  filename: string;
  status: JobStatus;
  totalRows: number;
  processedRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

// One CSV row exactly as uploaded — all strings, nothing trusted yet.
export type RawRow = Record<string, string>;

// A row that passed validation, with parsed numeric/date fields.
export interface ValidRow {
  transactionId: string;
  region: string;
  productCategory: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  transactionDate: string; // ISO yyyy-mm-dd
}

export type ValidationResult =
  | { ok: true; row: ValidRow }
  | { ok: false; errors: string[] };
