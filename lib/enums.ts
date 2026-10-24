import { z } from "zod";

export const SITE_STATUSES = ["active", "suspended", "deleted"] as const;
export const siteStatusSchema = z.enum(SITE_STATUSES);
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const GLOBAL_KINDS = ["navigation", "footer", "defaults"] as const;
export const globalKindSchema = z.enum(GLOBAL_KINDS);
export type GlobalKind = (typeof GLOBAL_KINDS)[number];
export const GLOBAL_CONTENT_KINDS = GLOBAL_KINDS;
export type GlobalContentKind = GlobalKind;

export const DOMAIN_KINDS = ["subdomain", "platform_subdomain", "custom"] as const;
export const domainKindSchema = z.enum(DOMAIN_KINDS);
export type DomainKind = (typeof DOMAIN_KINDS)[number];

export const DOMAIN_STATUSES = ["pending", "verifying", "active", "failed", "removed"] as const;
export const domainStatusSchema = z.enum(DOMAIN_STATUSES);
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const CERTIFICATE_STATES = ["none", "pending", "issued", "failed"] as const;
export const certificateStateSchema = z.enum(CERTIFICATE_STATES);
export type CertificateState = (typeof CERTIFICATE_STATES)[number];

export const PAGE_STATUSES = ["draft", "published", "archived", "deleted"] as const;
export const pageStatusSchema = z.enum(PAGE_STATUSES);
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const VERSION_SOURCES = [
  "publish",
  "manual",
  "scheduled",
  "rollback",
  "import",
  "template",
] as const;
export const versionSourceSchema = z.enum(VERSION_SOURCES);
export type VersionSource = (typeof VERSION_SOURCES)[number];

export const TEMPLATE_STATUSES = ["active", "retired"] as const;
export const templateStatusSchema = z.enum(TEMPLATE_STATUSES);
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const TEMPLATE_SCOPES = ["platform", "staff"] as const;
export const templateScopeSchema = z.enum(TEMPLATE_SCOPES);
export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

export const IMPORT_STATUSES = [
  "uploaded",
  "parsing",
  "mapped",
  "review",
  "in_review",
  "applied",
  "failed",
  "discarded",
] as const;
export const importStatusSchema = z.enum(IMPORT_STATUSES);
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const MEDIA_STATUSES = ["pending", "ready", "failed", "deleted"] as const;
export const mediaStatusSchema = z.enum(MEDIA_STATUSES);
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const MEDIA_KINDS = ["image", "document", "import_reference"] as const;
export const mediaKindSchema = z.enum(MEDIA_KINDS);
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_REF_SOURCES = [
  "page_draft",
  "page_version",
  "site_content",
  "site_theme",
  "page_seo",
] as const;
export const mediaRefSourceSchema = z.enum(MEDIA_REF_SOURCES);
export type MediaRefSource = (typeof MEDIA_REF_SOURCES)[number];

export const INVITE_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export const inviteStatusSchema = z.enum(INVITE_STATUSES);
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const BLOCK_GROUPS = ["site-frame", "conversion", "money", "content", "utility"] as const;
export const blockGroupSchema = z.enum(BLOCK_GROUPS);
export type BlockGroup = (typeof BLOCK_GROUPS)[number];

export const LLM_ADAPTERS = ["none", "openai-compatible"] as const;
export const llmAdapterSchema = z.enum(LLM_ADAPTERS);
export type LlmAdapterKind = (typeof LLM_ADAPTERS)[number];

export const JOB_KINDS = [
  "page.scheduled-publish",
  "page.scheduled-unpublish",
  "domain.verify",
  "media.orphan-sweep",
  "sweeper.daily",
] as const;
export const jobKindSchema = z.enum(JOB_KINDS);
export type JobKind = (typeof JOB_KINDS)[number];

export type AuditAction = string;
