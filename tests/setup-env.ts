
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "trofeo-test-"));
process.env.PGLITE_DIR = path.join(root, "pg");
process.env.MEDIA_DIR = path.join(root, "media");
process.env.ALLOW_HOST_FALLBACK = "true";
