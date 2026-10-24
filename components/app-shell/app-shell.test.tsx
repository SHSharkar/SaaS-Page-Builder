import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AdminAccountStatusButton,
  AdminRevealContactFormClient,
} from "./admin-forms";
import { AdminShell } from "./admin-shell";
import {
  SignInFormClient,
  SignOutCardClient,
  SignUpFormClient,
} from "./auth-forms";
import { PublicShell } from "./public-shell";
import { RealtimeListener } from "./realtime-listener";
import {
  AddDomainFormClient,
  CreatePageFormClient,
  CreateSiteFormClient,
  InviteMemberFormClient,
  PrivacyErasureFormClient,
} from "./workspace-forms";
import { WorkspaceShell } from "./workspace-shell";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignUp = vi.fn(async (_input?: unknown) => ({ ok: true }));
const mockCreateSite = vi.fn(async (_input?: unknown) => ({
  ok: true,
  siteId: "site-99",
}));
const mockCreatePage = vi.fn(async (_input?: unknown) => ({
  ok: true,
  pageId: "page-99",
}));
const mockConnectDomain = vi.fn(async (_input?: unknown) => ({
  domainId: "dom-99",
  ok: true,
}));
const mockInviteMember = vi.fn(async (_input?: unknown) => ({ ok: true }));
const mockRevealContact = vi.fn(async (_input?: unknown) => ({
  contact: "alice@example.test",
  ok: true,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/app/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(async ({ email }: { email: string }) =>
        email.includes("bad")
          ? { error: { message: "Invalid" } }
          : { data: { ok: true }, error: null },
      ),
    },
    signOut: vi.fn(async () => ({ ok: true })),
  },
}));

vi.mock("@/app/server/signup/actions", () => ({
  signUpWorkspaceAction: (input: unknown) => mockSignUp(input),
}));

vi.mock("@/app/server/sites/actions", () => ({
  createSiteAction: (input: unknown) => mockCreateSite(input),
}));

vi.mock("@/app/server/pages/actions", () => ({
  createPageAction: (input: unknown) => mockCreatePage(input),
}));

vi.mock("@/app/server/domains/actions", () => ({
  connectDomainAction: (input: unknown) => mockConnectDomain(input),
}));

vi.mock("@/app/server/team/actions", () => ({
  inviteMemberAction: (input: unknown) => mockInviteMember(input),
}));

vi.mock("@/app/server/privacy/actions", () => ({
  requestContactErasureAction: vi.fn(async () => ({
    erasedCount: 1,
    ok: true,
  })),
  revealContactForPlatformAction: (input: unknown) => mockRevealContact(input),
}));

vi.mock("@/app/server/admin/actions", () => ({
  setAccountStatusPlatformAction: vi.fn(async () => ({ ok: true })),
}));

describe("app-shell layouts and interactive forms", () => {
  it("renders WorkspaceShell, PublicShell, AdminShell, and RealtimeListener", () => {
    const label = "SaaS Page Builder";
    render(
      <WorkspaceShell
        accountName="Acme"
        adminHref="/ops"
        locale="en-GB"
        roleSlug="owner"
      >
        <div>{label}</div>
      </WorkspaceShell>,
    );
    render(
      <WorkspaceShell accountName="Acme" roleSlug="editor">
        <div>{label}</div>
      </WorkspaceShell>,
    );
    render(
      <PublicShell locale="en-US">
        <div>{label}</div>
      </PublicShell>,
    );
    render(
      <AdminShell
        locale="en-GB"
        platformRole="superadmin"
        tabs={[{ href: "/ops", label: "Overview" }]}
      >
        <div>{label}</div>
      </AdminShell>,
    );
    render(<RealtimeListener endpoint="/api/realtime" />);
    expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(4);
  });

  it("submits auth forms cleanly for valid, invalid, and error branches", async () => {
    const signInView = render(<SignInFormClient />);
    fireEvent.change(signInView.getByLabelText("Email address"), {
      target: { value: "bad@example.test" },
    });
    fireEvent.change(signInView.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(signInView.container.querySelector("form")!);
    await waitFor(() => expect(signInView.getByRole("alert")).toBeDefined());

    fireEvent.change(signInView.getByLabelText("Email address"), {
      target: { value: "ok@example.test" },
    });
    fireEvent.submit(signInView.container.querySelector("form")!);
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    signInView.unmount();

    const signUpView = render(<SignUpFormClient />);
    fireEvent.change(signUpView.getByLabelText("Full name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(signUpView.getByLabelText("Workspace name"), {
      target: { value: "Ada Studio" },
    });
    fireEvent.change(signUpView.getByLabelText("Email address"), {
      target: { value: "bad@example.test" },
    });
    fireEvent.change(signUpView.getByLabelText("Password"), {
      target: { value: "StrongPass!2026" },
    });
    mockSignUp.mockRejectedValueOnce(new Error("Email taken"));
    fireEvent.submit(signUpView.container.querySelector("form")!);
    await waitFor(() =>
      expect(signUpView.getByText("Email taken")).toBeDefined(),
    );

    fireEvent.submit(signUpView.container.querySelector("form")!);
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    fireEvent.change(signUpView.getByLabelText("Email address"), {
      target: { value: "ada@example.test" },
    });
    fireEvent.submit(signUpView.container.querySelector("form")!);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    signUpView.unmount();

    const signOutView = render(<SignOutCardClient />);
    signOutView.unmount();
  });

  it("submits workspace and admin forms cleanly including error recovery", async () => {
    const siteForm = render(<CreateSiteFormClient />);
    fireEvent.change(siteForm.getByLabelText("Site name"), {
      target: { value: "Marketing" },
    });
    mockCreateSite.mockRejectedValueOnce(new Error("Plan limit"));
    fireEvent.submit(siteForm.container.querySelector("form")!);
    await waitFor(() => expect(siteForm.getByText("Plan limit")).toBeDefined());
    fireEvent.submit(siteForm.container.querySelector("form")!);
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    siteForm.unmount();

    const pageForm = render(<CreatePageFormClient siteId="site-1" />);
    fireEvent.change(pageForm.getByLabelText("Page title"), {
      target: { value: "About" },
    });
    fireEvent.change(pageForm.getByLabelText("URL path"), {
      target: { value: "/about" },
    });
    mockCreatePage.mockRejectedValueOnce(new Error("Slug exists"));
    fireEvent.submit(pageForm.container.querySelector("form")!);
    await waitFor(() =>
      expect(pageForm.getByText("Slug exists")).toBeDefined(),
    );
    fireEvent.submit(pageForm.container.querySelector("form")!);
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    pageForm.unmount();

    const domainForm = render(<AddDomainFormClient siteId="site-1" />);
    fireEvent.change(domainForm.getByLabelText("Custom hostname"), {
      target: { value: "docs.example.com" },
    });
    mockConnectDomain.mockRejectedValueOnce(new Error("Invalid domain"));
    fireEvent.submit(domainForm.container.querySelector("form")!);
    await waitFor(() =>
      expect(domainForm.getByText("Invalid domain")).toBeDefined(),
    );
    fireEvent.submit(domainForm.container.querySelector("form")!);
    await waitFor(() => expect(domainForm.getByRole("status")).toBeDefined());
    domainForm.unmount();

    const inviteForm = render(<InviteMemberFormClient />);
    fireEvent.change(inviteForm.getByLabelText("Email address"), {
      target: { value: "colleague@example.test" },
    });
    mockInviteMember.mockRejectedValueOnce(new Error("Already invited"));
    fireEvent.submit(inviteForm.container.querySelector("form")!);
    await waitFor(() =>
      expect(inviteForm.getByText("Already invited")).toBeDefined(),
    );
    fireEvent.submit(inviteForm.container.querySelector("form")!);
    await waitFor(() => expect(inviteForm.getByRole("status")).toBeDefined());
    inviteForm.unmount();

    const eraseForm = render(<PrivacyErasureFormClient />);
    fireEvent.change(
      eraseForm.getByLabelText("Email, phone, or contact identifier"),
      {
        target: { value: "guest@example.test" },
      },
    );
    fireEvent.submit(eraseForm.container.querySelector("form")!);
    await waitFor(() => expect(eraseForm.getByRole("status")).toBeDefined());
    eraseForm.unmount();

    const adminActive = render(
      <AdminAccountStatusButton accountId="acc-1" currentStatus="active" />,
    );
    fireEvent.click(adminActive.getByRole("button"));
    adminActive.unmount();

    const adminSuspended = render(
      <AdminAccountStatusButton accountId="acc-1" currentStatus="suspended" />,
    );
    fireEvent.click(adminSuspended.getByRole("button"));
    adminSuspended.unmount();

    const revealForm = render(<AdminRevealContactFormClient />);
    fireEvent.change(
      revealForm.getByLabelText("Email, phone, or contact identifier"),
      {
        target: { value: "contact-1" },
      },
    );
    fireEvent.change(revealForm.container.querySelector("#reveal-reason")!, {
      target: { value: "DSAR verification" },
    });
    mockRevealContact.mockRejectedValueOnce(new Error("Not found"));
    fireEvent.submit(revealForm.container.querySelector("form")!);
    await waitFor(() =>
      expect(revealForm.getByText("Not found")).toBeDefined(),
    );
    fireEvent.submit(revealForm.container.querySelector("form")!);
    await waitFor(() =>
      expect(revealForm.getByText("alice@example.test")).toBeDefined(),
    );
  });
});
