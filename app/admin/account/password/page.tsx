import { requireActor } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default async function AccountPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ forced?: string }>;
}) {
  const actor = await requireActor({
    allowPasswordChangeGate: true,
    allowWithoutTwoFactor: true,
  });
  const { forced } = await searchParams;
  const mustChange = forced === "1" || actor.user.mustChangePassword;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account security"
        title={mustChange ? "Choose a new password to continue" : "Change your password"}
        description={
          mustChange
            ? "Your account is using a temporary password. Pick your own password before opening the workspace."
            : "Changing your password signs out every other device."
        }
        breadcrumb={
          mustChange
            ? undefined
            : [
                { label: "Your account", href: "/admin/account" },
                { label: "Password" },
              ]
        }
      />

      <div className="sm:w-96">
        <Panel>
          <ChangePasswordForm forced={mustChange} />
        </Panel>
      </div>
    </div>
  );
}
