import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

const SUGGESTED = [
  "product management",
  "ux design",
  "web dev",
  "machine learning",
  "startups",
  "data science",
  "fintech",
  "co-op",
  "content creation",
  "research",
];

export const MAX_TAGS = 10;

export function TagInput({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());

  const add = (raw: string) => {
    const parts = raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      if (next.length >= MAX_TAGS) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 40));
    }
    onChange(next);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const suggestions = SUGGESTED.filter((s) => !has(s));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-field/70 bg-surface px-2.5 py-2 transition-colors duration-[var(--dur-instant)] hover:border-field focus-within:border-link focus-within:ring-3 focus-within:ring-link/20">
        {value.map((t) => (
          <span key={t} className="chip-in inline-flex items-center gap-1 rounded-lg bg-mint px-2 py-1 text-[14px] text-[#14161b]">
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== t))}
              className="rounded p-0.5 transition-colors duration-[var(--dur-instant)] hover:bg-black/10"
              aria-label={`Remove ${t}`}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-describedby={describedBy}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft.trim() && add(draft)}
          disabled={value.length >= MAX_TAGS}
          placeholder={value.length ? "" : "Type and press Enter"}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-[16px] focus:outline-none"
        />
      </div>
      {suggestions.length > 0 && value.length < MAX_TAGS && (
        <div className="flex flex-wrap gap-2" aria-label="Suggestions">
          {suggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-lg px-2 py-1 text-[13px] text-muted shadow-[0_0_0_1px_var(--color-line)] transition-colors duration-[var(--dur-instant)] hover:bg-ink/6 hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
