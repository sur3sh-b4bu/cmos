# Installation Guide

## Prerequisites

| Tool | Version used in development | Notes |
|---|---|---|
| Node.js | 22.x | 18+ should work; the app has no Node-version-specific features |
| npm | 10.x | ships with Node |
| MySQL | 8.0 | must be reachable from where you run the backend |
| Angular CLI | 21.x | installed automatically via `npx` in the commands below — no global install needed |

You do **not** need an AG Grid license, a paid font, or any other paid
dependency to run this app. Every PDF (receipts, the daily register,
certificates) renders with the Roboto font bundled inside `pdfmake` itself
(Apache-2.0), extracted once by `npm run fonts:extract` (this also runs
automatically after `npm install` via the `postinstall` script).

## 1. Database

Make sure MySQL is running and reachable. The seed/migration scripts will
**create** the `coms_db` database for you — you only need a MySQL user with
permission to create databases and tables (the default `root` user is fine
for local development).

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` — at minimum, set your MySQL credentials:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=coms_db
```

Then:

```bash
npm install          # also extracts PDF fonts (postinstall)
npm run db:setup      # runs all migrations, then seeds initial data
npm run dev            # starts the API on http://localhost:4000 with auto-reload
```

`npm run db:setup` is idempotent — safe to re-run. It prints the seeded admin
login to the console on first run:

```
Admin login created -> username: admin  password: Admin@12345
You will be required to change this password on first login.
```

### Backend environment variables (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | `development` or `production` | `development` |
| `PORT` | API port | `4000` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL connection | — |
| `DB_CONNECTION_LIMIT` | mysql2 pool size | `10` |
| `SESSION_EXPIRES_IN` | How long an idle login session stays valid (days, e.g. `7d`); extended on every request | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:4200` |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Only used by `database/seed.js` on first run | `admin` / `Admin@12345` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | General API rate limiting | 15 min / 300 requests |

## 3. Frontend

```bash
cd frontend
npm install
npm start   # http://localhost:4200, proxies API calls to http://localhost:4000/api in dev
```

The dev build reads `src/environments/environment.ts` for the API base URL
(`http://localhost:4000/api`). The production build (`npm run build --
--configuration production`) swaps in `environment.production.ts`
(`apiBaseUrl: '/api'`) — when deploying, serve the built frontend behind the
same origin as the API (or a reverse proxy) so that path resolves, or edit
that file to point at your API's real URL.

## 4. First login

Open http://localhost:4200, sign in with the seeded admin account, and you'll
be forced to set a new password immediately. From there:

- **Masters** → review/edit the seeded church, mass schedule, and prayer
  intention dropdown to match your parish.
- **Settings → User Management** → create real staff accounts (each gets an
  auto-generated temporary password shown once — share it securely).
- **Settings → Roles & Permissions** → adjust what each role can do (the
  Administrator role is protected and can't be edited, to prevent lockout).

## Adding another church

As the Master Administrator: **Masters → Churches → New**, enter the name, and save. A
**"Set up …" popup** then opens (it also opens whenever an administrator enters a church that
is not fully set up, and a yellow reminder bar stays until it is finished). It asks for what a
church needs before its office can save records — receipt-number and certificate-number
prefixes, and the Mass schedule — with suggested values already filled in, plus an optional
**Church administrator** (name and username) and an optional branch and parish priest.
A new church starts with **no users at all**; nobody but the Master Administrator can enter it
until an administrator is created. If you fill in the administrator section, the popup then shows
the new login and a temporary password **once** — copy it and give it to that person, who must
choose a new password at first sign-in. If it is lost, reset it under **Settings → Users**.
Choose **Do this later** to skip the popup; nothing is lost, and everything (including creating
the administrator under **Settings → Users** while acting as that church) can be done afterwards.

While you are acting as a church, **Settings → Users** and **Roles & Permissions** show only
that church's own people and roles (plus the shared system roles). **Central Management** shows
everyone.

## Keeping it running and backed up (office computer)

Running `npm start` in a terminal is fine for trying things out, but an office
computer needs the app to survive reboots and crashes, and needs a copy of the
data somewhere else.

### Backups

```bash
cd backend
npm run backup
```

Writes a compressed, verified snapshot of the database to `BACKUP_DIR`
(default `backend/backups/`) and mirrors the church logo uploads next to it.
The app can keep running while it works (a 1.5-million-row database takes
about 7 seconds). The newest `BACKUP_KEEP` (default 30) backups are kept.

**Set `BACKUP_DIR` in `backend/.env` to an external drive or a synced cloud
folder** — a backup on the same disk as the database is lost with it. Backup
files contain personal data; keep that folder private (it is git-ignored).

To restore, **stop the app first**, then:

```bash
npm run restore -- path/to/coms-coms_db-2026-09-25_020000.sql.gz --force --with-uploads
```

To rehearse a restore without touching live data, load it into a scratch
database instead: `DB_NAME=coms_restore_check npm run restore -- <file>` (do
this once after setting up backups, so you know they work).

### Start automatically at boot (Windows)

From an **Administrator** PowerShell in the project folder:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1
```

This creates two Task Scheduler tasks that run without anyone logged in:
**COMS API** (starts at boot; if the API stops or MySQL wasn't ready yet, it
is restarted after 10 seconds) and **COMS Backup** (daily at 02:00, or at the
next start if the computer was off). Remove them with
`uninstall-autostart.ps1`. Also set Windows to never sleep, and make sure the
MySQL service starts automatically (`services.msc`).

Logs are in `backend/logs/`: `combined.log` (application), `backup.log`
(backup results — look here if a night's backup is missing) and
`service-error.log` (raw crash output).

> These scripts start the **API** only. Serving the built frontend for daily
> use is a separate step (see the production build note above).

## Running migrations again later

Add a new file to `backend/database/migrations/` (name it with the next
number prefix, e.g. `007_something.sql`) and run `npm run migrate` — already
-applied files are tracked in a `schema_migrations` table and skipped
automatically.

**After updating an existing installation**, run `npm run migrate` once. Recent updates add database indexes (for
example `041_central_analytics_indexes.sql`) that keep the Central Management screens fast on large data; it is safe to
run again at any time.

## Troubleshooting

- **"Cannot reach the server" in the UI / `ECONNREFUSED` in the backend
  console on startup** — MySQL isn't running or the `.env` credentials are
  wrong. Verify with `mysql -h 127.0.0.1 -P 3306 -u root -p`.
- **Login works but every page 401s immediately** — the browser is likely
  blocking the httpOnly `sid` session cookie because `CORS_ORIGIN` in `.env`
  doesn't exactly match the URL you're loading the frontend from (including
  port). They must match exactly for credentialed CORS requests.
- **PDFs come back empty or error** — the extracted `.ttf` files under
  `backend/assets/fonts/` are committed to the repo, but if they're ever
  missing (e.g. a fresh clone that excluded them), re-run
  `npm run fonts:extract` in `backend/` to regenerate them from pdfmake's own
  bundle — no download required.
