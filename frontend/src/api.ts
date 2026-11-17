// Typed client for the Pairwise API. Mirrors backend/pairwise/schemas.py.

export type EventStatus = "draft" | "matched" | "published";
export type Outcome = "talked" | "missed" | "skipped";

export interface EventPublic {
  slug: string;
  name: string;
  description: string;
  starts_at: string | null;
  location: string;
  matches_per_person: number;
  status: EventStatus;
}

export interface EventCreated extends EventPublic {
  admin_key: string;
}

export interface Attendee {
  id: number;
  name: string;
  email: string;
  role: string;
  affiliation: string;
  interests: string[];
  looking_for: string;
  can_help_with: string;
  intake_complete: boolean;
  source: string;
  token: string;
}

export interface Reason {
  type: "complement" | "shared" | "roles";
  text: string;
  terms: string[];
}

export interface PersonCard {
  id: number;
  name: string;
  role: string;
  affiliation: string;
  interests: string[];
}

export interface MatchRow {
  id: number;
  round: number;
  score: number;
  a: PersonCard;
  b: PersonCard;
  reasons: Reason[];
  icebreaker: string;
  feedback: { attendee_id: number; outcome: Outcome; rating: number | null }[];
}

export interface MatchStats {
  attendees: number;
  matches: number;
  coverage: number;
  mean_score: number;
  min_best_score: number;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: { row: number; reason: string }[];
  mapping: Record<string, string>;
  unmapped_headers: string[];
}

export interface MyMatch {
  match_id: number;
  round: number;
  person: PersonCard;
  looking_for: string;
  can_help_with: string;
  reasons: Reason[];
  icebreaker: string;
  my_feedback: { outcome: Outcome; rating: number | null } | null;
}

export interface Me {
  event: EventPublic;
  name: string;
  intake_complete: boolean;
  published: boolean;
  matches: MyMatch[];
}

export interface Metrics {
  registered: number;
  intake_complete: number;
  matched: number;
  gave_feedback: number;
  matches: number;
  matches_with_feedback: number;
  conversation_rate: number | null;
  conversation_rate_all: number | null;
  avg_rating: number | null;
  coverage: number | null;
  outcomes: Record<Outcome, number>;
  by_round: {
    round: number;
    matches: number;
    with_feedback: number;
    talked: number;
    conversation_rate: number | null;
  }[];
}

export interface IntakeBody {
  name: string;
  email: string;
  role: string;
  affiliation: string;
  interests: string[];
  looking_for: string;
  can_help_with: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, adminKey?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (adminKey) headers.set("X-Admin-Key", adminKey);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        const d = body.detail[0];
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
        message = `${field ? `${field}: ` : ""}${String(d.msg).replace(/^Value error, /, "")}`;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  createEvent: (body: Partial<EventPublic> & { name: string }) =>
    request<EventCreated>("/api/events", { method: "POST", body: json(body) }),
  event: (slug: string) => request<EventPublic>(`/api/events/${slug}`),
  intake: (slug: string, body: IntakeBody) =>
    request<{ token: string; updated: boolean }>(`/api/events/${slug}/intake`, {
      method: "POST",
      body: json(body),
    }),

  admin: {
    event: (slug: string, key: string) =>
      request<{ event: EventPublic; attendees: Attendee[] }>(`/api/admin/events/${slug}`, {}, key),
    importCsv: (slug: string, key: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<ImportResult>(`/api/admin/events/${slug}/import`, { method: "POST", body: form }, key);
    },
    removeAttendee: (slug: string, key: string, id: number) =>
      request<void>(`/api/admin/events/${slug}/attendees/${id}`, { method: "DELETE" }, key),
    generate: (slug: string, key: string) =>
      request<{ stats: MatchStats; matches: MatchRow[] }>(
        `/api/admin/events/${slug}/match`,
        { method: "POST" },
        key,
      ),
    matches: (slug: string, key: string) =>
      request<MatchRow[]>(`/api/admin/events/${slug}/matches`, {}, key),
    publish: (slug: string, key: string) =>
      request<EventPublic>(`/api/admin/events/${slug}/publish`, { method: "POST" }, key),
    metrics: (slug: string, key: string) =>
      request<Metrics>(`/api/admin/events/${slug}/metrics`, {}, key),
    exportCsv: async (slug: string, key: string) => {
      const res = await fetch(`/api/admin/events/${slug}/matches.csv`, {
        headers: { "X-Admin-Key": key },
      });
      if (!res.ok) throw new ApiError(res.status, "Export failed");
      return res.blob();
    },
  },

  me: (token: string) => request<Me>(`/api/me/${token}`),
  feedback: (token: string, body: { match_id: number; outcome: Outcome; rating?: number | null }) =>
    request<{ outcome: Outcome; rating: number | null }>(`/api/me/${token}/feedback`, {
      method: "POST",
      body: json(body),
    }),
};
