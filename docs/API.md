# API Reference

Base URL (dev): `http://localhost:4000/api`

## Conventions

- **Auth:** every endpoint except `POST /auth/login`, `POST /auth/logout`,
  `POST /auth/webauthn/login/*`, and `/public/*` requires the `sid` session
  cookie set by login (see Auth below) — no `Authorization` header.
- **Responses:** `{ "success": true, "data": ... }` on success,
  `{ "success": false, "message": "...", "details": [...] }` on error.
  List endpoints add `"meta": { "total", "page", "pageSize" }`.
- **Errors:** `400` validation, `401` missing/invalid/expired token, `403`
  missing permission, `404` not found, `409` conflict (duplicate/unique
  constraint), `500` unexpected.
- **Dates:** `YYYY-MM-DD` in requests; ISO-ish `YYYY-MM-DD HH:MM:SS` in
  responses (MySQL `dateStrings` mode).
- **Permissions:** each protected route checks the caller's permission list
  (re-fetched fresh from the DB on every request -- see `authenticate.js` --
  so a role/permission change or deactivation takes effect immediately, not
  only once the caller's current token expires) against a required code,
  e.g. `mass_intentions.create`. Codes follow `<module>.<action>`.
- **Pagination:** every list endpoint's `pageSize` is clamped server-side
  (max 1000; missing/invalid falls back to 25) -- a client can't force an
  unbounded `LIMIT`.

---

## Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | — | `{ username, password }` → sets the httpOnly `sid` session cookie; body returns the user. No attempt limit and no lockout — a wrong password just returns 401. |
| POST | `/logout` | session cookie | Deletes the session, clears the cookie |
| GET | `/me` | session cookie | Current user (same shape as login) + permissions — the frontend calls this on every page load to restore its session |
| POST | `/change-password` | session cookie | `{ currentPassword, newPassword }` -- also deletes every session for the account |
| POST | `/webauthn/register/options` | session cookie | Begin enrolling a passkey/biometric device for the current user |
| POST | `/webauthn/register/verify` | session cookie | Complete enrollment |
| GET | `/webauthn/devices` | session cookie | List the current user's enrolled devices |
| DELETE | `/webauthn/devices/:id` | session cookie | Remove an enrolled device |
| POST | `/webauthn/login/options` | — | Begin passkey sign-in |
| POST | `/webauthn/login/verify` | — | Complete passkey sign-in (sets the `sid` cookie like password login) |

**Example — login:**

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin", "password": "Admin@12345" }
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1, "username": "admin", "fullName": "System Administrator",
      "roleCode": "ADMIN", "churchId": 1, "branchId": 1,
      "mustChangePassword": true,
      "permissions": ["dashboard.view", "mass_intentions.view", "..."]
    }
  }
}
```

The session is one opaque random id in an httpOnly, `SameSite=Strict` cookie named `sid`
(only its SHA-256 hash is stored, in the `sessions` table). The browser sends it
automatically, so API clients must send cookies (`withCredentials: true` from the
SPA) — there is no `Authorization` header and no token in any response body. A
session lasts `SESSION_EXPIRES_IN` (default 7 days) and is extended on every
request, so only an idle session expires. The `Secure` flag is set whenever the
connection is HTTPS (behind a proxy, send `X-Forwarded-Proto`).

---

## Mass Intentions — `/mass-intentions`

The system's primary module. Permission prefix: `mass_intentions.*`
(register/receipt endpoints use `prayer_register.*` / `receipts.*` --
historical names, unchanged since the "Mass Intentions" rename). Booking
and payment are two separate steps: creating a record never assumes it's
paid — see "Payment workflow" below.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `.view` | List — see query params below |
| GET | `/bulk-batches` | `.view` | One row per past Bulk Mass Intention save (`{ batchId, createdAt, bookedBy, phone, count, total, paidCount }`) |
| GET | `/:id` | `.view` | Single record |
| POST | `/` | `.create` | Create — see body below |
| PUT | `/:id` | `.update` | Partial update, same shape |
| DELETE | `/:id` | `.delete` | Soft delete |
| GET | `/:id/receipt` | `.print` or `receipts.print` | Streams the receipt PDF (A5 portrait; shows both the Mass date and the date the intention was entered; only meaningful once paid) |
| GET | `/receipt/bulk?ids=1,2,3` or `?batchId=...` | `.print` or `receipts.print` | One combined receipt PDF covering every row of a Bulk save |
| POST | `/:id/payment/receive` | `.update` | Step 2 of the payment workflow — see body below |
| POST | `/payment/demo-qr` | `.create` | `{ amount, purpose }` → a mock UPI QR/deep-link for the in-progress form's inline demo panel (no DB write; see "Payment provider" below) |
| GET | `/register/preview?date=YYYY-MM-DD` | `prayer_register.view` | JSON rows for that date, grouped by Mass in the frontend |
| GET | `/register/print?date=YYYY-MM-DD&namesOnly=true&lang=ta` | `prayer_register.print` | Streams the Daily Prayer Register PDF |
| GET | `/dashboard-stats` | `dashboard.view` | Today's count/collections, pending (unpaid) count, 7-day collections trend, upcoming Restricted Dates |

**List query params:** `page, pageSize, search, prayerDate, prayerDateFrom,
prayerDateTo, massId, paymentMethodId, paidOnly (1|0), bulkBatchId`. `search`
matches name, phone, receipt number, booked-by, the Mass's name, and the
intention text (English or Tamil) in one free-text OR; the rest are exact
filters combined with AND and with `search`.

**Create body:**

```json
{
  "name": "John Peter",
  "bookedBy": "Mary Peter",
  "phone": "9876543210",
  "prayerDate": "2026-08-05",
  "massId": 1,
  "prayerIntentionMasterId": 1,
  "offeringAmount": 100,
  "paymentMethodId": 1,
  "remarks": "optional",
  "allowDuplicate": false
}
```

- Either `prayerIntentionMasterId` (a dropdown choice) or `customIntention`
  (free text) is required. If the selected master row is the "Others" entry
  (`is_custom = 1`), `customIntention` becomes required.
- `offeringAmount` must be `> 0`; `paymentMethodId` is required (it drives
  the Receive Payment step below, not an assumption that payment has
  happened yet).
- Rejected with `400` if `prayerDate` falls on a Restricted Date (Masters →
  Restricted Dates), enforced server-side regardless of what the frontend
  warned about.
- The service checks for a same name + date + Mass duplicate first; a
  genuine repeat returns `409` unless `allowDuplicate: true` is sent.
- `receipt_no` is generated server-side from the church's active
  `receipt_series` in the same transaction as the insert — claiming a
  number and then failing to save never permanently skips it.

**Payment workflow — `POST /:id/payment/receive`:**

```json
{ "method": "cash", "referenceNumber": "optional", "remarks": "optional", "paymentDate": "2026-08-05" }
```

`method` is one of `cash | upi | cheque | bank_transfer | other`. "Paid" is
purely defined by the existence of a successful `payment_transactions` row
for the intention — there's no separate manual status field. Fails with
`400` if already paid.

---

## Contributions — `/contributions`

Same two-step booking/payment shape as Mass Intentions, for general
donations (not tied to a Mass). Permission prefix: `contributions.*`.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `.view` | List — `page,pageSize,search,paidOnly` |
| GET | `/:id` | `.view` | Single record |
| POST | `/` | `.create` | `{ name, phone, contributionTypeId, customContributionType, contributionAmount, paymentMethodId, remarks }` |
| PUT | `/:id` | `.update` | Partial update |
| DELETE | `/:id` | `.delete` | Soft delete |
| GET | `/:id/receipt` | `.print` or `receipts.print` | Streams the receipt PDF (A5 portrait) |
| POST | `/:id/payment/receive` | `.update` | Same body/semantics as Mass Intentions' payment/receive |

`contributionTypeId` or `customContributionType` is required the same way
Mass Intentions requires an intention (the "Others" type, code `OTHERS`,
requires the custom text). `receipt_no` is claimed from the same
`receipt_series` per church as Mass Intentions (one shared numbering
sequence), atomically with the insert.

---

## Certificates — `/certificates/:type`

`:type` is `baptism`, `marriage`, or `death`. Permission codes are
`<type>_certificates.<action>` (e.g. `baptism_certificates.create`).

| Method | Path | Description |
|---|---|---|
| GET | `/:type` | List — see query params below |
| GET | `/:type/:id` | Single record |
| POST | `/:type` | Create — required fields vary by type (see below) |
| PUT | `/:type/:id` | Update |
| DELETE | `/:type/:id` | Soft delete |
| GET | `/:type/:id/print` | Streams the formal certificate PDF |

**List query params:** `page, pageSize, search`, plus structured filters
declared per type (combined with AND, and with `search`):

| Type | Structured filters |
|---|---|
| `baptism` | `gender_id`, `priest_id`, `date_of_birthFrom`/`date_of_birthTo`, `date_of_baptismFrom`/`date_of_baptismTo` |
| `marriage` | `priest_id`, `marriage_dateFrom`/`marriage_dateTo` |
| `death` | `priest_id`, `date_of_deathFrom`/`date_of_deathTo`, `burial_dateFrom`/`burial_dateTo` |

`certificate_no` is auto-generated per type (`BAP0001`, `MAR0001`, `DTH0001`,
...) from `certificate_series`, atomically with the insert (same pattern as
receipts above).

| Type | Required fields | Other fields |
|---|---|---|
| `baptism` | `child_name, gender_id, date_of_birth, date_of_baptism` | `place_of_baptism, father_name, mother_name, parent_residence, godfather_name, godmother_name, priest_id, remarks` |
| `marriage` | `bride_name, groom_name, marriage_date` | `where_married, groom_age, bride_age, groom_condition, bride_condition, groom_profession, bride_profession, groom_residence, bride_residence, groom_father_name, bride_father_name, banns_or_licence, impediments_dispensed, witness1_name, witness2_name, priest_id, remarks` |
| `death` | `deceased_name, date_of_death` | `age, place, profession, parents, place_of_death, cause, confession_received, viaticum_received, anointing_received, burial_date, cemetery, priest_id, family_contact, remarks` |

---

## Excel import & export — Mass Intentions, Contributions, Certificates

The three modules above share the same Excel endpoints. `<base>` is
`/mass-intentions`, `/contributions` or `/certificates/:type`. Only `.xlsx`
files are accepted (max 10 MB, 20,000 data rows). Pass `lang=en|ta` to pick the
language of headings and messages.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `<base>/export` | `.view` | Every record matching the same search/filters as the list, as an `.xlsx` |
| GET | `<base>/import-template` | `.create` | A blank workbook with the exact headings, an example row and notes |
| POST | `<base>/import/preview` | `.create` | Step 1 of an import — reads the file, saves **nothing** (see below) |
| POST | `<base>/import` | `.create` | Step 2 — validates every row and saves the valid ones in one transaction |

Both POST endpoints take `multipart/form-data` with the workbook in field
`file`. Church and branch always come from the signed-in user, never the file.

**Preview response** (`data`) — what the UI's "Match columns" popup shows:

```json
{
  "sheetName": "Old register",
  "rowCount": 3,
  "sourceColumns": [
    { "number": 1, "heading": "Donor", "samples": ["Mary Joseph", "John Peter"] },
    { "number": 2, "heading": "Amt",   "samples": ["250", "1,000.50"] }
  ],
  "fields": [
    { "key": "name", "label": "Name", "required": true, "suggestedColumn": null },
    { "key": "contribution_amount", "label": "Amount", "required": true, "suggestedColumn": null }
  ]
}
```

`number` is the 1-based sheet column (A = 1). `suggestedColumn` is the column
whose heading matched the field on its own (English or Tamil label, key or a
legacy alias), or `null`. A file whose headings match nothing is **not**
rejected here — choosing the columns by hand is the point of the step.

**Import** accepts an optional form field `mapping`, a JSON object
`{ "<field key>": <column number> }`, e.g. `{"name":1,"contribution_amount":2}`:

- With `mapping`, exactly those columns are read and headings are ignored.
  A field left out of `mapping` is not imported. Every required field must be
  present. The same column **may** be given to more than one field (the UI only
  warns about it).
- Without `mapping`, columns are found by heading, as before; missing required
  headings reject the whole file with `400`.
- An invalid mapping (not a JSON object, an unknown field key, a column that does
  not exist, a required field missing, nothing selected) is a `400` with a
  message naming the problem.

**Import response** (`data`): `{ total, imported, failed, errors: [{ row, column,
message }], ignoredColumns }`. Rows that fail validation are reported and
skipped; the rest are saved together, or none are if the database itself fails.

**Register numbers.** The optional `receipt_no` (Mass Intentions, Contributions) or
`certificate_no` (certificates) field takes the number from the sheet's "S.No" / "No." /
"Receipt No." / "Certificate No." column. Only the **number** is used, and the church's own
series prefix and padding are added: `12`, `"No. 12"`, `"12.0"` and `"RCT-0012"` all become
`RCT0012` (with prefix `RCT`, 4 digits). The first number in the cell wins (`"12/2020"` → 12).
Headings such as `S.No`, `Sl.No`, `No`, `Serial No`, `Reg No` and `வ.எண்` are matched
automatically; anything else can be chosen in the mapping.

- A **blank** cell gets the next automatic number. After the import the series continues from
  the highest imported number, so numbers created later never collide with imported ones.
- A number that repeats inside the file, or is already used in the church, is reported on that
  row and skipped. Mass Intentions and Contributions share one receipt sequence, so a number used
  by either is taken for both. Deleted records still hold their number.
- A cell that has no number (`"abc"`), is `0`, has decimals (`"1.5"`), is over 999,999,999, or
  that Excel turned into a date is reported on that row.
- A church that never had a series gets the default one (`RCT`, `BAP`, `MAR`, `DTH`).
- The preview's `fields[].hint` shows the rule with the church's real prefix.

---

## Church setup — `/church-setup`

A church created under Masters → Churches starts with nothing. Before its office can
save a record it needs a **receipt-number series**, a **Baptism, Marriage and Death
certificate series**, and **at least one Mass**; a branch, a priest and the church's own
Administrator login are recommended but optional. These endpoints report what is missing and create it in one step. Permission:
`masters.create`. A Master Administrator may use them for any church; everyone else only for
their own (`403` otherwise).

| Method | Path | Description |
|---|---|---|
| GET | `/:churchId/status` | `{ churchId, churchName, complete, missing, defaults }` — `missing` is `{ receiptSeries, certificateSeries: ["Baptism", ...], masses, branch, priest, admin }` (`admin`: no active user with the `ADMIN` role exists for the church); `complete` is true when nothing that blocks the office is missing; `defaults` are the suggested values the UI pre-fills |
| POST | `/:churchId` | Creates what is supplied **and** still missing, in one transaction. Returns `{ status, created, skipped, admin? }` — `admin` (`{ id, username, tempPassword }`) is present only when a login was just created |

**POST body** — every part is optional; send only what is needed:

```json
{
  "receiptSeries": { "prefix": "RCT", "startNumber": 1, "padding": 4 },
  "certificateSeries": { "Baptism": { "prefix": "BAP", "startNumber": 1, "padding": 4 }, "Marriage": {}, "Death": {} },
  "masses": [{ "name": "Morning Mass", "nameTa": "", "massTime": "06:00", "dayType": "Daily", "defaultOfferingAmount": 0 }],
  "branch": { "name": "Main Church" },
  "priest": { "name": "Fr. John", "title": "Rev. Fr." },
  "admin": { "fullName": "Fr. Paul", "username": "paul.admin", "email": "", "phone": "" }
}
```

- Safe to submit twice: anything that already exists is left untouched and listed in `skipped`.
  A deleted or deactivated certificate series of the same type is brought back rather than
  duplicated. If any part fails, none of it is saved.
- `admin` creates the church's Administrator (role `ADMIN`) with a generated temporary password that
  must be changed at first sign-in. The password is returned **once**, in this response only; it is
  stored as a hash and never written to the audit log. Needs `users.create` in addition (a Master
  Administrator always has it). A username or email already in use is a `409` and **nothing** is
  saved. A church that already has an active Administrator is not given a second one (`skipped`).
  A church created this way has no other users: a Master Administrator working inside it sees
  only that church's users and roles (`GET /users`, `GET /roles`); in Central Management it sees all.
- `prefix`: letters, digits and `. _ / -`, up to 20 characters. `padding`: 1–10 digits.
  `dayType`: `Daily`, `Sunday` or `Special`. `massTime`: 24-hour `HH:MM`. Invalid input is a `400`.

**Safety net.** A church that has *never* had a receipt or certificate series (not even a
deactivated one) is given the defaults (`RCT`, `BAP`, `MAR`, `DTH`, 4 digits) the first time a
number is needed, so saving a record cannot fail just because setup was skipped. A series an
administrator deliberately deactivated or deleted is **not** replaced; saving then returns the
usual "No active … series" `400`. Masses have no safe default: until one exists, a Mass
Intention cannot be booked.

**One church's Masses stay in that church.** Creating or updating a Mass Intention with another
church's `massId` is a `400` ("… does not belong to this church"). `GET /masters/:masterKey?scoped=true`
returns only the church being worked in even for a Master Administrator (who otherwise reads every
church's masters); the UI's Mass and Priest dropdowns use it. Priests on certificates are free
text: the dropdown lists the church's own priests for convenience, but any name may be entered
or imported, and it does not have to belong to the church.

---

## Masters — `/masters/:masterKey`

One generic engine drives every configurable dropdown table. Reading a
table (`GET /:masterKey` and `GET /:masterKey/:id`) only requires being
logged in — every data-entry form in the app populates its dropdowns this
way, regardless of the caller's role. Writing requires the `masters.*`
permission prefix (same permission for every table).

`GET /masters` (no key) lists every valid `masterKey`:
`countries, states, districts, churches, branches, priests, masses, genders,
departments, languages, currencies, payment_methods, contribution_types,
document_types, prayer_categories, prayer_intention_master, special_feasts,
holidays, announcements, receipt_series, certificate_series, print_templates,
email_templates, sms_templates, system_settings`

(`statuses` existed historically but is no longer registered here — the
Pending/Completed workflow it drove was retired in favour of the
payment-existence check described under Mass Intentions/Contributions
above; the table and its FK are untouched for old audit-log history.)

| Method | Path | Description |
|---|---|---|
| GET | `/:masterKey` | List, filters: `page,pageSize,search,includeInactive`, plus any FK column as an exact filter (e.g. `?church_id=1`) |
| GET | `/:masterKey/:id` | Single record |
| POST | `/:masterKey` | Create |
| PUT | `/:masterKey/:id` | Update |
| DELETE | `/:masterKey/:id` | Soft delete (hidden from default list, recoverable via `includeInactive=true`) |
| POST | `/churches/:id/logo` | Multipart `logo` field (PNG/JPEG/WEBP, 2MB max) — uploads a church's logo |
| POST | `/:masterKey/reorder` | Body `{ orderedIds: number[] }` — only for tables with a `sort_order` column (masses, prayer categories/intentions) |
| POST | `/:masterKey/:id/set-default` | Makes one row the table's sole default (Languages, Currencies) |

Each table's editable columns, required fields, searchable/filterable
columns, and FK joins are declared in `backend/src/config/masterRegistry.js`.

---

## Reports — `/reports` (all require `reports.view`)

| Method | Path | Query params | Returns |
|---|---|---|---|
| GET | `/mass-intentions` | `dateFrom, dateTo, massId, paidOnly` | `{ rows, summary }` |
| GET | `/collections` | `dateFrom, dateTo, method` | `{ byDay, byPaymentMethod, summary }` |
| GET | `/collections/detail` | `dateFrom, dateTo, dateBasis` | Per-transaction breakdown |
| GET | `/collections/detail/print` | `dateFrom, dateTo, dateBasis, mine, lang` | Streams the Collections PDF — `mine=true` needs only `reports.view`; the all-users breakdown needs `reports.print_all` |
| GET | `/contributions` | `dateFrom, dateTo, method` | `{ byDay, byPaymentMethod, summary }` |
| GET | `/contributions/detail` | `dateFrom, dateTo` | Per-transaction breakdown |
| GET | `/contributions/detail/print` | `dateFrom, dateTo, mine, lang` | Streams the Contributions PDF — same `reports.print_all` gate as above |
| GET | `/certificates` | `type (baptism\|marriage\|death\|all), dateFrom, dateTo` | `{ rows, summary: { baptism, marriage, death, total } }` |

Daily/Monthly/Yearly/Custom reporting is a matter of the `dateFrom`/`dateTo`
range the frontend sends, not a separate endpoint.

---

## Central Management analytics — `/central` (Master Administrator only)

Organization-wide, read-only analytics behind the **Central Management** screens. Every route needs a session
belonging to a Master Administrator (`401` without one, `403` for anyone else, whatever their permissions) and is
sent with `Cache-Control: no-store`. Nothing here creates or changes a record.

**Common query params** (all optional): `period` = `today | week | month | quarter | year | custom` (default `month`),
`from` + `to` (`YYYY-MM-DD`, used with `period=custom`), `churchId`, `branchId` (needs a `churchId` it belongs to).
Every response carries a `context` with the resolved period, the previous period it is compared against (the same
elapsed part of the previous week/month/quarter/year), and the currency.

| Method | Path | Returns |
|---|---|---|
| GET | `/overview` | KPIs (churches, branches, activity, Mass Intentions, certificates, contributions), and one row per church with its activity level and a mini trend |
| GET | `/mass-intentions` | Totals, paid/unpaid, trend, by church, by intention type |
| GET | `/register` | Daily Prayer Register **registrations** (not attendance): totals, daily average, peak day, active days, weekday × Mass-time heat map |
| GET | `/certificates/:type` | `type` = `baptism`, `marriage` or `death`. Counts by event date, by church, age bands / gender (baptism) or by month of the year (others), and how promptly records were entered. Deaths are aggregated only |
| GET | `/contributions` | Money **received** (a recorded successful payment): totals, trend, by church, by contribution type |
| GET | `/insights` | Plain-sentence findings, each built from the numbers above |
| GET | `/branches` | Activity per branch (`churchId` required) |
| GET | `/church/:id` | One church for the detail drawer: metrics, last 7 days, per-branch rows |

Definitions match the existing Reports: Mass Intentions by Mass date, money by payment date, certificates by event
date. Very long custom ranges over hundreds of thousands of records are slower; the presets return in well under a
second at that size.

---

## Users — `/users`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `users.view` | List, filters: `page,pageSize,search` |
| GET | `/:id` | `users.view` | Single user |
| POST | `/` | `users.create` | Creates a user; response includes a one-time `tempPassword` |
| PUT | `/:id` | `users.update` | Update profile/role/church (not username) |
| POST | `/:id/activate` | `users.update` | Re-enable login — takes effect on that user's very next request |
| POST | `/:id/deactivate` | `users.update` | Disable login (can't deactivate yourself) — takes effect immediately, not only once their current token expires |
| POST | `/:id/reset-password` | `users.update` | Issues a new `tempPassword`, forces change on next login, revokes all their existing sessions |

## Roles — `/roles`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `roles.view` | All roles |
| GET | `/permissions/all` | `roles.view` | Every permission, grouped by module in the frontend |
| GET | `/:roleId/permissions` | `roles.view` | Permission IDs currently granted to a role |
| PUT | `/:roleId/permissions` | `roles.update` | Body `{ permissionIds: number[] }` — replaces the set, effective immediately for every user holding that role. Rejected with `403` for system roles (Administrator) |

## Audit Logs — `/audit-logs`

| Method | Path | Permission | Query params |
|---|---|---|---|
| GET | `/` | `audit_logs.view` | `page,pageSize,module,userId,fromDate,toDate,search` |

Every mutating action across every module writes here (fire-and-forget —
logging failures never break the triggering request). Sensitive fields
(password hashes) are never included — audited before/after values are an
explicit whitelist per module, not a raw row dump.

## Public — `/public` (no auth)

Reached only by scanning the QR code on a printed receipt — the caller is a
parishioner, not a COMS user. Rate-limited tighter than the rest of the API
(60/15min) since it's open to the internet.

| Method | Path | Description |
|---|---|---|
| GET | `/intentions/:token` | Summary for the receipt behind this unguessable token |
| GET | `/intentions/:token/calendar.ics` | The same booking as a downloadable calendar event |

## Payment provider

Every "Receive Payment" step above records that money was already received
by some means (cash handed over, a UPI transfer confirmed by phone, a
cheque, etc.) — there is currently no real online payment gateway wired in.
`POST /mass-intentions/payment/demo-qr` generates a mock UPI QR/deep-link
for demoing the flow; swapping in a real hosted-checkout provider
(Razorpay/Cashfree/PhonePe PG) is tracked as a known follow-up (see
`backend/src/payments/PaymentProvider.js`).
