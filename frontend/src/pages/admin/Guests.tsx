import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api, type Attendee, type EventPublic, type ImportResult } from "../../api";
import { Button, CopyButton, Notice } from "../../components/ui";
import { vars } from "../../lib/motion";

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
    <div className="focus-in mt-4 rounded-[var(--radius-card)] bg-surface p-4 text-[15px] shadow-[var(--shadow-card)]">
      <p className="font-medium">
        Added {r.added} {r.added === 1 ? "guest" : "guests"}
        {r.updated > 0 && `, updated ${r.updated}`}
        {r.skipped.length > 0 && `, skipped ${r.skipped.length}`}.
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-link">Columns we read</summary>
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {Object.entries(r.mapping).map(([field, header]) => (
              <tr key={field} className="shadow-[0_-1px_0_var(--color-line)]">
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
          <summary className="cursor-pointer text-link">Skipped rows</summary>
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
  return (
    <CopyButton
      iconOnly
      value={`${window.location.origin}/m/${token}`}
      title="Copy this guest's private link"
      ariaLabel="Copy guest link"
    />
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
  // Rows added by the last import get a staggered entrance; everything else stays put.
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const locked = event.status === "published";
  const ready = attendees.filter((a) => a.intake_complete).length;
  // `fresh` holds the ids that existed *before* the import (plus a -1 marker).
  const isNew = (id: number) => fresh.has(-1) && !fresh.has(id);
  let newIndex = 0;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const before = new Set(attendees.map((a) => a.id));
      setResult(await api.admin.importCsv(event.slug, adminKey, file));
      await reload();
      setFresh(new Set([-1, ...before])); // resolved against the new list below
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside>
        <h2 className="text-[19px]">Import from Luma</h2>
        <p className="mt-1 text-[14px] text-muted">
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
          className={`mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] bg-surface px-4 py-8 text-center transition-[transform,box-shadow,background-color] duration-[var(--dur-quick)] ease-[var(--ease-out)] has-focus-visible:outline-3 has-focus-visible:outline-link ${dragging ? "-translate-y-0.5 bg-link/8 shadow-[0_0_0_1.5px_var(--color-link)]" : "shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-field)]"}`}
        >
          <Upload aria-hidden className={`size-5 text-link ${busy ? "animate-pulse" : ""}`} />
          <span className="font-medium">{busy ? "Importing" : "Drop the CSV here or browse"}</span>
          <span className="text-[13px] text-muted">Up to 2 MB</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
        </label>
        {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
        {result && <ImportSummary r={result} />}
      </aside>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[19px]">Guests</h2>
          <p className="text-[14px] text-muted">
            {ready} of {attendees.length} ready to match
          </p>
        </div>
        {attendees.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-card)] bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)]">
            <p className="font-medium">No guests yet</p>
            <p className="mt-1 text-[14px] text-muted">Import your Luma list, or share the intake link above.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full text-left text-[14px] md:min-w-[640px]">
              <thead className="text-[13px] text-muted shadow-[0_1px_0_var(--color-line)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Role</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Interests</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr
                    key={a.id}
                    className={`shadow-[0_1px_0_var(--color-line)] last:shadow-none ${isNew(a.id) ? "enter" : ""}`}
                    style={isNew(a.id) ? vars({ "--i": newIndex++, "--delay": "200ms" }) : undefined}
                  >
                    <td className="max-w-0 px-4 py-2.5 md:max-w-none">
                      <div className="truncate font-medium">{a.name}</div>
                      <div className="truncate text-[13px] text-muted">{a.email}</div>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">{a.role || <span className="text-muted">Not given</span>}</td>
                    <td className="hidden max-w-64 truncate px-4 py-2.5 md:table-cell" title={a.interests.join(", ")}>
                      {a.interests.join(", ") || <span className="text-muted">None</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.intake_complete ? (
                        <span className="rounded-full bg-mint px-2.5 py-0.5 text-[13px] font-medium text-[#14161b]">Ready</span>
                      ) : (
                        <span className="rounded-full bg-ink/8 px-2.5 py-0.5 text-[13px]" title="No interests or goals yet. Send them the intake link.">
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
