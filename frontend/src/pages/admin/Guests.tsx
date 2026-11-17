import { Check, Link2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api, type Attendee, type EventPublic, type ImportResult } from "../../api";
import { Button, Notice } from "../../components/ui";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  approval_status: "Approval status",
  role: "Program or role",
  affiliation: "Club or team",
  interests: "Interests",
  looking_for: "Looking for",
  can_help_with: "Can help with",
};

function ImportSummary({ r }: { r: ImportResult }) {
  return (
    <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-[15px]">
      <p className="font-semibold">
        Added {r.added} {r.added === 1 ? "guest" : "guests"}
        {r.updated > 0 && `, updated ${r.updated}`}
        {r.skipped.length > 0 && `, skipped ${r.skipped.length}`}.
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-tag">Columns we read</summary>
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {Object.entries(r.mapping).map(([field, header]) => (
              <tr key={field} className="border-t border-line">
                <td className="py-1.5 pr-4 text-muted">{FIELD_LABELS[field] ?? field}</td>
                <td className="py-1.5">{header}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!("looking_for" in r.mapping) && (
          <p className="mt-2 text-sm text-muted">
            No "looking for" question found. Share the intake link so guests can add it, or matches will rely on interests alone.
          </p>
        )}
      </details>
      {r.skipped.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-tag">Skipped rows</summary>
          <ul className="mt-2 text-sm text-muted">
            {r.skipped.map((s) => (
              <li key={s.row}>Row {s.row}: {s.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CopyGuestLink({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy this guest's private link"
      aria-label="Copy guest link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/m/${token}`);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="rounded-md p-1.5 text-muted hover:bg-tag/8 hover:text-tag"
    >
      {done ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />}
    </button>
  );
}

export function Guests({
  event,
  adminKey,
  attendees,
  reload,
}: {
  event: EventPublic;
  adminKey: string;
  attendees: Attendee[];
  reload: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const locked = event.status === "published";
  const ready = attendees.filter((a) => a.intake_complete).length;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setResult(await api.admin.importCsv(event.slug, adminKey, file));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (a: Attendee) => {
    if (!window.confirm(`Remove ${a.name}? Any draft matches will be cleared.`)) return;
    try {
      await api.admin.removeAttendee(event.slug, adminKey, a.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove guest");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <aside>
        <h2 className="text-[22px]">Import from Luma</h2>
        <p className="mt-1 text-[15px] text-muted">
          In Luma, open your event, go to Guests, and choose Download as CSV. Registration questions about interests or
          goals are picked up automatically.
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files[0]);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors has-focus-visible:outline-3 has-focus-visible:outline-tag ${dragging ? "border-tag bg-tag/5" : "border-line bg-surface hover:border-tag/60"}`}
        >
          <Upload aria-hidden className="size-6 text-tag" />
          <span className="font-semibold">{busy ? "Importing" : "Drop the CSV here or browse"}</span>
          <span className="text-sm text-muted">Up to 2 MB</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
        </label>
        {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
        {result && <ImportSummary r={result} />}
      </aside>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[22px]">Guests</h2>
          <p className="text-[15px] text-muted">
            {ready} of {attendees.length} ready to match
          </p>
        </div>
        {attendees.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <p className="font-semibold">No guests yet</p>
            <p className="mt-1 text-[15px] text-muted">Import your Luma list, or share the intake link above.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Interests</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-sm text-muted">{a.email}</div>
                    </td>
                    <td className="px-4 py-2.5">{a.role || <span className="text-muted">Not given</span>}</td>
                    <td className="max-w-64 truncate px-4 py-2.5" title={a.interests.join(", ")}>
                      {a.interests.join(", ") || <span className="text-muted">None</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.intake_complete ? (
                        <span className="rounded-full bg-mint px-2.5 py-0.5 text-sm font-semibold">Ready</span>
                      ) : (
                        <span className="rounded-full bg-line/70 px-2.5 py-0.5 text-sm" title="No interests or goals yet. Send them the intake link.">
                          Needs answers
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right">
                      <CopyGuestLink token={a.token} />
                      {!locked && (
                        <Button variant="danger" className="!p-1.5" aria-label={`Remove ${a.name}`} title="Remove guest" onClick={() => remove(a)}>
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
