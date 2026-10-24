import { expect, test } from "@playwright/test";
import { checkWcagAaViolations } from "./axe";

test.describe("SaaS Page Builder public, health, and security surfaces", () => {
  test("marketing home and sign-in pass WCAG AA axe checks", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    expect(await checkWcagAaViolations(page)).toEqual([]);

    await page.goto("/sign-in");
    await expect(page.locator("h1")).toBeVisible();
    expect(await checkWcagAaViolations(page)).toEqual([]);
  });

  test("liveness and readiness probes return 200 JSON", async ({ request }) => {
    const live = await request.get("/api/health");
    expect(live.status()).toBe(200);
    const ready = await request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
  });

  test("short link endpoint shields tokens from link-preview crawlers", async ({
    request,
  }) => {
    const res = await request.get("/go/abcdefghijklmnopqrstuvwxyzab", {
      headers: {
        "user-agent":
          "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["referrer-policy"]).toBe("no-referrer");
  });
});
