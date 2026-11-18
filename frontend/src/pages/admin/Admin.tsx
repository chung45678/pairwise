import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api, ApiError, type Attendee, type EventPublic, type MatchRow } from "../../api";
import { Button, CopyButton, Field, Input, Loading, Notice, PageShell, StatusPill } from "../../components/ui";
import { formatDate, readAdminKey } from "../../lib/highlight";
import { stagger } from "../../lib/motion";
import { Guests } from "./Guests";
import { Matches } from "./Matches";
import { Results } from "./Results";

type Tab = "guests" | "matches" | "results";

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <div className="flex gap-2">
          <Input id={id} aria-describedby={d} readOnly value={value} onFocus={(e) => e.target.select()} className="min-w-0 text-muted" />
          <CopyButton value={value} />
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
      <h1 className="enter text-[32px] sm:text-[40px]" style={stagger(0)}>Organizer access</h1>
      <p className="enter mt-3 max-w-[56ch] text-muted" style={stagger(1)}>
        Open the dashboard link you saved when you created this event, or paste the admin key from it.
      </p>
      <form onSubmit={submit} className="enter mt-8 flex max-w-md flex-col gap-4" style={stagger(2)}>
        <Field label="Admin key">{(id) => <Input id={id} required value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
        <Button type="submit" arrow className="self-start">Open dashboard</Button>
      </form>
    </PageShell>
  );
}

/** Tabs with one underline that slides to the active tab (transform only). */
function Tabs({ tabs, active, onChange }: { tabs: { id: Tab; label: string }[]; active: Tab; onChange: (t: Tab) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const labels = tabs.map((t) => t.label).join("|");

  const measure = useCallback(() => {
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (btn) setBar({ x: btn.offsetLeft, w: btn.offsetWidth });
  }, [active]);

  useLayoutEffect(measure, [measure, labels]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div ref={listRef} role="tablist" aria-label="Dashboard sections" className="relative mt-12 flex gap-1 shadow-[0_1px_0_var(--color-line)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          data-tab={t.id}
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-[15px] font-medium transition-colors duration-[var(--dur-instant)] ${active === t.id ? "text-ink" : "text-muted hover:text-ink"}`}
        >
          {t.label}
        </button>
      ))}
      {bar && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-[2px] w-px origin-left bg-ink transition-transform duration-[var(--dur-base)] ease-[var(--ease-drawer)]"
          style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w})` }}
        />
      )}
    </div>
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
  const [error, setError] = useState("");

  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="mb-10">
          <Notice>
            <p className="font-medium">Bookmark this dashboard.</p>
            <p className="mt-1 text-muted">There are no accounts, so this private link is how you get back in.</p>
            <div className="mt-3 max-w-xl">
              <CopyField label="Organizer link" value={`${origin}/e/${slug}/admin#key=${key}`} />
            </div>
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-end">
        <div>
          <p className="enter text-[14px] text-muted" style={stagger(0)}>
            {[formatDate(event.starts_at), event.location].filter(Boolean).join(", ") || "No date set"}
          </p>
          <h1 className="enter mt-2 text-[32px] sm:text-[40px]" style={stagger(1)}>{event.name}</h1>
        </div>
        <div className="enter" style={stagger(2)}>
          <CopyField label="Intake link for guests" value={`${origin}/e/${slug}/join`} hint="Post it in your event chat or add it to the Luma confirmation email." />
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="enter pt-10" style={{ ["--rise" as string]: "var(--rise-sm)" }}>
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
