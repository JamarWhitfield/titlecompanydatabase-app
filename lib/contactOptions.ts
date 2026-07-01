// Option sets for the demo-request form at /contact.
//
// These are shared by the client form (to render the <select> menus) and the
// server action (to validate that a submitted value is one we actually offer,
// so a tampered request can't smuggle arbitrary strings into the database).
// Keeping them in one plain module means the UI and the validation can never
// drift apart.

export const COMPANY_TYPES = [
  "Title company",
  "Law firm",
  "Title + law firm",
  "Abstractor",
  "Other",
] as const;

export const TEAM_SIZES = [
  "Just me",
  "2–5",
  "6–15",
  "16–50",
  "51–200",
  "200+",
] as const;

export const CURRENT_SYSTEMS = [
  "Qualia",
  "SoftPro",
  "RamQuest",
  "Local folders",
  "Google Drive / Dropbox",
  "Email-based workflow",
  "Other",
] as const;

export const PAIN_POINTS = [
  "Finding old records",
  "Searching inside PDFs/documents",
  "Sharing records with other companies",
  "Managing team access",
  "Audit/history tracking",
  "Moving away from scattered folders",
  "Other",
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];
export type TeamSize = (typeof TEAM_SIZES)[number];
export type CurrentSystem = (typeof CURRENT_SYSTEMS)[number];
export type PainPoint = (typeof PAIN_POINTS)[number];
