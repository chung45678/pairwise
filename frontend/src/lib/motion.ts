// Small motion helpers. Everything visual lives in CSS (index.css); these hooks
// only decide *when* (in view, scrolled) and respect reduced motion.

import { useEffect, useRef, useState, type CSSProperties } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Sets `data-in` on the element the first time it scrolls into view, which
 * drives `.reveal` and `.sweepable`. Plays once. With reduced motion, or
 * without IntersectionObserver, the element is marked in view immediately.
 */
export function useInView<T extends Element>(options: { rootMargin?: string; threshold?: number } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = "0px 0px -12% 0px", threshold = 0.15 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin, threshold]);

  return { ref, inView, attrs: inView ? { "data-in": "" } : {} };
}

/**
 * True shortly after the first paint, so a mount-time sweep starts from empty.
 * Pass `replayKey` to run it again when that value changes (e.g. a new list).
 * The key check is synchronous, so new content never mounts already "on".
 */
export function useMounted(delayMs = 0, replayKey?: unknown) {
  const [onFor, setOnFor] = useState<{ key: unknown } | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setOnFor({ key: replayKey });
      return;
    }
    const id = window.setTimeout(() => setOnFor({ key: replayKey }), Math.max(16, delayMs));
    return () => window.clearTimeout(id);
  }, [delayMs, replayKey]);
  return onFor !== null && onFor.key === replayKey;
}

/** Header hide-on-scroll: away when scrolling down past `offset`, back on any upward scroll. */
export function useScrollAway(offset = 96) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) > 4) {
          setAway(y > last && y > offset);
          last = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return away;
}

/** Inline style for a staggered item: `style={stagger(i)}`. */
export const stagger = (i: number, extra: CSSProperties = {}): CSSProperties =>
  ({ "--i": i, ...extra }) as CSSProperties;

/** Inline CSS custom properties without type noise. */
export const vars = (v: Record<string, string | number>): CSSProperties => v as CSSProperties;
