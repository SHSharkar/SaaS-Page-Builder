import {
  addedColumns,
  alteredTable,
  createdTable,
  identifierKey,
  normalizeWhitespace,
  readMigrations,
  splitStatements,
} from "./sql";

export const TENANT_COLUMN = "account_id";

export interface PolicyModel {
  readonly name: string;
  readonly table: string;
  readonly usingExpr: string;
  readonly checkExpr: string;
}

export interface TableModel {
  readonly name: string;
  readonly columns: Set<string>;
  rlsEnabled: boolean;
  rlsForced: boolean;
  readonly policies: Map<string, PolicyModel>;
}

export function newEmptyTableModel(name: string): TableModel {
  return {
    name,
    columns: new Set<string>(),
    rlsEnabled: false,
    rlsForced: false,
    policies: new Map<string, PolicyModel>(),
  };
}

export function parsePolicy(statement: string): PolicyModel | null {
  const flat = normalizeWhitespace(statement);
  const match =
    /^CREATE POLICY ("?[a-zA-Z0-9_]+"?) ON ("?[a-zA-Z0-9_.]+"?)(?: AS \w+)?(?: FOR \w+)?(?: TO [a-zA-Z0-9_", ]+)? USING \((.+)\) WITH CHECK \((.+)\)$/i.exec(
      flat,
    );
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
    return null;
  }
  const tableName = match[2].split(".").pop() ?? match[2];
  return {
    name: identifierKey(match[1]),
    table: identifierKey(tableName),
    usingExpr: match[3],
    checkExpr: match[4],
  };
}

function applyRowLevelSecurity(
  tables: Map<string, TableModel>,
  tableName: string,
  flat: string,
): boolean {
  const model = tables.get(tableName);
  if (!model) {
    return false;
  }
  if (/ENABLE ROW LEVEL SECURITY$/i.test(flat)) {
    model.rlsEnabled = true;
    return true;
  }
  if (/DISABLE ROW LEVEL SECURITY$/i.test(flat)) {
    model.rlsEnabled = false;
    return true;
  }
  if (/NO FORCE ROW LEVEL SECURITY$/i.test(flat)) {
    model.rlsForced = false;
    return true;
  }
  if (/FORCE ROW LEVEL SECURITY$/i.test(flat)) {
    model.rlsForced = true;
    return true;
  }
  return false;
}

function applyColumnChanges(model: TableModel, statement: string): void {
  for (const added of addedColumns(statement)) {
    model.columns.add(added);
  }
  const dropRegex = /DROP\s+COLUMN(?:\s+IF\s+EXISTS)?\s+("?[a-zA-Z0-9_]+"?)/gi;
  let m: RegExpExecArray | null = dropRegex.exec(statement);
  while (m) {
    if (m[1]) {
      model.columns.delete(identifierKey(m[1]));
    }
    m = dropRegex.exec(statement);
  }
}

function applyAlterTable(
  tables: Map<string, TableModel>,
  statement: string,
): void {
  const target = alteredTable(statement);
  if (!target) {
    return;
  }
  const flat = normalizeWhitespace(statement);
  if (applyRowLevelSecurity(tables, target, flat)) {
    return;
  }
  const model = tables.get(target);
  if (model) {
    applyColumnChanges(model, statement);
  }
}

function applyDropTable(
  tables: Map<string, TableModel>,
  statement: string,
): void {
  const match = /^DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+("?[a-zA-Z0-9_.]+"?)/i.exec(
    statement.trim(),
  );
  if (match?.[1]) {
    const name = match[1].split(".").pop() ?? match[1];
    tables.delete(identifierKey(name));
  }
}

function applyPolicyStatement(
  tables: Map<string, TableModel>,
  statement: string,
): void {
  const created = parsePolicy(statement);
  if (created) {
    tables.get(created.table)?.policies.set(created.name, created);
    return;
  }
  const dropped =
    /^DROP\s+POLICY(?:\s+IF\s+EXISTS)?\s+("?[a-zA-Z0-9_]+"?)\s+ON\s+("?[a-zA-Z0-9_.]+"?)/i.exec(
      normalizeWhitespace(statement),
    );
  if (dropped?.[1] && dropped[2]) {
    const tbl = dropped[2].split(".").pop() ?? dropped[2];
    tables.get(identifierKey(tbl))?.policies.delete(identifierKey(dropped[1]));
  }
}

export function applyStatement(
  tables: Map<string, TableModel>,
  statement: string,
): void {
  const created = createdTable(statement);
  if (created) {
    const model = tables.get(created.name) ?? newEmptyTableModel(created.name);
    for (const col of created.columns) {
      model.columns.add(col);
    }
    tables.set(created.name, model);
    return;
  }
  if (/^ALTER\s+TABLE\b/i.test(statement.trim())) {
    applyAlterTable(tables, statement);
    return;
  }
  if (/^DROP\s+TABLE\b/i.test(statement.trim())) {
    applyDropTable(tables, statement);
    return;
  }
  if (/^(CREATE|DROP)\s+POLICY\b/i.test(statement.trim())) {
    applyPolicyStatement(tables, statement);
  }
}

export function statementsOf(rootDir = process.cwd()): string[] {
  return readMigrations(rootDir).flatMap((m) => splitStatements(m.sql));
}

export function buildSchemaModel(
  rootDir = process.cwd(),
): Map<string, TableModel> {
  const tables = new Map<string, TableModel>();
  for (const stmt of statementsOf(rootDir)) {
    applyStatement(tables, stmt);
  }
  return tables;
}

export function isTenantTable(model: TableModel): boolean {
  return model.columns.has(TENANT_COLUMN);
}
