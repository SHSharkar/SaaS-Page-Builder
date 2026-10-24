import "server-only";
import { db } from "@/lib/db";
import { componentDefinitions } from "@/lib/db/schema";
import { REGISTRY_LIST } from "./index";

export async function syncComponentCatalog(): Promise<void> {
  const now = new Date();
  for (const block of REGISTRY_LIST) {
    const serializedFields = block.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      hasDefault: field.default !== undefined,
    }));
    await db
      .insert(componentDefinitions)
      .values({
        alias: block.alias,
        name: block.name,
        groupKey: block.group,
        description: block.description,
        wave: block.wave ?? 1,
        adminOnly: Boolean(block.adminOnly),
        deprecated: Boolean(block.deprecated),
        fieldCount: block.fields.length,
        schemaJson: serializedFields,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: componentDefinitions.alias,
        set: {
          name: block.name,
          groupKey: block.group,
          description: block.description,
          wave: block.wave ?? 1,
          adminOnly: Boolean(block.adminOnly),
          deprecated: Boolean(block.deprecated),
          fieldCount: block.fields.length,
          schemaJson: serializedFields,
          updatedAt: now,
        },
      });
  }
}
