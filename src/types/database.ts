// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript --linked` once the project
// is linked, and this file can be replaced by the generated one.

export type AppRole = "member" | "support" | "admin";
export type ProfileStatus = "unclaimed" | "claimed" | "pro";

export interface ProfileFields {
  serviceArea?: string;
  photo?: boolean;
  licence?: string[];
  businessHours?: string;
  yearStarted?: string;
  skills?: string[];
  services?: string[];
  headline?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  owner_id: string | null;
  name: string;
  profession: string;
  org: string;
  location: string;
  email: string | null;
  phone: string | null;
  status: ProfileStatus;
  fields: ProfileFields;
  completeness: number;
  created_at: string;
  claimed_at: string | null;
  last_activity_at: string;
}

export interface UserRole {
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  profile_id: string | null;
  event: string;
  detail: string | null;
  actor_id: string | null;
  ts: string;
}

export type ConversationKind = "coach" | "copilot";
export type ConversationStatus = "active" | "completed" | "abandoned";

export interface AiMessage {
  role: "assistant" | "user" | "system";
  text: string;
  ts: string;
  quickReplies?: string[];
}

export interface AiConversation {
  id: string;
  profile_id: string;
  kind: ConversationKind;
  messages: AiMessage[];
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
}

export type SupportStatus = "open" | "pending" | "resolved" | "closed";
export type SupportChannel = "ai" | "human";

export interface SupportConversation {
  id: string;
  profile_id: string | null;
  requester_id: string | null;
  subject: string;
  status: SupportStatus;
  channel: SupportChannel;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: "member" | "agent" | "ai";
  sender_id: string | null;
  body: string;
  created_at: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

export interface Campaign {
  id: string;
  name: string;
  segment: string;
  subject: string;
  body: string;
  html_body: string;
  status: CampaignStatus;
  created_by: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignSendStatus = "queued" | "sent" | "opened" | "clicked" | "bounced" | "failed";

export interface CampaignSend {
  id: string;
  campaign_id: string;
  profile_id: string | null;
  status: CampaignSendStatus;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

export interface ConversionEvent {
  id: string;
  type: string;
  profile_id: string | null;
  metadata: Record<string, unknown>;
  ts: string;
}

export interface Subscription {
  id: string;
  profile_id: string;
  plan: string;
  status: "active" | "past_due" | "canceled";
  current_period_end: string | null;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
}

export interface Survey {
  id: string;
  name: string;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  profile_id: string | null;
  respondent_name: string;
  rating: number;
  comments: string | null;
  created_at: string;
}

export interface ReportExport {
  id: string;
  report_key: string;
  report_label: string;
  format: "xlsx" | "csv" | "pdf";
  range_start: string | null;
  range_end: string | null;
  row_count: number;
  file_size_bytes: number;
  storage_path: string;
  requested_by: string | null;
  requested_by_label: string;
  created_at: string;
}

// Mapped-type wrappers (Homomorphic<T>, Partial<T>) get an implicit index
// signature from TS; a plain interface referenced by name does not, so
// without this, Row/Insert/Update below fail the GenericTable structural
// check (`Row extends Record<string, unknown>`) that postgrest-js's client
// generics require, and every query silently resolves to `never`.
type Homomorphic<T> = { [K in keyof T]: T[K] };
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Homomorphic<Row>;
  Insert: Homomorphic<Insert>;
  Update: Homomorphic<Update>;
  Relationships: [];
};

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: Table<Profile>;
      user_roles: Table<UserRole>;
      audit_log: Table<AuditLogEntry>;
      ai_conversations: Table<AiConversation>;
      support_conversations: Table<SupportConversation>;
      support_messages: Table<SupportMessage>;
      campaigns: Table<Campaign>;
      campaign_sends: Table<CampaignSend>;
      notifications: Table<NotificationRow>;
      conversion_events: Table<ConversionEvent>;
      subscriptions: Table<Subscription>;
      surveys: Table<Survey>;
      survey_responses: Table<SurveyResponse>;
      report_exports: Table<ReportExport>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_profile: {
        Args: Homomorphic<{ p_profile_id: string }>;
        Returns: Homomorphic<Profile>;
      };
    };
  };
}
