# Sales Data Processing & Analytics Pipeline

A full-stack system that ingests bulk sales CSV files, validates and processes rows **concurrently** through a queue-backed worker pool, computes analytical metrics in SQL, and presents everything on a live dashboard with per-user isolation.

**Stack:** Node.js + Express + TypeScript · PostgreSQL · Redis + BullMQ · React (Vite) + Recharts

## Quick start

Prerequisites: Node 20+, Docker Desktop.

```bash
# 1. Configure + start Postgres and Redis
cp .env.example .env            # infrastructure credentials/ports (compose reads this)
cp backend/.env.example backend/.env  # app config (DB URL, JWT secret, worker tuning)
docker compose up -d

# 2. Backend (terminal 1) — starts API (:4000) AND the queue worker together
cd backend
npm install
npm run migrate
npm run dev

# 3. Frontend (terminal 2) — dashboard on :5173
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, sign up, upload `sample-data/sample.csv` (contains every error case) or `sample-data/large-sample.csv` (2,000 rows — watch the progress bar).

> Postgres is mapped to host port **5434** (5432 was taken by a local install); Redis on 6379. All infrastructure values (DB credentials, ports) live in the root `.env`, which docker-compose substitutes into `docker-compose.yml` — no credentials are committed. App-level config lives in `backend/.env`; both files are gitignored with committed `.env.example` templates.

## Architecture

```
React dashboard ──── REST (/api, Vite proxy) ────► Express API ────► PostgreSQL
      │                                                │                ▲
      │ polling (1.5–2s while a job is active)         │ enqueue        │ SQL aggregation,
      └────────────────────────────────────────────    ▼                │ batched row updates
                                                   BullMQ (Redis)       │
                                                       │                │
                                                       ▼                │
                                              Worker process ───────────┘
                                        (pool of N concurrent row processors)
```

**Flow:** upload CSV → API parses it, bulk-inserts raw rows, creates a `pending` job → user triggers processing → job enqueued to BullMQ → worker marks duplicates in one SQL pass, then validates/computes remaining rows through a concurrency pool (default 10 workers, 25ms simulated cost per row) → progress counter updates as it goes → on completion, aggregate metrics are computed in SQL and stored as a report → dashboard polls, then renders charts.

### Backend layering (SOLID)

```
routes → controllers → services → repositories → Postgres
                 (wired together in container.ts)
```

- **routes/** — URL wiring only (plus auth middleware and rate limits)
- **controllers/** — translate HTTP ⇄ service calls, no business logic
- **services/** — business rules (auth, upload, reports); receive dependencies via factory functions so they're unit-testable with fakes (Dependency Inversion)
- **repositories/** — the only layer that runs SQL
- **validators/** — row rules as a data array (`rules.ts`); adding a rule = appending an entry, no pipeline changes (Open/Closed)
- **workers/** — queue consumer + the concurrent row processor
- The `net_amount` formula exists in exactly one function (`services/pricing.ts`) — DRY where it matters

### Database (4 tables)

| Table | Purpose |
|---|---|
| `users` | email, bcrypt hash, role (`user`/`admin`) |
| `jobs` | one per upload; status `pending → processing → completed/failed`, row counters for live progress |
| `transactions` | every raw row (JSONB) + parsed fields + `validation_status` (`valid`/`invalid`/`duplicate`) + error reasons; indexed on `(job_id, validation_status)` and `(job_id, net_amount DESC)` |
| `reports` | one JSONB metrics document per aggregation run |

Every user-facing query includes `WHERE user_id = $current_user` at the repository layer, so ownership isn't left to controllers to remember.

### Validation

Each row is checked against all rules (all failures collected, not just the first): required fields present, quantity/price positive numbers, discount 0–100, date valid and not in the future. Duplicate `transaction_id`s are flagged in a single SQL pass that keeps the first occurrence. **Bad rows never crash the pipeline** — they're flagged with reasons and surface in the job summary and the annotated export.

### Concurrency

`utils/concurrency.ts` implements a minimal worker pool: N workers pull rows off a shared cursor, so fast rows never wait on slow ones. Each row carries an artificial 25ms delay (configurable via `ROW_PROCESSING_DELAY_MS`) to simulate real cost. Measured result: **2,000 rows = 50s sequential-equivalent, completed in 7.4s** with 10 workers. On top of that, BullMQ gives queued background jobs, retries (3 attempts, exponential backoff), and survival across API restarts.

### Aggregation — all in SQL

Total revenue, revenue by region/category, average (`AVG`), **median** (`PERCENTILE_CONT(0.5)`), std deviation (`STDDEV`), top-5 (`ORDER BY net_amount DESC LIMIT 5`), daily and monthly trends (`GROUP BY` date / `date_trunc('month')`), and discount impact (`SUM(gross) − SUM(net)`). At 10k+ rows the database does one pass over an indexed table instead of streaming rows to JS. Reports are computed automatically on job completion and re-runnable on demand (`POST /api/jobs/:id/aggregate`).

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` / `/api/auth/login` | JWT auth (bcrypt-hashed passwords) |
| POST | `/api/jobs/upload` | multipart CSV upload (rate-limited) |
| POST | `/api/jobs/:id/process` | trigger processing manually |
| GET | `/api/jobs` / `/api/jobs/:id` | job list / status + progress counters |
| GET | `/api/jobs/:id/report` | latest aggregate metrics |
| POST | `/api/jobs/:id/aggregate` | re-run aggregation |
| GET | `/api/jobs/:id/export` | annotated results CSV (every row + status + errors) |

## Testing & CI

```bash
cd backend
npm test           # 18 unit tests: validation rules, pricing math, worker pool
npm run test:watch # re-runs on save while developing
npm run typecheck  # full TypeScript check (dev servers don't typecheck)
```

Tests cover the pure core: every validation rule (including the spec's four trap rows), `net_amount` rounding, and the worker pool's concurrency limit — testable without a database because the logic lives in pure functions. GitHub Actions (`.github/workflows/ci.yml`) runs typecheck + tests + builds for both packages on every push, plus a smoke test that boots the API against real Postgres/Redis service containers and hits `/health`.

## Observability

Structured JSON logging via pino (pretty-printed in dev): every request (method/path/status/duration/user), row-level validation warnings, job start/end with duration, and **`jobId` as a correlation ID** on every log line inside the pipeline (`logger.child({ jobId })`). Log levels: debug/info/warn/error.

**Metrics:** each completed job logs `avgRowMs` (average per-row processing time), and `GET /health` exposes system-wide numbers — total jobs, **job failure rate**, and average job duration — computed in one SQL pass.

## Design decisions & tradeoffs

- **BullMQ + Redis over an in-process pool** — real background jobs, retries, and restart survival for one docker-compose service. Tradeoff: an extra moving part and a separate worker process to run.
- **Duplicate = repeated `transaction_id`** (per the requirements). The spec's sample calls TXN-1005 a "duplicate" of TXN-1001 even though its ID differs — content-identical rows with unique IDs are treated as valid; `sample.csv` adds a genuinely repeated ID to demonstrate the duplicate path.
- **Polling over WebSockets** — 1.5s polling is visually indistinguishable for a progress bar and removes a whole class of connection-management code. The `processed_rows` counter design would feed a WebSocket unchanged if upgraded.
- **Aggregation in SQL, not JS** — the whole point of putting rows in Postgres; median/stddev are one function call away.
- **Missing `discount_percent` is invalid, not defaulted to 0** — silently inventing a 0% discount would fabricate revenue numbers; flagged instead (TXN-1007 demonstrates).
- **Multer memory storage** — files in scope (10k rows ≈ a few MB) don't justify disk/stream plumbing; a 20MB cap rejects abuse.
- **Manual DI via factory functions** (`container.ts`) instead of a framework — the same testability with ~20 lines and no magic.
- **`net_amount` rounded to 2 decimals per row** at the single computation site, so every aggregate downstream agrees.

## How AI tools were used

This project was built in a pair-programming loop with Claude Code (Anthropic). The workflow: I set the requirements, architecture direction, and design constraints (SOLID/DRY layering, TypeScript, explainability of every module); the AI proposed the phase plan, generated the layer-by-layer implementation, and executed verification at every step — booting the server, running migrations, uploading the spec's sample CSV, and hand-checking the computed metrics (row counts, net amounts, median, discount loss) against expected values before moving to the next phase. Issues found and fixed along the way included a host port collision with a local Postgres install, an ioredis/BullMQ type conflict, and a Vite scaffold that generated the wrong template. All design tradeoffs listed above were discussed and decided explicitly rather than accepted as defaults.

## Project structure

```
sales-dashboard/
├── docker-compose.yml        # Postgres (:5434) + Redis (:6379)
├── sample-data/              # sample.csv (error cases), large-sample.csv (2k rows)
├── backend/
│   └── src/
│       ├── config/           # env, pg pool, redis options
│       ├── db/migrations/    # plain SQL, applied once each by migrate.ts
│       ├── middleware/       # auth guard, error handler, rate limits, request log
│       ├── validators/       # rule list + row validator
│       ├── repositories/     # ALL SQL: users, jobs, transactions, reports
│       ├── services/         # auth, jobs, reports, pricing (net_amount)
│       ├── queue/            # BullMQ producer
│       ├── workers/          # queue consumer + concurrent row processor
│       ├── controllers/ routes/ container.ts app.ts index.ts
└── frontend/
    └── src/
        ├── api/client.ts     # fetch wrapper (token, errors) — components never call fetch
        ├── auth.tsx          # auth context (JWT in localStorage)
        ├── pages/            # Login, Dashboard (upload + jobs), Job (progress + report)
        └── components/       # Recharts charts + stat tiles
```
