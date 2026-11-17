import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api, ApiError, type Attendee, type EventPublic, type MatchRow } from "../../api";
import { Button, Field, Input, Loading, Notice, PageShell, StatusPill } from "../../components/ui";
import { formatDate, readAdminKey } from "../../lib/highlight";
import { Guests } from "./Guests";
import { Matches } from "./Matches";
import { Results } from "./Results";

type Tab = "guests" | "matches" | "results";

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <div className="flex gap-2">
          <Input id={id} aria-describedby={d} readOnly value={value} onFocus={(e) => e.target.select()} className="font-[450] text-muted" />
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </Field>
  );
}

function EnterKey({ slug, onKey }: { slug: string; onKey: (k: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(`pairwise:admin:${slug}`, value.trim());
    } catch {
      /* ignore */
    }
    onKey(value.trim());
  };
  return (
    <PageShell>
      <h1 className="text-[36px]">Organizer access</h1>
      <p className="mt-2 max-w-[56ch] text-muted">
        Open the dashboard link you saved when you created this event, or paste the admin key from it.
      </p>
      <form onSubmit={submit} className="mt-6 flex max-w-md flex-col gap-4">
        <Field label="Admin key">{(id) => <Input id={id} required value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
        <Button type="submit" className="self-start">Open dashboard</Button>
      </form>
    </PageShell>
  );
}

export function Admin() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  const [key, setKey] = useState<string | null>(() => readAdminKey(slug));
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const tabParam = new URLSearchParams(location.search).get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(tabParam ?? "guests");
  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  };
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const [data, ms] = await Promise.all([api.admin.event(slug, key), api.admin.matches(slug, key)]);
      setEvent(data.event);
      setAttendees(data.attendees);
      setMatches(ms);
      setError("");
      return data.event;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setKey(null);
      setError(e instanceof Error ? e.message : "Couldn't load the dashboard");
    }
  }, [slug, key]);

  useEffect(() => {
    load().then((ev) => {
      if (ev && ev.status !== "draft" && !tabParam) setTabState(ev.status === "published" ? "results" : "matches");
    });
    // Clear the key from the address bar once it's saved, so screenshots don't leak it.
    if (window.location.hash.includes("key="))
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [load]);

  if (!key) return <EnterKey slug={slug} onKey={setKey} />;
  if (error && !event) return <PageShell><Notice tone="error">{error}</Notice></PageShell>;
  if (!event) return <PageShell wide><Loading label="Loading dashboard" /></PageShell>;

  const origin = window.location.origin;
  const ready = attendees.filter((a) => a.intake_complete).length;
  const tabs: { id: Tab; label: string }[] = [
    { id: "guests", label: `Guests (${attendees.length})` },
    { id: "matches", label: matches.length ? `Matches (${matches.length})` : "Matches" },
    { id: "results", label: "Results" },
  ];

  return (
    <PageShell wide right={<StatusPill status={event.status} />}>
      {justCreated && (
        <div className="mb-8">
          <Notice>
            <p className="font-semibold">Bookmark this dashboard.</p>
            <p className="mt-1">There are no accounts, so this private link is how you get back in.</p>
            <div className="mt-3 max-w-xl">
              <CopyField label="Organizer link" value={`${origin}/e/${slug}/admin#key=${key}`} />
            </div>
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,440px)] lg:items-end">
        <div>
          <p className="text-[15px] text-muted">{[formatDate(event.starts_at), event.location].filter(Boolean).join(", ") || "No date set"}</p>
          <h1 className="mt-1 text-[36px] sm:text-[44px]">{event.name}</h1>
        </div>
        <CopyField label="Intake link for guests" value={`${origin}/e/${slug}/join`} hint="Post it in your event chat or add it to the Luma confirmation email." />
      </div>

      <div role="tablist" aria-label="Dashboard sections" className="mt-10 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-[3px] px-4 py-2.5 text-[15px] font-semibold ${tab === t.id ? "border-tag text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-8">
        {tab === "guests" && <Guests event={event} adminKey={key} attendees={attendees} reload={async () => void (await load())} />}
        {tab === "matches" && (
          <Matches
            event={event}
            adminKey={key}
            matches={matches}
            readyCount={ready}
            onChange={({ event: ev, matches: ms }) => {
              if (ev) setEvent(ev);
              if (ms) setMatches(ms);
            }}
          />
        )}
        {tab === "results" && <Results event={event} adminKey={key} />}
      </div>
    </PageShell>
  );
}
