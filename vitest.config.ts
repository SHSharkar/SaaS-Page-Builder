import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

function nodeBuiltinsStayExternal(): Plugin {
  return {
    name: "node-builtins-stay-external",
    enforce: "pre",
    resolveId(source) {
      if (source.startsWith("node:")) {
        return { id: source, external: true };
      }
      return null;
    },
  };
}

const sharedResolve = {
  alias: {
    "@": root,
    "server-only": path.join(root, "scripts/lib/server-only-stub.ts"),
  },
};

export default defineConfig({
  plugins: [nodeBuiltinsStayExternal(), react()],
  resolve: sharedResolve,
  test: {
    maxWorkers: 4,
    hookTimeout: 30_000,
    testTimeout: 20_000,
    globalSetup: ["./vitest.global-setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          root,
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: ["node_modules/**", ".next/**", "e2e/**"],
          setupFiles: ["./vitest.env-setup.ts", "./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          root,
          environment: "happy-dom",
          include: ["**/*.test.tsx"],
          exclude: ["node_modules/**", ".next/**", "e2e/**"],
          setupFiles: [
            "./vitest.env-setup.ts",
            "./vitest.setup.ts",
            "./vitest.dom-setup.ts",
          ],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "app/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "app/server/test-support/**",
        "app/**/{layout,page,loading,error,not-found,default}.tsx",
        "app/**/route.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
