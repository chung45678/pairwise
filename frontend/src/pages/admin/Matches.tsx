import { Download, RefreshCw, Send } from "lucide-react";
import { memo, useState } from "react";
import { api, type EventPublic, type MatchRow, type MatchStats } from "../../api";
import { countMarks, Marked } from "../../components/Marked";
import { Button, Notice } from "../../components/ui";
import { pct } from "../../lib/highlight";
import { useMounted, vars } from "../../lib/motion";

/** One pair. Rows deal in (first 8 staggered) and each row's highlights sweep as it lands. */
const Pair = memo(function Pair({ m, index, swept }: { m: MatchRow; index: number; swept: boolean }) {
  const talked = m.feedback.filter((f) => f.outcome === "talked").length;
  const slot = Math.min(index, 8);
  // Only the first screenful performs. Rows below the fold arrive already drawn,
  // which keeps a 40-pair list from repainting 100+ marks at once.
  const performs = index < 8;
  let n = 0;
  const offsets = m.reasons.map((r) => {
    const at = n;
    if (r.type !== "roles") n += countMarks(r.text, r.terms);
    return at;
  });
  return (
    <li
      className={`${performs ? "enter" : "[contain-intrinsic-size:auto_132px] [content-visibility:auto]"} grid grid-cols-[minmax(0,1fr)] gap-3 px-5 py-4 shadow-[0_1px_0_var(--color-line)] last:shadow-none md:grid-cols-[minmax(200px,0.8fr)_minmax(0,1.6fr)]`}
      style={vars({ "--i": slot, "--rise": "var(--rise-sm)" })}
    >
      <div>
        <p className="text-[16px] font-medium leading-tight">
          {m.a.name} <span className="font-normal text-muted">and</span> {m.b.name}
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {[m.a.role, m.b.role].filter(Boolean).join(" with ") || "Roles not given"}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          {m.round === 1 ? "Best match" : `Match ${m.round}`} with score {m.score.toFixed(2)}
          {m.feedback.length > 0 && `. ${talked} of ${m.feedback.length} said they talked`}
        </p>
      </div>
      <div className="text-[15px]">
        <ul
          className={performs ? "sweepable flex flex-col gap-1" : "flex flex-col gap-1"}
          style={vars({ "--sweep-delay": `${slot * 60 + 260}ms` })}
          {...(swept ? { "data-in": "" } : {})}
        >
          {m.reasons.length ? (
            m.reasons.map((r, i) => (
              <li key={i}>
                {r.type === "roles" ? r.text : <Marked text={r.text} terms={r.terms} tone={r.type === "shared" ? "mint" : "marker"} offset={offsets[i]} />}
              </li>
            ))
          ) : (
            <li className="text-muted">No strong overlap. This pair fills a gap so nobody is left out.</li>
          )}
        </ul>
        <p className="mt-2 text-muted">Opener: {m.icebreaker}</p>
      </div>
    </li>
  );
});

export function Matches({
  event,
  adminKey,
  matches,
  readyCount,
  onChange,
}: {
  event: EventPublic;
  adminKey: string;
  matches: MatchRow[];
  readyCount: number;
  onChange: (next: { event?: EventPublic; matches?: MatchRow[] }) => void;
}) {
  const [busy, setBusy] = useState<"" | "generate" | "publish" | "export">("");
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const published = event.status === "published";

  const run = async <T,>(kind: typeof busy, fn: () => Promise<T>) => {
    setBusy(kind);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  };

  const generate = () =>
    run("generate", async () => {
      const res = await api.admin.generate(event.slug, adminKey);
      setStats(res.stats);
      onChange({ matches: res.matches, event: { ...event, status: "matched" } });
    });

  const publish = () =>
    run("publish", async () => {
      const ev = await api.admin.publish(event.slug, adminKey);
      setConfirming(false);
      onChange({ event: ev });
    });

  const exportCsv = () =>
    run("export", async () => {
      const blob = await api.admin.exportCsv(event.slug, adminKey);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.slug}-matches.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const people = new Set(matches.flatMap((m) => [m.a.id, m.b.id])).size;
  // One timer for the whole list (not one per row) flips every row's sweep on.
  const swept = useMounted(40, matches);

  if (matches.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center shadow-[var(--shadow-card)]">
        <h2 className="text-[22px]">No matches yet</h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-[15px] text-muted">
          {readyCount < 2
            ? "You need at least two guests who've answered the intake questions."
            : `${readyCount} guests are ready. Matching takes a few seconds, and nobody sees anything until you send.`}
        </p>
        {error && <div className="mx-auto mt-4 max-w-md"><Notice tone="error">{error}</Notice></div>}
        <Button className="mt-6" onClick={generate} busy={busy === "generate"} disabled={readyCount < 2} arrow>
          Generate matches
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[19px]">{published ? "Matches sent" : "Review before you send"}</h2>
          <p className="mt-1 max-w-[72ch] text-[14px] text-muted">
            {matches.length} pairs covering {people} guests
            {stats && `, ${pct(stats.coverage)} of everyone ready`}.{" "}
            {!published && "Highlighted words show why each pair matched. Read a few. If something looks off, fix the guest's answers and regenerate."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!published && (
            <Button variant="secondary" onClick={generate} busy={busy === "generate"}>
              <RefreshCw aria-hidden className="size-4" /> Regenerate
            </Button>
          )}
          <Button variant="secondary" onClick={exportCsv} busy={busy === "export"}>
            <Download aria-hidden className="size-4" /> Export CSV
          </Button>
          {!published && !confirming && (
            <Button onClick={() => setConfirming(true)}>
              <Send aria-hidden className="size-4" /> Send matches
            </Button>
          )}
        </div>
      </div>

      {confirming && (
        <div className="enter mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[0_0_0_1px_var(--color-link),0_12px_32px_-16px_rgb(0_0_0/0.8)]" style={vars({ "--rise": "var(--rise-sm)" })}>
          <p className="max-w-[60ch] text-[15px]">
            Guests will see their matches on their private page. After sending you can't regenerate, so new sign-ups won't get matched.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>Keep reviewing</Button>
            <Button onClick={publish} busy={busy === "publish"}>Send to {people} guests</Button>
          </div>
        </div>
      )}
      {published && (
        <div className="mt-4">
          <Notice tone="ok">
            Sent. Guests who used the intake form already have their link. For guests imported from Luma, export the CSV:
            it has each person's private link for a mail merge or Slack message.
          </Notice>
        </div>
      )}
      {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}

      <ul className="mt-6 rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]">
        {matches.map((m, i) => <Pair key={m.id} m={m} index={i} swept={swept} />)}
      </ul>
    </div>
  );
}
