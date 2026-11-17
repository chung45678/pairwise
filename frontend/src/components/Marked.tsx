import { highlight } from "../lib/highlight";

/** Text with evidence terms drawn over in highlighter. */
export function Marked({ text, terms, tone = "marker" }: { text: string; terms: string[]; tone?: "marker" | "mint" }) {
  return (
    <>
      {highlight(text, terms).map((s, i) =>
        s.mark ? (
          <mark key={i} className={tone}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
