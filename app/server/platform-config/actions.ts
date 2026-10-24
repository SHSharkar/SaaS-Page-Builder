"use server";

import { requirePlatformCapability } from "@/app/server/auth/guards";
import { setPlatformSetting } from "./index";

export async function updatePlatformSettingAction(input: {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}): Promise<{ ok: boolean }> {
  const actor = await requirePlatformCapability("platform.settings.manage");
  await setPlatformSetting({
    key: input.key,
    value: input.value,
    isSecret: input.isSecret,
    description: input.description,
    actorUserId: actor.user.id,
  });
  return { ok: true };
}
