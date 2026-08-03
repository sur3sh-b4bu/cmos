# COMS Frontend

Angular 21 (standalone components, signals, zoneless change detection) +
Angular Material. See the [repository root README](../README.md) for the
full project overview and [`docs/INSTALLATION.md`](../docs/INSTALLATION.md)
for setup.

## Commands

```bash
npm start                                    # dev server, http://localhost:4200
npm run build -- --configuration production   # production build → dist/frontend
npm test                                       # unit tests (Vitest)
```

## Structure

```
src/app/
  core/        auth (login/session/guards/interceptor), shared services & models
  layout/      app shell: sidebar, header, breadcrumb, command palette
  shared/      reusable UI: DataTable, BarChart, confirm dialog, date-range filter
  features/    one folder per module — dashboard, prayer-intentions, certificates,
               reports, masters, settings, authentication
```

## Config-driven modules

Certificates (`features/certificates/certificate-config.ts`) and Masters
(`features/masters/master-config.ts`) each use **one** generic list + form
component pair, parametrized by a route param (`:certType` / `:masterKey`).
Adding a field to an existing certificate type or a new master table is a
config change, not a new component.

## Environments

`src/environments/environment.ts` (dev, points at `localhost:4000/api`) and
`environment.production.ts` (`/api`, same-origin) — swapped via
`fileReplacements` in `angular.json` on a production build.
