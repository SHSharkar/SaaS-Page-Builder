import { eq, sql } from "drizzle-orm";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import {
  domains,
  pages,
  platformSettings,
  staffInvites,
  templates,
  users,
  type User,
} from "@/lib/db/schema";
import {
  DOCUMENT_SCHEMA_VERSION,
  DEFAULT_THEME,
  type BlockNode,
  type PageDocument,
  type PlaceholderSpec,
} from "@/lib/documents";
import { DEFAULT_APPEARANCE } from "@/lib/registry/types";
import { defaultPropsFor } from "@/lib/registry";
import { hashToken, newToken } from "@/lib/auth/password";
import { provisionAccount } from "@/lib/auth/mutations";
import { listRoles, permissionKeysForUser, syncRbacCatalog } from "@/lib/auth/rbac";
import { createSite } from "@/lib/sites";
import { createPage, publishPage } from "@/lib/pages";
import { getSiteContent, publishGlobals, saveGlobalsDraft } from "@/lib/globals";
import { ingestSeedImage } from "@/lib/media";
import type { Actor } from "@/lib/auth/session";
import { createImportJob } from "@/lib/importer";
import { enqueue } from "@/lib/queue";

export { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { DEMO_PASSWORD as DEMO_PASSWORD_VALUE } from "@/lib/demo-accounts";

const NO_APPEARANCE = { ...DEFAULT_APPEARANCE };

function blk(type: string, props: Record<string, unknown> = {}, appearance: Record<string, unknown> = {}): BlockNode {
  return {
    type,
    props: {
      ...defaultPropsFor(type),
      ...props,
      appearance: { ...NO_APPEARANCE, ...appearance },
    },
  };
}

function doc(content: BlockNode[]): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { contentWidth: "default", background: "default" } },
    content,
  };
}

async function seedActor(user: User): Promise<Actor> {
  const roles = await listRoles();
  const adminRole = roles.find((role) => role.key === "admin");
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
    roles: adminRole ? [adminRole] : [],
    permissions: new Set(permissions),
    stepUpValid: true,
  };
}

export async function seedIfEmpty(): Promise<void> {

  await syncRbacCatalog();
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

  const site = await createSite({
    name: "Trofeo Reward",
    slug: "trofeo",
    createdBy: admin.id,
    theme: {
      ...DEFAULT_THEME,
      accent: "#c8a24a",
      accentContrast: "#0b1120",
      background: "#0b1120",
      surface: "#121a2b",
      text: "#f4f6fb",
      muted: "#9aa4bb",
      border: "#243049",
      logoText: "Trofēo",
      tagline: "Rewards that keep players playing.",
      radius: "soft",
    },
  });

  const assets = {
    hero: await ingestSeedImage({
      siteId: site.id,
      filename: "hero-glow.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "hero-glow.jpg"),
      actor,
      altText: "Golden bokeh light over a midnight blue background",
    }),
    coin: await ingestSeedImage({
      siteId: site.id,
      filename: "coin-blitz.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "coin-blitz.jpg"),
      actor,
      altText: "Coin Blitz game cover",
    }),
    lucky: await ingestSeedImage({
      siteId: site.id,
      filename: "lucky-streak.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "lucky-streak.jpg"),
      actor,
      altText: "Lucky Streak game cover",
    }),
    treasure: await ingestSeedImage({
      siteId: site.id,
      filename: "treasure-bay.jpg",
      sourcePath: path.join(process.cwd(), "public", "seed", "treasure-bay.jpg"),
      actor,
      altText: "Treasure Bay game cover",
    }),
    fruits: await ingestSeedImage({
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
    blk("site-header", {
      logoText: "Trofēo",
      links: [
        { label: "Games", href: "/games" },
        { label: "Bonuses", href: "/bonuses" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Rewards", href: "/rewards/wallet" },
      ],
      cta: { label: "Join free", href: "/join", style: "solid" },
      announcement: "Weekend turbo: double trophies on every slot →",
      announcementHref: "/bonuses",
    }),
  ]);

  const footer = doc([
    blk(
      "site-footer",
      {
        columns: [
          { title: "Play", links: "Games|/games\nBonuses|/bonuses\nHow it works|/how-it-works" },
          { title: "Rewards", links: "Wallet|/rewards/wallet\nRedeem|/rewards\nTrophies|/trophies" },
          { title: "Company", links: "About|/about\nPress|/press\nCareers|/careers" },
        ],
        legal:
          "Trofēo Reward is a social games platform. No purchase necessary. 18+ only. Play responsibly — set limits and take breaks.",
      },
      { spacing: "md", background: "inherit" },
    ),
    blk("sticky-cta-dock", {
      message: "Welcome bonus ready to claim",
      primary: { label: "Claim now", href: "/join", style: "solid" },
      secondary: { label: "Details", href: "/bonuses", style: "outline" },
    }),
  ]);

  for (const [kind, document] of [
    ["navigation", navigation],
    ["footer", footer],
  ] as const) {
    const row = await getSiteContent(site.id, kind);
    await saveGlobalsDraft(site.id, kind, document, row?.lockVersion ?? 0, actor);
    await publishGlobals(site.id, kind, actor);
  }

  const homeDocument = doc([
    blk(
      "hero",
      {
        eyebrow: "Trofēo Reward",
        title: "Play the games you love. Keep the rewards.",
        subtitle:
          "Create a free account, collect trophies on every round, and swap them for gift cards and bonus cash. No purchase needed.",
        primary: { label: "Claim welcome bonus", href: "/join", style: "solid" },
        secondary: { label: "See how it works", href: "#how-it-works", style: "outline" },
        background: { id: assets.hero.id },
        overlay: 62,
        rating: 4.6,
        ratingLabel: "Rated 4.6 by 12,400 players",
        badges: ["18+", "Licensed", "Responsible play"],
      },
      { spacing: "none" },
    ),
    blk("trust-strip", {}, { spacing: "sm", background: "surface" }),
    blk(
      "bonus-card",
      {
        brand: "Trofēo Reward",
        badge: "Welcome offer",
        headline: "100% up to $200",
        subline: "+ 50 free spins on your first deposit",
        freeSpins: "50",
        minDeposit: "$10",
        wagering: "35x",
        maxCashout: "$2,000",
        rating: 4.6,
        reviewCount: "12,400 reviews",
        cta: { label: "Claim welcome bonus", href: "/join", style: "solid" },
      },
      { spacing: "lg" },
    ),
    blk(
      "cards-grid",
      {
        eyebrow: "The floor",
        title: "Games players keep coming back to",
        description: "Four thousand titles, curated weekly by our games team.",
        columns: "4",
        cards: [
          {
            image: { id: assets.coin.id },
            icon: "trophy",
            title: "Coin Blitz",
            text: "Cascading coins and a trophy ladder that resets every hour.",
            ctaLabel: "Play Coin Blitz",
            ctaHref: "/games/coin-blitz",
          },
          {
            image: { id: assets.lucky.id },
            icon: "spark",
            title: "Lucky Streak",
            text: "Green clovers, gem multipliers and a 4,000x top payout.",
            ctaLabel: "Play Lucky Streak",
            ctaHref: "/games/lucky-streak",
          },
          {
            image: { id: assets.treasure.id },
            icon: "gift",
            title: "Treasure Bay",
            text: "Pearl bonuses on every chest, with a moonlit free-spin round.",
            ctaLabel: "Play Treasure Bay",
            ctaHref: "/games/treasure-bay",
          },
          {
            image: { id: assets.fruits.id },
            icon: "bolt",
            title: "Neon Fruits",
            text: "The retro classic, rebuilt with electric neon win lines.",
            ctaLabel: "Play Neon Fruits",
            ctaHref: "/games/neon-fruits",
          },
        ],
      },
      { spacing: "lg" },
    ),
    blk(
      "steps",
      {
        eyebrow: "How it works",
        title: "Three steps to your first reward",
        items: [
          { title: "Create a free account", text: "Sign up in under a minute. No purchase, no card details." },
          { title: "Play and collect trophies", text: "Every game you open adds trophies to one wallet." },
          { title: "Redeem what you want", text: "Swap trophies for gift cards, bonus cash or free spins." },
        ],
      },
      { spacing: "lg", background: "muted" },
    ),
    blk(
      "casino-compare-table",
      {
        eyebrow: "Compare",
        title: "The three bonuses worth your time",
        description: "Terms verified by our team this week. Wagering shown as a multiplier.",
        rows: [
          {
            casino: "Trofēo Reward",
            bonus: "100% up to $200",
            highlights: "24h payouts · 4,000 games · 50 spins",
            rating: 4.6,
            ctaLabel: "Claim",
            ctaHref: "/join",
            highlight: "yes",
          },
          {
            casino: "Lucky Streak",
            bonus: "50 free spins",
            highlights: "No deposit · 40x wagering",
            rating: 4.2,
            ctaLabel: "Claim",
            ctaHref: "/join",
            highlight: "no",
          },
          {
            casino: "Treasure Bay",
            bonus: "125% up to $500",
            highlights: "Crypto accepted · 30x wagering",
            rating: 4,
            ctaLabel: "Claim",
            ctaHref: "/join",
            highlight: "no",
          },
        ],
      },
      { spacing: "lg" },
    ),
    blk(
      "promo-banner",
      {
        headline: "200 free spins this weekend only",
        offer: "On every Neon Fruits deposit, Friday to Sunday",
        code: "TROFEO200",
        cta: { label: "Redeem code", href: "/join", style: "solid" },
      },
      { spacing: "none" },
    ),
    blk(
      "features-grid",
      {
        eyebrow: "By the numbers",
        title: "Why players stay",
        variant: "stats",
        items: [
          { icon: "gift", value: "50k", title: "Rewards claimed", text: "Gift cards and bonus cash since launch." },
          { icon: "clock", value: "24h", title: "Payout window", text: "Most withdrawals land the same day." },
          { icon: "shield", value: "4.6", title: "Player rating", text: "From 12,400 verified reviews." },
        ],
      },
      { spacing: "lg", background: "surface" },
    ),
    blk(
      "faq",
      {
        eyebrow: "Questions",
        title: "Frequently asked",
        items: [
          {
            question: "Is Trofēo free to play?",
            answer:
              "Yes. Creating an account and playing social games is free, and no purchase is ever required to collect or redeem trophies.",
          },
          {
            question: "How do trophies become rewards?",
            answer:
              "Trophies collect in one wallet. Open the rewards page, pick a gift card or bonus, and confirm — most land within 24 hours.",
          },
          {
            question: "What are wagering requirements?",
            answer:
              "Wagering is the number of times bonus winnings must be played before withdrawal. The welcome bonus uses 35x, and the full terms sit on every bonus card.",
          },
          {
            question: "Can I set my own limits?",
            answer:
              "Yes. Deposit, session and spend limits are in your account settings, and they take effect immediately.",
          },
        ],
        structuredData: true,
      },
      { spacing: "lg" },
    ),
    blk(
      "cta-banner",
      {
        title: "Your first trophy is one spin away",
        text: "Join 120,000 players collecting rewards across four thousand games.",
        primary: { label: "Create free account", href: "/join", style: "solid" },
        secondary: { label: "Talk to support", href: "/contact", style: "ghost" },
      },
      { spacing: "lg", background: "muted" },
    ),
  ]);

  const home = await createPage({
    siteId: site.id,
    title: "Home",
    slug: "",
    document: homeDocument,
    actor,
    isHomepage: true,
    seo: {
      title: "Trofēo Reward — play, collect trophies, redeem rewards",
      description:
        "Create a free account, collect trophies on every round and redeem them for gift cards and bonus cash. 18+, licensed and responsible.",
      canonicalMode: "self",
      noindex: false,
    },
  });

  await publishPage(site.id, home.id, actor, "manual");

  const walletDocument = doc([
    blk(
      "hero",
      {
        eyebrow: "Rewards",
        title: "Your trophy wallet, in plain sight",
        subtitle:
          "See what you have collected, what it is worth, and exactly how long a redemption takes.",
        primary: { label: "Open my wallet", href: "/join", style: "solid" },
        secondary: { label: "Browse rewards", href: "/rewards", style: "outline" },
        rating: 0,
        ratingLabel: "",
        height: "compact",
        badges: [],
      },
      { spacing: "lg", background: "muted" },
    ),
    blk("rich-text", {
      eyebrow: "How balances work",
      heading: "Trophies in, rewards out",
      body:
        "Every game you open adds trophies to a single balance. Trophies never expire while your account is active.\n\nWhen you redeem, the balance is reserved immediately and the reward is issued once our team confirms the request — usually **within 24 hours**.\n\nIf a reward is out of stock, you can swap it for another gift card of equal value, or keep the trophies for later.",
    }),
    blk(
      "steps",
      {
        eyebrow: "Cash out",
        title: "From wallet to reward in three steps",
        items: [
          { title: "Pick a reward", text: "Gift cards, bonus cash, or free spins on your favourite game." },
          { title: "Confirm the request", text: "We reserve the trophies the moment you confirm." },
          { title: "Get it delivered", text: "Codes arrive by email within 24 hours, usually much sooner." },
        ],
      },
      { spacing: "lg" },
    ),
    blk("payment-strip", {}, { spacing: "sm", background: "surface" }),
    blk(
      "faq",
      {
        eyebrow: "Wallet questions",
        title: "Good to know",
        items: [
          { question: "Do trophies expire?", answer: "No, while your account stays active. Dormant accounts keep trophies for 12 months." },
          { question: "Can I split a redemption?", answer: "Yes — any reward can be paid in trophies plus bonus cash if you prefer." },
          { question: "What if the code does not arrive?", answer: "Contact support with the redemption reference; we reissue within one working day." },
        ],
      },
      { spacing: "lg" },
    ),
    blk(
      "cta-banner",
      {
        title: "Ready to redeem?",
        text: "Open your wallet and pick something worth playing for.",
        primary: { label: "Go to my wallet", href: "/join", style: "solid" },
        secondary: { label: "", href: "", style: "ghost" },
      },
      { spacing: "lg", background: "muted" },
    ),
  ]);

  const wallet = await createPage({
    siteId: site.id,
    title: "Rewards wallet",
    slug: "rewards/wallet",
    document: walletDocument,
    actor,
    seo: {
      title: "Rewards wallet — Trofēo Reward",
      description: "Track trophies, see what they are worth and redeem in three steps.",
      canonicalMode: "self",
      noindex: false,
    },
  });
  await publishPage(site.id, wallet.id, actor, "manual");

  const termsDocument = doc([
    blk("rich-text", {
      eyebrow: "Legal",
      heading: "Bonus terms",
      body:
        "## Welcome bonus\n\nThe welcome bonus is 100% of your first deposit up to $200, plus 50 free spins on Coin Blitz.\n\n## Wagering\n\nBonus winnings carry a 35x wagering requirement, calculated on the bonus amount only. Game contributions vary: slots contribute 100%, table games 10%.\n\n## Expiry\n\nBonus funds expire seven days after credit. Free spins expire after 48 hours.",
    }),
    blk("faq", {
      eyebrow: "Terms",
      title: "What players ask about our terms",
      items: [
        { question: "Is the bonus cash or a free bet?", answer: "It is bonus cash, playable on any slot, with winnings withdrawable after wagering." },
        { question: "What is the maximum cashout?", answer: "$2,000 from the welcome bonus." },
      ],
      structuredData: false,
    }),
  ]);

  const terms = await createPage({
    siteId: site.id,
    title: "Bonus terms",
    slug: "bonus-terms",
    document: termsDocument,
    actor,
    seo: {
      title: "Bonus terms — Trofēo Reward",
      description: "Full wagering, expiry and cashout terms for every Trofēo Reward bonus.",
      canonicalMode: "self",
      noindex: false,
    },
  });
  await publishPage(site.id, terms.id, actor, "manual");

  const secondVersionDoc: PageDocument = {
    ...homeDocument,
    content: homeDocument.content.map((node) =>
      node.type === "promo-banner"
        ? {
            ...node,
            props: {
              ...node.props,
              headline: "300 free spins this weekend only",
              code: "TROFEO300",
            },
          }
        : node,
    ),
  };
  await db.update(pages).set({ draftDocument: secondVersionDoc, lockVersion: 1 }).where(eq(pages.id, home.id));
  await publishPage(site.id, home.id, actor, "manual");
  await db.update(pages).set({ draftDocument: secondVersionDoc, lockVersion: 2 }).where(eq(pages.id, home.id));

  const gamePlaceholders: PlaceholderSpec[] = [
    { key: "brand", label: "Brand name", kind: "text", defaultValue: "Trofēo Reward" },
    { key: "bonus_amount", label: "Bonus amount", kind: "text", defaultValue: "100% up to $200" },
    { key: "free_spins", label: "Free spins", kind: "number", defaultValue: "50" },
    { key: "cta_link", label: "Button link", kind: "link", defaultValue: "/join" },
    { key: "game_name", label: "Featured game", kind: "text", defaultValue: "Coin Blitz" },
  ];

  await db.insert(templates).values([
    {
      scope: "platform",
      name: "Game discovery lander",
      description: "The page shape we ship for game launches: hero, trust, four games, bonus, steps and FAQ.",
      category: "Game launch",
      accent: "#c8a24a",
      placeholders: gamePlaceholders,
      status: "active",
      createdBy: admin.id,
      document: doc([
        blk("hero", {
          eyebrow: "{{brand}}",
          title: "Play {{game_name}} and collect trophies on every spin",
          subtitle: "Claim {{bonus_amount}} plus {{free_spins}} free spins when you join today.",
          primary: { label: "Claim {{bonus_amount}}", href: "{{cta_link}}", style: "solid" },
          secondary: { label: "See how it works", href: "#how-it-works", style: "outline" },
          badges: ["18+", "Licensed", "Responsible play"],
        }),
        blk("trust-strip", {}),
        blk("cards-grid", {
          title: "More games like {{game_name}}",
          columns: "3",
          cards: [
            { image: null, icon: "trophy", title: "{{game_name}}", text: "Collect trophies on every round.", ctaLabel: "Play", ctaHref: "{{cta_link}}" },
            { image: null, icon: "spark", title: "Lucky Streak", text: "Gem multipliers and a 4,000x top payout.", ctaLabel: "Play", ctaHref: "{{cta_link}}" },
            { image: null, icon: "gift", title: "Treasure Bay", text: "Pearl bonuses in every chest.", ctaLabel: "Play", ctaHref: "{{cta_link}}" },
          ],
        }),
        blk("bonus-card", {
          brand: "{{brand}}",
          headline: "{{bonus_amount}}",
          subline: "+ {{free_spins}} free spins",
          freeSpins: "{{free_spins}}",
          cta: { label: "Claim bonus", href: "{{cta_link}}", style: "solid" },
        }),
        blk("steps", {}),
        blk("faq", {}),
        blk("cta-banner", {
          title: "Start with {{brand}} today",
          text: "{{bonus_amount}} and {{free_spins}} free spins are waiting.",
          primary: { label: "Join free", href: "{{cta_link}}", style: "solid" },
        }),
      ]),
    },
    {
      scope: "platform",
      name: "Cash-out and wallet lander",
      description: "For the wallet and redemption story: balances, payout timing and trust.",
      category: "Rewards",
      accent: "#7fb3d5",
      placeholders: [
        { key: "brand", label: "Brand name", kind: "text", defaultValue: "Trofēo Reward" },
        { key: "payout_window", label: "Payout window", kind: "text", defaultValue: "24 hours" },
        { key: "cta_link", label: "Button link", kind: "link", defaultValue: "/join" },
      ],
      status: "active",
      createdBy: admin.id,
      document: doc([
        blk("hero", {
          eyebrow: "Rewards",
          title: "Your trophies, paid out in {{payout_window}}",
          subtitle: "{{brand}} keeps one wallet for every game and every reward.",
          primary: { label: "Open my wallet", href: "{{cta_link}}", style: "solid" },
          height: "compact",
          badges: [],
        }),
        blk("rich-text", { heading: "One balance, every game", body: "Trophies from slots, live tables and promotions all land in the same wallet.\n\n- No minimum redemption\n- Codes delivered by email\n- Support answers within a day" }),
        blk("steps", {}),
        blk("payment-strip", {}),
        blk("faq", {}),
        blk("cta-banner", { title: "Redeem in three taps", primary: { label: "Go to my wallet", href: "{{cta_link}}", style: "solid" } }),
      ]),
    },
    {
      scope: "platform",
      name: "Reward claim lander",
      description: "A short, urgent claim page for a single reward with a countdown.",
      category: "Promotion",
      accent: "#e0a4a4",
      placeholders: [
        { key: "reward_name", label: "Reward name", kind: "text", defaultValue: "$50 gift card" },
        { key: "trophy_cost", label: "Trophy cost", kind: "number", defaultValue: "5000" },
        { key: "cta_link", label: "Button link", kind: "link", defaultValue: "/join" },
      ],
      status: "active",
      createdBy: admin.id,
      document: doc([
        blk("promo-banner", {
          headline: "{{reward_name}} for {{trophy_cost}} trophies",
          offer: "Limited stock this week",
          code: "CLAIM",
          cta: { label: "Claim now", href: "{{cta_link}}", style: "solid" },
        }),
        blk("hero", {
          eyebrow: "Reward claim",
          title: "{{reward_name}}, yours for {{trophy_cost}} trophies",
          subtitle: "Reserve it now and we will email the code within 24 hours.",
          primary: { label: "Claim {{reward_name}}", href: "{{cta_link}}", style: "solid" },
          height: "compact",
          badges: [],
        }),
        blk("countdown", { title: "This reward leaves the shelf soon" }),
        blk("steps", {}),
        blk("faq", {}),
        blk("cta-banner", { title: "Do not lose it", primary: { label: "Claim now", href: "{{cta_link}}", style: "solid" } }),
      ]),
    },
  ]);

  const sample = await readFile(path.join(process.cwd(), "public", "seed", "sample-lander.html"));
  await createImportJob({
    siteId: site.id,
    filename: "neon-fruits-lander.html",
    bytes: sample,
    actor: await seedActor(editor),
  });

  await db.insert(platformSettings).values([
    { key: "platform.name", value: "Trofēo Pages", isSecret: false, updatedBy: admin.id },
    { key: "limits.imports_per_day", value: 20, isSecret: false, updatedBy: admin.id },
    { key: "limits.publish_per_hour", value: 30, isSecret: false, updatedBy: admin.id },
    { key: "limits.max_domains_per_site", value: 10, isSecret: false, updatedBy: admin.id },
    { key: "email.from", value: "pages@trofeo.example", isSecret: false, updatedBy: admin.id },
  ]);

  await enqueue("invite.sweep", {}, { dedupeKey: "invite.sweep:daily", runAt: new Date(Date.now() + 60_000) });
}
