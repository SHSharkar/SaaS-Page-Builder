import { execFileSync } from "node:child_process";

export default async function globalSetup(): Promise<void> {
  execFileSync("bun", ["run", "db:migrate"], {
    stdio: "inherit",
  });
  execFileSync("bun", ["run", "db:seed:development"], {
    stdio: "inherit",
  });
}
