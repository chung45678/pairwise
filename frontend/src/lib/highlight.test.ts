import { describe, expect, it } from "vitest";
import { highlight, initials, pct } from "./highlight";

describe("highlight", () => {
  it("marks terms case-insensitively", () => {
    expect(highlight("Design feedback on Figma", ["design feedback", "figma"])).toEqual([
      { text: "Design feedback", mark: true },
      { text: " on ", mark: false },
      { text: "Figma", mark: true },
    ]);
  });

  it("prefers the longest term", () => {
    const segs = highlight("design feedback", ["design", "design feedback"]);
    expect(segs).toEqual([{ text: "design feedback", mark: true }]);
  });

  it("respects word boundaries", () => {
    expect(highlight("redesign", ["design"])).toEqual([{ text: "redesign", mark: false }]);
  });

  it("escapes regex characters", () => {
    expect(highlight("I write C++ daily", ["c++"])[1]).toEqual({ text: "C++", mark: true });
  });

  it("handles empty input", () => {
    expect(highlight("", ["x"])).toEqual([]);
    expect(highlight("hello", [])).toEqual([{ text: "hello", mark: false }]);
  });
});

describe("formatters", () => {
  it("initials", () => {
    expect(initials("Maya Chen")).toBe("MC");
    expect(initials("Leo")).toBe("L");
    expect(initials("Ana de la Cruz")).toBe("AC");
  });

  it("pct", () => {
    expect(pct(0.456)).toBe("46%");
    expect(pct(null)).toBe("No data yet");
  });
});
