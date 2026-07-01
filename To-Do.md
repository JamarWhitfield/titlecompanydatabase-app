# To Do

# Urgent Fixes
- Potentially a light and dark mode

## 2. Fix the Small Obvious Gaps

After docs:

- [ ] Add all 50 states to `US_STATES`
- [ ] Add expired invite cleanup
- [ ] Add resend invitation
- [x] Add company/profile settings
- [ ] Add better empty states/onboarding text

These are small polish items that make the app feel real.

---

## 3. Improve Search UX

This is probably the most important near-term feature.

Add:

- [x] Search result snippets
- [x] Highlighted matched text
- [x] Matched filename
- [ ] Matched field: title, description, county, state, document content
- [ ] Filters for company records vs network records
- [ ] Filters for record type, state, county, shared/private
- [ ] Recent searches

Right now, searching inside documents is a backend win. You need to make it obvious in the UI.

---

## 4. Add AI-Assisted Record Intelligence

Once search is solid, add AI features like:

- [ ] “Summarize this record”
- [ ] “Extract property details from this document”
- [ ] “Find index numbers in this file”
- [ ] “What documents are missing?”
- [ ] “Compare two records”
- [ ] “Ask a question about this record’s documents”
- [ ] “Generate a title file summary”

This is where the app becomes more than a shared database.

---

## 5. Make Sharing Safer and More Intentional

Before real companies use the shared network, add controls:

- [ ] Shared record preview
- [ ] Warning before sharing
- [ ] Ability to share only metadata, not documents
- [ ] Ability to share selected files only
- [ ] Company-level default sharing settings
- [ ] Audit log for who shared/unshared
- [ ] “Shared with network” badge everywhere
- [ ] Admin approval before members can share

For title companies, “sharing” is sensitive. You need very clear permission boundaries.

---

## My Recommendation to Your Coding Agent

Tell the agent:

```text
Update the README and TITLE_NETWORK_DATABASE_DESIGN.md so they accurately reflect the current shipped application state.

Use the real implementation as the source of truth, especially:
- Next.js 16 App Router, React 19, Server Actions
- Supabase Auth, Postgres, RLS, Storage
- Company/profile multi-tenancy
- company_records using abstract / qualia_file
- explicit county/state fields
- file uploads to Supabase Storage
- content_text extraction for PDFs, DOCX, text files, and images
- search_company_records hybrid search with FTS + pg_trgm ILIKE
- shared_records_network read-only view
- saved searches and notifications
- team invitations and Resend fallback
- audit logs
- current known gaps

Remove or clearly mark aspirational/outdated sections that mention older record types like property/lien/escrow or a JSONB data model if they are not currently used.

After updating docs, implement the US_STATES fix by replacing the current limited state list with all 50 U.S. states and verify the record form still works.
```

---

## Strategic Direction

The best positioning is probably not:

> “Database for title companies.”

That sounds too generic.

Better:

> “A secure document intelligence and record-sharing network for title companies.”

Or:

> “The shared records layer for title companies.”

Or:

> “Search, manage, and share title records across your company and trusted network.”

This is a good SaaS idea because it is vertical, workflow-specific, document-heavy, and has a clear pain point. The next big step is making the search/document intelligence experience feel obviously better than using folders, Dropbox, email, or Qualia alone.
