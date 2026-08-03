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

The `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` placeholders in
`.env.example` **must** be replaced with real random values before any
production-like use — never commit real secrets. For local development you
can generate quick ones with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
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
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets — **set real random values** | — |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (days, e.g. `7d`) | `7d` |
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

## Running migrations again later

Add a new file to `backend/database/migrations/` (name it with the next
number prefix, e.g. `007_something.sql`) and run `npm run migrate` — already
-applied files are tracked in a `schema_migrations` table and skipped
automatically.

## Troubleshooting

- **"Cannot reach the server" in the UI / `ECONNREFUSED` in the backend
  console on startup** — MySQL isn't running or the `.env` credentials are
  wrong. Verify with `mysql -h 127.0.0.1 -P 3306 -u root -p`.
- **Login works but every page 401s immediately** — the browser is likely
  blocking the httpOnly refresh cookie because `CORS_ORIGIN` in `.env`
  doesn't exactly match the URL you're loading the frontend from (including
  port). They must match exactly for credentialed CORS requests.
- **PDFs come back empty or error** — the extracted `.ttf` files under
  `backend/assets/fonts/` are committed to the repo, but if they're ever
  missing (e.g. a fresh clone that excluded them), re-run
  `npm run fonts:extract` in `backend/` to regenerate them from pdfmake's own
  bundle — no download required.
