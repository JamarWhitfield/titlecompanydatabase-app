# Title Network — Database Design

## Overview

The database models a **multi-tenant B2B SaaS** platform where each title company has private data that can optionally be published to a shared read-only network visible to all companies.

Data isolation is enforced at the database layer using **Supabase Row Level Security (RLS)** — no application code can accidentally leak one company's data to another. All tables use `FORCE ROW LEVEL SECURITY` and policies key off two stable helper functions: `get_my_company_id()` and `get_my_role()`.

---

## Tables

### `companies`

One row per title company on the platform.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `name` | TEXT | Display name, e.g. "Acme Title Co." |
| `slug` | TEXT UNIQUE | URL-safe identifier |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

---

### `profiles`

One row per user. Extends Supabase's `auth.users` with app-specific fields.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Same as `auth.users.id` |
| `company_id` | UUID (FK → companies) | Which company this user belongs to |
| `full_name` | TEXT | Optional display name |
| `role` | TEXT | `admin` or `member` — scoped per company |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

Roles are per-company only. There is no platform superadmin role.

---

### `company_records`

The core entity. Each row is a record owned by one company.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `company_id` | UUID (FK) | Owning company |
| `created_by` | UUID (FK → profiles) | Creating user |
| `title` | TEXT | Short label, required, max 255 chars |
| `description` | TEXT | Optional detail, max 2000 chars |
| `record_type` | TEXT | `abstract` or `qualia_file` |
| `county` | TEXT | Optional location field |
| `state` | TEXT | Optional location field |
| `is_shared` | BOOLEAN | `false` by default |
| `shared_at` | TIMESTAMPTZ | Auto-set by trigger on first share; preserved on unshare |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger on every change |

> **Note**: earlier design iterations used a `data JSONB` column with open-ended record types (`property`, `lien`, `escrow`). The shipped schema uses explicit typed columns (`county`, `state`) and the two concrete record types above.

---

### `record_files`

File attachments for a record, stored in the `record-files` Supabase Storage bucket.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `company_id` | UUID (FK) | Owning company (denormalized for RLS) |
| `record_id` | UUID (FK → company_records) | Parent record |
| `name` | TEXT | Original filename |
| `path` | TEXT | Storage key: `companyId/recordId/<uuid>.<ext>` |
| `size` | BIGINT | File size in bytes |
| `mime_type` | TEXT | MIME type |
| `content_text` | TEXT | Extracted text content (PDF, DOCX, TXT, OCR) |
| `has_text` | BOOLEAN | Stored boolean, set by trigger when `content_text` is not null |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

Up to 5 files per record, 10 MB each. Text extraction is best-effort and never blocks upload.

---

### Storage usage & billing reconciliation

Company storage usage (shown to admins in **Settings → Storage usage**) is calculated from **`record_files.size` — database metadata — not by inspecting the Supabase Storage bucket.** Two RPCs support this (migration `0024_storage_usage_reconciliation.sql`):

- `get_company_storage_usage()` → `SUM(record_files.size)` and file count for the caller's company.
- `check_company_storage_drift()` → owner-only, read-only reconciliation report (never deletes).

Billing-accuracy notes:

- **Usage is calculated from `record_files.size`.** One row per tracked attachment.
- **This is Casetra's billable, application-level storage** — the bytes the app knowingly wrote on the company's behalf.
- **Supabase project-level storage may differ slightly**, because it includes every bucket object plus internal/project-level storage (placeholder folder markers, other buckets, overhead). It is not a like-for-like figure and is not used for billing.
- **A file in Storage with no `record_files` row does not count** toward company usage (`orphaned_object` in the drift report).
- **A `record_files` row whose object was deleted outside the app still counts** toward usage until cleaned up (`missing_object` in the drift report).

The reconciliation check **reports mismatches only** — it performs no deletion. Automatic billing, overage charges, Stripe integration, plan enforcement, and destructive cleanup are intentionally out of scope. Future maintenance work could act on the drift report, but only via an explicit, human-initiated step.

---

### `company_billing` & the platform usage dashboard

Per-company plan label and monitoring limits, powering the **owner-only** Storage & Usage dashboard at `/dashboard/platform/usage` (migration `0025_company_billing_usage.sql`).

| Column | Type | Notes |
|--------|------|-------|
| `company_id` | UUID (PK, FK → companies) | One row per company |
| `plan` | TEXT | `trial` \| `starter` \| `growth` \| `enterprise` (default `trial`) |
| `storage_limit_bytes` | BIGINT | NULL = unlimited / not set |
| `user_limit` | INTEGER | NULL = unlimited |
| `record_limit` | INTEGER | NULL = unlimited |
| `updated_at` / `updated_by` | TIMESTAMPTZ / UUID | Audit of last change |

RLS is enabled with **no client write policies** (owners may read; all writes go through the audited RPC). Two owner-only `SECURITY DEFINER` RPCs back the dashboard:

- `platform_list_company_usage()` → aggregate per-company usage: storage (`SUM(record_files.size)`), users, records, files, plus plan + limits. **Aggregate numbers only** — no file paths, names, `content_text`, record titles, or signed URLs are ever returned.
- `platform_set_company_billing(company_id, plan, storage_limit_bytes, user_limit, record_limit)` → owner-only upsert of a company's plan + limits, written to the platform audit trail. Support and auditor roles cannot call it.

**Overage** is displayed as a quantity over the configured limit (bytes / users / records) for monitoring only. There is no Stripe, automatic billing, automatic overage charging, or plan enforcement.

---


### `record_notes`

Free-text notes attached to a record.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `record_id` | UUID (FK) | Parent record |
| `company_id` | UUID (FK) | Note author's company |
| `user_id` | UUID (FK → profiles) | Note author |
| `note_text` | TEXT | Required, max 2000 chars |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on edit |

Notes on shared records from other companies are scoped to the author's company and are not visible to the record's owning company.

---

### `audit_logs`

Append-only log of every change to `company_records`. Written by a Postgres trigger — no application code writes to this table directly.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `company_id` | UUID (FK) | Company that owns the affected record |
| `user_id` | UUID (FK) | Who triggered the change |
| `action` | TEXT | `INSERT`, `UPDATE`, `DELETE`, `SHARE`, `UNSHARE`, `member_removed` |
| `table_name` | TEXT | Always `company_records` |
| `record_id` | UUID | The affected record |
| `old_data` | JSONB | Full row snapshot before the change |
| `new_data` | JSONB | Full row snapshot after the change |
| `created_at` | TIMESTAMPTZ | When the change happened |

`SHARE` and `UNSHARE` are specially labeled by the trigger to make sharing events easy to query. Audit logs are readable by admins of the owning company only.

---

### `company_invitations`

Pending invitations to join a company. Token is a UUID, valid for 7 days.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `company_id` | UUID (FK) | Inviting company |
| `email` | TEXT | Invitee's email (lowercased) |
| `role` | TEXT | Role to assign on acceptance |
| `invited_by` | UUID (FK → profiles) | Admin who sent the invite |
| `token` | UUID | URL-safe invite token |
| `expires_at` | TIMESTAMPTZ | 7 days after creation |
| `accepted_at` | TIMESTAMPTZ | Set when invitation is consumed |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

A unique partial index prevents duplicate pending invitations for the same email within a company.

---

### `saved_searches`

Named search terms saved by a user for the shared network. Used to generate notifications when matching records appear.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `company_id` | UUID (FK) | Author's company |
| `user_id` | UUID (FK → profiles) | Author |
| `name` | TEXT | Display label, max 120 chars |
| `query_text` | TEXT | Search string, max 200 chars |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

---

### `notifications`

System-generated notifications for a company (e.g. a saved search matched a new shared record).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `company_id` | UUID (FK) | Target company |
| `user_id` | UUID (FK → profiles) | Target user (optional) |
| `message` | TEXT | Human-readable notification text |
| `read_at` | TIMESTAMPTZ | Null until marked read |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

---

## Views

### `shared_records_network`

A SQL view over `company_records` that filters to `is_shared = TRUE` and joins `companies` to expose the company name.

```sql
SELECT r.id, r.company_id, c.name AS company_name,
       r.title, r.description, r.record_type,
       r.county, r.state, r.shared_at, r.created_at
FROM company_records r
JOIN companies c ON c.id = r.company_id
WHERE r.is_shared = TRUE;
```

All authenticated users can query this view. Because it is a view on the same underlying table, all RLS policies still apply.

---

## Row Level Security (RLS)

All tables use `FORCE ROW LEVEL SECURITY`. Policies use two stable helper RPCs:
- `get_my_company_id()` — returns the `company_id` of the authenticated user.
- `get_my_role()` — returns the `role` of the authenticated user.

### Rule summary

| Table | SELECT | INSERT / UPDATE / DELETE |
|-------|--------|--------------------------|
| `companies` | Any authenticated user | Service role only |
| `profiles` | Own company members | Own row only |
| `company_records` | Own company **+** `is_shared = true` (read-only for others) | Own company only |
| `record_files` | Same as parent record | Own company only |
| `record_notes` | Own company notes on any viewable record | Own company, own notes (or admin) |
| `audit_logs` | Admin of owning company only | Trigger only (SECURITY DEFINER) |
| `company_invitations` | Admin of own company | Admin of own company |
| `saved_searches` | Own company | Own user (delete: admin can delete any) |
| `notifications` | Own company | System / service role |

### Key isolation rules for `company_records`

1. **Private by default** — `is_shared = false` on insert.
2. **Own company has full access** — read, write, share, unshare, delete.
3. **Shared records are read-only for others** — any authenticated user can SELECT a record where `is_shared = TRUE`, but UPDATE/DELETE is blocked by RLS.
4. **Unsharing is allowed** — owning company can set `is_shared = false` at any time; `shared_at` is preserved.

---

## Security-Definer RPCs

These functions run with elevated privileges and perform multi-step operations atomically. All enforce their own authorization checks internally.

| RPC | Purpose |
|-----|---------|
| `handle_new_user` | Trigger on `auth.users` insert — provisions company + profile |
| `get_invitation_by_token(token)` | Validates an invite token; returns company name, email, role |
| `search_company_records(query)` | Hybrid FTS + trigram search scoped to caller's company |
| `search_shared_records(query)` | Hybrid FTS + trigram search across the shared network |
| `remove_member(target_user)` | Admin-only; same-company check; last-admin guard; reassigns records/notes; writes audit entry; deletes profile |
| `get_record_audit_trail(record_id)` | Returns audit history for a single record |

---

## Triggers

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_company_records_updated_at` | `company_records` | Keeps `updated_at` current |
| `trg_company_records_shared_at` | `company_records` | Stamps `shared_at` on first share |
| `trg_audit_company_records` | `company_records` | Writes `audit_logs` row after every change |
| `trg_record_files_has_text` | `record_files` | Sets `has_text = true` when `content_text` is populated |
| `handle_new_user` | `auth.users` | Provisions company + profile on signup |

---

## Search Architecture

Search uses a **hybrid strategy** implemented in the `search_company_records` and `search_shared_records` RPCs.

**Metadata path** — `websearch_to_tsquery` FTS against a pre-built `tsvector` column covering title, description, county, state, and company name. Supports quoted phrases, AND/OR/NOT operators.

**Document content path** — pg_trgm `ILIKE '%query%'` against `record_files.content_text`. Chosen over FTS for document content because title industry codes (index numbers, policy numbers, parcel IDs) contain hyphens and digits that FTS tokenizes incorrectly. Trigram matching finds them reliably as substrings.

Results include:
- `match_source`: `metadata` or `document`
- `matched_file_name`: filename where the document match occurred
- `relevance_rank`: float for ORDER BY

A GIN trigram index (`idx_record_files_content_trgm`) makes content searches efficient even on large `content_text` values.

---

## Multi-tenancy Model

```
auth.users (Supabase managed)
     │
     └── profiles (1 per user)
              │
              └── company_id ──► companies (1 per title company)
                                       │
                                       ├── company_records (many per company)
                                       │        │
                                       │        ├── record_files (up to 5 per record)
                                       │        ├── record_notes (any company, own-scoped)
                                       │        └── audit_logs (trigger-written)
                                       │
                                       ├── company_invitations (pending invites)
                                       ├── saved_searches (per user)
                                       └── notifications (per company/user)

company_records (is_shared = TRUE) ──► shared_records_network (SQL view, cross-company read)
```

Each user belongs to exactly one company. All data is scoped by `company_id`. The shared network is a cross-company read-only window into records companies have explicitly published.

---

## Tables

### `companies`

Represents a single title company registered on the platform.

| Column       | Type        | Notes                                   |
|--------------|-------------|------------------------------------------|
| `id`         | UUID (PK)   | Auto-generated                          |
| `name`       | TEXT        | Display name, e.g. "Acme Title Co."     |
| `slug`       | TEXT UNIQUE | URL-safe identifier, e.g. `acme-title`  |
| `created_at` | TIMESTAMPTZ | Set automatically on insert             |

---

### `profiles`

One row per user. Extends Supabase's built-in `auth.users` table (which handles passwords and tokens). Connects a user to their company and assigns them a role.

| Column       | Type      | Notes                                            |
|--------------|-----------|--------------------------------------------------|
| `id`         | UUID (PK) | Same as `auth.users.id` — foreign key + PK       |
| `company_id` | UUID (FK) | Which company this user belongs to               |
| `full_name`  | TEXT      | Optional display name                            |
| `role`       | TEXT      | `'admin'` or `'member'`                          |
| `created_at` | TIMESTAMPTZ | Auto-set on insert                             |

**Why a separate profiles table?**
Supabase Auth manages `auth.users` internally — you cannot add custom columns to it. The `profiles` table is your extension point for app-specific user data.

---

### `company_records`

The core table. Each row is a record (property file, lien notice, escrow note, etc.) owned by one company.

| Column        | Type        | Notes                                                       |
|---------------|-------------|--------------------------------------------------------------|
| `id`          | UUID (PK)   | Auto-generated                                              |
| `company_id`  | UUID (FK)   | Which company owns this record                              |
| `created_by`  | UUID (FK)   | Which user created it (references `profiles.id`)            |
| `title`       | TEXT        | Short label for the record                                  |
| `description` | TEXT        | Optional long-form description                              |
| `record_type` | TEXT        | Category: `'property'`, `'lien'`, `'escrow'`, `'general'`  |
| `data`        | JSONB       | Flexible key-value store for record-specific fields         |
| `is_shared`   | BOOLEAN     | `false` by default — set to `true` to publish to network    |
| `shared_at`   | TIMESTAMPTZ | Auto-set the first time `is_shared` becomes `true`          |
| `created_at`  | TIMESTAMPTZ | Auto-set on insert                                          |
| `updated_at`  | TIMESTAMPTZ | Auto-updated on every row change                            |

**The `data` JSONB column** allows each `record_type` to carry its own schema without requiring migrations. For example:

```json
// record_type = "property"
{
  "address": "123 Main St",
  "parcel_number": "APN-0042",
  "square_feet": 2100
}

// record_type = "lien"
{
  "lien_amount": 45000,
  "lien_holder": "First Bank",
  "filing_date": "2024-03-15"
}
```

---

### `audit_logs`

An append-only log of every change to `company_records`. Written automatically by a PostgreSQL trigger — no application code required.

| Column       | Type        | Notes                                         |
|--------------|-------------|-----------------------------------------------|
| `id`         | UUID (PK)   | Auto-generated                                |
| `company_id` | UUID (FK)   | Which company the changed record belongs to   |
| `user_id`    | UUID (FK)   | Who triggered the change                      |
| `action`     | TEXT        | `INSERT`, `UPDATE`, `DELETE`, `SHARE`, `UNSHARE` |
| `table_name` | TEXT        | Always `'company_records'` for now            |
| `record_id`  | UUID        | The affected record                           |
| `old_data`   | JSONB       | Full row snapshot before the change           |
| `new_data`   | JSONB       | Full row snapshot after the change            |
| `created_at` | TIMESTAMPTZ | When the change happened                      |

`SHARE` and `UNSHARE` are specially labeled by the trigger to make those events easy to query.

---

## Views

### `shared_records_network`

This view is the "shared database." It is **not a separate physical database** — it is a SQL view that filters `company_records` for rows where `is_shared = TRUE` and joins with `companies` to expose the company name.

```sql
SELECT r.id, r.company_id, c.name AS company_name,
       r.title, r.description, r.record_type, r.data, r.shared_at
FROM company_records r
JOIN companies c ON c.id = r.company_id
WHERE r.is_shared = TRUE;
```

All authenticated users can query this view to browse/search the network. Because it is a view on top of the same table with the same RLS, all security rules still apply.

---

## Row Level Security (RLS)

RLS is the security layer enforced by PostgreSQL itself — it cannot be bypassed by application bugs.

### Rule summary

| Table             | Who can SELECT                                   | Who can INSERT/UPDATE/DELETE          |
|-------------------|--------------------------------------------------|---------------------------------------|
| `companies`       | Any authenticated user                           | Service role only (server-side)       |
| `profiles`        | Users in the same company                        | Own row only                          |
| `company_records` | Own company's records **+** any `is_shared=true` | Own company's records only            |
| `audit_logs`      | Own company's logs only                          | Trigger only (SECURITY DEFINER)       |

### Key isolation rules for `company_records`

1. **Private by default** — `is_shared` is `false` on insert. Other companies cannot see it.
2. **Own company always has full access** — read, write, share, unshare, delete.
3. **Shared records are read-only for others** — any authenticated user can SELECT a record where `is_shared = TRUE`, but they cannot UPDATE or DELETE it (only the owning company passes the UPDATE/DELETE policy check).
4. **Unsharing is allowed** — the owning company can set `is_shared` back to `false` at any time. The `shared_at` timestamp is preserved as a historical record.

---

## Triggers

| Trigger                         | Table             | Purpose                                               |
|---------------------------------|-------------------|-------------------------------------------------------|
| `trg_company_records_updated_at`| `company_records` | Keeps `updated_at` current                            |
| `trg_company_records_shared_at` | `company_records` | Stamps `shared_at` the first time a record is shared  |
| `trg_audit_company_records`     | `company_records` | Writes an `audit_logs` row after every data change    |

---

## Multi-tenancy model

```
auth.users (Supabase managed)
     │
     └── profiles (1 per user)
              │
              └── company_id ──► companies (1 per title company)
                                       │
                                       └── company_records (many per company)
                                                  │
                                                  └── is_shared=true ──► shared_records_network (view)
```

Each user belongs to exactly one company. All their data is scoped by that `company_id`. The shared network is a cross-company read-only window into records that companies have explicitly published.

---

## What comes next

- **Phase 2**: Build the login / register flows using Supabase Auth
- **Phase 3**: Build the Records CRUD UI (`/dashboard/records`)
- **Phase 4**: Build the Shared Network search UI (`/dashboard/network`)
- **Phase 5**: Admin role features (invite teammates, manage company settings)
