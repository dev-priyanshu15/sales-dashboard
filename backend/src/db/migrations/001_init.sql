-- Users ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jobs: one row per uploaded file --------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_rows      INTEGER NOT NULL DEFAULT 0,
    processed_rows  INTEGER NOT NULL DEFAULT 0,
    valid_rows      INTEGER NOT NULL DEFAULT 0,
    invalid_rows    INTEGER NOT NULL DEFAULT 0,
    duplicate_rows  INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs (user_id, created_at DESC);

-- Raw transaction rows --------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id                SERIAL PRIMARY KEY,
    job_id            INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    row_number        INTEGER NOT NULL,
    transaction_id    TEXT,
    region            TEXT,
    product_category  TEXT,
    quantity          NUMERIC,
    unit_price        NUMERIC,
    discount_percent  NUMERIC,
    transaction_date  DATE,
    net_amount        NUMERIC,
    validation_status TEXT NOT NULL DEFAULT 'pending'
                      CHECK (validation_status IN ('pending', 'valid', 'invalid', 'duplicate')),
    error_reasons     TEXT[],
    raw_data          JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_txn_job_status ON transactions (job_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_txn_job_amount ON transactions (job_id, net_amount DESC);

-- Aggregate reports: one per aggregation run ----------------------------
CREATE TABLE IF NOT EXISTS reports (
    id         SERIAL PRIMARY KEY,
    job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    metrics    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_job ON reports (job_id, created_at DESC);
