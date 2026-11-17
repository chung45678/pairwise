import type { ReactNode } from "react";

/**
 * The signature element: a conference name tag. The cobalt band says who,
 * the white body says why. Used for match cards and the landing hero.
 */
export function NameTag({
  lead = "Meet",
  name,
  subtitle,
  children,
  footer,
  className = "",
}: {
  lead?: string;
  name: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`overflow-hidden rounded-[var(--radius-tag)] border border-tag-dark/20 bg-surface shadow-[0_1px_0_#1a32991a,0_10px_30px_-18px_#1a329966] ${className}`}
    >
      <header className="bg-tag px-5 pt-3 pb-4 text-white">
        <p className="text-[15px] text-white/80">{lead}</p>
        <h3 className="mt-0.5 text-[30px] text-white sm:text-[34px]">{name}</h3>
        {subtitle && <p className="mt-1 text-[15px] text-white/85">{subtitle}</p>}
      </header>
      {children && <div className="px-5 py-4">{children}</div>}
      {footer}
      <div aria-hidden className="h-2 bg-tag" />
    </article>
  );
}
