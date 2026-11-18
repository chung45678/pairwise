import type { CSSProperties } from "react";
import { highlight } from "../lib/highlight";

/**
 * Text with evidence terms drawn over in highlighter. Each mark gets an index
 * (`--mi`) so a `.sweepable` ancestor can draw them in reading order.
 * `offset` continues the count across several Marked blocks in one container.
 */
export function Marked({
  text,
  terms,
  tone = "marker",
  offset = 0,
}: {
  text: string;
  terms: string[];
  tone?: "marker" | "mint";
  offset?: number;
}) {
  let n = offset;
  return (
    <>
      {highlight(text, terms).map((s, i) =>
        s.mark ? (
          <mark key={i} className={tone} style={{ "--mi": n++ } as CSSProperties}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** How many marks a text will produce, so callers can chain offsets. */
export function countMarks(text: string, terms: string[]) {
  return highlight(text, terms).filter((s) => s.mark).length;
}
