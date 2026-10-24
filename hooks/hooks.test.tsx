import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./use-copy-to-clipboard";
import { useFieldIssues } from "./use-field-issues";
import { useMobile } from "./use-mobile";
import { useTranslations } from "./use-translations";

describe("hooks", () => {
  it("resolves catalog messages through useTranslations", () => {
    const { result } = renderHook(() => useTranslations("en-GB"));
    expect(result.current("app.brand")).toBe("SaaS Page Builder");
  });

  it("reads field issues through useFieldIssues", () => {
    const { result } = renderHook(() =>
      useFieldIssues({ slug: ["Invalid"], _form: ["Top error"] }),
    );
    expect(result.current.issueFor("slug")).toBe("Invalid");
    expect(result.current.formIssue).toBe("Top error");
  });

  it("copies text and tracks mobile viewport state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      const ok = await result.current.copyText("hello");
      expect(ok).toBe(true);
    });
    expect(result.current.copied).toBe(true);

    const { result: mobileResult } = renderHook(() => useMobile(768));
    expect(typeof mobileResult.current).toBe("boolean");
  });
});
