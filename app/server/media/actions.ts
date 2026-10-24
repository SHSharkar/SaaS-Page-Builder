"use server";

import { requireAccountCapability } from "@/app/server/auth/guards";
import { publishAccountChange } from "@/app/server/realtime/publish";
import { registerSiteMediaAsset, retireMediaAsset } from "./index";

export async function registerMediaAction(input: {
  siteId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  altText?: string;
}): Promise<{ ok: boolean; mediaId: string; uploadUrl: string }> {
  const actor = await requireAccountCapability("media.manage");
  const { asset, uploadUrl } = await registerSiteMediaAsset({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    ...input,
  });
  await publishAccountChange(actor.account.id, "media.registered", [asset.id]);
  return { ok: true, mediaId: asset.id, uploadUrl };
}

export async function retireMediaAction(input: {
  mediaId: string;
}): Promise<{ ok: boolean; mediaId: string }> {
  const actor = await requireAccountCapability("media.manage");
  const retired = await retireMediaAsset({
    accountId: actor.account.id,
    actorUserId: actor.user.id,
    mediaId: input.mediaId,
  });
  await publishAccountChange(actor.account.id, "media.retired", [retired.id]);
  return { ok: true, mediaId: retired.id };
}
