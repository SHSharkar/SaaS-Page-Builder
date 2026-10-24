import "server-only";
import { relations } from "drizzle-orm";
import { accountMembers, accounts } from "./accounts";
import { siteDomains } from "./domains";
import { pageVersions, pages } from "./pages";
import { siteContents, sites } from "./sites";
import { users } from "./users";

export const accountsRelations = relations(accounts, ({ many }) => ({
  members: many(accountMembers),
  sites: many(sites),
}));

export const accountMembersRelations = relations(accountMembers, ({ one }) => ({
  account: one(accounts, {
    fields: [accountMembers.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [accountMembers.userId],
    references: [users.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  account: one(accounts, {
    fields: [sites.accountId],
    references: [accounts.id],
  }),
  pages: many(pages),
  domains: many(siteDomains),
  contents: many(siteContents),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, {
    fields: [pages.siteId],
    references: [sites.id],
  }),
  versions: many(pageVersions),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  page: one(pages, {
    fields: [pageVersions.pageId],
    references: [pages.id],
  }),
}));
