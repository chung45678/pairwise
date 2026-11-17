import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MAX_TAGS, TagInput } from "./TagInput";

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagInput id="t" value={tags} onChange={setTags} />
      <output data-testid="out">{tags.join("|")}</output>
    </>
  );
}

const out = () => screen.getByTestId("out").textContent;

describe("TagInput", () => {
  it("adds on Enter and splits on commas", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "fintech, AI" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(out()).toBe("fintech|AI");
  });

  it("ignores case-insensitive duplicates", () => {
    render(<Harness initial={["Fintech"]} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "fintech" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(out()).toBe("Fintech");
  });

  it("removes the last tag on Backspace in an empty input", () => {
    render(<Harness initial={["a", "b"]} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Backspace" });
    expect(out()).toBe("a");
  });

  it("adds a suggestion on click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "+ startups" }));
    expect(out()).toBe("startups");
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
    render(<Harness initial={many} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
