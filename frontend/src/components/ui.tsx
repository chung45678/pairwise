import { ArrowRight, Check, Copy, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useScrollAway } from "../lib/motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Feedback is color only and near-instant (80ms). Press darkens; nothing scales.
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/88 active:bg-ink/76 disabled:bg-ink/40",
  secondary: "text-ink shadow-[0_0_0_1px_var(--color-line)] hover:bg-ink/6 active:bg-ink/10 disabled:text-muted",
  ghost: "text-link hover:bg-link/10 active:bg-link/16 disabled:text-muted",
  danger: "text-danger hover:bg-danger/10 active:bg-danger/16",
};

export function Button({
  variant = "primary",
  busy = false,
  arrow = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; arrow?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`group inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-[15px] font-medium transition-colors duration-[var(--dur-instant)] ease-[var(--ease-standard)] disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
      {arrow && !busy && (
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform duration-[var(--dur-quick)] ease-[var(--ease-standard)] group-hover:translate-x-0.5 group-disabled:translate-x-0"
        />
      )}
    </button>
  );
}

const inputBase =
  "w-full rounded-[var(--radius-control)] border border-field/70 bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-muted/80 transition-colors duration-[var(--dur-instant)] hover:border-field focus:border-link focus:outline-none focus:ring-3 focus:ring-link/20";

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
      <label htmlFor={id} className="text-[14px] font-medium">
        {label}
      </label>
      {children(id, hintId)}
      {(error || hint) && (
        <p id={hintId} className={`text-[13px] ${error ? "text-danger" : "text-muted"}`}>
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

/** Quiet inline status. Errors keep a visible edge; info and success stay calm. */
export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const tones = {
    info: "bg-surface text-ink shadow-[var(--shadow-card)]",
    error: "bg-danger/8 text-danger shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-danger)_35%,transparent)]",
    ok: "bg-surface text-ink shadow-[var(--shadow-card)]",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`enter flex gap-3 rounded-[var(--radius-card)] px-4 py-3 text-[15px] ${tones[tone]}`}
      style={{ ["--rise" as string]: "var(--rise-sm)" }}
    >
      {tone === "ok" && <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ok" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Wordmark only: no logo. */
export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link
      to={to}
      className="font-display text-[18px] font-medium tracking-[-0.02em] text-ink transition-colors duration-[var(--dur-instant)] hover:text-ink/80"
    >
      Pairwise
    </Link>
  );
}

export function PageShell({ children, wide = false, right }: { children: ReactNode; wide?: boolean; right?: ReactNode }) {
  const away = useScrollAway();
  return (
    <div className="min-h-dvh">
      <header
        className="site-header sticky top-0 z-30 bg-paper/80 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md"
        {...(away ? { "data-away": "" } : {})}
      >
        <div className={`mx-auto flex h-14 items-center justify-between px-5 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Brand />
          {right}
        </div>
      </header>
      <main className={`mx-auto px-5 py-10 sm:py-14 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}

/** Skeleton instead of a spinner, so content arrives without a layout jump. */
export function Loading({ label = "Loading", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div className="flex flex-col gap-4 py-2" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="skeleton h-4 w-40" />
      <div aria-hidden className="skeleton h-10 w-3/4 max-w-lg" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} aria-hidden className="skeleton h-24 w-full" style={{ opacity: 1 - i * 0.25 }} />
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: "draft" | "matched" | "published" }) {
  const map = {
    draft: { text: "Collecting guests", cls: "bg-ink/8 text-ink" },
    matched: { text: "Matches ready to review", cls: "bg-marker text-[#14161b]" },
    published: { text: "Matches sent", cls: "bg-mint text-[#14161b]" },
  };
  const s = map[status];
  return (
    <span key={status} className={`enter rounded-full px-3 py-1 text-[13px] font-medium ${s.cls}`} style={{ ["--rise" as string]: "4px" }}>
      {s.text}
    </span>
  );
}

/** Copy-to-clipboard with a blur crossfade from the copy icon to a check. */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  iconOnly = false,
  className = "",
  title,
  ariaLabel,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  const icon = (
    <span className="swap" aria-hidden>
      <Copy className="size-4" {...(copied ? { "data-off": "" } : {})} />
      <Check className="size-4" {...(copied ? {} : { "data-off": "" })} />
    </span>
  );
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={copy}
        title={title}
        aria-label={ariaLabel ?? title ?? label}
        className={`rounded-md p-1.5 text-muted transition-colors duration-[var(--dur-instant)] hover:bg-ink/6 hover:text-ink ${className}`}
      >
        {icon}
      </button>
    );
  }
  return (
    <Button type="button" variant="secondary" onClick={copy} className={className}>
      {icon}
      {copied ? copiedLabel : label}
    </Button>
  );
}
