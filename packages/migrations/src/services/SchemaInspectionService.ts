import type { DatabaseProvider } from '@ts-linq/core';
import {
  PostgresSchemaInspector,
  MySqlSchemaInspector,
  MssqlSchemaInspector
} from '../SchemaInspector';
import type { SchemaSnapshot, TableSnapshot, IndexDef } from '../DiffTypes';

export class SchemaInspectionService {
  public async buildActualSnapshot(
    provider: DatabaseProvider,
    expected: SchemaSnapshot
  ): Promise<SchemaSnapshot> {
    const label = provider.providerLabel;

    const existingTables = await (async (): Promise<Set<string>> => {
      if (label === 'postgresql') {
        const ins = new PostgresSchemaInspector(provider);
        return new Set(await ins.listTables());
      }
      if (label === 'mysql') {
        const ins = new MySqlSchemaInspector(provider);
        return new Set(await ins.listTables());
      }
      if (label === 'mssql') {
        const ins = new MssqlSchemaInspector(provider);
        return new Set(await ins.listTables());
      }
      // Unknown provider: assume tables exist to avoid destructive diffs.
      return new Set<string>(expected.tables.map((t) => t.name));
    })();

    // For supported providers: mirror expected columns/PKs, fetch actual indexes via dialect inspectors
    const fetchIndexes = async (table: string): Promise<IndexDef[]> => {
      if (label === 'postgresql') {
        const ins = new PostgresSchemaInspector(provider);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: i.unique,
          where: i.where
        }));
      }
      if (label === 'mysql') {
        const ins = new MySqlSchemaInspector(provider);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique }));
      }
      if (label === 'mssql') {
        const ins = new MssqlSchemaInspector(provider);
        const list = await ins.getIndexes(table);
        return list.map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: i.unique,
          where: i.where
        }));
      }
      return [];
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
