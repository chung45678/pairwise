import { useEffect, useState } from "react";
import { api, type EventPublic, type Metrics } from "../../api";
import { Loading, Notice } from "../../components/ui";
import { pct } from "../../lib/highlight";
import { vars } from "../../lib/motion";

function Funnel({ m }: { m: Metrics }) {
  const steps = [
    { label: "Registered", value: m.registered },
    { label: "Answered intake", value: m.intake_complete },
    { label: "Matched", value: m.matched },
    { label: "Gave feedback", value: m.gave_feedback },
  ];
  const max = Math.max(1, m.registered);
  return (
    <figure>
      <figcaption className="text-[16px] font-medium">Guest funnel</figcaption>
      <ol className="mt-3 flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const step = prev ? ` (${Math.round((s.value / prev) * 100)}% of previous)` : "";
          return (
            <li key={s.label} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 text-[14px]" title={`${s.label}: ${s.value}${step}`}>
              <span className="text-muted">{s.label}</span>
              <span
                className="grow-x h-4 rounded-r-[4px] bg-bar"
                style={vars({ width: `${(s.value / max) * 100}%`, minWidth: s.value ? 4 : 0, "--i": i, "--delay": "360ms" })}
              />
              <span className="tabular-nums font-medium">{s.value}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function Results({ event, adminKey }: { event: EventPublic; adminKey: string }) {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.admin.metrics(event.slug, adminKey).then(setM).catch((e) => setError(e.message));
  }, [event.slug, adminKey, event.status]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!m) return <Loading />;

  if (event.status !== "published") {
    return (
      <div className="rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center shadow-[var(--shadow-card)]">
        <h2 className="text-[22px]">Results show up after you send matches</h2>
        <p className="mx-auto mt-2 max-w-[56ch] text-[15px] text-muted">
          The day after your event, ask guests to open their link and tap whether they talked. That's where these numbers come from.
        </p>
      </div>
    );
  }

  const r1 = m.by_round.find((r) => r.round === 1);
  const later = m.by_round.filter((r) => r.round > 1);
  const laterFb = later.reduce((s, r) => s + r.with_feedback, 0);
  const laterRate = laterFb ? later.reduce((s, r) => s + r.talked, 0) / laterFb : null;

  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[16px] font-medium">Conversations that happened</p>
          <p className="focus-in display mt-2 text-[64px] sm:text-[80px]">{pct(m.conversation_rate)}</p>
          <p className="mt-3 max-w-[52ch] text-[14px] text-muted">
            Of the {m.matches_with_feedback} matches where someone answered, at least one person said they talked.
            Counting every match, including ones with no answer, the floor is {pct(m.conversation_rate_all)}.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 self-center">
          <div className="enter" style={vars({ "--i": 0, "--delay": "200ms" })}>
            <dt className="text-[15px] text-muted">Average rating</dt>
            <dd className="mt-1 text-[28px] font-medium tracking-[-0.02em]">{m.avg_rating ? `${m.avg_rating.toFixed(1)} / 5` : "None yet"}</dd>
          </div>
          <div className="enter" style={vars({ "--i": 1, "--delay": "200ms" })}>
            <dt className="text-[15px] text-muted">Coverage</dt>
            <dd className="mt-1 text-[28px] font-medium tracking-[-0.02em]">{pct(m.coverage)}</dd>
          </div>
          <div className="enter" style={vars({ "--i": 2, "--delay": "200ms" })}>
            <dt className="text-[15px] text-muted">Feedback from</dt>
            <dd className="mt-1 text-[28px] font-medium tracking-[-0.02em]">{m.gave_feedback} guests</dd>
          </div>
          <div className="enter" style={vars({ "--i": 3, "--delay": "200ms" })}>
            <dt className="text-[15px] text-muted">Couldn't find match</dt>
            <dd className="mt-1 text-[28px] font-medium tracking-[-0.02em]">{m.outcomes.missed}</dd>
          </div>
        </dl>
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-12 pt-10 shadow-[0_-1px_0_var(--color-line)] md:grid-cols-2">
        <Funnel m={m} />
        <div>
          <p className="text-[16px] font-medium">Is the ranking working?</p>
          <p className="mt-1 text-[14px] text-muted">
            Best matches should turn into conversations more often than later ones. If they don't, the scoring needs tuning.
          </p>
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-sm text-muted">
              <tr className="shadow-[0_1px_0_var(--color-line)]">
                <th className="py-2 font-medium">Match</th>
                <th className="py-2 font-medium">Answered</th>
                <th className="py-2 text-right font-medium">Talked</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="shadow-[0_1px_0_var(--color-line)]">
                <td className="py-2">Best match</td>
                <td className="py-2">{r1?.with_feedback ?? 0} of {r1?.matches ?? 0}</td>
                <td className="py-2 text-right font-medium">{pct(r1?.conversation_rate)}</td>
              </tr>
              <tr>
                <td className="py-2">Second and later</td>
                <td className="py-2">{laterFb} of {later.reduce((s, r) => s + r.matches, 0)}</td>
                <td className="py-2 text-right font-medium">{pct(laterRate)}</td>
              </tr>
            </tbody>
          </table>
          {r1?.conversation_rate != null && laterRate != null && (
            <p className="mt-3 text-[15px]">
              {r1.conversation_rate > laterRate + 0.05
                ? "Best matches converted more often. The ranking is doing its job."
                : "Best matches didn't clearly beat later ones. Worth checking the intake questions or scoring weights."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
