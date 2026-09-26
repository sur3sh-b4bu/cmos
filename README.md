<div align="center">

# ⛪ Church Office Management System (COMS)

**Mass Intentions, Contributions, certificates, the daily register, and reports —**
**for one church, or many, under a single shared deployment.**

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Material](https://img.shields.io/badge/Angular_Material-standalone_%2B_signals-3F51B5?logo=angular&logoColor=white)

</div>

---

## Contents

- [Stack](#stack)
- [Highlights](#highlights)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Deliberate deviations from a literal reading of the spec](#notes-on-a-few-deliberate-deviations-from-a-literal-reading-of-the-spec)

---

## Stack

| Layer | Choice |
|---|---|
| **Frontend** | Angular 21 — standalone components, signals, zoneless change detection, Angular Material, hand-rolled SVG charts, SCSS design system (white / blue / gold, light + dark mode, glassmorphism) |
| **Backend** | Node.js + Express, repository-pattern architecture |
| **Database** | MySQL 8 |
| **Auth** | Server-side sessions (one httpOnly `sid` cookie, stored in the `sessions` table), bcrypt password hashing, RBAC. No JWTs, no login lockout or login attempt limits |

---

## Highlights

🙏 **Mass Intentions** — the system's primary, highest-priority module. Covers
the full office workflow: take a Mass Intention booking → separately record
payment received (cash, UPI, cheque, bank transfer) once it actually
happens → auto-numbered receipt (PDF, with a QR code parishioners can scan)
→ on the Mass date, print the **Daily Prayer Register** (A4 PDF, grouped by
Mass, serial-numbered, repeating header across pages). "Paid" is defined
purely by a recorded payment existing — there's no separate manual status.

💰 **Contributions** — the same booking → payment → receipt workflow as Mass
Intentions, for general donations not tied to a Mass.

📜 **Certificates** — Baptism, Marriage, Death, each with atomically-numbered
certificates, a formal printable PDF certificate, and a filter bar (Priest,
Gender, date ranges) alongside full-text search.

🗂️ **Masters** — every dropdown in the app (26 tables: church setup, prayer
categories, mass schedule, geography, RBAC-adjacent lookups, print/email/SMS
templates, receipt & certificate numbering series...) is admin-editable
through one generic, config-driven CRUD engine — nothing is hardcoded.

📊 **Reports** — Mass Intentions, Collections, Contributions, and Certificates
reports, each with Today/Week/Month/Year/Custom date-range presets, summary
cards, charts, and Excel export.

⚙️ **Settings** — user management (with auto-generated temp passwords), a
per-role permission matrix (including custom, church-specific roles a
church admin can define alongside the fixed system roles), and a full
audit log of who did what and when.

🏛️ **Multi-church** — every church-scoped table (masses, priests, branches,
holidays, receipt/certificate numbering, ...) is isolated per church at the
database layer; a regular admin only ever sees/edits their own church's
data. A **Master Administrator** role sits above every church: it can
browse all of them at once ("Central Management": a Church Network Overview with organization-wide analytics for
Mass Intentions, the Daily Prayer Register, certificates, contributions and reports, each filterable by church, branch
and period) or switch to act as one
specific church/branch via a Change Church & Branch control, and can create
a Masters record or a custom role under several churches at once (a
checkbox picker with "select all") instead of one at a time.

---

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

`db:setup` seeds two separate logins:

**Admin** — access to one church only
- Username: `admin`
- Password: `Admin@12345`
- To change these defaults, set `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`
  in `.env` before running `db:setup`

**Master Administrator** — access to every church
- Username: `masteradmin`
- Password: `MasterAdmin@12345`
- To change these defaults, set `SEED_MASTER_ADMIN_USERNAME` and
  `SEED_MASTER_ADMIN_PASSWORD` in `.env` before running `db:setup`

Both passwords must be changed on first login.

📖 See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for a fuller walkthrough
(including troubleshooting) and [`docs/API.md`](docs/API.md) for the REST API
reference.

---

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
    features/          one folder per module (dashboard, mass-intentions,
                        contributions, certificates, reports, masters,
                        settings, authentication)
```

---

## Notes on a few deliberate deviations from a literal reading of the spec

- **No AG Grid.** It requires a paid Enterprise license; per explicit
  instruction, the app uses a hand-built Angular Material `DataTable`
  component instead (sort/filter/paginate/column-chooser/Excel export), with
  no functionality lost and no license dependency.
- **Reports** are consolidated into four types (Mass Intentions, Collections,
  Contributions, Certificates) rather than eleven near-duplicate pages, since
  several of the originally listed report types aren't actually separate data
  (e.g. "Birth Reports" has no dedicated table and is covered via Baptism's
  `date_of_birth`). Daily/Monthly/Yearly/Custom are date-range presets over
  the same four reports, not separate logic, since granularity isn't a
  different report.
- **Confirmation/First Communion/Family Register/...** (the "Future Modules"
  list in the spec) are intentionally not built — the architecture (the
  master registry + generic CRUD engine, the certificate registry pattern)
  is designed so adding one is mostly configuration, not a rewrite.
