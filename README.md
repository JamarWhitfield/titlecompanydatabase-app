# Title Network

A multi-tenant B2B SaaS platform for title companies. Each company manages private records (abstracts, Qualia files) and can optionally publish them to a shared read-only industry network accessible by all companies. Data isolation is enforced at the database layer with PostgreSQL Row Level Security — no application bug can leak one company's data to another.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions, Turbopack) |
| Language | TypeScript 5 |
| Auth | Supabase Auth (PKCE, email/password) |
| Database | Supabase (PostgreSQL 15+, RLS, SECURITY DEFINER RPCs) |
| Storage | Supabase Storage (`record-files` bucket) |
| Styling | Tailwind CSS 4 |
| Email | Resend |
| Text extraction | unpdf (PDF), mammoth (DOCX), tesseract.js (image OCR) |
| Full-text search | PostgreSQL `websearch_to_tsquery` + pg_trgm trigram ILIKE |

---

## Main Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Redirects to `/login` |
| `/login` | Public | Email/password login |
| `/register` | Public | New company registration, or invite-based join (via `?invite=<token>`) |
| `/auth/callback` | Public | Supabase PKCE callback handler |
| `/dashboard` | Authenticated | Summary / home |
| `/dashboard/records` | Authenticated | Company's own records — create, edit, delete, share, search |
| `/dashboard/records/[id]` | Authenticated | Record detail with file attachments and notes |
| `/dashboard/network` | Authenticated | Read-only shared industry network with search |
| `/dashboard/notifications` | Authenticated | Saved searches and notifications |
| `/dashboard/audit` | Admin only | Company-scoped append-only audit log |
| `/dashboard/team` | Admin only | Invite, revoke, role changes, remove members |

---

## Core Data Model

### `companies`
One row per title company (the tenant boundary).
`id`, `name`, `slug`, `created_at`

### `profiles`
One row per user. Extends `auth.users`. Connects a user to their company and role.
`id` (= `auth.users.id`), `company_id`, `full_name`, `role` (`admin` | `member`), `created_at`

### `company_records`
The primary entity. Owned by one company. Can be kept private or published to the shared network.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `company_id` | UUID | Owning company |
| `created_by` | UUID | Creating user |
| `title` | TEXT | Required, max 255 chars |
| `description` | TEXT | Optional, max 2000 chars |
| `record_type` | TEXT | `abstract` or `qualia_file` |
| `county` | TEXT | Optional location field |
| `state` | TEXT | Optional location field |
| `is_shared` | BOOLEAN | `false` by default |
| `shared_at` | TIMESTAMPTZ | Stamped by trigger on first share |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-managed |

### `record_files`
Attached documents for a record, with extracted text for search.
`id`, `company_id`, `record_id`, `name`, `path` (storage key), `size`, `mime_type`, `content_text` (extracted), `has_text` (stored boolean), `created_at`

### `record_notes`
Free-text notes on a record. Visible to own company; also writable by users from other companies on shared records (notes are scoped to the writer's company and not visible to the owning company).
`id`, `record_id`, `company_id`, `user_id`, `note_text`, `created_at`, `updated_at`

### `audit_logs`
Append-only trigger-written log of every `company_records` change.
Actions: `INSERT`, `UPDATE`, `DELETE`, `SHARE`, `UNSHARE`, `member_removed`

### `company_invitations`
Pending invites. Token is a UUID, valid for 7 days.
`id`, `company_id`, `email`, `role`, `invited_by`, `token`, `expires_at`, `accepted_at`, `created_at`

### `saved_searches`
Per-user saved network search terms that drive notifications.
`id`, `company_id`, `user_id`, `name`, `query_text`, `created_at`

### `notifications`
System-generated notifications (e.g. saved search matches).
`id`, `company_id`, `user_id`, `message`, `read_at`, `created_at`

---

## Auth / Invite Flow

### New company registration
1. User submits `/register` with `company_name`, `full_name`, `email`, `password`.
2. `supabase.auth.signUp()` creates the `auth.users` row, passing metadata.
3. The `handle_new_user` Postgres trigger fires and atomically creates the `companies` row and the `profiles` row (role = `admin`).
4. If email confirmation is disabled, a session is returned immediately and the user is redirected to `/dashboard`.

### Invite-based join
1. Admin at `/dashboard/team` submits an email + role.
2. `inviteMember` server action inserts a row into `company_invitations` and returns a token.
3. If `RESEND_API_KEY` is configured, a branded HTML email with the invite link is sent via Resend. The token is always returned so the admin can copy the link manually as a fallback.
4. Invitee opens `/register?invite=<token>`.
5. The page calls `get_invitation_by_token` RPC to validate the token, locking the email field and displaying the company name.
6. On submit, the `register` action calls `supabase.auth.signUp()` with `invite_token` in user metadata.
7. The `handle_new_user` trigger reads the token, skips company creation, and attaches the new profile to the inviting company with the pre-assigned role.

---

## File Upload / Search Flow

### Upload
1. User attaches up to 5 files (max 10 MB each) when creating or editing a record.
2. Each file is stored in Supabase Storage under `companyId/recordId/<uuid>.<ext>` in the `record-files` bucket.
3. `extractFileText` extracts text server-side (PDF → unpdf, DOCX → mammoth, TXT → plain, images → tesseract.js OCR) — best-effort, never blocks the upload.
4. Extracted text is stored in `record_files.content_text`. The `has_text` stored boolean is set by a trigger.
5. File deletion removes the storage object first, then the metadata row, preventing orphaned storage objects.
6. Downloads use server-issued signed URLs (1-hour expiry) that verify authorization: own company, or a shared record accessible to all.

### Search
- **Record metadata** is searched via `websearch_to_tsquery` FTS against title, description, county, state, and company name.
- **Document content** is searched via pg_trgm `ILIKE '%query%'`, which handles structured codes (index numbers, policy numbers) that FTS tokenizes poorly.
- Results include `match_source` (`metadata` | `document`), `matched_file_name`, and `relevance_rank`. The UI shows an amber badge when the match came from inside an uploaded document.
- Pagination is 20 rows per page, applied at the query/RPC level — never client-side.
- **My Records** (`/dashboard/records`) is scoped to the caller's company only, even though RLS also allows reading shared records. An explicit `company_id` filter is applied in addition to RLS.
- **Shared Network** (`/dashboard/network`) searches all shared records across all companies.

---

## Shared Network Behavior

- Records are **private by default** (`is_shared = false`).
- Admins and members of the owning company can toggle sharing individually or bulk-share/unshare up to 200 records at once. Bulk operations only flip records that are actually changing state, keeping the audit trail clean.
- Shared records appear in the `shared_records_network` SQL view, readable by all authenticated users but writable only by the owning company (RLS).
- Unsharing is permitted at any time; `shared_at` is preserved as historical record.
- Users from other companies may read shared records, download their files (via signed URL), and add their own private notes.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values. Never commit `.env.local`.

```bash
# Required — Supabase project credentials (safe to expose to the browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Required for the RLS test harness (tests/ only — never import in app/ code)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional — transactional email via Resend
# Without RESEND_API_KEY, invitations still work via the copy-link fallback.
RESEND_API_KEY=your-resend-api-key-here
# Verified sender. The default onboarding@resend.dev only delivers to the Resend
# account owner — use a verified-domain sender for real recipients.
RESEND_FROM=Title Network <invites@yourdomain.com>

# Optional — explicit base URL for invite links in emails.
# Falls back to forwarded request headers when absent (fine for local dev).
NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com
```

---

## Known Gaps

| Gap | Impact | Status |
|-----|--------|--------|
| `RESEND_API_KEY` not configured | Invitation emails not sent; admin copies link manually | Pending env setup |
| `US_STATES` list in record form has only 4 states | State dropdown incomplete | Not yet fixed |
| No resend-invitation action | Admin must revoke and re-invite to resend | Not built |
| No expired-invite cleanup job | Expired tokens remain in the table indefinitely | Not built |
| No company / profile settings UI | Cannot change company name or own profile in-app | Not built |

---

## Test Commands

```bash
# Run all tests
npm test

# Run only the RLS tenant-isolation tests
npm run test:rls

# Run only the search tests
node --test tests/search.test.mjs

# Type-check without emitting
npx tsc --noEmit

# Full production build
npm run build
```

Tests require `SUPABASE_SERVICE_ROLE_KEY` in the environment so the harness can seed and clean up two isolated companies. See `tests/helpers.mjs`.

---

## Deployment Notes

- **Migrations**: apply all files in `supabase/migrations/` in order against your production project before deploying.
- **Server Action body limit**: `next.config.ts` raises the limit to 55 MB to support up to 5 × 10 MB attachments. Ensure your hosting platform does not impose a lower limit.
- **tesseract.js** is in `serverExternalPackages` and must be available as a native module at runtime — it is not bundled by Next.js.
- **Email sending domain**: verify a domain in Resend and set `RESEND_FROM` to an address on that domain before going to production.
- **PKCE callback**: `/auth/callback` must remain a public route. The Next.js middleware already allowlists it.
- **`NEXT_PUBLIC_*` variables** are baked into the client bundle at build time — set them in your host's environment before building, not only at runtime.
