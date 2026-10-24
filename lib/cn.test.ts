import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("merges conditional and conflicting utility classes", () => {
    const isHidden = Boolean("");
    expect(cn("px-2 py-1", isHidden && "hidden", "px-4")).toBe("py-1 px-4");
  });
});
