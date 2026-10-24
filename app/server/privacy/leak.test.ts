import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { projectFiles } from "@/scripts/lib/files";
import { createAccountSite } from "@/app/server/sites";
import { createTestWorkspaceFixture } from "@/app/server/test-support";
import {
  eraseGuestByRawContact,
  listAnonymousContacts,
  sealGuestContact,
  superadminRevealGuestContact,
} from "./index";

describe("app/server/privacy/leak", () => {
  it("forbids decryptContact and contactCiphertext outside privacy and schema modules", () => {
    const allowed = new Set([
      "app/server/crypto/index.ts",
      "app/server/crypto/index.test.ts",
      "app/server/db/schema/privacy.ts",
      "app/server/privacy/index.ts",
      "app/server/privacy/leak.test.ts",
    ]);

    const files = projectFiles(["app", "components", "hooks", "lib"]);
    const violations: string[] = [];
    for (const rel of files) {
      if (allowed.has(rel) || (!rel.endsWith(".ts") && !rel.endsWith(".tsx"))) {
        continue;
      }
      const text = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      if (
        text.includes("decryptContact(") ||
        text.includes("contactCiphertext") ||
        text.includes("contact_ciphertext")
      ) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("never exposes plaintext contacts in anonymous views and audits superadmin reveals", async () => {
    const ctx = await createTestWorkspaceFixture({
      platformRole: "superadmin",
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const site = await createAccountSite({
      accountId: ctx.account.id,
      actorUserId: ctx.user.id,
      name: "Privacy Site",
      slug: `privacy-site-${suffix}`,
    });

    const secretPhone = `+447700${Math.floor(100000 + Math.random() * 899999)}`;
    const view = await sealGuestContact({
      accountId: ctx.account.id,
      siteId: site.id,
      rawContact: secretPhone,
    });
    expect(JSON.stringify(view)).not.toContain(secretPhone);
    expect(view.publicId.startsWith("gst_")).toBe(true);

    const listed = await listAnonymousContacts(ctx.account.id);
    expect(JSON.stringify(listed)).not.toContain(secretPhone);

    const revealed = await superadminRevealGuestContact({
      contactId: view.id,
      actorUserId: ctx.user.id,
      reason: "Compliance verification ticket 1042",
    });
    expect(revealed).toBe(secretPhone);

    const erased = await eraseGuestByRawContact(secretPhone);
    expect(erased.erasedCount).toBe(1);
    expect(await listAnonymousContacts(ctx.account.id)).toHaveLength(0);
  });
});
