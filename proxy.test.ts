import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { DOMAIN_ID_HEADER, proxy } from "./proxy";

describe("edge proxy", () => {
  it("answers crawler bots on /go/ with empty 200 and no-referrer", () => {
    const req = new NextRequest("http://localhost:3000/go/abc12345", {
      headers: {
        host: "localhost:3000",
        "user-agent":
          "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      },
    });
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("blocks /admin directly when ADMIN_PATH is non-default", () => {
    const previous = process.env.ADMIN_PATH;
    process.env.ADMIN_PATH = "/ops-console";
    try {
      const req = new NextRequest("http://localhost:3000/admin/users", {
        headers: { host: "localhost:3000" },
      });
      const res = proxy(req);
      expect(res.status).toBe(404);
    } finally {
      process.env.ADMIN_PATH = previous;
    }
  });

  it("rewrites custom domain requests and blocks workspace routes on custom domains", () => {
    const blockedReq = new NextRequest("https://acme.example.org/dashboard", {
      headers: { host: "acme.example.org" },
    });
    expect(proxy(blockedReq).status).toBe(404);

    const publicReq = new NextRequest("https://acme.example.org/pricing", {
      headers: {
        host: "acme.example.org",
        [DOMAIN_ID_HEADER]: "forged.evil.org",
      },
    });
    const publicRes = proxy(publicReq);
    expect(publicRes.status).toBe(200);
    expect(publicRes.headers.get("x-middleware-rewrite")).toContain(
      "/s/_custom/pricing",
    );

    const previewReq = new NextRequest("https://3000-sandbox.e2b.app/", {
      headers: { host: "3000-sandbox.e2b.app" },
    });
    const previewRes = proxy(previewReq);
    expect(previewRes.headers.get("X-Frame-Options")).toBeNull();
    expect(previewRes.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors *",
    );
  });
});
