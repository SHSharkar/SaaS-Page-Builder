const config = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Runtime import cycles are forbidden outside schema relations.",
      from: {
        pathNot: "^app/server/db/schema/",
      },
      to: {
        circular: true,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "server-cannot-import-route-groups",
      severity: "error",
      comment: "Server code must not depend on route group screens.",
      from: {
        path: "^app/server/",
      },
      to: {
        path: "^app/(\\((app|public)\\)|admin)/",
      },
    },
    {
      name: "lib-stays-client-safe-and-pure",
      severity: "error",
      comment:
        "lib/ imports nothing from app/, components/, hooks/, or server-only.",
      from: {
        path: "^lib/",
      },
      to: {
        path: "^(app|components|hooks)/|^server-only$",
      },
    },
    {
      name: "shared-components-cannot-import-server-internals",
      severity: "error",
      comment:
        "Shared components and hooks can only reference server action modules or types.",
      from: {
        path: "^(components|hooks)/",
        pathNot: "\\.test\\.(ts|tsx)$",
      },
      to: {
        path: "^app/server/(?!.*/actions\\.ts$)",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-test-support-in-production",
      severity: "error",
      comment: "Production code cannot import test-support modules.",
      from: {
        path: "^(app|components|hooks|lib)/",
        pathNot: "(^app/server/test-support/|\\.test\\.(ts|tsx)$)",
      },
      to: {
        path: "^app/server/test-support/",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};

export default config;
