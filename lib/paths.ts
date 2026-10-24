export const APP_PATHS = {
  dashboard: "/dashboard",
  sites: "/sites",
  newSite: "/sites/new",
  siteDetail: (siteId: string) => `/sites/${encodeURIComponent(siteId)}`,
  sitePages: (siteId: string) => `/sites/${encodeURIComponent(siteId)}/pages`,
  siteEditor: (siteId: string, pageId: string) =>
    `/sites/${encodeURIComponent(siteId)}/editor/${encodeURIComponent(pageId)}`,
  sitePreview: (siteId: string, pageId: string) =>
    `/sites/${encodeURIComponent(siteId)}/preview/${encodeURIComponent(pageId)}`,
  siteGlobals: (siteId: string) =>
    `/sites/${encodeURIComponent(siteId)}/globals`,
  siteDomains: (siteId: string) =>
    `/sites/${encodeURIComponent(siteId)}/domains`,
  siteMedia: (siteId: string) => `/sites/${encodeURIComponent(siteId)}/media`,
  siteImports: (siteId: string) =>
    `/sites/${encodeURIComponent(siteId)}/imports`,
  siteSettings: (siteId: string) =>
    `/sites/${encodeURIComponent(siteId)}/settings`,
  templates: "/templates",
  domains: "/domains",
  media: "/media",
  imports: "/imports",
  analytics: "/analytics",
  team: "/team",
  exportData: "/export",
  settings: "/settings",
} as const;

export const PUBLIC_PATHS = {
  home: "/",
  features: "/features",
  pricing: "/pricing",
  faq: "/faq",
  privacy: "/privacy",
  terms: "/terms",
  myData: "/my-data",
  signIn: "/sign-in",
  twoFactor: "/sign-in/two-factor",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  acceptInvitation: "/accept-invitation",
  signedOut: "/signed-out",
  publishedSite: (siteSlug: string, slug = "/") =>
    slug === "/"
      ? `/s/${encodeURIComponent(siteSlug)}`
      : `/s/${encodeURIComponent(siteSlug)}${slug.startsWith("/") ? slug : `/${slug}`}`,
} as const;
