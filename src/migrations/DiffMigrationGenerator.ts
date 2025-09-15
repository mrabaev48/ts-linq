import type { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SQLiteSchemaInspector, PostgresSchemaInspector, MysqlSchemaInspector, MssqlSchemaInspector } from './SchemaInspector';
import type { SchemaSnapshot, TableSnapshot, ColumnDef, ForeignKeyDef, UniqueConstraintDef } from './DiffTypes';
import { compareSchemas } from './DiffTypes';

export interface MigrationStep {
  sql: string;
}

/**
 * Minimal diff generator (SQLite):
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 *
 * Note: For complex ALTERs SQLite often requires table rebuild; here we handle simple adds.
 */
export class DiffMigrationGenerator {
  constructor(private provider: DatabaseProvider) {}

  public async generate(): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];
    const { expected, actual } = await this.buildSnapshots();
    const providerId = this.provider.providerLabel || 'unknown';
    const sqliteInspector = new SQLiteSchemaInspector(this.provider);
    const entities = MetadataStorage.getEntities();
    const expectedByName = new Map(expected.tables.map((t) => [t.name, t] as const));
    const diff = compareSchemas(expected, actual);
    // Translate diff into SQL steps for SQLite
    for (const tableDiff of diff.tables) {
      if (tableDiff.create) {
        steps.push({
          sql: this.buildCreateTableSql(
            tableDiff.create.name,
            tableDiff.create.columns,
            tableDiff.create.primaryKeys,
            providerId === 'sqlite' ? (tableDiff.create.foreignKeys || []) : undefined
          )
        });
        // Emit indexes
        for (const idx of tableDiff.create.indexes || []) {
          const uniq = idx.unique ? 'UNIQUE ' : '';
          const target = idx.expression ? idx.expression : `(${idx.columns.join(', ')})`;
          const where = idx.where && providerId === 'postgresql' ? ` WHERE ${idx.where}` : '';
          steps.push({ sql: `CREATE ${uniq}INDEX IF NOT EXISTS ${idx.name} ON ${tableDiff.create.name} ${target}${where}` });
        }
        // Emit foreign keys (as follow-up constraints for broad compatibility)
        if (providerId !== 'sqlite') for (const fk of tableDiff.create.foreignKeys || []) {
          const cols = fk.columns.join(', ');
          const refCols = fk.refColumns.join(', ');
          const fkName = fk.name || this.buildFkName(tableDiff.create.name, fk);
          const name = fkName ? ` CONSTRAINT ${fkName}` : '';
          const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
          const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
          steps.push({ sql: `ALTER TABLE ${tableDiff.create.name} ADD${name} FOREIGN KEY (${cols}) REFERENCES ${fk.refTable} (${refCols})${onDelete}${onUpdate}` });
        }
        // Emit unique constraints for create
        if (providerId === 'sqlite') {
          for (const uq of tableDiff.create.uniqueConstraints || []) {
            const idxName = uq.name || `UQ_${tableDiff.create.name}_${uq.columns.join('_')}`;
            steps.push({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS ${idxName} ON ${tableDiff.create.name} (${uq.columns.join(', ')})` });
          }
          // SQLite: CHECK constraints inline only; emit comment for awareness
          for (const ck of tableDiff.create.checkConstraints || []) {
            const nm = ck.name ? `${ck.name}: ` : '';
            steps.push({ sql: `-- SQLite CHECK not added post-create (${nm}${ck.expression})` });
          }
        } else {
          for (const uq of tableDiff.create.uniqueConstraints || []) {
            const uqName = uq.name || `UQ_${tableDiff.create.name}_${uq.columns.join('_')}`;
            steps.push({ sql: `ALTER TABLE ${tableDiff.create.name} ADD CONSTRAINT ${uqName} UNIQUE (${uq.columns.join(', ')})` });
          }
          // Emit check constraints for create (non-SQLite)
          for (const ck of tableDiff.create.checkConstraints || []) {
            const ckName = ck.name ? ` CONSTRAINT ${ck.name}` : '';
            steps.push({ sql: `ALTER TABLE ${tableDiff.create.name} ADD${ckName} CHECK (${ck.expression})` });
          }
        }
        continue;
      }
      if (tableDiff.drop) {
        steps.push({ sql: `DROP TABLE ${tableDiff.table}` });
        continue;
      }
      // Index drops/creates for existing table
      for (const dropName of tableDiff.indexDrops || []) {
        steps.push({ sql: `DROP INDEX IF EXISTS ${dropName}` });
      }
      for (const idx of tableDiff.indexCreates || []) {
        const uniq = idx.unique ? 'UNIQUE ' : '';
        const target = idx.expression ? idx.expression : `(${idx.columns.join(', ')})`;
        const where = idx.where && providerId === 'postgresql' ? ` WHERE ${idx.where}` : '';
        steps.push({ sql: `CREATE ${uniq}INDEX IF NOT EXISTS ${idx.name} ON ${tableDiff.table} ${target}${where}` });
      }
      // Unique drops/creates for existing table
      if (providerId === 'sqlite') {
        for (const uqName of tableDiff.uniqueDrops || []) {
          steps.push({ sql: `DROP INDEX IF EXISTS ${uqName}` });
        }
        for (const uq of tableDiff.uniqueCreates || []) {
          const idxName = uq.name || `UQ_${tableDiff.table}_${uq.columns.join('_')}`;
          steps.push({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS ${idxName} ON ${tableDiff.table} (${uq.columns.join(', ')})` });
        }
        for (const ckName of tableDiff.checkDrops || []) {
          steps.push({ sql: `-- SQLite does not support DROP CHECK ${ckName} post-create` });
        }
        for (const ck of tableDiff.checkCreates || []) {
          steps.push({ sql: `-- SQLite does not support ADD CHECK post-create (${ck.name || ''} ${ck.expression})` });
        }
      } else {
        for (const uqName of tableDiff.uniqueDrops || []) {
          steps.push({ sql: `ALTER TABLE ${tableDiff.table} DROP CONSTRAINT ${uqName}` });
        }
        for (const uq of tableDiff.uniqueCreates || []) {
          const uqName = uq.name || `UQ_${tableDiff.table}_${uq.columns.join('_')}`;
          steps.push({ sql: `ALTER TABLE ${tableDiff.table} ADD CONSTRAINT ${uqName} UNIQUE (${uq.columns.join(', ')})` });
        }
        // Check drops/creates for existing table
        for (const ckName of tableDiff.checkDrops || []) {
          steps.push({ sql: `ALTER TABLE ${tableDiff.table} DROP CONSTRAINT ${ckName}` });
        }
        for (const ck of tableDiff.checkCreates || []) {
          const name = ck.name ? ` CONSTRAINT ${ck.name}` : '';
          steps.push({ sql: `ALTER TABLE ${tableDiff.table} ADD${name} CHECK (${ck.expression})` });
        }
      }
      // FK drops/creates for existing table
      for (const fkName of tableDiff.fkDrops || []) {
        steps.push({ sql: `ALTER TABLE ${tableDiff.table} DROP CONSTRAINT ${fkName}` });
      }
      for (const fk of tableDiff.fkCreates || []) {
        const cols = fk.columns.join(', ');
        const refCols = fk.refColumns.join(', ');
        const name = fk.name ? ` CONSTRAINT ${fk.name}` : '';
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
        steps.push({ sql: `ALTER TABLE ${tableDiff.table} ADD${name} FOREIGN KEY (${cols}) REFERENCES ${fk.refTable} (${refCols})${onDelete}${onUpdate}` });
      }

      const hasFkMutation = (tableDiff.fkCreates && tableDiff.fkCreates.length > 0) || (tableDiff.fkDrops && tableDiff.fkDrops.length > 0);
      if ((tableDiff.columnChanges && tableDiff.columnChanges.length > 0) || (providerId === 'sqlite' && hasFkMutation)) {
        // If any alter/drop detected, rebuild table
        const hasDestructive = (tableDiff.columnChanges || []).some((change) => change.kind !== 'add') || (providerId === 'sqlite' && hasFkMutation);
        if (hasDestructive) {
          const entityMeta = entities.find((e) => e.tableName === tableDiff.table)!;
          const tempTable = `__new_${tableDiff.table}`;
          const cols: ColumnDef[] = entityMeta.columns.map((column) => ({
            name: column.columnName,
            type: column.type,
            nullable: column.nullable,
            defaultValue: column.defaultValue
          }));
          const pkCols = entityMeta.primaryKeys.map(
            (pk) =>
              entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk
          );
          const expected = expectedByName.get(tableDiff.table);
          const fks = expected?.foreignKeys || [];
          const checks = expected?.checkConstraints || [];
          // For SQLite rebuild: inline FKs and CHECKs into CREATE TABLE; unique constraints will be emitted as indexes after rename
          steps.push({ sql: this.buildCreateTableSql(tempTable, cols, pkCols, providerId === 'sqlite' ? fks : undefined, undefined, providerId === 'sqlite' ? checks : undefined) });
          const info2 = await sqliteInspector.getTableInfo(tableDiff.table);
          const commonColumns = info2.columns
            .map((c) => c.name)
            .filter((columnName: string) =>
              entityMeta.columns.some((col) => col.columnName === columnName)
            );
          if (commonColumns.length > 0) {
            const columnList = commonColumns.join(', ');
            steps.push({
              sql: `INSERT INTO ${tempTable} (${columnList}) SELECT ${columnList} FROM ${tableDiff.table}`
            });
          }
          steps.push({ sql: `DROP TABLE ${tableDiff.table}` });
          steps.push({ sql: `ALTER TABLE ${tempTable} RENAME TO ${tableDiff.table}` });
          // Recreate indexes and unique indexes for SQLite after rename
          if (providerId === 'sqlite' && expected) {
            for (const uq of expected.uniqueConstraints || []) {
              const idxName = uq.name || `UQ_${expected.name}_${uq.columns.join('_')}`;
              steps.push({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS ${idxName} ON ${expected.name} (${uq.columns.join(', ')})` });
            }
            for (const idx of expected.indexes || []) {
              const uniq = idx.unique ? 'UNIQUE ' : '';
              const target = idx.expression ? idx.expression : `(${idx.columns.join(', ')})`;
              steps.push({ sql: `CREATE ${uniq}INDEX IF NOT EXISTS ${idx.name} ON ${expected.name} ${target}` });
            }
          }
          continue;
        }
        // Only adds
        for (const columnChange of (tableDiff.columnChanges || [])) {
          if (columnChange.kind === 'add') {
            const nn = columnChange.column.nullable ? '' : ' NOT NULL';
            const def =
              columnChange.column.defaultValue !== undefined
                ? ` DEFAULT ${this.formatValue(columnChange.column.defaultValue)}`
                : '';
            steps.push({
              sql: `ALTER TABLE ${tableDiff.table} ADD COLUMN ${columnChange.column.name} ${this.decorateTypeWithModifiers(this.mapTypeByDialect(columnChange.column.type, providerId), columnChange.column)}${nn}${def}`
            });
          }
        }
      }
    }
    // Safety pass for SQLite only
    if (providerId === 'sqlite') {
      for (const entity of entities) {
        const info = await sqliteInspector.getTableInfo(entity.tableName);
        const existing = new Set(info.columns.map((col) => col.name));
        for (const col of entity.columns) {
          if (!existing.has(col.columnName)) {
            const nn = col.nullable ? '' : ' NOT NULL';
            const def =
              col.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(col.defaultValue)}` : '';
            const sql = `ALTER TABLE ${entity.tableName} ADD COLUMN ${col.columnName} ${this.mapTypeByDialect(col.type, providerId)}${nn}${def}`;
            if (!steps.some((s) => s.sql.toUpperCase() === sql.toUpperCase())) {
              steps.push({ sql });
            }
          }
        }
      }
    }
    return steps;
  }

  /** Build expected and actual schema snapshots using current provider and metadata. */
  public async buildSnapshots(): Promise<{ expected: SchemaSnapshot; actual: SchemaSnapshot }> {
    const providerId = this.provider.providerLabel || 'unknown';
    const sqliteInspector = new SQLiteSchemaInspector(this.provider);
    const pgInspector = new PostgresSchemaInspector(this.provider);
    const myInspector = new MysqlSchemaInspector(this.provider);
    const msInspector = new MssqlSchemaInspector(this.provider);
    const entities = MetadataStorage.getEntities();
    const expected: SchemaSnapshot = {
      tables: entities.map((entityMeta) => {
        const columns: ColumnDef[] = entityMeta.columns.map((column) => ({
          name: column.columnName,
          type: this.mapTypeByDialect(column.type, providerId),
          nullable: column.nullable,
          defaultValue: column.defaultValue,
          isPrimaryKey: entityMeta.primaryKeys.includes(column.propertyName),
          length: (column as unknown as { length?: number }).length,
          precision: (column as unknown as { precision?: number }).precision,
          scale: (column as unknown as { scale?: number }).scale
        }));
        const primaryKeys = entityMeta.primaryKeys.map(
          (pk) => entityMeta.columns.find((column) => column.propertyName === pk)?.columnName || pk
        );
        const indexes = (entityMeta.indexes || []).map((indexDef) => ({
          name: indexDef.name,
          columns: indexDef.columns,
          unique: !!indexDef.unique,
          expression: (indexDef as unknown as { expression?: string }).expression,
          where: (indexDef as unknown as { where?: string }).where
        }));
        const foreignKeys = (entityMeta.relationships || [])
          .filter((rel) => Boolean((rel as unknown as { foreignKey?: string; foreignKeys?: string[] }).foreignKey || (rel as unknown as { foreignKeys?: string[] }).foreignKeys?.length))
          .map((rel) => {
            const targetCtor = this.resolveTargetConstructor(rel.targetEntity as unknown as (Function | (() => Function)));
            const targetMeta = MetadataStorage.getEntity(targetCtor);
            const refTable = targetMeta?.tableName || (targetCtor as Function).name;
            const refPkCols = (rel.referencedColumns && rel.referencedColumns.length > 0
              ? rel.referencedColumns
              : (targetMeta?.primaryKeys || [])
            ).map(
              (pk) =>
                targetMeta?.columns.find((c) => c.propertyName === pk)?.columnName || pk
            );
            return {
              name: undefined,
              columns: (rel.foreignKeys && rel.foreignKeys.length > 0
                ? rel.foreignKeys
                : [rel.foreignKey as string]
              ) as string[],
              refTable,
              refColumns: refPkCols.length > 0 ? refPkCols : ['id'],
              onDelete: rel.onDelete ?? (rel.cascade ? 'CASCADE' : undefined),
              onUpdate: rel.onUpdate ?? (rel.cascade ? 'CASCADE' : undefined)
            };
          });
        return {
          name: entityMeta.tableName,
          columns,
          primaryKeys,
          indexes,
          foreignKeys,
          uniqueConstraints: (entityMeta.indexes || [])
            .filter((i) => i.unique && i.columns && i.columns.length > 0 && !(i as any).expression)
            .map((i) => ({ name: i.name, columns: i.columns })),
          checkConstraints: (entityMeta.checks || []).map((c) => ({ name: c.name, expression: c.expression }))
        } as TableSnapshot;
      })
    };
    const actualTables: TableSnapshot[] = [];
    if (providerId === 'sqlite') {
      const tableNames = await sqliteInspector.listTables();
      for (const tableName of tableNames) {
        const info = await sqliteInspector.getTableInfo(tableName);
        const uniqIdx = await sqliteInspector.listUniqueIndexes(tableName);
        const indexes = await sqliteInspector.listIndexes(tableName);
        const fks = await sqliteInspector.listForeignKeys(tableName);
        actualTables.push({
          name: tableName,
          columns: info.columns.map((col) => ({
            name: col.name,
            type: this.normalizeTypeByDialect(col.type, providerId),
            nullable: !col.notnull,
            defaultValue: col.dflt_value
          })),
          primaryKeys: info.columns.filter((col) => col.pk > 0).map((col) => col.name),
          indexes: indexes,
          foreignKeys: fks,
          uniqueConstraints: uniqIdx.map((u) => ({ name: u.name, columns: u.columns }))
        });
      }
    } else if (providerId === 'postgresql') {
      const tableNames = await pgInspector.listTables();
      for (const tableName of tableNames) {
        const info = await pgInspector.getTableInfo(tableName);
        const uniques = await pgInspector.listUniqueConstraints(tableName);
        const checks = await pgInspector.listCheckConstraints(tableName);
        const indexes = await pgInspector.listIndexes(tableName);
        const fks = await pgInspector.listForeignKeys(tableName);
        actualTables.push({
          name: info.name,
          columns: info.columns.map((c) => ({ name: c.name, type: this.normalizeTypeByDialect(c.type, providerId), nullable: !c.notnull, defaultValue: (c as any).column_default })),
          primaryKeys: info.columns.filter((c) => c.pk > 0).map((c) => c.name),
          indexes: indexes,
          foreignKeys: fks,
          uniqueConstraints: uniques,
          checkConstraints: checks
        });
      }
    } else if (providerId === 'mysql') {
      const tableNames = await myInspector.listTables();
      for (const tableName of tableNames) {
        const info = await myInspector.getTableInfo(tableName);
        const uniques = await myInspector.listUniqueConstraints(tableName);
        const indexes = await myInspector.listIndexes(tableName);
        const fks = await myInspector.listForeignKeys(tableName);
        actualTables.push({
          name: info.name,
          columns: info.columns.map((c) => ({ name: c.name, type: this.normalizeTypeByDialect(c.type, providerId), nullable: !c.notnull, defaultValue: (c as any).column_default })),
          primaryKeys: info.columns.filter((c) => c.pk > 0).map((c) => c.name),
          indexes: indexes,
          foreignKeys: fks,
          uniqueConstraints: uniques,
          checkConstraints: []
        });
      }
    } else if (providerId === 'mssql') {
      const tableNames = await msInspector.listTables();
      for (const tableName of tableNames) {
        const info = await msInspector.getTableInfo(tableName);
        const uniques = await msInspector.listUniqueConstraints(tableName);
        const checks = await msInspector.listCheckConstraints(tableName);
        const indexes = await msInspector.listIndexes(tableName);
        const fks = await msInspector.listForeignKeys(tableName);
        actualTables.push({
          name: info.name,
          columns: info.columns.map((c) => ({ name: c.name, type: this.normalizeTypeByDialect(c.type, providerId), nullable: !c.notnull, defaultValue: (c as any).COLUMN_DEFAULT })),
          primaryKeys: info.columns.filter((c) => c.pk > 0).map((c) => c.name),
          indexes: indexes,
          foreignKeys: fks,
          uniqueConstraints: uniques,
          checkConstraints: checks
        });
      }
    }
    return { expected, actual: { tables: actualTables } };
  }

  private buildCreateTableSql(
    table: string,
    columns: ColumnDef[],
    primaryKeys: string[],
    inlineFks?: ForeignKeyDef[],
    uniques?: UniqueConstraintDef[],
    checks?: Array<{ name?: string; expression: string }>
  ): string {
    const colDefs = columns.map((c) => {
      const type = this.decorateTypeWithModifiers(
        this.mapTypeByDialect(c.type, this.provider.providerLabel || 'unknown'),
        c
      );
      const nn = c.nullable ? '' : ' NOT NULL';
      const def =
        c.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.defaultValue)}` : '';
      const colName = c.name;
      return `${colName} ${type}${nn}${def}`;
    });
    if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
      colDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
    }
    if (uniques && uniques.length > 0) {
      for (const uq of uniques) {
        const name = uq.name ? `CONSTRAINT ${uq.name} ` : '';
        colDefs.push(`${name}UNIQUE (${uq.columns.join(', ')})`);
      }
    }
    if (checks && checks.length > 0) {
      for (const ck of checks) {
        const name = ck.name ? `CONSTRAINT ${ck.name} ` : '';
        colDefs.push(`${name}CHECK (${ck.expression})`);
      }
    }
    if (inlineFks && inlineFks.length > 0) {
      for (const fk of inlineFks) {
        const cols = fk.columns.join(', ');
        const refCols = fk.refColumns.join(', ');
        const fkName = fk.name || this.buildFkName(table, fk);
        const name = fkName ? `CONSTRAINT ${fkName} ` : '';
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '';
        colDefs.push(`${name}FOREIGN KEY (${cols}) REFERENCES ${fk.refTable} (${refCols})${onDelete}${onUpdate}`);
      }
    }
    return `CREATE TABLE IF NOT EXISTS ${table} (${colDefs.join(', ')})`;
  }

  private mapTypeByDialect(type: string, providerId: string): string {
    const t = type.toUpperCase();
    switch (providerId) {
      case 'postgresql': {
        if (t === 'INTEGER' || t === 'INT' || t === 'BIGINT' || t === 'SMALLINT' || t === 'NUMBER') return 'INTEGER';
        if (t === 'REAL' || t === 'FLOAT' || t === 'DOUBLE' || t === 'DOUBLE PRECISION') return 'REAL';
        if (t === 'DECIMAL' || t.startsWith('NUMERIC')) return 'REAL';
        if (t === 'BOOLEAN') return 'INTEGER';
        if (t === 'UUID') return 'TEXT';
        if (t.includes('JSON')) return 'TEXT';
        if (t.includes('DATE') || t.includes('TIME')) return 'TEXT';
        if (t === 'BYTEA' || t === 'BLOB') return 'BLOB';
        return 'TEXT';
      }
      case 'mysql': {
        if (t.includes('INT')) return 'INTEGER';
        if (t.includes('DECIMAL') || t.includes('NUMERIC') || t.includes('DOUBLE') || t.includes('FLOAT')) return 'REAL';
        if (t === 'BOOLEAN' || t === 'TINYINT(1)') return 'INTEGER';
        if (t.includes('DATE') || t.includes('TIME')) return 'TEXT';
        if (t.includes('JSON')) return 'TEXT';
        if (t.includes('BLOB') || t.includes('BINARY')) return 'BLOB';
        return 'TEXT';
      }
      case 'mssql': {
        if (t === 'INT' || t === 'BIGINT' || t === 'SMALLINT' || t === 'TINYINT' || t === 'NUMERIC' || t === 'DECIMAL') return 'INTEGER';
        if (t.includes('FLOAT') || t.includes('REAL')) return 'REAL';
        if (t.includes('DATE') || t.includes('TIME')) return 'TEXT';
        if (t.includes('VARBINARY') || t.includes('BINARY') || t.includes('IMAGE')) return 'BLOB';
        if (t === 'BIT') return 'INTEGER';
        return 'TEXT';
      }
      default:
        return this.mapType(t);
    }
  }

  private mapType(type: string): string {
    switch (type.toUpperCase()) {
      case 'INTEGER':
      case 'NUMBER':
        return 'INTEGER';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'REAL';
      case 'BOOLEAN':
        return 'INTEGER';
      case 'DATETIME':
      case 'DATE':
        return 'TEXT';
      case 'BLOB':
        return 'BLOB';
      default:
        return 'TEXT';
    }
  }

  private normalizeTypeByDialect(type: string, providerId: string): string {
    return this.mapTypeByDialect(type, providerId);
  }

  private buildFkName(table: string, fk: ForeignKeyDef): string {
    const sanitize = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
    const cols = fk.columns.join('_');
    const base = `FK_${sanitize(table)}_${sanitize(cols)}__${sanitize(fk.refTable)}`;
    return base.length > 63 ? base.slice(0, 63) : base;
  }

  private resolveTargetConstructor(input: Function | (() => Function)): Function {
    try {
      const maybe = (input as () => unknown)();
      if (typeof maybe === 'function') return maybe as Function;
    } catch {
      // not a thunk — treat as constructor
    }
    return input as Function;
  }

  private decorateTypeWithModifiers(
    base: string,
    c: { length?: number; precision?: number; scale?: number }
  ): string {
    if (c.precision !== undefined && c.scale !== undefined && (base === 'REAL' || base === 'DECIMAL')) {
      return `${base}(${c.precision},${c.scale})`;
    }
    if (c.length !== undefined && (base === 'TEXT' || base === 'STRING' || base === 'VARCHAR')) {
      return `${base}(${c.length})`;
    }
    return base;
  }

  private formatValue(v: unknown): string {
    if (v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }
}
