import { can, hasRecentStepUp, requireView } from "@/lib/auth/session";
import { listSettingsForAdmin } from "@/lib/settings";
import { previewDailySweep } from "@/lib/sweeper";
import { getQueueHealth } from "@/lib/queue";
import { cacheStats } from "@/lib/cache";
import { storageBackend } from "@/lib/media/storage";
import { databaseBackend } from "@/lib/db";
import { PageHeader, Panel, Stat } from "@/components/admin/ui";
import { StepUpNotice } from "@/components/admin/step-up-notice";
import { SettingsEditor } from "@/components/admin/settings-client";

export default async function PlatformSettingsPage() {
  const actor = await requireView("settings.view", "/admin/settings");
  const [settings, sweepPreview, queue, cache, steppedUp] = await Promise.all([
    listSettingsForAdmin(),
    previewDailySweep(),
    getQueueHealth(),
    cacheStats(),
    hasRecentStepUp(actor),
  ]);

  const canEdit = can(actor, "settings.manage");
  const canOperate = can(actor, "ops.run");
  const dbEngine = databaseBackend();
  const mediaEngine = storageBackend();

  const serialized = settings.map((setting) => ({
    key: setting.key,
    value: typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value),
    description: setting.description,
    isSecret: setting.isSecret,
    hasSecretValue: setting.hasSecretValue,
    updatedAt: setting.updatedAt?.toISOString() ?? new Date().toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations & configuration"
        title="Platform settings"
        description="Runtime limits, encrypted integration secrets, background worker health, and daily sweeper controls."
      />

      {canEdit && !steppedUp ? <StepUpNotice /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Database engine" value={dbEngine} hint="Drizzle ORM" />
        <Stat label="Cache backend" value={cache.backend} hint={`${cache.keys} tracked keys`} />
        <Stat label="Media storage" value={mediaEngine} hint="SHA-256 deduplicated" />
        <Stat
          label="Job queue"
          value={queue.mode}
          hint={`${queue.queued} queued | ${queue.failed} failed`}
        />
      </div>

      <Panel
        title="Configuration keys"
        description="Secrets are encrypted with AES-256-GCM at rest and require a fresh step-up check to reveal or update."
      >
        <SettingsEditor
          settings={serialized}
          canEdit={canEdit}
          canOperate={canOperate}
        />
      </Panel>

      <Panel
        title="Daily sweeper preview"
        description="Counts of expired records eligible for cleanup on the next scheduled or manual sweep."
      >
        <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-slate-500">Expired sessions</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">
              {sweepPreview.expiredSessions}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-slate-500">Expired invitations</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">
              {sweepPreview.expiredInvites}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-slate-500">Deleted sites past window</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">
              {sweepPreview.purgeableSites}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-slate-500">Trashed pages past window</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">
              {sweepPreview.purgeablePages}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
