import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-tag text-white hover:bg-tag-dark disabled:bg-tag/50",
  secondary: "bg-surface text-ink border border-line hover:border-ink/40 disabled:text-muted",
  ghost: "text-tag hover:bg-tag/8 disabled:text-muted",
  danger: "text-danger hover:bg-danger/8",
};

export function Button({
  variant = "primary",
  busy = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const inputBase =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-muted/70 focus:border-tag focus:outline-none focus:ring-3 focus:ring-tag/15";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      {children(id, hintId)}
      {(error || hint) && (
        <p id={hintId} className={`text-sm ${error ? "text-danger" : "text-muted"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputBase} resize-y ${props.className ?? ""}`} />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const tones = {
    info: "border-tag/25 bg-tag/5 text-ink",
    error: "border-danger/30 bg-danger/5 text-danger",
    ok: "border-ok/30 bg-ok/5 text-ok",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-[15px] ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 font-display text-[19px] font-bold tracking-tight">
      <svg aria-hidden viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="7" fill="#2442C9" />
        <circle cx="12" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.5" />
        <circle cx="20" cy="16" r="6" fill="none" stroke="#FFE14D" strokeWidth="2.5" />
      </svg>
      Pairwise
    </Link>
  );
}

export function PageShell({ children, wide = false, right }: { children: ReactNode; wide?: boolean; right?: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/70 backdrop-blur">
        <div className={`mx-auto flex h-16 items-center justify-between px-5 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Brand />
          {right}
        </div>
      </header>
      <main className={`mx-auto px-5 py-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 text-muted" role="status">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      {label}
    </div>
  );
}

export function StatusPill({ status }: { status: "draft" | "matched" | "published" }) {
  const map = {
    draft: { text: "Collecting guests", cls: "bg-line/70 text-ink" },
    matched: { text: "Matches ready to review", cls: "bg-marker text-ink" },
    published: { text: "Matches sent", cls: "bg-mint text-ink" },
  };
  const s = map[status];
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.cls}`}>{s.text}</span>;
}
