import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api, ApiError, type Me, type MyMatch, type Outcome, type Reason } from "../api";
import { Marked } from "../components/Marked";
import { NameTag } from "../components/NameTag";
import { Loading, Notice, PageShell } from "../components/ui";
import { formatDate } from "../lib/highlight";

function ReasonLine({ r }: { r: Reason }) {
  if (r.type === "roles") return <span>{r.text}</span>;
  return <Marked text={r.text} terms={r.terms} tone={r.type === "shared" ? "mint" : "marker"} />;
}

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: "talked", label: "We talked" },
  { value: "missed", label: "Couldn't find them" },
  { value: "skipped", label: "Skipped" },
];

function Feedback({ token, m, onSaved }: { token: string; m: MyMatch; onSaved: (f: MyMatch["my_feedback"]) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = m.my_feedback;
  const first = m.person.name.split(" ")[0];

  const save = async (outcome: Outcome, rating: number | null = null) => {
    setSaving(true);
    setError("");
    try {
      onSaved(await api.feedback(token, { match_id: m.match_id, outcome, rating }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-line bg-paper/60 px-5 py-4">
      <p className="text-[15px] font-semibold">Did you talk to {first}?</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Did you talk to ${first}?`}>
        {OUTCOMES.map((o) => {
          const on = current?.outcome === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={saving}
              aria-pressed={on}
              onClick={() => save(o.value, o.value === "talked" ? current?.rating ?? null : null)}
              className={`rounded-lg border px-3 py-1.5 text-[15px] font-semibold transition-colors ${on ? "border-tag bg-tag text-white" : "border-line bg-surface hover:border-ink/40"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {current?.outcome === "talked" && (
        <div className="mt-3">
          <p className="text-[15px] text-muted">How useful was it?</p>
          <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={saving}
                aria-pressed={current.rating === n}
                aria-label={`${n} out of 5`}
                onClick={() => save("talked", n)}
                className={`size-10 rounded-lg border text-[15px] font-semibold ${current.rating != null && n <= current.rating ? "border-ink bg-marker" : "border-line bg-surface hover:border-ink/40"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-2 min-h-5 text-sm" aria-live="polite">
        {error ? <span className="text-danger">{error}</span> : current ? <span className="text-ok">Saved. Thanks, this helps the organizer.</span> : null}
      </p>
    </div>
  );
}

function MatchCard({ m, index, token, eventOver, onFeedback }: { m: MyMatch; index: number; token: string; eventOver: boolean; onFeedback: (f: MyMatch["my_feedback"]) => void }) {
  const helpTerms = m.reasons.filter((r) => r.type === "complement").flatMap((r) => r.terms);
  const subtitle = [m.person.role, m.person.affiliation].filter(Boolean).join(", ");
  return (
    <NameTag
      lead={index === 0 ? "Start with" : "Then find"}
      name={m.person.name}
      subtitle={subtitle}
      footer={eventOver ? <Feedback token={token} m={m} onSaved={onFeedback} /> : undefined}
    >
      <h4 className="text-[15px] font-semibold text-muted">Why you two</h4>
      <ul className="mt-1.5 flex flex-col gap-1.5 text-[17px] leading-relaxed">
        {m.reasons.length ? m.reasons.map((r, i) => <li key={i}><ReasonLine r={r} /></li>) : <li>You're both here to meet new people. That's enough.</li>}
      </ul>

      <h4 className="mt-5 text-[15px] font-semibold text-muted">Say this</h4>
      <p className="mt-1 text-[17px] leading-relaxed">{m.icebreaker}</p>

      {(m.looking_for || m.can_help_with) && (
        <details className="group mt-5 rounded-lg border border-line px-4 py-3">
          <summary className="cursor-pointer text-[15px] font-semibold text-tag">In {m.person.name.split(" ")[0]}'s words</summary>
          <dl className="mt-3 flex flex-col gap-3 text-[15px]">
            {m.looking_for && (
              <div>
                <dt className="text-muted">Looking for</dt>
                <dd><Marked text={m.looking_for} terms={helpTerms} /></dd>
              </div>
            )}
            {m.can_help_with && (
              <div>
                <dt className="text-muted">Can help with</dt>
                <dd><Marked text={m.can_help_with} terms={helpTerms} /></dd>
              </div>
            )}
            {m.person.interests.length > 0 && (
              <div>
                <dt className="text-muted">Interests</dt>
                <dd>{m.person.interests.join(", ")}</dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </NameTag>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the URL bar still works */
        }
      }}
      className="inline-flex items-center gap-1.5 font-semibold text-tag hover:underline"
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? "Copied" : "Copy this link"}
    </button>
  );
}

export function MyMatches() {
  const { token = "" } = useParams();
  const location = useLocation();
  const justJoined = Boolean((location.state as { justJoined?: boolean } | null)?.justJoined);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.me(token).then(setMe).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your matches."));
  }, [token]);

  if (error) return <PageShell><Notice tone="error">{error}</Notice></PageShell>;
  if (!me) return <PageShell><Loading label="Loading your matches" /></PageShell>;

  const first = me.name.split(" ")[0];
  const starts = me.event.starts_at ? new Date(me.event.starts_at) : null;
  const eventOver = !starts || starts.getTime() < Date.now();

  const updateFeedback = (matchId: number, f: MyMatch["my_feedback"]) =>
    setMe((cur) => cur && { ...cur, matches: cur.matches.map((m) => (m.match_id === matchId ? { ...m, my_feedback: f } : m)) });

  return (
    <PageShell>
      <p className="text-[15px] text-muted">{[me.event.name, formatDate(me.event.starts_at)].filter(Boolean).join(", ")}</p>
      <h1 className="mt-1 text-[36px] sm:text-[44px]">
        {me.published ? `${first}, here's who to find` : `You're in, ${first}`}
      </h1>

      {justJoined && (
        <div className="mt-6">
          <Notice tone="ok">
            Saved. This page is private to you and it's where your matches will show up. <CopyLink />
          </Notice>
        </div>
      )}

      {!me.published ? (
        <div className="mt-8 rounded-[var(--radius-tag)] border border-dashed border-line bg-surface px-6 py-10">
          <h2 className="text-[24px]">Your matches arrive before the event</h2>
          <p className="mt-2 max-w-[56ch] text-muted">
            The organizer is still collecting guests. Once they send matches, open this same link to see who to meet and why.
          </p>
          {!justJoined && <p className="mt-4"><CopyLink /></p>}
        </div>
      ) : me.matches.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-tag)] border border-dashed border-line bg-surface px-6 py-10">
          <h2 className="text-[24px]">No matches for you yet</h2>
          <p className="mt-2 max-w-[56ch] text-muted">You signed up after matching ran. Find the organizer at the door and they'll introduce you to someone.</p>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
            {eventOver
              ? "After the event, tap whether you talked. It takes five seconds and tells the organizer if this worked."
              : "Highlighted words are what connected you. Find them, use the opener, and see where it goes."}
          </p>
          <div className="mt-8 flex flex-col gap-8">
            {me.matches.map((m, i) => (
              <MatchCard key={m.match_id} m={m} index={i} token={token} eventOver={eventOver} onFeedback={(f) => updateFeedback(m.match_id, f)} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
