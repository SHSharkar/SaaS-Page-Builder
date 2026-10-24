const bunGlobal = globalThis as {
  Bun?: {
    plugin?: (plugin: {
      name: string;
      setup: (build: {
        module: (
          specifier: string,
          factory: () => { exports: Record<string, unknown>; loader: "object" },
        ) => void;
      }) => void;
    }) => void;
  };
};

if (bunGlobal.Bun?.plugin) {
  bunGlobal.Bun.plugin({
    name: "server-only-stub",
    setup(build) {
      build.module("server-only", () => ({
        exports: {},
        loader: "object",
      }));
    },
  });
}

export {};
