import { Download, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { api, type EventPublic, type MatchRow, type MatchStats } from "../../api";
import { Marked } from "../../components/Marked";
import { Button, Notice } from "../../components/ui";
import { pct } from "../../lib/highlight";

function Pair({ m }: { m: MatchRow }) {
  const talked = m.feedback.filter((f) => f.outcome === "talked").length;
  return (
    <li className="grid gap-3 border-b border-line px-5 py-4 last:border-0 md:grid-cols-[minmax(220px,0.8fr)_1.6fr]">
      <div>
        <p className="font-display text-[19px] font-bold leading-tight">
          {m.a.name} <span className="font-sans text-[15px] font-normal text-muted">and</span> {m.b.name}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {[m.a.role, m.b.role].filter(Boolean).join(" with ") || "Roles not given"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {m.round === 1 ? "Best match" : `Match ${m.round}`} with score {m.score.toFixed(2)}
          {m.feedback.length > 0 && `. ${talked} of ${m.feedback.length} said they talked`}
        </p>
      </div>
      <div className="text-[15px]">
        <ul className="flex flex-col gap-1">
          {m.reasons.length ? (
            m.reasons.map((r, i) => (
              <li key={i}>{r.type === "roles" ? r.text : <Marked text={r.text} terms={r.terms} tone={r.type === "shared" ? "mint" : "marker"} />}</li>
            ))
          ) : (
            <li className="text-muted">No strong overlap. This pair fills a gap so nobody is left out.</li>
          )}
        </ul>
        <p className="mt-2 text-muted">Opener: {m.icebreaker}</p>
      </div>
    </li>
  );
}

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

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
        <h2 className="text-[24px]">No matches yet</h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-[15px] text-muted">
          {readyCount < 2
            ? "You need at least two guests who've answered the intake questions."
            : `${readyCount} guests are ready. Matching takes a few seconds, and nobody sees anything until you send.`}
        </p>
        {error && <div className="mx-auto mt-4 max-w-md"><Notice tone="error">{error}</Notice></div>}
        <Button className="mt-6" onClick={generate} busy={busy === "generate"} disabled={readyCount < 2}>
          Generate matches
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px]">{published ? "Matches sent" : "Review before you send"}</h2>
          <p className="mt-1 text-[15px] text-muted">
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tag/30 bg-tag/5 px-5 py-4">
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

      <ul className="mt-6 rounded-xl border border-line bg-surface">
        {matches.map((m) => <Pair key={m.id} m={m} />)}
      </ul>
    </div>
  );
}
