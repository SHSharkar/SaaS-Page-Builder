import fs from "node:fs";
import path from "node:path";

export const MIGRATIONS_FOLDER = "drizzle";

export interface MigrationJournalEntry {
  readonly idx: number;
  readonly version: string;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

export interface LoadedMigration {
  readonly tag: string;
  readonly filePath: string;
  readonly sql: string;
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function identifierKey(rawIdentifier: string): string {
  return rawIdentifier
    .replace(/^"+|"+$/g, "")
    .trim()
    .toLowerCase();
}

function consumeDollarTag(sqlText: string, startIndex: number): string | null {
  const rest = sqlText.slice(startIndex);
  const match = /^\$[a-zA-Z0-9_]*\$/.exec(rest);
  return match ? match[0] : null;
}

interface ScannerState {
  current: string;
  dollarTag: string | null;
  index: number;
  inDouble: boolean;
  inSingle: boolean;
  readonly statements: string[];
}

function advanceLineComment(cleaned: string, state: ScannerState): boolean {
  if (
    state.inSingle ||
    state.inDouble ||
    state.dollarTag ||
    cleaned.slice(state.index, state.index + 2) !== "--"
  ) {
    return false;
  }
  while (state.index < cleaned.length && cleaned[state.index] !== "\n") {
    state.index += 1;
  }
  return true;
}

function advanceDollarBlock(cleaned: string, state: ScannerState): boolean {
  if (state.dollarTag) {
    if (cleaned.startsWith(state.dollarTag, state.index)) {
      state.current += state.dollarTag;
      state.index += state.dollarTag.length;
      state.dollarTag = null;
      return true;
    }
    state.current += cleaned[state.index] ?? "";
    state.index += 1;
    return true;
  }
  if (!state.inSingle && !state.inDouble && cleaned[state.index] === "$") {
    const tag = consumeDollarTag(cleaned, state.index);
    if (tag) {
      state.dollarTag = tag;
      state.current += tag;
      state.index += tag.length;
      return true;
    }
  }
  return false;
}

function advanceSingleQuote(cleaned: string, state: ScannerState): boolean {
  if (state.inDouble || cleaned[state.index] !== "'") {
    return false;
  }
  state.current += "'";
  if (state.inSingle && cleaned[state.index + 1] === "'") {
    state.current += "'";
    state.index += 2;
    return true;
  }
  state.inSingle = !state.inSingle;
  state.index += 1;
  return true;
}

function advanceCharOrTerminator(cleaned: string, state: ScannerState): void {
  const ch = cleaned[state.index] ?? "";
  if (!state.inSingle && ch === '"') {
    state.inDouble = !state.inDouble;
    state.current += ch;
    state.index += 1;
    return;
  }
  if (!state.inSingle && !state.inDouble && ch === ";") {
    const trimmed = state.current.trim();
    if (trimmed.length > 0) {
      state.statements.push(trimmed);
    }
    state.current = "";
    state.index += 1;
    return;
  }
  state.current += ch;
  state.index += 1;
}

export function splitStatements(sqlText: string): string[] {
  const cleaned = sqlText.replace(/-->\s*statement-breakpoint/g, "\n");
  const state: ScannerState = {
    current: "",
    dollarTag: null,
    index: 0,
    inDouble: false,
    inSingle: false,
    statements: [],
  };

  while (state.index < cleaned.length) {
    if (advanceLineComment(cleaned, state)) continue;
    if (advanceDollarBlock(cleaned, state)) continue;
    if (advanceSingleQuote(cleaned, state)) continue;
    advanceCharOrTerminator(cleaned, state);
  }

  const tail = state.current.trim();
  if (tail.length > 0) {
    state.statements.push(tail);
  }
  return state.statements;
}

export function createdTable(statement: string): {
  name: string;
  columns: string[];
} | null {
  const header =
    /^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+("?[a-zA-Z0-9_.]+"?)\s*\(([\s\S]*)\)$/i.exec(
      statement.trim(),
    );
  if (!header) {
    return null;
  }
  const rawName = (header[1] ?? "").split(".").pop() ?? "";
  const body = header[2] ?? "";
  const columns: string[] = [];
  for (const rawLine of body.split(",")) {
    const trimmed = rawLine.trim();
    if (
      !trimmed ||
      /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(trimmed)
    ) {
      continue;
    }
    const colMatch = /^("?[a-zA-Z0-9_]+"?)\s+[a-zA-Z]/i.exec(trimmed);
    if (colMatch?.[1]) {
      columns.push(identifierKey(colMatch[1]));
    }
  }
  return { name: identifierKey(rawName), columns };
}

export function alteredTable(statement: string): string | null {
  const match = /^ALTER\s+TABLE(?:\s+ONLY)?\s+("?[a-zA-Z0-9_.]+"?)\s+/i.exec(
    statement.trim(),
  );
  if (!match?.[1]) {
    return null;
  }
  const tablePart = match[1].split(".").pop() ?? match[1];
  return identifierKey(tablePart);
}

export function addedColumns(statement: string): string[] {
  const cols: string[] = [];
  const regex = /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+("?[a-zA-Z0-9_]+"?)/gi;
  let m: RegExpExecArray | null = regex.exec(statement);
  while (m) {
    if (m[1]) {
      cols.push(identifierKey(m[1]));
    }
    m = regex.exec(statement);
  }
  return cols;
}

export function readMigrations(rootDir = process.cwd()): LoadedMigration[] {
  const journalPath = path.join(
    rootDir,
    MIGRATIONS_FOLDER,
    "meta",
    "_journal.json",
  );
  const raw = fs.readFileSync(journalPath, "utf8");
  const parsed = JSON.parse(raw) as { entries: MigrationJournalEntry[] };
  return parsed.entries.map((entry) => {
    const filePath = path.join(rootDir, MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    return {
      tag: entry.tag,
      filePath,
      sql: fs.readFileSync(filePath, "utf8"),
    };
  });
}
