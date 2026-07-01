// Convenience types used across the app

export type Company = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Profile = {
  id: string;
  company_id: string;
  full_name: string | null;
  role: "admin" | "member";
  created_at: string;
};

// Profile joined with its company — returned by getProfile() in lib/dal.ts
export type ProfileWithCompany = Profile & {
  companies: Company | null;
};

// Flat shape of a company_records row — used across the records UI
export type CompanyRecord = {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string | null;
  record_type: string;
  data: Json;
  county: string | null;
  state: string | null;
  is_shared: boolean;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecordType = "abstract" | "qualia_file";

// Why a record surfaced in a full-text search. Returned by the
// search_company_records RPC (see migration 0018) so the UI can explain the
// match — e.g. "Matched inside closing_documents.pdf".
export type MatchSource = "title" | "description" | "location" | "document";

// A CompanyRecord plus the search match metadata. Match fields are optional
// because the plain (non-search) record listing path returns bare records.
export type CompanyRecordSearchResult = CompanyRecord & {
  match_source?: MatchSource | null;
  matched_file_name?: string | null;
  snippet?: string | null;
  relevance_rank?: number | null;
};

// Row shape returned by the shared_records_network view
export type SharedRecord = {
  id: string;
  company_id: string;
  company_name: string;
  title: string;
  description: string | null;
  record_type: string;
  data: Json;
  county: string | null;
  state: string | null;
  shared_at: string | null;
};

// File attachment metadata — actual file lives in Supabase Storage
export type RecordFile = {
  id: string;
  company_id: string;
  record_id: string;
  name: string;
  path: string;
  size: number;
  mime_type: string;
  created_at: string;
  // Whether text was successfully extracted and indexed for search.
  // Derived from the generated `has_text` column; optional so callers
  // that don't select it stay compatible.
  indexed?: boolean;
};

// Internal collaboration note on a record. Notes are private to the
// author's company (see migration 0014).
export type RecordNote = {
  id: string;
  record_id: string;
  company_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
};

// A saved Shared Network search term (see migration 0015).
export type SavedSearch = {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  query_text: string;
  created_at: string;
};

// An invitation for a new teammate to join an existing company
// (see migration 0016). Created by an admin; consumed at registration.
export type CompanyInvitation = {
  id: string;
  company_id: string;
  email: string;
  role: "admin" | "member";
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

// In-app notification raised when a newly shared record matches a saved
// search from another company (see migration 0015).
export type Notification = {
  id: string;
  company_id: string;
  user_id: string | null;
  saved_search_id: string | null;
  record_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

// ============================================================
// Platform Admin Console (see migration 0023)
// ============================================================

// A platform operator's access level, stored in platform_admins — entirely
// separate from the per-company admin/member role.
export type PlatformRole = "owner" | "support" | "auditor";

// A row of the append-only platform audit trail, as returned by the
// platform_list_platform_audit_logs RPC (actor/company names resolved).
export type PlatformAuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  target_company_id: string | null;
  target_company: string | null;
  target_user_id: string | null;
  target_record_id: string | null;
  metadata: Json;
  reason: string | null;
  created_at: string;
};

// A break-glass support session, as returned by the support-session RPCs.
export type PlatformSupportSession = {
  id: string;
  actor_user_id?: string;
  company_id: string;
  company_name: string;
  reason: string;
  expires_at: string;
  created_at: string;
  active: boolean;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          company_id: string;
          full_name: string | null;
          role: "admin" | "member";
          created_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          full_name?: string | null;
          role?: "admin" | "member";
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          full_name?: string | null;
          role?: "admin" | "member";
          created_at?: string;
        };
        Relationships: [];
      };
      company_records: {
        Row: {
          id: string;
          company_id: string;
          created_by: string;
          title: string;
          description: string | null;
          record_type: string;
          data: Json;
          county: string | null;
          state: string | null;
          is_shared: boolean;
          shared_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          record_type: string;
          data?: Json;
          county?: string | null;
          state?: string | null;
          is_shared?: boolean;
          shared_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          record_type?: string;
          data?: Json;
          county?: string | null;
          state?: string | null;
          is_shared?: boolean;
          shared_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          company_id: string | null;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          user_id?: string | null;
          action: string;
          table_name: string;
          record_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      record_files: {
        Row: {
          id: string;
          company_id: string;
          record_id: string;
          name: string;
          path: string;
          size: number;
          mime_type: string;
          content_text: string | null;
          has_text: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          record_id: string;
          name: string;
          path: string;
          size: number;
          mime_type?: string;
          content_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          record_id?: string;
          name?: string;
          path?: string;
          size?: number;
          mime_type?: string;
          content_text?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      record_notes: {
        Row: {
          id: string;
          record_id: string;
          company_id: string;
          user_id: string;
          note_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          company_id: string;
          user_id: string;
          note_text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          note_text?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          name: string;
          query_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          name: string;
          query_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          query_text?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          user_id: string | null;
          saved_search_id: string | null;
          record_id: string | null;
          message: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id?: string | null;
          saved_search_id?: string | null;
          record_id?: string | null;
          message: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      company_invitations: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          role: "admin" | "member";
          token: string;
          invited_by: string | null;
          accepted_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          email: string;
          role?: "admin" | "member";
          token?: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: "admin" | "member";
          accepted_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      shared_records_network: {
        Row: {
          id: string;
          company_id: string;
          company_name: string;
          title: string;
          description: string | null;
          record_type: string;
          data: Json;
          county: string | null;
          state: string | null;
          shared_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      search_company_records: {
        Args: { search_query: string };
        Returns: (Database["public"]["Tables"]["company_records"]["Row"] & {
          match_source: "title" | "description" | "location" | "document" | null;
          matched_file_name: string | null;
          relevance_rank: number | null;
        })[];
      };
      search_shared_records: {
        Args: { search_query: string };
        Returns: Database["public"]["Views"]["shared_records_network"]["Row"][];
      };
      // Billable, application-level storage for the caller's company, summed
      // from record_files.size (database metadata — never bucket inspection).
      get_company_storage_usage: {
        Args: Record<string, never>;
        Returns: {
          total_bytes: number;
          file_count: number;
        }[];
      };
      // Owner-only, read-only reconciliation report. Flags record_files rows
      // whose storage object is missing, and storage objects with no matching
      // record_files row. Never deletes anything.
      check_company_storage_drift: {
        Args: Record<string, never>;
        Returns: {
          issue_type: "missing_object" | "orphaned_object";
          object_path: string;
          file_id: string | null;
          record_id: string | null;
          file_name: string;
          size_bytes: number;
        }[];
      };
      get_record_audit_trail: {
        Args: { p_record_id: string };
        Returns: {
          id: string;
          action: string;
          user_id: string | null;
          actor_name: string | null;
          created_at: string;
          detail: string | null;
        }[];
      };
      get_invitation_by_token: {
        Args: { invite_token: string };
        Returns: {
          company_name: string;
          email: string;
          role: "admin" | "member";
        }[];
      };
      set_member_role: {
        Args: { target_user: string; new_role: string };
        Returns: undefined;
      };
      remove_member: {
        Args: { target_user: string };
        Returns: undefined;
      };
      platform_current_role: {
        Args: Record<string, never>;
        Returns: PlatformRole | null;
      };
      platform_get_stats: {
        Args: Record<string, never>;
        Returns: {
          total_companies: number;
          total_users: number;
          total_records: number;
          total_shared_records: number;
          total_files: number;
        }[];
      };
      platform_list_companies: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          member_count: number;
          record_count: number;
          shared_count: number;
          file_count: number;
        }[];
      };
      // Owner-only aggregate usage per company. Storage from
      // SUM(record_files.size); aggregate numbers only (no file/record detail).
      platform_list_company_usage: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          slug: string;
          plan: "trial" | "starter" | "growth" | "enterprise";
          storage_bytes: number;
          storage_limit_bytes: number | null;
          user_count: number;
          user_limit: number | null;
          record_count: number;
          record_limit: number | null;
          file_count: number;
        }[];
      };
      // Owner-only upsert of a company's plan + limits. NULL limit = unlimited.
      platform_set_company_billing: {
        Args: {
          p_company_id: string;
          p_plan: string;
          p_storage_limit_bytes?: number | null;
          p_user_limit?: number | null;
          p_record_limit?: number | null;
        };
        Returns: undefined;
      };
      platform_get_company_details: {
        Args: { p_company_id: string };
        Returns: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          member_count: number;
          record_count: number;
          shared_count: number;
          private_count: number;
          file_count: number;
        }[];
      };
      platform_list_company_members: {
        Args: { p_company_id: string };
        Returns: {
          user_id: string;
          full_name: string | null;
          email: string;
          role: "admin" | "member";
          created_at: string;
        }[];
      };
      platform_list_company_audit_logs: {
        Args: { p_company_id: string };
        Returns: {
          id: string;
          action: string;
          actor_name: string | null;
          record_id: string | null;
          created_at: string;
        }[];
      };
      platform_list_platform_audit_logs: {
        Args: Record<string, never>;
        Returns: PlatformAuditLog[];
      };
      platform_list_admins: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          full_name: string | null;
          role: PlatformRole;
          enabled: boolean;
          created_at: string;
        }[];
      };
      platform_add_admin: {
        Args: { target_email: string; target_role: string };
        Returns: string;
      };
      platform_set_admin_role: {
        Args: { target_user: string; new_role: string };
        Returns: undefined;
      };
      platform_set_admin_enabled: {
        Args: { target_user: string; new_enabled: boolean };
        Returns: undefined;
      };
      platform_start_support_session: {
        Args: { p_company_id: string; p_reason: string };
        Returns: string;
      };
      platform_get_support_session: {
        Args: { p_session_id: string };
        Returns: PlatformSupportSession[];
      };
      platform_list_my_support_sessions: {
        Args: Record<string, never>;
        Returns: PlatformSupportSession[];
      };
      platform_end_support_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      platform_support_list_records: {
        Args: { p_session_id: string };
        Returns: {
          id: string;
          title: string;
          record_type: string;
          county: string | null;
          state: string | null;
          is_shared: boolean;
          created_at: string;
          file_count: number;
        }[];
      };
      platform_support_get_record: {
        Args: { p_session_id: string; p_record_id: string };
        Returns: {
          id: string;
          title: string;
          description: string | null;
          record_type: string;
          county: string | null;
          state: string | null;
          is_shared: boolean;
          created_at: string;
          updated_at: string;
        }[];
      };
      platform_support_list_files: {
        Args: { p_session_id: string; p_record_id: string };
        Returns: {
          id: string;
          name: string;
          size: number;
          mime_type: string;
          created_at: string;
        }[];
      };
      platform_support_authorize_download: {
        Args: { p_session_id: string; p_file_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
