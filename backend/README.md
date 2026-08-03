# COMS Backend

Node.js + Express + MySQL. See the [repository root README](../README.md)
for the full project overview, [`docs/INSTALLATION.md`](../docs/INSTALLATION.md)
for setup, and [`docs/API.md`](../docs/API.md) for the REST API reference.

## Commands

```bash
npm run dev          # dev server with auto-reload, http://localhost:4000
npm start             # production start (no auto-reload)
npm run migrate        # apply any new SQL files in database/migrations/
npm run seed            # idempotent initial-data seed
npm run db:setup         # migrate + seed
npm run fonts:extract     # re-extract Roboto TTFs from pdfmake (runs automatically post-install)
npm test                   # Jest
```

## Structure

```
database/
  migrations/    versioned SQL (001_..., 002_..., applied in order, tracked
                 in a schema_migrations table so re-runs are safe)
  seed.js         idempotent — checks each table before inserting
src/
  config/         env loading, MySQL pool, masterRegistry.js, certificateRegistry.js
  controllers/     thin HTTP layer — no business logic
  services/         business logic (validation, orchestration, audit logging)
  repositories/      all SQL lives here (Repository Pattern)
  middlewares/        authenticate, authorize (RBAC), validate (zod), rate limiting
  reports/             PDF generation: receiptPdf, dailyRegisterPdf, certificatePdf
  routes/
```

## Repository Pattern in practice

Two registries (`config/masterRegistry.js`, `config/certificateRegistry.js`)
declare table/column/validation metadata once; one generic repository +
controller per registry drives every table it lists. Adding a new master
table or certificate type is a config entry, not a new file per table.

## Auth model

Access tokens are short-lived JWTs (embed the user's permission list, so
most requests need zero extra DB round-trip for authorization). Refresh
tokens are opaque random strings, stored only as a SHA-256 hash, delivered
as an httpOnly cookie, and rotated on every use (the old row is marked
`revoked_at` and linked to its replacement).
