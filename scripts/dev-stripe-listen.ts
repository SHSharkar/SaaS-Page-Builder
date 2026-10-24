import { spawn } from "node:child_process";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

if (isMainModule(import.meta.url)) {
  const target =
    process.env.STRIPE_FORWARD_URL ?? "http://localhost:3000/webhooks/stripe";
  log.info(`Forwarding local Stripe webhooks to ${target}`);
  const proc = spawn("stripe", ["listen", "--forward-to", target], {
    stdio: "inherit",
  });
  proc.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
