import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type EventPublic, type IntakeBody } from "../api";
import { TagInput } from "../components/TagInput";
import { Button, Field, Input, Loading, Notice, PageShell, Textarea } from "../components/ui";
import { formatDate } from "../lib/highlight";
import { stagger } from "../lib/motion";

const EMPTY: IntakeBody = {
  name: "",
  email: "",
  role: "",
  affiliation: "",
  interests: [],
  looking_for: "",
  can_help_with: "",
};

export function Join() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<IntakeBody>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.event(slug).then(setEvent).catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? "This event doesn't exist. Check the link with the organizer." : "Couldn't load the event."));
  }, [slug]);

  const set = <K extends keyof IntakeBody>(k: K, v: IntakeBody[K]) => setForm((f) => ({ ...f, [k]: v }));
  const empty = !form.interests.length && !form.looking_for.trim() && !form.can_help_with.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (empty) {
      setError("Add at least one interest, or say what you're looking for. That's what your matches are based on.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { token } = await api.intake(slug, form);
      nav(`/m/${token}`, { state: { justJoined: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  };

  if (loadError) return <PageShell><Notice tone="error">{loadError}</Notice></PageShell>;
  if (!event) return <PageShell><Loading lines={2} /></PageShell>;

  return (
    <PageShell>
      <div className="max-w-xl">
        <p className="enter text-[14px] text-muted" style={stagger(0)}>
          {[formatDate(event.starts_at), event.location].filter(Boolean).join(", ")}
        </p>
        <h1 className="enter mt-2 text-[32px] sm:text-[40px]" style={stagger(1)}>{event.name}</h1>
        <p className="enter mt-4 text-[17px] text-muted" style={stagger(2)}>
          Tell us a little about yourself and we'll suggest {event.matches_per_person}{" "}
          {event.matches_per_person === 1 ? "person" : "people"} worth finding at the event. Takes about a minute.
        </p>

        <form onSubmit={submit} className="enter mt-10 flex flex-col gap-6" style={stagger(3)} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name">
              {(id) => <Input id={id} required autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />}
            </Field>
            <Field label="Email" hint="Only the organizer sees this.">
              {(id, d) => <Input id={id} aria-describedby={d} required type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />}
            </Field>
            <Field label="Program or role" hint="For example: Systems Design, or PM intern">
              {(id, d) => <Input id={id} aria-describedby={d} maxLength={80} value={form.role} onChange={(e) => set("role", e.target.value)} />}
            </Field>
            <Field label="Club or team (optional)" hint="We'll avoid matching you with your own team.">
              {(id, d) => <Input id={id} aria-describedby={d} maxLength={100} value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} />}
            </Field>
          </div>

          <Field label="Interests" hint="Up to 10. Press Enter after each one.">
            {(id, d) => <TagInput id={id} describedBy={d} value={form.interests} onChange={(t) => set("interests", t)} />}
          </Field>
          <Field label="What are you hoping to get out of tonight?" hint="Be specific. 'Feedback on my portfolio' matches better than 'networking'.">
            {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={500} value={form.looking_for} onChange={(e) => set("looking_for", e.target.value)} placeholder="Advice on breaking into product management, a cofounder for a fintech idea" />}
          </Field>
          <Field label="What could you help someone else with?">
            {(id) => <Textarea id={id} maxLength={500} value={form.can_help_with} onChange={(e) => set("can_help_with", e.target.value)} placeholder="React, resume reviews, how I landed my first co-op" />}
          </Field>

          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" busy={busy} arrow>Save and get my link</Button>
            <p className="text-[13px] text-muted">Your matches see your name, role, club and interests. Never your email.</p>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
