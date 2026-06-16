import type { DatabaseProvider } from '@ts-linq/core';

import type { IndexDef, SchemaSnapshot, TableSnapshot } from '../DiffTypes';
import { SchemaInspectorFactory } from '../SchemaInspector';

export class SchemaInspectionService {
  public async buildActualSnapshot(
    provider: DatabaseProvider,
    expected: SchemaSnapshot
  ): Promise<SchemaSnapshot> {
    // Single dialect → inspector selection point (throws on unsupported dialects).
    const inspector = SchemaInspectorFactory.for(provider.providerLabel, provider);

    const existingTables = new Set(await inspector.listTables());

    // Mirror expected columns/PKs, fetch actual indexes via the dialect inspector.
    const fetchIndexes = async (table: string): Promise<IndexDef[]> => {
      const list = await inspector.getIndexes(table);
      return list.map((i) => ({
        name: i.name,
        columns: i.columns,
        unique: i.unique,
        where: i.where
      }));
    };

    const actualTables: TableSnapshot[] = [];
    for (const t of expected.tables) {
      if (!existingTables.has(t.name)) continue;
      const indexes = await fetchIndexes(t.name);
      actualTables.push({
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })),
        primaryKeys: t.primaryKeys.slice(),
        indexes,
        foreignKeys: []
      });
    }
    return { tables: actualTables };
  }
}
