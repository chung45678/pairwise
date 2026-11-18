import type { CSSProperties, ReactNode } from "react";

/**
 * The signature element: a conference name tag. It's the only paper object in
 * the dark UI: the cobalt band says who, the white body says why.
 */
export function NameTag({
  lead = "Meet",
  name,
  subtitle,
  children,
  footer,
  className = "",
  style,
  headingLevel = 2,
  ...rest
}: {
  lead?: string;
  name: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  headingLevel?: 2 | 3;
} & Record<`data-${string}`, string>) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article
      {...rest}
      style={style}
      className={`on-paper overflow-hidden rounded-[var(--radius-tag)] bg-surface shadow-[var(--shadow-tag)] ${className}`}
    >
      <header className="bg-tag px-5 pt-3 pb-4 text-white">
        <p className="text-[14px] text-white/80">{lead}</p>
        <Heading className="display mt-0.5 text-[30px] text-white sm:text-[34px]">{name}</Heading>
        {subtitle && <p className="mt-1 text-[14px] text-white/85">{subtitle}</p>}
      </header>
      {children && <div className="px-5 py-4">{children}</div>}
      {footer}
      <div aria-hidden className="h-2 bg-tag" />
    </article>
  );
}
