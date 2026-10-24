import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  domains,
  pages,
  staffInvites,
  templates,
  users,
  type User,
} from "@/lib/db/schema";
import {
  DEFAULT_THEME,
  DOCUMENT_SCHEMA_VERSION,
  newBlockId,
  type BlockNode,
  type PageDocument,
} from "@/lib/documents";
import { defaultPropsFor } from "@/lib/registry";
import { syncComponentCatalog } from "@/lib/registry/sync";
import { hashToken, newToken } from "@/lib/auth/password";
import { provisionAccount } from "@/lib/auth/mutations";
import { listRoles, permissionKeysForUser, syncRbacCatalog } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/auth/session";
import { seedPlatformSettings } from "@/lib/settings";
import { createSite } from "@/lib/sites";
import { createPage, publishPage } from "@/lib/pages";
import { publishGlobals, saveDefaultSeo, saveGlobalsDraft } from "@/lib/globals";
import { uploadMedia } from "@/lib/media";
import { builtInTemplates } from "@/lib/templates";
import { createImportJob } from "@/lib/importer";
import { DEMO_PASSWORD as DEMO_PASSWORD_VALUE } from "@/lib/demo-accounts";

export { DEMO_PASSWORD } from "@/lib/demo-accounts";

function blk(type: string, props: Record<string, unknown> = {}): BlockNode {
  return {
    type,
    props: {
      ...defaultPropsFor(type),
      id: newBlockId(type),
      ...props,
    },
  };
}

function doc(content: BlockNode[]): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: {} },
    content,
  };
}

async function seedActor(user: User): Promise<Actor> {
  const roles = await listRoles();
  const matchedRole = roles.find((role) => role.key === user.role);
  const permissions = await permissionKeysForUser(user.id);
  return {
    user,
    session: {
      id: "00000000-0000-0000-0000-000000000000",
      token: "seed",
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: "seed",
      stepUpUntil: new Date(Date.now() + 60_000),
      impersonatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    roles: matchedRole ? [matchedRole] : [],
    permissions: new Set(permissions),
    stepUpValid: true,
  };
}

async function ingestSeedFile(options: {
  siteId: string;
  filename: string;
  sourcePath: string;
  altText: string;
  actor: Actor;
}) {
  const bytes = await readFile(options.sourcePath);
  const { asset } = await uploadMedia({
    siteId: options.siteId,
    filename: options.filename,
    mimeType: "image/jpeg",
    bytes,
    altText: options.altText,
    actor: options.actor,
  });
  return asset;
}

export async function seedIfEmpty(): Promise<void> {
  await syncRbacCatalog();
  await syncComponentCatalog();
  await seedPlatformSettings();

  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((existing?.count ?? 0) > 0) return;

  const roles = await listRoles();
  const roleId = (key: string) => {
    const role = roles.find((candidate) => candidate.key === key);
    if (!role) throw new Error(`The ${key} role is missing.`);
    return role.id;
  };

  const admin = await provisionAccount({
    name: "Dana Whitlock",
    email: "admin@trofeo.example",
    password: DEMO_PASSWORD_VALUE,
    roleKey: "admin",
    mustChangePassword: false,
  });
  const editor = await provisionAccount({
    name: "Marco Silva",
    email: "editor@trofeo.example",
    password: DEMO_PASSWORD_VALUE,
    roleKey: "editor",
    mustChangePassword: false,
  });
  await provisionAccount({
    name: "Priya Raman",
    email: "viewer@trofeo.example",
    password: DEMO_PASSWORD_VALUE,
    roleKey: "viewer",
    mustChangePassword: false,
  });

  const inviteToken = newToken(24);
  await db.insert(staffInvites).values({
    email: "new.starter@trofeo.example",
    roleId: roleId("editor"),
    tokenHash: hashToken(inviteToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: admin.id,
  });

  const actor = await seedActor(admin);
  const editorActor = await seedActor(editor);

  const site = await createSite({
    name: "Trofeo Reward",
    slug: "trofeo",
    createdBy: admin.id,
    theme: {
      ...DEFAULT_THEME,
      palette: "obsidian-gold",
      fontPair: "editorial",
      accent: "#d4af37",
      accentContrast: "#090b10",
      surface: "#0b0d14",
      ink: "#f8fafc",
      logoText: "Trofeo",
      tagline: "Rewards that keep players playing.",
      radius: "soft",
    },
  });

  const assets = {
    hero: await ingestSeedFile({
      siteId: site.id,
      filename: "hero-glow.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "hero-glow.jpg"),
      actor,
      altText: "Golden bokeh light over a midnight blue background",
    }),
    coin: await ingestSeedFile({
      siteId: site.id,
      filename: "coin-blitz.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "coin-blitz.jpg"),
      actor,
      altText: "Coin Blitz game cover",
    }),
    lucky: await ingestSeedFile({
      siteId: site.id,
      filename: "lucky-streak.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "lucky-streak.jpg"),
      actor,
      altText: "Lucky Streak game cover",
    }),
    treasure: await ingestSeedFile({
      siteId: site.id,
      filename: "treasure-bay.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "treasure-bay.jpg"),
      actor,
      altText: "Treasure Bay game cover",
    }),
    fruits: await ingestSeedFile({
      siteId: site.id,
      filename: "neon-fruits.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "neon-fruits.jpg"),
      actor,
      altText: "Neon Fruits game cover",
    }),
  };

  await db.insert(domains).values({
    siteId: site.id,
    hostname: "offers.trofeo-reward.example",
    kind: "custom",
    status: "active",
    verifiedAt: new Date(),
    certificateIssuer: "lets_encrypt",
    certificateState: "issued",
    isPrimary: false,
    requestedBy: admin.id,
  });

  const navigation = doc([
    blk("announcement-bar", {
      badge: "WEEKEND TURBO",
      message: "Double trophies on every featured game through Sunday midnight UTC.",
      ctaLabel: "See Bonuses",
      ctaHref: "/bonus-terms",
      dismissible: "true",
      tone: "gold",
    }),
    blk("site-header", {
      brandName: "Trofeo Reward",
      tagline: "Verified Rewards",
      links: [
        { label: "Home", href: "/" },
        { label: "Rewards Wallet", href: "/rewards/wallet" },
        { label: "Bonus Terms", href: "/bonus-terms" },
      ],
      ctaLabel: "Claim Bonus",
      ctaHref: "/rewards/wallet",
      ctaTrackingId: "nav_claim_bonus",
      sticky: "true",
    }),
  ]);

  const footer = doc([
    blk("site-footer", {
      brandName: "Trofeo Reward",
      summary:
        "Curated game offers, transparent bonus terms, and fast payout verification for 18+ players.",
      columns: [
        {
          heading: "Rewards",
          links: [
            { label: "Rewards Wallet", href: "/rewards/wallet" },
            { label: "Bonus Terms", href: "/bonus-terms" },
          ],
        },
        {
          heading: "Safety",
          links: [
            { label: "BeGambleAware", href: "https://www.begambleaware.org" },
            { label: "GamCare", href: "https://www.gamcare.org.uk" },
          ],
        },
      ],
      badges: [{ label: "18+ Only" }, { label: "MGA Licensed" }, { label: "SSL Secured" }],
      legalNote:
        "18+ only. Trofeo Reward promotes regulated gaming offers. Please play within your limits.",
    }),
    blk("sticky-cta-dock", {
      offer: "100% up to $200 + 50 Free Spins ready to claim",
      subtext: "18+ | T&Cs apply | 35x wagering",
      buttonLabel: "Claim Offer",
      buttonHref: "/rewards/wallet",
      trackingId: "sticky_claim_offer",
    }),
  ]);

  await saveGlobalsDraft(site.id, "navigation", navigation, actor);
  await publishGlobals(site.id, "navigation", actor);
  await saveGlobalsDraft(site.id, "footer", footer, actor);
  await publishGlobals(site.id, "footer", actor);
  await saveDefaultSeo(
    site.id,
    {
      metaTitle: "Trofeo Reward | Verified Bonuses & Fast Payouts",
      metaDescription:
        "Play featured games, collect trophies in a single wallet, and redeem verified rewards.",
    },
    actor,
  );

  const homeDocument = doc([
    blk("hero", {
      eyebrow: "Trofeo Reward",
      headline: "Play the games you love and keep every verified reward",
      subheadline:
        "Create an account, collect trophies on every round, and redeem them for gift cards and bonus cash with transparent wagering terms.",
      primaryLabel: "Claim Welcome Bonus",
      primaryHref: "/rewards/wallet",
      primaryTrackingId: "hero_claim_welcome",
      secondaryLabel: "Read Bonus Terms",
      secondaryHref: "/bonus-terms",
      media: { id: assets.hero.id, alt: assets.hero.altText },
      layout: "split",
      align: "left",
      theme: "dark",
    }),
    blk("trust-strip", {}),
    blk("bonus-card", {
      rankBadge: "#1 Editor's Pick",
      brand: "Trofeo Reward",
      rating: "9.8 / 10",
      headline: "100% up to $200 + 50 Free Spins",
      subheadline: "Instant trophy wallet credit + verified 24-hour payouts",
      bonusCode: "TROFEO200",
      wagering: "35x bonus",
      minDeposit: "$10",
      payoutSpeed: "Under 24 hours",
      ctaLabel: "Claim Welcome Bonus",
      ctaHref: "/rewards/wallet",
      ctaTrackingId: "bonus_card_trofeo",
      terms:
        "18+ | New players only | Min deposit $10 | 35x wagering on bonus | Max cashout $2,000 | Full terms apply.",
      highlight: "featured",
    }),
    blk("cards-grid", {
      eyebrow: "Featured Floor",
      heading: "Games players keep coming back to",
      columns: "4",
      cards: [
        {
          media: { id: assets.coin.id, alt: assets.coin.altText },
          tag: "Hourly Ladder",
          title: "Coin Blitz",
          body: "Cascading coins and a trophy ladder that resets every hour.",
          linkLabel: "Explore",
          linkHref: "/rewards/wallet",
        },
        {
          media: { id: assets.lucky.id, alt: assets.lucky.altText },
          tag: "High Multiplier",
          title: "Lucky Streak",
          body: "Clovers, gem multipliers, and a 4,000x top payout ceiling.",
          linkLabel: "Explore",
          linkHref: "/rewards/wallet",
        },
        {
          media: { id: assets.treasure.id, alt: assets.treasure.altText },
          tag: "Bonus Chests",
          title: "Treasure Bay",
          body: "Pearl bonuses on every chest with a moonlit free-spin round.",
          linkLabel: "Explore",
          linkHref: "/rewards/wallet",
        },
        {
          media: { id: assets.fruits.id, alt: assets.fruits.altText },
          tag: "Classic Arcade",
          title: "Neon Fruits",
          body: "The retro classic rebuilt with crisp neon win lines.",
          linkLabel: "Explore",
          linkHref: "/rewards/wallet",
        },
      ],
    }),
    blk("steps", {
      eyebrow: "How It Works",
      heading: "Three steps to your first reward",
      layout: "horizontal",
      steps: [
        {
          title: "Create your account",
          body: "Verify your email in under a minute and unlock the starter wallet.",
        },
        {
          title: "Collect trophies",
          body: "Every eligible game round adds trophies to one unified balance.",
        },
        {
          title: "Redeem anytime",
          body: "Swap trophies for gift cards, bonus cash, or free-spin bundles.",
        },
      ],
    }),
    blk("casino-compare-table", {
      heading: "Top verified bonus offers this week",
      subheading: "All wagering multipliers and payout speeds audited by our editorial team.",
    }),
    blk("promo-banner", {
      badge: "WEEKEND CODE",
      text: "200 Free Spins on Neon Fruits with your weekend deposit",
      code: "TROFEO200",
      ctaLabel: "Redeem Code",
      ctaHref: "/rewards/wallet",
      tone: "gold",
    }),
    blk("faq", {
      eyebrow: "Questions",
      heading: "Frequently asked questions",
      emitJsonLd: "true",
      items: [
        {
          question: "How do trophies turn into rewards?",
          answer:
            "Trophies accumulate in one wallet. Pick a gift card or bonus package on the wallet page and confirm your request; most redemptions complete within 24 hours.",
        },
        {
          question: "What are the wagering requirements on the welcome bonus?",
          answer:
            "The welcome offer carries a 35x wagering requirement on the bonus amount, with full game weighting tables published on the bonus terms page.",
        },
        {
          question: "Can I set deposit and session limits?",
          answer:
            "Yes. Deposit, loss, and session time limits are available at any time and take effect immediately.",
        },
      ],
    }),
    blk("responsible-gaming", {}),
  ]);

  const home = await createPage({
    siteId: site.id,
    title: "Home",
    slug: "/",
    isHomepage: true,
    document: homeDocument,
    actor,
    seo: {
      metaTitle: "Trofeo Reward - Play, Collect Trophies, Redeem Rewards",
      metaDescription:
        "Create an account, collect trophies on featured games, and redeem gift cards or bonus cash with verified payout times.",
      noindex: false,
    },
  });
  await publishPage(site.id, home.id, actor, { note: "Initial launch", source: "manual" });

  const updatedHomeDoc: PageDocument = {
    ...homeDocument,
    content: homeDocument.content.map((node) =>
      node.type === "promo-banner"
        ? {
            ...node,
            props: {
              ...node.props,
              text: "300 Free Spins on Neon Fruits this weekend",
              code: "TROFEO300",
            },
          }
        : node,
    ),
  };
  await db
    .update(pages)
    .set({ draftDocument: updatedHomeDoc, updatedAt: new Date() })
    .where(eq(pages.id, home.id));
  await publishPage(site.id, home.id, actor, {
    note: "Weekend 300 spins campaign",
    source: "manual",
  });

  const walletDocument = doc([
    blk("hero", {
      eyebrow: "Rewards Wallet",
      headline: "Your trophy balance in plain sight",
      subheadline:
        "See what you have collected, what each tier is worth, and how quickly redemptions settle.",
      primaryLabel: "View Bonus Terms",
      primaryHref: "/bonus-terms",
      secondaryLabel: "Back to Home",
      secondaryHref: "/",
      layout: "centered",
      align: "center",
      theme: "dark",
    }),
    blk("animated-counter", {
      heading: "Live wallet metrics",
      items: [
        { value: "50,000+", label: "Rewards redeemed", note: "Verified payouts" },
        { value: "14 min", label: "Median e-wallet speed", note: "Last 30 days" },
        { value: "99.4%", label: "Same-day fulfillment", note: "Audited monthly" },
      ],
    }),
    blk("payment-strip", {}),
    blk("cta-banner", {
      eyebrow: "Instant Redemption",
      heading: "Ready to put your trophies to work?",
      body: "Review eligible games and transparent bonus rules before claiming.",
      buttonLabel: "Read Bonus Terms",
      buttonHref: "/bonus-terms",
      tone: "brand",
    }),
  ]);

  const wallet = await createPage({
    siteId: site.id,
    title: "Rewards Wallet",
    slug: "/rewards/wallet",
    document: walletDocument,
    actor,
    seo: {
      metaTitle: "Rewards Wallet - Trofeo Reward",
      metaDescription: "Track trophies, check payout speeds, and redeem verified rewards.",
      noindex: false,
    },
  });
  await publishPage(site.id, wallet.id, actor, { note: "Wallet launch", source: "manual" });

  const termsDocument = doc([
    blk("table-of-contents", {
      heading: "Bonus terms sections",
      items: [
        { label: "Welcome Offer Rules", anchor: "#welcome-rules" },
        { label: "Frequently Asked Questions", anchor: "#faq" },
      ],
    }),
    blk("rich-text", {
      width: "normal",
      html: "<h2 id=\"welcome-rules\">Welcome bonus terms</h2><p>The welcome bonus matches 100% of your first deposit up to $200 plus 50 free spins on Coin Blitz.</p><h3>Wagering contribution</h3><ul><li>Slots contribute 100% toward the 35x bonus requirement.</li><li>Table and live dealer titles contribute 10%.</li><li>Bonus funds expire 7 days after credit and free spins expire after 48 hours.</li></ul>",
    }),
    blk("faq", {
      eyebrow: "Terms FAQ",
      heading: "Common bonus term questions",
      emitJsonLd: "false",
      items: [
        {
          question: "Is the welcome offer withdrawable cash?",
          answer:
            "Bonus funds convert to withdrawable cash once the 35x wagering requirement is completed within 7 days.",
        },
        {
          question: "What is the maximum cashout on the welcome offer?",
          answer: "Winnings converted from the welcome bonus are capped at $2,000.",
        },
      ],
    }),
    blk("responsible-gaming", {}),
  ]);

  const terms = await createPage({
    siteId: site.id,
    title: "Bonus Terms",
    slug: "/bonus-terms",
    document: termsDocument,
    actor,
    seo: {
      metaTitle: "Bonus Terms - Trofeo Reward",
      metaDescription: "Full wagering, game weighting, expiry, and cashout rules.",
      noindex: false,
    },
  });
  await publishPage(site.id, terms.id, actor, { note: "Terms launch", source: "manual" });

  const curated = builtInTemplates();
  await db.insert(templates).values(
    curated.map((tpl) => ({
      siteId: null,
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      document: tpl.document,
      createdBy: admin.id,
    })),
  );

  const sampleHtml = await readFile(
    path.join(process.cwd(), "public", "seed", "sample-lander.html"),
    "utf8",
  );
  await createImportJob({
    siteId: site.id,
    filename: "neon-fruits-lander.html",
    html: sampleHtml,
    actor: editorActor,
  });
}
