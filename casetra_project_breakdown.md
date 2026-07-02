# Casetra Project Breakdown

## 1. Product Overview

**Casetra** is a multi-tenant B2B SaaS platform built for title companies. Each company gets its own isolated workspace to manage, search, and share title records, abstracts, Qualia files, and attached documents.

The platform is designed around strict database-level security using PostgreSQL Row Level Security, so each company’s data remains isolated from every other company.

### Core Positioning

Casetra should not be described simply as a “database app.” A stronger positioning is:

> **A secure title-record intelligence platform that helps title companies find, manage, and safely share historical title files.**

A more direct sales version:

> **Find, search, organize, and safely share title records and abstracts faster.**

---

## 2. Main Customer

Casetra is built for:

- Title companies
- Law/title offices
- Settlement companies
- Abstractors
- Potentially underwriters later

The product works best as a vertical SaaS platform because the workflow is specific to title companies instead of being a generic document storage tool.

---

## 3. Current Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, React 19, Server Actions, Turbopack |
| Language | TypeScript 5 |
| Auth | Supabase Auth with PKCE and email/password |
| Database | Supabase PostgreSQL 15+, RLS, SECURITY DEFINER RPCs |
| Storage | Supabase Storage, `record-files` bucket |
| Styling | Tailwind CSS v4 |
| Email | Resend |
| Text extraction | unpdf, mammoth, tesseract.js |
| Search | PostgreSQL full-text search and pg_trgm trigram search |
| Deployment | Vercel |

---

## 4. Main Product Features

### Public Website

Casetra currently includes a dark editorial B2B landing page with:

- Hero section
- Feature grid
- “How it works” section
- Trust/security section
- Demo CTA
- Contact/demo request form

The website should remain demo-led instead of publicly showing pricing.

Recommended CTA language:

> **Build a demo**

or

> **Book a demo**

---

### Demo Request Page

The `/contact` page collects:

- Name
- Work email
- Company name
- Website
- Role
- Company type
- Team size
- Current system
- Main pain point
- Free-text message

Submissions are saved to `contact_submissions` with a service-role write path and deny-all RLS, meaning clients cannot directly read or write those records.

---

### Auth and Registration

Casetra supports:

- Login
- Registration
- Create your own company
- Join by invite token

This makes it work for both new company onboarding and team-member invitation flows.

---

## 5. Authenticated Dashboard Features

### Records

The records page is the core of the app. A record represents a title file, abstract, or Qualia file.

Current record features include:

- Create records
- Edit records
- Delete records
- Attach up to 5 files per record
- File limit of 10 MB each
- Supported file types: PDF, DOCX, images, TXT
- Server-side text extraction
- Search across metadata and document content
- Share individual records to the Shared Title Network
- Bulk-share or bulk-unshare up to 200 records
- County and state fields
- Paginated record list

---

### Record Detail Page

The record detail page includes:

- Record metadata
- Attached file list
- Signed download URLs with 1-hour expiry
- Record notes
- Audit trail

Record notes are useful because users can add context to shared records without changing the original record itself.

---

### Shared Title Network

The Shared Title Network is one of Casetra’s most important differentiators.

It allows companies to publish selected records so other companies can search and view them.

Current network features include:

- Read-only network view
- Search across shared records
- Metadata search
- Trigram search for structured identifiers
- Matched field display
- Matched file name display
- Highlighted excerpts
- Pagination

This could become Casetra’s strongest moat if sharing is made safe and intentional.

---

### Notifications

The notification system includes:

- Saved network searches
- Notification inbox
- Alerts when newly shared records match a saved search

This could eventually become valuable for title companies that frequently look for similar records, properties, counties, or identifiers.

---

### Audit Log

The audit log is admin-only and records actions such as:

- Record creation
- Record edits
- Record deletion
- Record sharing
- Record unsharing
- File uploads
- File deletions
- Member removals

Audit logging is especially important for trust, compliance, and internal accountability.

---

### Team Management

Admins can:

- Invite teammates by email
- Assign admin or member roles
- Revoke pending invitations
- Promote members
- Demote admins
- Remove members

The database prevents the last admin from being demoted, which is important for avoiding accidental account lockout.

---

### Settings

Users can update their full name.

Admins can also:

- Rename the company
- View storage usage
- See per-file storage breakdown
- Reconcile tracked database bytes against Supabase Storage actual bytes

The storage usage dashboard is important for future billing and platform-owner monitoring.

---

## 6. Platform Admin Console

The platform admin console is separate from normal company workspaces and is only accessible to platform staff.

It includes:

| Route | Purpose |
|---|---|
| `/platform` | Overview and stats |
| `/platform/companies` | All tenants with record/member/file counts |
| `/platform/companies/[id]` | Company detail, members, audit, metadata |
| `/platform/support` | Break-glass support sessions list |
| `/platform/support/[id]` | Support session browser |
| `/platform/audit` | Platform-wide append-only audit log |
| `/platform/admins` | Manage platform admins |

The platform owner dashboard should show company-level usage, including:

- Storage used
- Record count
- File count
- Member count
- Plan tier
- Billing limits

---

## 7. Security Architecture

Casetra has a strong security foundation.

Important security features include:

- RLS on every tenant table
- Company-level isolation
- SECURITY DEFINER RPCs for sensitive mutations
- `SET search_path = public` to prevent search-path injection
- Server-only service-role client
- Append-only audit logs
- Signed file URLs with 1-hour expiry
- Contact submissions locked behind service-role access

This security posture is one of the reasons Casetra can be positioned as a serious B2B tool instead of a basic file-storage app.

---

## 8. Known Product Gaps

Current known gaps include:

- All 50 US states are not yet in the state picker
- Expired invite cleanup is not automated
- No resend-invitation flow
- No AI record intelligence yet
- Sharing controls are not granular enough
- No file-level sharing
- No metadata-only sharing
- No advanced filters by type, state, county, shared/private
- No recent searches UI
- No light/dark mode toggle

The most important gaps are not cosmetic. The highest-priority gaps are:

1. Better search filters
2. Safer sharing controls
3. Resend/expired invite flows
4. Granular sharing permissions
5. AI intelligence later

---

## 9. Overall Product Assessment

Casetra is becoming a real vertical SaaS product.

The strongest aspects are:

- Clear customer type
- Real workflow pain point
- Strong security architecture
- Full-text document search
- Shared Title Network concept
- Admin/team management
- Platform owner dashboard
- Storage/billing foundation

The biggest risk is adding too many features before the core workflow feels excellent.

The core “aha moment” should be:

> A user uploads a title file, searches inside the document, and instantly finds the exact old record they need.

Every feature should support one of these outcomes:

- Find title records faster
- Understand title records faster
- Safely share title records
- Manage company access securely

---

## 10. Pricing Philosophy

Casetra should be priced in stages.

The current company should receive founding-customer pricing because they helped shape the product and are the first real use case.

Future customers should pay more as the product becomes safer, more polished, and more valuable.

Casetra should not show public pricing on the landing page yet. It should use a demo-led sales model.

---

## 11. Current Recommended Pricing

For the company currently using or testing Casetra:

| Item | Price |
|---|---:|
| Founding customer monthly plan | **$500/month** |
| Setup/onboarding fee | **Waived** |
| Basic support | Included |
| Bug fixes | Included |
| Small improvements | Included within reason |
| Larger custom features | Quoted separately |
| Data migration/import | Quoted separately |

Recommended language:

> Since you are the founding customer and helped shape the product, I can offer Casetra at $500/month for the first 12 months. That includes hosting, support, bug fixes, storage up to an agreed limit, and continued access to the current platform. Larger custom features or major data migration would be quoted separately.

---

## 12. Suggested Founding Customer Limits

A reasonable founding customer plan could include:

| Included | Limit |
|---|---:|
| Company workspace | 1 company |
| Users | Up to 5 users |
| Records | Up to 2,500 records |
| Storage | 50 GB included |
| Search | Included |
| Shared network | Included while in beta |
| Support/bug fixes | Included |
| Small improvements | Included within reason |

Possible overages:

| Overage | Price |
|---|---:|
| Extra users | $25/user/month |
| Extra storage | $25 per additional 100 GB/month |
| Large custom features | Quoted separately |
| Data migration/import | Quoted separately |

---

## 13. Future Pricing Stages

### Stage 1: Current Stage

For the first company or first few paying customers:

| Plan | Price |
|---|---:|
| Founding Customer | $500/month |
| Setup | Waived or small |
| Custom work | Quoted separately |

Goal: prove that a real company is willing to pay.

---

### Stage 2: Polished MVP

Once search, uploads, invites, audit logs, and storage tracking are stable:

| Plan | Price |
|---|---:|
| Starter | $199/month |
| Professional | $499/month |
| Enterprise | Custom, starting around $1,500/month |

Goal: get 3–10 paying companies.

---

### Stage 3: Production SaaS

Once sharing controls, filters, onboarding, resend invites, expired invite cleanup, and permissions are polished:

| Plan | Price |
|---|---:|
| Starter | $299/month |
| Professional | $799/month |
| Business | $1,499/month |
| Enterprise | Custom |

Goal: charge closer to the real operational value.

---

### Stage 4: AI Title Intelligence Platform

Once Casetra can summarize records, extract fields, compare records, answer questions over documents, and generate title-file summaries:

| Plan | Price |
|---|---:|
| Starter | $399/month |
| Professional | $999/month |
| Business | $1,999/month |
| Enterprise | $3,000+/month custom |

At this stage, Casetra is no longer just search/storage. It becomes a title intelligence platform.

---

## 14. Setup Fee Recommendation

A large setup fee can feel disingenuous if setup only takes a short time.

Instead of charging a large “setup fee,” Casetra should separate fees into honest categories:

| Fee Type | When to Charge |
|---|---|
| Setup fee | Only if real configuration is required |
| Onboarding fee | If training and workflow testing are involved |
| Migration fee | If importing old records/documents |
| Custom development fee | If special features are requested |
| Monthly subscription | Always, if they use the product |

For the current company, setup should probably be waived.

Recommended current structure:

> **$500/month, onboarding waived, custom work and data migration quoted separately.**

---

## 15. What Onboarding Actually Includes

Onboarding means getting the company from “new account” to “confident daily use.”

It can include:

- Creating the company workspace
- Meeting with the owner/admin
- Explaining what Casetra does and does not do
- Understanding how their office stores title files
- Deciding who should use it
- Walking through the first records
- Answering basic questions

This could be a 30–60 minute call for a simple company.

---

## 16. What Initial Configuration Includes

Initial configuration means setting up the workspace correctly.

For Casetra, this can include:

- Company name
- Admin users
- Member users
- Storage plan/limit
- Default roles
- State/county defaults
- Shared network settings
- Basic company settings
- Email/invite setup

Example configuration:

> Jeff and Kellie are admins. Other employees are members. The company is on the Professional plan with 100 GB storage. Shared Title Network access is enabled, but only admins can share records.

---

## 17. What Training Includes

Training teaches the team how to use the product.

For Casetra, training should cover:

- How to create a record
- How to upload files
- How to search document contents
- How to read highlighted snippets
- How to open a record detail page
- How to add notes
- How admins share/unshare records
- How the Shared Title Network works
- How invitations and roles work
- What members can and cannot do
- How to avoid accidentally sharing sensitive information

Training can be delivered through:

- Live call
- Loom video
- Short PDF guide
- In-app onboarding checklist

---

## 18. What Workflow Testing Includes

Workflow testing means testing whether Casetra fits their actual office process.

Example workflow to test:

1. Create a title record.
2. Upload title documents.
3. Search by property address.
4. Search by policy number.
5. Search by county/state.
6. Search inside PDF text.
7. Open the record.
8. Download a file.
9. Add a note.
10. Check the audit log.
11. Share to the network.
12. Confirm another company can only see what it is allowed to see.

The goal is to catch real workflow issues before the team depends on the system.

---

## 19. What Permission Checking Includes

Permission checking is especially important for title companies.

You should verify that:

- Members cannot access admin pages
- Members cannot invite users unless allowed
- Members cannot remove other users
- Members cannot share records if only admins should share
- Users from Company A cannot see Company B’s private records
- Shared network records are read-only
- Notes follow author permissions
- Platform admin tools are blocked from normal users
- File downloads are re-authorized before signed URLs are created

This work helps build trust in the product.

---

## 20. What Launch Support Includes

Launch support means making sure the team can use Casetra without confusion.

It may include:

- Confirming users received invites
- Confirming admins are correct
- Uploading sample records
- Testing real searches
- Testing file downloads
- Testing shared network access
- Confirming email notifications work
- Confirming storage tracking works
- Fixing small bugs before broader usage
- Being available during the first week for issues

The goal:

> The team can start using Casetra on Monday morning without needing every button explained again.

---

## 21. Qualia and Abstract Storage

The company has many abstracts stored in Qualia.

That changes the pricing and implementation conversation.

Casetra should not try to replace Qualia immediately.

A better positioning is:

> Qualia remains the operational closing/title production system. Casetra becomes the searchable title-record knowledge base for old abstracts, documents, and reusable records.

Casetra should complement Qualia, not compete directly with it at the beginning.

---

## 22. Data Migration Pricing

If the company has many abstracts stored in Qualia, then migration should be treated as paid project work.

Recommended current structure:

| Item | Price |
|---|---:|
| Casetra founding customer plan | $500/month |
| Setup/onboarding | Included or waived |
| First small sample import | Included |
| Additional migration | $75/hour or fixed quote |
| Custom Qualia import automation | Quoted separately |

Suggested migration pricing:

| Migration Type | Price |
|---|---:|
| First 25–50 record pilot import | Included or $250 |
| Clean CSV + organized folders import | $500–$1,500 |
| Messy archive migration | $75/hour or $2,500+ fixed quote |
| Full Qualia API sync | Later/custom quote |

---

## 23. What to Ask Before Quoting Migration

Before quoting a Qualia/archive migration, ask:

1. How many abstracts or records are in Qualia?
2. Can they export a spreadsheet of file metadata?
3. Can they bulk-download documents?
4. Are documents named consistently?
5. Do they want only abstracts or all title documents?
6. Do they want county/state/property fields imported?
7. Do they want old files searchable by document content?
8. Do they want manual cleanup/matching?

The key distinction:

> If they can export clean data, migration is easier. If the data is messy, migration becomes a real paid project.

---

## 24. Recommended Migration Strategy

Do not start with a full Qualia API integration.

Start with:

> **Export from Qualia → clean spreadsheet → bulk import into Casetra → upload documents → extract searchable text.**

This is safer, cheaper, and easier to validate.

---

## 25. Migration Levels

| Level | Method | Best For |
|---|---|---|
| 1 | CSV/spreadsheet + file upload | First version, easiest path |
| 2 | Bulk folder/ZIP import | Lots of PDFs and abstracts |
| 3 | Qualia API integration | Mature automated sync |

The recommended first milestone is Level 1 or Level 2.

---

## 26. Migration Data Needed

Important fields to request from Qualia or an exported spreadsheet:

- File number
- Property address
- County
- State
- Buyer/seller names, if useful
- Closing date, if useful
- Order status, if useful
- Policy number, if useful
- Abstract/title file name
- Document list
- Attached PDFs/documents
- Notes or internal comments, if needed

Minimum useful fields for Casetra:

| Casetra Field | Source |
|---|---|
| Title | File number + property address |
| Description | Optional notes/summary |
| County | County field |
| State | State field |
| Record type | Abstract, Qualia file, title file, etc. |
| Source system | Qualia |
| Source ID | Qualia file/order number |
| Files | PDFs, DOCX, scans, images |
| Search text | Extracted after upload |

The most important unique key is the Qualia file/order number.

---

## 27. Example Import Template

A basic CSV import template could look like this:

```csv
source_system,source_id,title,record_type,property_address,county,state,closing_date,description,folder_name
Qualia,FDL-2024-00123,"FDL-2024-00123 - 123 Main St",abstract,"123 Main St","East Baton Rouge","LA","2024-06-12","Old abstract file","FDL-2024-00123"
```

The matching folder structure could look like this:

```text
qualia-import/
  records.csv
  files/
    FDL-2024-00123/
      abstract.pdf
      title_commitment.pdf
      tax_certificate.pdf
    FDL-2024-00124/
      abstract.pdf
      closing_package.pdf
```

The `folder_name` column connects each CSV row to its matching document folder.

---

## 28. Recommended Import Tables

Casetra should not import directly into production records without tracking.

Recommended import tracking tables:

```sql
import_batches
- id
- company_id
- source_system
- uploaded_by
- status
- total_records
- successful_records
- failed_records
- created_at
- completed_at

import_batch_items
- id
- batch_id
- source_id
- raw_data jsonb
- status
- error_message
- created_record_id
- created_at
```

This allows an admin to see:

> Imported 482 records. 467 succeeded. 15 failed. Here are the errors.

---

## 29. Recommended Import Tool Flow

An import tool could live at:

```text
/dashboard/platform/companies/[id]/import
```

or for company admins:

```text
/dashboard/settings/import
```

Recommended flow:

1. Upload CSV.
2. Validate columns.
3. Preview the first 10 records.
4. Show warnings.
5. Upload ZIP of files.
6. Match CSV rows to folders.
7. Run import.
8. Show success/error report.

There should always be a preview step before importing.

---

## 30. Record Import Process

For each CSV row, the import script should:

1. Check whether `source_system = Qualia` and `source_id` already exists.
2. If not, create a new record.
3. Store imported metadata.
4. Attach files from the matching folder.
5. Upload files to Supabase Storage.
6. Insert file rows into the record files table.
7. Run text extraction.
8. Store extracted text for search.
9. Write audit log entries.

Recommended fields to add to records:

```sql
source_system text
source_external_id text
import_batch_id uuid
imported_at timestamptz
```

This helps track where each record came from.

---

## 31. File Upload Storage Path

A predictable Supabase Storage path should be used:

```text
record-files/{company_id}/{record_id}/{file_id}/{filename}
```

During upload, the importer should:

- Sanitize file names
- Reject unsupported file types
- Enforce file size limits
- Calculate file size
- Store MIME type
- Store original file name
- Store storage path
- Mark extraction status as pending

---

## 32. Text Extraction During Import

After each file upload, Casetra should run its text extraction pipeline.

| File Type | Tool |
|---|---|
| PDF | unpdf |
| DOCX | mammoth |
| Images | tesseract.js |
| TXT | Plain text extraction |

Important warning:

> Many old abstracts may be scanned PDFs. If the PDF is only images inside a PDF, normal PDF text extraction may return little or nothing. Casetra may eventually need scanned-PDF OCR, not just image OCR.

Recommended extraction statuses:

```text
pending → extracted → failed
```

Failed extraction should store an error message.

---

## 33. Import Validation Checklist

After import, validate:

- Number of CSV records vs. records created
- Number of files expected vs. files uploaded
- Storage bytes in database vs. Supabase Storage actual bytes
- Random sample of records opens correctly
- Search works for file number
- Search works for property address
- Search works for county/state
- Search works inside uploaded abstracts
- Signed URLs work
- RLS prevents cross-company data access

This validation work is a major reason migration should be charged separately.

---

## 34. Pilot Migration Recommendation

Do not migrate everything at once.

Start with:

> **25–50 Qualia records/abstracts**

Use that pilot to answer:

- Is the export clean?
- Are file names consistent?
- Are documents easy to match to records?
- Does text extraction work?
- Are the PDFs scanned?
- Does search find what the company expects?
- Are fields mapped correctly?

After the pilot succeeds, migrate the rest.

---

## 35. One-Time Import vs. Ongoing Sync

There are two different versions of Qualia integration.

### One-Time Historical Import

This means:

> Move old abstracts/title files into Casetra so they are searchable.

This is what Casetra should support first.

### Ongoing Qualia Sync

This means:

> Whenever a new Qualia file is created or updated, Casetra syncs automatically.

This is more advanced and should come later. It may require official Qualia API access.

Avoid scraping Qualia or using browser automation unless Qualia explicitly allows it.

---

## 36. Recommended First Import Milestone

Build a CSV + ZIP bulk importer before building a Qualia API integration.

Recommended first version:

```text
Admin uploads records.csv
Admin uploads files.zip
Casetra validates the CSV
Casetra matches each row to a folder in the ZIP
Casetra creates records
Casetra uploads files to Supabase Storage
Casetra extracts text
Casetra reports successes/failures
```

This gives most of the value with much less risk.

---

## 37. Product Roadmap Priorities

### Priority 1: Perfect the Demo Workflow

The demo workflow should be:

1. Create company account.
2. Create record.
3. Upload PDF/DOCX/image.
4. Extract text automatically.
5. Search document contents.
6. Show matched file, matched field, and highlighted snippet.
7. Open record.
8. View files, notes, and audit trail.
9. Share to network.
10. Find it from another company/network view.

This is the heart of the product.

---

### Priority 2: Finish Obvious Polish

Important polish items:

- Add all 50 states
- Add expired invite cleanup
- Add resend invitation
- Add advanced filters
- Add recent searches
- Add better empty states
- Add onboarding copy

Advanced filters matter more than light/dark mode right now.

---

### Priority 3: Improve Sharing Safety

Before heavily marketing the Shared Title Network, add:

- Metadata-only sharing
- File-level share selection
- Shared/private indicators
- Confirmation screen before bulk sharing
- Preview of exactly what another company will see
- Clear network access policy explanation

This will make companies more comfortable sharing records.

---

### Priority 4: Make Billing Limits Real

The storage panel and billing dashboard are good foundations.

Next, Casetra should support:

- Plan tier per company
- Storage limit
- File count limit
- Record count limit
- Member limit
- Warning at 80%
- Warning at 95%
- Soft-block or hard-block over limit
- Platform owner override
- “Contact us to increase limit” message

---

### Priority 5: Add AI Record Intelligence Carefully

Do not start with broad AI chat.

Recommended order:

1. Generate title record summary
2. Extract key fields from uploaded documents
3. Ask questions about one record’s documents
4. Compare two records
5. Ask questions across company records
6. Ask questions across network records

The first AI feature should probably be:

> **Generate title record summary**

It is easy to understand and strong in a demo.

---

## 38. Best Current Business Model

For the current company:

> **$500/month founding customer plan, setup waived, basic onboarding included, migration quoted separately.**

For future customers:

| Package | Price |
|---|---:|
| Starter | $199/month early, later $299/month |
| Professional | $499/month early, later $799–$999/month |
| Business | $1,499–$1,999/month |
| Enterprise | Custom, $3,000+/month |

For migration:

| Migration Work | Price |
|---|---:|
| Small clean import | $500–$1,500 |
| Messy archive migration | $75/hour or $2,500+ fixed |
| Large migration | $5,000–$10,000+ |
| API integration | Custom quote |

---

## 39. Recommended Message to Current Company

```text
Hi [Name],

I wanted to talk through the next step for Casetra, the title record and document search platform I’ve been building.

The project has grown from an initial internal tool into a more complete platform with company workspaces, document uploads, record search, team access, audit logs, storage tracking, and support for sharing title records.

Since your company has been the first real use case and has helped shape the product, I’d like to offer a founding-customer rate rather than standard pricing.

I can offer Casetra at $500/month for the first 12 months. This would include continued platform access, hosting, maintenance, bug fixes, basic support, and reasonable small improvements.

I would waive the onboarding/setup fee because you are the founding customer. If your team wants to migrate a large number of historical abstracts or Qualia files into Casetra, I would quote that separately based on the number of records, file structure, and how clean the export is.

Would you be open to discussing a simple monthly arrangement?
```

---

## 40. Final Recommendation

Casetra is strong enough to charge for now, but the pricing should be relationship-friendly.

The best current path is:

1. Charge the current company **$500/month**.
2. Waive setup/onboarding for them.
3. Include a small pilot import.
4. Charge separately for large Qualia/archive migration.
5. Build a CSV + ZIP importer before a Qualia API integration.
6. Improve search, filters, sharing safety, and onboarding before adding major AI features.
7. Raise pricing as the product matures.

The core business rule should be:

> The monthly fee covers the software. The migration fee covers moving and validating historical data. Custom feature work is quoted separately.

