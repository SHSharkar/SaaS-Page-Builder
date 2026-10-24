import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyDocument } from "@/lib/documents";
import { PageStudioClient } from "./page-studio-client";

const mockSaveDraft = vi.fn(async (_input: unknown) => ({
  ok: true,
  lockVersion: 2,
}));
const mockPublishPage = vi.fn(async (_input: unknown) => ({
  ok: true,
  versionId: "ver-1",
  versionNumber: 1,
}));

vi.mock("@/app/server/pages/actions", () => ({
  saveDraftAction: (input: unknown) => mockSaveDraft(input),
  publishPageAction: (input: unknown) => mockPublishPage(input),
}));

describe("PageStudioClient", () => {
  it("adds, updates, removes blocks, saves drafts, and publishes", async () => {
    const doc = emptyDocument("Home");
    render(
      <PageStudioClient
        initialDocument={doc}
        initialLockVersion={1}
        initialTitle="Home"
        pageId="page-1"
        pageSlug="/"
        pageStatus="draft"
        siteId="site-1"
      />,
    );

    const addBtn = screen.getByRole("button", { name: "Add block" });
    fireEvent.click(addBtn);

    const titleInputs = screen.getAllByLabelText("Page title");
    fireEvent.change(titleInputs[0]!, { target: { value: "Updated Home" } });
    fireEvent.change(titleInputs[1]!, { target: { value: "Hero Title" } });
    fireEvent.change(screen.getByLabelText("Block content"), {
      target: { value: "Rich paragraph copy" },
    });

    const saveBtn = screen.getByRole("button", { name: "Save draft" });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(screen.getByRole("status")).toBeDefined());

    const publishBtn = screen.getByRole("button", { name: "Publish snapshot" });
    await waitFor(() =>
      expect(publishBtn.hasAttribute("disabled")).toBe(false),
    );
    fireEvent.click(publishBtn);
    await waitFor(() => expect(mockPublishPage).toHaveBeenCalled());

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    if (removeButtons[0]) {
      fireEvent.click(removeButtons[0]);
    }

    mockSaveDraft.mockRejectedValueOnce(new Error("Draft conflict"));
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText("Draft conflict")).toBeDefined();
      expect(publishBtn.hasAttribute("disabled")).toBe(false);
    });

    mockSaveDraft.mockRejectedValueOnce(new Error("Publish conflict"));
    fireEvent.click(publishBtn);
    await waitFor(() =>
      expect(screen.getByText("Publish conflict")).toBeDefined(),
    );
  });
});
