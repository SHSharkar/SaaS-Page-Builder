import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("eslint house rules", () => {
  it("flags source comments, console calls, raw HTML outside components/ui, and raw Tailwind palettes", async () => {
    const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });

    const [commentResult] = await eslint.lintText(
      "// forbidden comment\nexport const x = 1;\n",
      { filePath: "lib/sample.ts" },
    );
    expect(
      commentResult?.messages.some(
        (m) => m.ruleId === "house/no-source-comments",
      ),
    ).toBe(true);

    const [consoleResult] = await eslint.lintText(
      "export function demo() {\n  console.log('hi');\n}\n",
      { filePath: "lib/sample.ts" },
    );
    expect(consoleResult?.messages.some((m) => m.ruleId === "no-console")).toBe(
      true,
    );

    const [rawButtonResult] = await eslint.lintText(
      'export function View() {\n  return <button className="bg-slate-900">{"Click"}</button>;\n}\n',
      { filePath: "app/(public)/demo.tsx" },
    );
    expect(
      rawButtonResult?.messages.some(
        (m) => m.ruleId === "no-restricted-syntax",
      ),
    ).toBe(true);
    expect(
      rawButtonResult?.messages.some(
        (m) => m.ruleId === "house/no-raw-tailwind-palette",
      ),
    ).toBe(true);
  });
});
