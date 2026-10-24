declare module "bun" {
  interface PluginBuilder {
    module(
      specifier: string,
      callback: () => { exports: Record<string, unknown>; loader: "object" },
    ): void;
  }
}

export {};
