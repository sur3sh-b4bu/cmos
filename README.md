# Church Office Management System (COMS)

A production-ready system for parish office staff to manage prayer intentions,
issue baptism/marriage/death certificates, print the daily Mass register,
maintain church records, and generate reports.

- **Frontend:** Angular 21 (standalone components, signals, zoneless change
  detection), Angular Material, hand-rolled SVG charts, SCSS design system
  (white / blue / gold, light + dark mode, glassmorphism)
- **Backend:** Node.js + Express, repository-pattern architecture
- **Database:** MySQL 8
- **Auth:** JWT access tokens (in-memory) + rotating httpOnly-cookie refresh
  tokens, bcrypt password hashing, account lockout, RBAC

## Highlights

- **Prayer Intentions** — the system's primary, highest-priority module.
  Covers the full office workflow: take a prayer intention → auto-numbered
  receipt (PDF, with QR code) → on the Mass date, print the **Daily Prayer
  Register** (A4 PDF, grouped by Mass, serial-numbered, repeating header
  across pages) → mark intentions completed after Mass.
- **Certificates** — Baptism, Marriage, Death, each with atomically-numbered
  certificates and a formal printable PDF certificate.
- **Masters** — every dropdown in the app (26 tables: church setup, prayer
  categories, mass schedule, geography, RBAC-adjacent lookups, print/email/SMS
  templates, receipt & certificate numbering series...) is admin-editable
  through one generic, config-driven CRUD engine — nothing is hardcoded.
- **Reports** — Prayer Intentions, Collections/Donations, and Certificates
  reports, each with Today/Week/Month/Year/Custom date-range presets, summary
  cards, charts, and Excel export.
- **Settings** — user management (with auto-generated temp passwords), a
  per-role permission matrix, and a full audit log of who did what and when.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env        # then edit .env with your local MySQL credentials
npm install
npm run db:setup            # runs migrations, then seeds initial data
npm run dev                 # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm start                   # http://localhost:4200
```

Log in with the seeded admin account: **username `admin`**, **password
`Admin@12345`** (you'll be required to change it on first login).

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for a fuller walkthrough
(including troubleshooting) and [`docs/API.md`](docs/API.md) for the REST API
reference.

## Project structure

```
backend/
  database/
    migrations/     versioned SQL, applied in order by database/migrate.js
    seed.js          idempotent initial-data seed
  src/
    config/          env loading, DB pool, master/certificate registries
    controllers/      thin HTTP layer
    services/         business logic
    repositories/      SQL access (Repository Pattern)
    middlewares/       auth, RBAC, validation, rate limiting, error handling
    routes/
    reports/           PDF generation (receipts, register, certificates)
    validators/         zod schemas

frontend/
  src/app/
    core/              auth, guards, interceptors, shared services/models
    layout/            shell, header, sidebar
    shared/            reusable components (DataTable, charts, dialogs...)
    features/          one folder per module (dashboard, prayer-intentions,
                        certificates, reports, masters, settings, auth)
```

## Notes on a few deliberate deviations from a literal reading of the spec

- **No AG Grid.** It requires a paid Enterprise license; per explicit
  instruction, the app uses a hand-built Angular Material `DataTable`
  component instead (sort/filter/paginate/column-chooser/Excel export), with
  no functionality lost and no license dependency.
- **Reports** are consolidated into three types (Prayer Intentions,
  Collections/Donations, Certificates) rather than eleven near-duplicate
  pages, since the schema doesn't distinguish some of the originally listed
  report types as separate data (e.g. there's no separate donations table —
  offerings live on `prayer_intentions`; "Birth Reports" has no dedicated
  table and is covered via Baptism's `date_of_birth`). Daily/Monthly/Yearly/
  Custom are date-range presets over the same three reports, not separate
  logic, since granularity isn't a different report.
- **Confirmation/First Communion/Family Register/...** (the "Future Modules"
  list in the spec) are intentionally not built — the architecture (the
  master registry + generic CRUD engine, the certificate registry pattern)
  is designed so adding one is mostly configuration, not a rewrite.
