import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Marked } from "../components/Marked";
import { NameTag } from "../components/NameTag";
import { Brand, Button, Field, Input, Notice } from "../components/ui";

const REPO_URL = import.meta.env.VITE_REPO_URL as string | undefined;

function HeroTags() {
  return (
    <div className="sweep relative mx-auto w-full max-w-md lg:mx-0">
      <NameTag name="Jordan" subtitle="Designer, UW Blueprint" className="relative z-10 -rotate-2">
        <p className="text-[15px] text-muted">Why you two</p>
        <p className="mt-1 text-[17px] leading-relaxed">
          You're looking for <Marked text="design feedback" terms={["design feedback"]} /> on your
          mockups. Jordan does <Marked text="portfolio reviews" terms={["portfolio reviews"]} /> every
          week, and you're both into <Marked tone="mint" text="user research" terms={["user research"]} />.
        </p>
      </NameTag>
      <NameTag
        name="Maya"
        subtitle="Product Manager, UW PM"
        className="relative -mt-6 ml-10 rotate-[1.5deg] opacity-95 sm:ml-16"
      >
        <p className="text-[15px] text-muted">Say this</p>
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
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[24px]">Set up your event</h2>
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
        <legend className="mb-1.5 text-[15px] font-semibold">People to meet, per guest</legend>
        <div className="inline-flex w-fit rounded-lg border border-line p-1">
          {[1, 2, 3].map((n) => (
            <label key={n} className={`cursor-pointer rounded-md px-4 py-1.5 text-[15px] font-semibold has-focus-visible:outline-3 has-focus-visible:outline-tag ${k === n ? "bg-tag text-white" : "text-muted hover:text-ink"}`}>
              <input type="radio" name="k" value={n} checked={k === n} onChange={() => setK(n)} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">Two works for most mixers. Use three for events over two hours.</p>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" busy={busy} className="mt-1 self-start">
        Create event
      </Button>
    </form>
  );
}

export function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Brand />
        {REPO_URL && (
          <a href={REPO_URL} className="text-[15px] font-semibold text-tag hover:underline">
            Source on GitHub
          </a>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-12 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <h1 className="max-w-[14ch] text-[44px] sm:text-[60px]">Tell everyone at your event who to meet, and why.</h1>
            <p className="mt-5 max-w-[52ch] text-[18px] text-muted">
              Guests fill a 60-second form. Pairwise suggests two or three people each of them should find,
              with the exact reason and an opener. After the event, you see how many conversations actually
              happened.
            </p>
          </div>
          <HeroTags />
        </section>

        <section className="grid gap-10 border-t border-line py-14 lg:grid-cols-[1fr_1.05fr]">
          <ol className="flex flex-col gap-7">
            {[
              ["Bring your guest list", "Upload the Luma export or share one intake link. Guests say what they're looking for and what they can help with."],
              ["Review the matches", "Every pair comes with the words that connected them, so a bad match is obvious before anyone sees it."],
              ["Send links, then measure", "Each guest gets a private page with their matches. The next day they tap whether they talked."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-tag font-display text-[17px] font-bold text-tag">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[21px]">{title}</h3>
                  <p className="mt-1 max-w-[52ch] text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <CreateEvent />
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        Free and open source. Built for student clubs. No LinkedIn scraping: Pairwise only uses what guests tell it.
      </footer>
    </div>
  );
}
