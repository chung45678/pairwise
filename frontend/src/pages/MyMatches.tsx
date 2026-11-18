import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api, ApiError, type Me, type MyMatch, type Outcome, type Reason } from "../api";
import { countMarks, Marked } from "../components/Marked";
import { NameTag } from "../components/NameTag";
import { CopyButton, Loading, Notice, PageShell } from "../components/ui";
import { formatDate } from "../lib/highlight";
import { stagger, useInView, vars } from "../lib/motion";

function ReasonLine({ r, offset }: { r: Reason; offset: number }) {
  if (r.type === "roles") return <span>{r.text}</span>;
  return <Marked text={r.text} terms={r.terms} tone={r.type === "shared" ? "mint" : "marker"} offset={offset} />;
}

/** Running mark offsets so a card's highlights sweep in reading order. */
function markOffsets(reasons: Reason[]) {
  let n = 0;
  return reasons.map((r) => {
    const at = n;
    if (r.type !== "roles") n += countMarks(r.text, r.terms);
    return at;
  });
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
    <div className="bg-paper px-5 py-4 shadow-[0_-1px_0_var(--color-line)]">
      <p className="text-[15px] font-medium">Did you talk to {first}?</p>
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
              className={`rounded-[var(--radius-control)] px-3 py-1.5 text-[15px] font-medium transition-colors duration-[var(--dur-instant)] ${on ? "bg-tag text-white shadow-[0_0_0_1px_var(--color-tag)]" : "bg-surface shadow-[0_0_0_1px_var(--color-line)] hover:bg-ink/5 active:bg-ink/10"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {current?.outcome === "talked" && (
        <div className="enter mt-3" style={vars({ "--rise": "var(--rise-sm)" })}>
          <p className="text-[14px] text-muted">How useful was it?</p>
          <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={saving}
                aria-pressed={current.rating === n}
                aria-label={`${n} out of 5`}
                onClick={() => save("talked", n)}
                className={`size-10 rounded-[var(--radius-control)] text-[15px] font-medium transition-colors duration-[var(--dur-quick)] ${current.rating != null && n <= current.rating ? "bg-marker shadow-[0_0_0_1px_#14161b]" : "bg-surface shadow-[0_0_0_1px_var(--color-line)] hover:bg-ink/5 active:bg-ink/10"}`}
                style={vars({ transitionDelay: current.rating != null && n <= current.rating ? `${(n - 1) * 40}ms` : "0ms" })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-2 min-h-5 text-[13px]" aria-live="polite">
        {error ? <span className="text-danger">{error}</span> : current ? <span key={`${current.outcome}${current.rating}`} className="enter inline-block text-ok" style={vars({ "--rise": "4px" })}>Saved. Thanks, this helps the organizer.</span> : null}
      </p>
    </div>
  );
}

function MatchCard({ m, index, token, eventOver, onFeedback }: { m: MyMatch; index: number; token: string; eventOver: boolean; onFeedback: (f: MyMatch["my_feedback"]) => void }) {
  // Signature moment: as the card scrolls in, its evidence words are highlighted in order.
  const { ref, attrs } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const helpTerms = m.reasons.filter((r) => r.type === "complement").flatMap((r) => r.terms);
  const subtitle = [m.person.role, m.person.affiliation].filter(Boolean).join(", ");
  const offsets = markOffsets(m.reasons);
  return (
    <div ref={ref} {...attrs} className="reveal" style={vars({ "--delay": index === 0 ? "120ms" : "0ms" })}>
      <NameTag
        lead={index === 0 ? "Start with" : "Then find"}
        name={m.person.name}
        subtitle={subtitle}
        footer={eventOver ? <Feedback token={token} m={m} onSaved={onFeedback} /> : undefined}
      >
        <h3 className="text-[14px] font-medium text-muted">Why you two</h3>
        <ul
          {...attrs}
          className="sweepable mt-1.5 flex flex-col gap-1.5 text-[17px] leading-relaxed"
          style={vars({ "--sweep-delay": "420ms" })}
        >
          {m.reasons.length ? m.reasons.map((r, i) => <li key={i}><ReasonLine r={r} offset={offsets[i]} /></li>) : <li>You're both here to meet new people. That's enough.</li>}
        </ul>

        <h3 className="mt-5 text-[14px] font-medium text-muted">Say this</h3>
        <p className="mt-1 text-[17px] leading-relaxed">{m.icebreaker}</p>

        {(m.looking_for || m.can_help_with) && (
          <details className="group mt-5 rounded-[var(--radius-control)] px-4 py-3 shadow-[0_0_0_1px_var(--color-line)]">
            <summary className="cursor-pointer text-[14px] font-medium text-link">In {m.person.name.split(" ")[0]}'s words</summary>
            <dl className="enter mt-3 flex flex-col gap-3 text-[15px]" style={vars({ "--rise": "var(--rise-sm)" })}>
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
    </div>
  );
}

function CopyLink() {
  return (
    <CopyButton
      value={typeof window !== "undefined" ? window.location.href : ""}
      label="Copy this link"
      copiedLabel="Copied"
      className="!px-2.5 !py-1 align-middle"
    />
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
  if (!me) return <PageShell><Loading label="Loading your matches" lines={2} /></PageShell>;

  const first = me.name.split(" ")[0];
  const starts = me.event.starts_at ? new Date(me.event.starts_at) : null;
  const eventOver = !starts || starts.getTime() < Date.now();

  const updateFeedback = (matchId: number, f: MyMatch["my_feedback"]) =>
    setMe((cur) => cur && { ...cur, matches: cur.matches.map((m) => (m.match_id === matchId ? { ...m, my_feedback: f } : m)) });

  return (
    <PageShell>
      <p className="enter text-[14px] text-muted" style={stagger(0)}>{[me.event.name, formatDate(me.event.starts_at)].filter(Boolean).join(", ")}</p>
      <h1 className="enter mt-2 text-[32px] sm:text-[40px]" style={stagger(1)}>
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
        <div className="focus-in mt-8 rounded-[var(--radius-card)] bg-surface px-6 py-10 shadow-[var(--shadow-card)]" style={vars({ "--delay": "160ms" })}>
          <h2 className="text-[22px]">Your matches arrive before the event</h2>
          <p className="mt-2 max-w-[56ch] text-muted">
            The organizer is still collecting guests. Once they send matches, open this same link to see who to meet and why.
          </p>
          {!justJoined && <p className="mt-4"><CopyLink /></p>}
        </div>
      ) : me.matches.length === 0 ? (
        <div className="enter mt-8 rounded-[var(--radius-card)] bg-surface px-6 py-10 shadow-[var(--shadow-card)]" style={stagger(2)}>
          <h2 className="text-[22px]">No matches for you yet</h2>
          <p className="mt-2 max-w-[56ch] text-muted">You signed up after matching ran. Find the organizer at the door and they'll introduce you to someone.</p>
        </div>
      ) : (
        <>
          <p className="enter mt-4 max-w-[60ch] text-[17px] text-muted" style={stagger(2)}>
            {eventOver
              ? "After the event, tap whether you talked. It takes five seconds and tells the organizer if this worked."
              : "Highlighted words are what connected you. Find them, use the opener, and see where it goes."}
          </p>
          <div className="mt-10 flex flex-col gap-10">
            {me.matches.map((m, i) => (
              <MatchCard key={m.match_id} m={m} index={i} token={token} eventOver={eventOver} onFeedback={(f) => updateFeedback(m.match_id, f)} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
