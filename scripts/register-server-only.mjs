import Module from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const emptyUrl = pathToFileURL(path.resolve("node_modules/server-only/empty.js")).href;

if (typeof Module.registerHooks === "function") {
  Module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") {
        return {
          url: emptyUrl,
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
  });
}
