# API Reference

Base URL (dev): `http://localhost:4000/api`

## Conventions

- **Auth:** every endpoint except `POST /auth/login` and `POST /auth/refresh`
  requires `Authorization: Bearer <accessToken>`.
- **Responses:** `{ "success": true, "data": ... }` on success,
  `{ "success": false, "message": "...", "details": [...] }` on error.
  List endpoints add `"meta": { "total", "page", "pageSize" }`.
- **Errors:** `400` validation, `401` missing/invalid/expired token, `403`
  missing permission, `404` not found, `409` conflict (duplicate/unique
  constraint), `500` unexpected.
- **Dates:** `YYYY-MM-DD` in requests; ISO-ish `YYYY-MM-DD HH:MM:SS` in
  responses (MySQL `dateStrings` mode).
- **Permissions:** each protected route checks the caller's JWT-embedded
  permission list (see [Auth](#auth)) against a required code, e.g.
  `prayer_intentions.create`. Codes follow `<module>.<action>`.

---

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | `{ username, password }` → access token (body) + refresh token (httpOnly cookie) |
| POST | `/auth/refresh` | refresh cookie | Rotates the refresh token, returns a new access token |
| POST | `/auth/logout` | refresh cookie | Revokes the refresh token, clears the cookie |
| GET | `/auth/me` | Bearer | Current user + permissions (decoded from the token, no DB hit) |
| POST | `/auth/change-password` | Bearer | `{ currentPassword, newPassword }` |

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
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": 1, "username": "admin", "fullName": "System Administrator",
      "roleCode": "ADMIN", "churchId": 1, "branchId": 1,
      "mustChangePassword": true,
      "permissions": ["dashboard.view", "prayer_intentions.view", "..."]
    }
  }
}
```

The access token is short-lived (15 min default) and meant to be held in
memory only (never `localStorage`) — the frontend's `AuthService` does
exactly this and calls `/auth/refresh` transparently on a 401.

---

## Prayer Intentions — `/prayer-intentions`

The system's primary module. Permission prefix: `prayer_intentions.*`
(register/receipt endpoints use `prayer_register.*` / `receipts.*`).

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `.view` | List, filters: `page,pageSize,search,prayerDate,prayerDateFrom,prayerDateTo,massId,statusId` |
| GET | `/:id` | `.view` | Single record |
| POST | `/` | `.create` | Create — see body below |
| PUT | `/:id` | `.update` | Partial update, same shape |
| DELETE | `/:id` | `.delete` | Soft delete |
| POST | `/:id/mark-completed` | `.update` | Marks one as completed |
| POST | `/mark-all-completed` | `.update` | Body `{ prayerDate }` — marks every intention on that date completed |
| GET | `/:id/receipt` | `.print` or `receipts.print` | Streams the receipt PDF |
| GET | `/register/preview?date=YYYY-MM-DD` | `prayer_register.view` | JSON rows for that date, grouped by Mass in the frontend |
| GET | `/register/print?date=YYYY-MM-DD` | `prayer_register.print` | Streams the Daily Prayer Register PDF |
| GET | `/dashboard-stats` | `dashboard.view` | Today's count/collections, pending count, 7-day trend, by-Mass counts |

**Create body:**

```json
{
  "name": "John Peter",
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
- `offeringAmount` must be `> 0` (validated).
- The service checks for a same name + date + Mass duplicate first; a
  genuine repeat returns `409` unless `allowDuplicate: true` is sent.
- `receipt_no` is generated server-side (atomic, race-safe) from the
  church's active `receipt_series` — never sent by the client.

---

## Certificates — `/certificates/:type`

`:type` is `baptism`, `marriage`, or `death`. Permission codes are
`<type>_certificates.<action>` (e.g. `baptism_certificates.create`).

| Method | Path | Description |
|---|---|---|
| GET | `/:type` | List, filters: `page,pageSize,search` |
| GET | `/:type/:id` | Single record |
| POST | `/:type` | Create — required fields vary by type (see below) |
| PUT | `/:type/:id` | Update |
| DELETE | `/:type/:id` | Soft delete |
| GET | `/:type/:id/print` | Streams the formal certificate PDF |

`certificate_no` is auto-generated per type (`BAP0001`, `MAR0001`, `DTH0001`,
...) from `certificate_series`, same atomic pattern as receipts.

| Type | Required fields | Other fields |
|---|---|---|
| `baptism` | `child_name, gender_id, date_of_birth, date_of_baptism` | `father_name, mother_name, godfather_name, godmother_name, priest_id, remarks` |
| `marriage` | `bride_name, groom_name, marriage_date` | `witness1_name, witness2_name, priest_id, remarks` |
| `death` | `deceased_name, date_of_death` | `burial_date, cemetery, priest_id, family_contact, remarks` |

---

## Masters — `/masters/:masterKey`

One generic engine drives all 26 configurable dropdown tables. Permission
prefix: `masters.*` (same permission for every table).

`GET /masters` (no key) lists every valid `masterKey`:
`countries, states, districts, churches, branches, priests, masses, genders,
departments, languages, currencies, payment_methods, donation_types,
document_types, prayer_categories, prayer_intention_master, special_feasts,
holidays, announcements, receipt_series, certificate_series, print_templates,
email_templates, sms_templates, system_settings, statuses`

| Method | Path | Description |
|---|---|---|
| GET | `/:masterKey` | List, filters: `page,pageSize,search,includeInactive`, plus any FK column as an exact filter (e.g. `?church_id=1`) |
| GET | `/:masterKey/:id` | Single record |
| POST | `/:masterKey` | Create |
| PUT | `/:masterKey/:id` | Update |
| DELETE | `/:masterKey/:id` | Soft delete (hidden from default list, recoverable via `includeInactive=true`) |
| POST | `/:masterKey/reorder` | Body `{ orderedIds: number[] }` — only for tables with a `sort_order` column (masses, prayer categories/intentions, statuses) |

Each table's editable columns, required fields, and FK joins are declared in
`backend/src/config/masterRegistry.js`.

---

## Reports — `/reports` (all require `reports.view`)

| Method | Path | Query params | Returns |
|---|---|---|---|
| GET | `/prayer-intentions` | `dateFrom, dateTo, massId, statusId` | `{ rows, summary: { totalCount, totalOffering } }` |
| GET | `/collections` | `dateFrom, dateTo, paymentMethodId` | `{ byDay, byPaymentMethod, summary }` |
| GET | `/certificates` | `type (baptism\|marriage\|death\|all), dateFrom, dateTo` | `{ rows, summary: { baptism, marriage, death, total } }` |

Daily/Monthly/Yearly/Custom reporting is a matter of the `dateFrom`/`dateTo`
range the frontend sends, not a separate endpoint.

---

## Users — `/users`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `users.view` | List, filters: `page,pageSize,search` |
| GET | `/:id` | `users.view` | Single user |
| POST | `/` | `users.create` | Creates a user; response includes a one-time `tempPassword` |
| PUT | `/:id` | `users.update` | Update profile/role/church (not username) |
| POST | `/:id/activate` | `users.update` | Re-enable login |
| POST | `/:id/deactivate` | `users.update` | Disable login (can't deactivate yourself) |
| POST | `/:id/reset-password` | `users.update` | Issues a new `tempPassword`, forces change on next login |

## Roles — `/roles`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `roles.view` | All roles |
| GET | `/permissions/all` | `roles.view` | Every permission, grouped by module in the frontend |
| GET | `/:roleId/permissions` | `roles.view` | Permission IDs currently granted to a role |
| PUT | `/:roleId/permissions` | `roles.update` | Body `{ permissionIds: number[] }` — replaces the set. Rejected with `403` for system roles (Administrator) |

## Audit Logs — `/audit-logs`

| Method | Path | Permission | Query params |
|---|---|---|---|
| GET | `/` | `audit_logs.view` | `page,pageSize,module,userId,fromDate,toDate,search` |

Every mutating action across every module writes here (fire-and-forget —
logging failures never break the triggering request).
