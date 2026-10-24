import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorPanel } from "./error-panel";

describe("ErrorPanel", () => {
  it("renders tracked error digest and calls onReset when clicked", () => {
    const onReset = vi.fn();
    render(
      <ErrorPanel
        digest="DIGEST-1234"
        homeHref="/dashboard"
        onReset={onReset}
      />,
    );
    expect(screen.getByText(/DIGEST-1234/)).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders fallback reference when digest is absent", () => {
    render(<ErrorPanel />);
    expect(screen.getByText(/ERR-UNTRACKED/)).toBeDefined();
  });
});
