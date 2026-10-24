import { describe, expect, it } from "vitest";
import * as enums from "./index";

describe("lib/enums", () => {
  it("declares non-empty unique value lists and matching schemas", () => {
    const pairs = [
      [enums.ACCOUNT_ROLES, enums.accountRoleSchema],
      [enums.ACCOUNT_STATUSES, enums.accountStatusSchema],
      [enums.BLOCK_GROUPS, enums.blockGroupSchema],
      [enums.CERTIFICATE_STATES, enums.certificateStateSchema],
      [enums.DOMAIN_KINDS, enums.domainKindSchema],
      [enums.DOMAIN_STATUSES, enums.domainStatusSchema],
      [enums.GLOBAL_KINDS, enums.globalKindSchema],
      [enums.IMPORT_STATUSES, enums.importStatusSchema],
      [enums.INVITE_STATUSES, enums.inviteStatusSchema],
      [enums.JOB_KINDS, enums.jobKindSchema],
      [enums.MEDIA_KINDS, enums.mediaKindSchema],
      [enums.MEDIA_REF_SOURCES, enums.mediaRefSourceSchema],
      [enums.MEDIA_STATUSES, enums.mediaStatusSchema],
      [enums.PAGE_STATUSES, enums.pageStatusSchema],
      [enums.PLATFORM_ROLES, enums.platformRoleSchema],
      [enums.SHORT_LINK_KINDS, enums.shortLinkKindSchema],
      [enums.SITE_STATUSES, enums.siteStatusSchema],
      [enums.TEMPLATE_SCOPES, enums.templateScopeSchema],
      [enums.TEMPLATE_STATUSES, enums.templateStatusSchema],
      [enums.VERSION_SOURCES, enums.versionSourceSchema],
    ] as const;

    for (const [values, schema] of pairs) {
      expect(values.length).toBeGreaterThan(1);
      expect(new Set(values).size).toBe(values.length);
      for (const item of values) {
        expect(schema.parse(item)).toBe(item);
      }
      expect(() => schema.parse("__invalid__")).toThrow();
    }
  });
});
