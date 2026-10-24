import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";
import { buildSchemaModel } from "./lib/schema-model";

const KEBAB_SEGMENT =
  /^(?:\([a-z0-9-]+\)|\[\[\.\.\.[a-zA-Z0-9]+\]\]|\[\.\.\.[a-zA-Z0-9]+\]|\[[a-zA-Z0-9]+\]|_[a-z0-9-]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*)$/;

const SNAKE_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

export function verifyNaming(rootDir = process.cwd()): CheckResult {
  const failures: string[] = [];
  const files = projectFiles(
    ["app", "components", "hooks", "lib", "scripts"],
    rootDir,
  );
  for (const rel of files) {
    for (const seg of rel.split("/")) {
      if (!KEBAB_SEGMENT.test(seg)) {
        failures.push(`${rel}: path segment "${seg}" is not kebab-case`);
      }
    }
  }

  const model = buildSchemaModel(rootDir);
  for (const table of model.values()) {
    if (!SNAKE_IDENTIFIER.test(table.name)) {
      failures.push(`SQL table "${table.name}" is not snake_case`);
    }
    for (const col of table.columns) {
      if (!SNAKE_IDENTIFIER.test(col)) {
        failures.push(`SQL column "${table.name}.${col}" is not snake_case`);
      }
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:naming",
        `Verified kebab-case paths across ${files.length} files and snake_case SQL identifiers across ${model.size} tables`,
      )
    : failCheck("verify:naming", "Naming convention violations", failures);
}

void runCliCheck(import.meta.url, () => verifyNaming());
