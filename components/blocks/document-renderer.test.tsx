import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentRenderer } from "./document-renderer";

describe("DocumentRenderer", () => {
  it("renders structured blocks, fallbacks, and empty nav/footer variants", () => {
    const fullView = render(
      <DocumentRenderer
        document={{
          schemaVersion: 1,
          root: { title: "Home" },
          content: [
            {
              id: "hero-1",
              type: "hero-banner",
              props: {
                body: "Body copy text",
                ctaHref: "/sign-up",
                ctaLabel: "Start now",
                headline: "Ship faster",
                subheadline: "Multi-tenant page studio",
              },
            },
            {
              id: "custom-1",
              type: "unregistered-widget",
              props: {
                subheading: "Secondary line",
              },
            },
          ],
        }}
        footerDocument={{
          schemaVersion: 1,
          root: { title: "Footer" },
          content: [
            {
              id: "ftr-1",
              type: "site-footer",
              props: {
                heading: "Footer Links",
              },
            },
          ],
        }}
        navDocument={{
          schemaVersion: 1,
          root: { title: "Nav" },
          content: [
            {
              id: "nav-1",
              type: "site-header",
              props: {
                heading: "Top Nav",
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Ship faster")).toBeDefined();
    expect(screen.getByText("Body copy text")).toBeDefined();
    expect(screen.getByText("Secondary line")).toBeDefined();
    expect(screen.getByText("Top Nav")).toBeDefined();
    expect(screen.getByText("Footer Links")).toBeDefined();
    fullView.unmount();

    render(
      <DocumentRenderer
        document={{
          schemaVersion: 1,
          root: { title: "Minimal" },
          content: [],
        }}
      />,
    );
  });
});
