import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Marked } from "../components/Marked";
import { NameTag } from "../components/NameTag";
import { Brand, Button, Field, Input, Notice } from "../components/ui";
import { stagger, useInView, useMounted, vars } from "../lib/motion";

const REPO_URL = import.meta.env.VITE_REPO_URL as string | undefined;

/** Signature moment: two name tags deal onto the table, then the marker sweeps the evidence. */
function HeroTags() {
  // Tags land at ~0.9s; the sweep starts as the second one settles.
  const swept = useMounted(80);
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0" aria-label="Example match">
      <NameTag
        name="Jordan"
        subtitle="Designer, UW Blueprint"
        headingLevel={3}
        className="deal relative z-10"
        style={vars({ "--tilt": "-2deg", "--i": 0, "--delay": "240ms" })}
      >
        <p className="text-[14px] text-muted">Why you two</p>
        <p
          className="sweepable mt-1 text-[17px] leading-relaxed"
          style={vars({ "--sweep-delay": "1000ms" })}
          {...(swept ? { "data-in": "" } : {})}
        >
          You're looking for <Marked text="design feedback" terms={["design feedback"]} /> on your
          mockups. Jordan does <Marked text="portfolio reviews" terms={["portfolio reviews"]} offset={1} /> every
          week, and you're both into <Marked tone="mint" text="user research" terms={["user research"]} offset={2} />.
        </p>
      </NameTag>
      <NameTag
        name="Maya"
        subtitle="Product Manager, UW PM"
        headingLevel={3}
        className="deal relative -mt-6 ml-10 sm:ml-16"
        style={vars({ "--tilt": "1.5deg", "--i": 1, "--delay": "240ms" })}
      >
        <p className="text-[14px] text-muted">Say this</p>
        <p className="mt-1 text-[17px] leading-relaxed">
          "What's one thing that actually helped you get better at design feedback?"
        </p>
      </NameTag>
    </div>
  );
}

function CreateEvent() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [k, setK] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ev = await api.createEvent({
        name,
        location,
        matches_per_person: k,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      });
      nav(`/e/${ev.slug}/admin#key=${ev.admin_key}`, { state: { justCreated: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the event. Try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-[20px]">Set up your event</h2>
      <Field label="Event name">
        {(id) => (
          <Input id={id} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="PM x Blueprint Winter Mixer" />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date and time">
          {(id) => <Input id={id} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
        </Field>
        <Field label="Location">
          {(id) => <Input id={id} maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="E7 4th floor" />}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[14px] font-medium">People to meet, per guest</legend>
        <div className="relative inline-grid w-fit grid-cols-3 rounded-[var(--radius-control)] p-1 shadow-[0_0_0_1px_var(--color-line)]">
          {/* One sliding thumb instead of three repainting backgrounds. */}
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-ink transition-transform duration-[var(--dur-base)] ease-[var(--ease-drawer)]"
            style={{ transform: `translateX(${(k - 1) * 100}%)` }}
          />
          {[1, 2, 3].map((n) => (
            <label
              key={n}
              className={`relative z-10 cursor-pointer rounded-lg px-4 py-1.5 text-center text-[15px] font-medium transition-colors duration-[var(--dur-quick)] has-focus-visible:outline-3 has-focus-visible:outline-link ${k === n ? "text-paper" : "text-muted hover:text-ink"}`}
            >
              <input type="radio" name="k" value={n} checked={k === n} onChange={() => setK(n)} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
        <p className="text-[13px] text-muted">Two works for most mixers. Use three for events over two hours.</p>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" busy={busy} arrow className="mt-1 self-start">
        Create event
      </Button>
    </form>
  );
}

function Steps() {
  const { ref, attrs } = useInView<HTMLOListElement>();
  const steps = [
    ["Bring your guest list", "Upload the Luma export or share one intake link. Guests say what they're looking for and what they can help with."],
    ["Review the matches", "Every pair comes with the words that connected them, so a bad match is obvious before anyone sees it."],
    ["Send links, then measure", "Each guest gets a private page with their matches. The next day they tap whether they talked."],
  ];
  return (
    <ol ref={ref} className="flex flex-col gap-8">
      {steps.map(([title, body], i) => (
        <li key={title} {...attrs} className="reveal flex gap-4" style={vars({ "--delay": `${i * 90}ms` })}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]">
            {i + 1}
          </span>
          <div>
            <h2 className="text-[19px]">{title}</h2>
            <p className="mt-1 max-w-[52ch] text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Landing() {
  const form = useInView<HTMLDivElement>();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Brand />
        {REPO_URL && (
          <a href={REPO_URL} className="text-[14px] text-muted transition-colors duration-[var(--dur-instant)] hover:text-ink">
            Source on GitHub
          </a>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-14 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <h1 className="enter display max-w-[14ch] text-[40px] sm:text-[64px]" style={stagger(0)}>
              Tell everyone at your event who to meet, and why.
            </h1>
            <p className="enter mt-6 max-w-[48ch] text-[17px] text-muted" style={vars({ "--i": 0, "--delay": "160ms" })}>
              Guests fill a 60-second form. Pairwise suggests two or three people each of them should find,
              with the exact reason and an opener. After the event, you see how many conversations actually
              happened.
            </p>
          </div>
          <HeroTags />
        </section>

        <section className="grid gap-12 py-16 shadow-[0_-1px_0_var(--color-line)] lg:grid-cols-[1fr_1.05fr] lg:py-24">
          <Steps />
          <div ref={form.ref} {...form.attrs} className="reveal" style={vars({ "--delay": "120ms" })}>
            <CreateEvent />
          </div>
        </section>
      </main>

      <footer className="py-10 text-center text-[13px] text-muted shadow-[0_-1px_0_var(--color-line)]">
        Free and open source. Built for student clubs. No LinkedIn scraping: Pairwise only uses what guests tell it.
      </footer>
    </div>
  );
}
