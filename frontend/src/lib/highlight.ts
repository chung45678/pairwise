// Split text into plain and highlighted segments for a set of evidence terms.
// Longest terms win, matching is case-insensitive and respects word boundaries.

export interface Segment {
  text: string;
  mark: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function highlight(text: string, terms: string[]): Segment[] {
  const clean = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!text || clean.length === 0) return text ? [{ text, mark: false }] : [];

  const pattern = new RegExp(`(?<![\\w])(${clean.map(escape).join("|")})(?![\\w])`, "gi");
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start), mark: false });
    out.push({ text: m[0], mark: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mark: false });
  return out;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function pct(v: number | null | undefined, digits = 0): string {
  return v == null ? "No data yet" : `${(v * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Admin keys travel in the URL fragment (#key=...) so they never hit server logs. */
export function readAdminKey(slug: string): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("key");
  try {
    if (fromHash) {
      localStorage.setItem(`pairwise:admin:${slug}`, fromHash);
      return fromHash;
    }
    return localStorage.getItem(`pairwise:admin:${slug}`);
  } catch {
    return fromHash;
  }
}
