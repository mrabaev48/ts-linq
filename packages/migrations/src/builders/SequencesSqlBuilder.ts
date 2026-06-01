import type { Dialect } from '../Dialect';
import type { SchemaDiff, SequenceDef, SequenceDiff } from '../DiffTypes';

/** Name of the MySQL sequence emulation table. */
const MYSQL_SEQ_TABLE = '__ts_linq_sequences';

/** DDL for the MySQL sequence emulation table. */
const MYSQL_SEQ_TABLE_DDL =
  `CREATE TABLE IF NOT EXISTS \`${MYSQL_SEQ_TABLE}\` (\n` +
  `  \`name\`           VARCHAR(128) NOT NULL,\n` +
  `  \`schema_name\`    VARCHAR(128)          DEFAULT NULL,\n` +
  `  \`current_value\`  BIGINT       NOT NULL DEFAULT 0,\n` +
  `  \`increment_by\`   INT          NOT NULL DEFAULT 1,\n` +
  `  PRIMARY KEY (\`name\`)\n` +
  `) ENGINE=InnoDB`;

/**
 * Generates CREATE SEQUENCE / DROP SEQUENCE DDL for migration UP/DOWN scripts.
 *
 * - PostgreSQL: native CREATE SEQUENCE with optional schema, type, START, INCREMENT, MINVALUE,
 *   MAXVALUE, CYCLE/NO CYCLE.
 * - MSSQL: native CREATE SEQUENCE with AS type.
 * - MySQL: INSERT into the emulation table `__ts_linq_sequences`; the table itself is
 *   created once on first sequence declaration.
 */
export class SequencesSqlBuilder {
  constructor(private readonly dialect: Dialect) {}

  /** Appends sequence UP/DOWN SQL from `diff.sequenceOps` (if any). */
  generate(diff: SchemaDiff, up: string[], down: string[]): void {
    if (!diff.sequenceOps?.length) return;

    if (this.dialect === 'mysql') {
      this.handleMysql(diff.sequenceOps, up, down);
    } else {
      this.handleNative(diff.sequenceOps, up, down);
    }
  }

  // ─── Native (PG / MSSQL) ────────────────────────────────────────────────

  private handleNative(ops: SequenceDiff[], up: string[], down: string[]): void {
    for (const op of ops) {
      if (op.kind === 'create') {
        up.push(this.buildCreateSequence(op.sequence));
        down.push(this.buildDropSequence(op.sequence));
      } else if (op.kind === 'drop') {
        up.push(this.buildDropSequence(op.sequence));
        down.push(this.buildCreateSequence(op.sequence));
      } else if (op.kind === 'alter' && op.prev) {
        up.push(this.buildAlterSequence(op.sequence));
        down.push(this.buildAlterSequence(op.prev));
      }
    }
  }

  private buildCreateSequence(seq: SequenceDef): string {
    if (this.dialect === 'postgresql') return this.buildPgCreate(seq);
    return this.buildMssqlCreate(seq);
  }

  private buildDropSequence(seq: SequenceDef): string {
    if (this.dialect === 'postgresql') {
      const name = seq.schema ? `"${seq.schema}"."${seq.name}"` : `"${seq.name}"`;
      return `DROP SEQUENCE IF EXISTS ${name};`;
    }
    // MSSQL
    const name = seq.schema ? `[${seq.schema}].[${seq.name}]` : `[${seq.name}]`;
    return `DROP SEQUENCE ${name};`;
  }

  private buildAlterSequence(seq: SequenceDef): string {
    if (this.dialect === 'postgresql') return this.buildPgAlter(seq);
    return this.buildMssqlAlter(seq);
  }

  // PostgreSQL

  private buildPgCreate(seq: SequenceDef): string {
    const name = seq.schema ? `"${seq.schema}"."${seq.name}"` : `"${seq.name}"`;
    const type = seq.type === 'bigint' ? 'BIGINT' : 'INTEGER';
    const parts = [`CREATE SEQUENCE ${name}`, `  AS ${type}`];
    if (seq.startsAt !== undefined) parts.push(`  START WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  private buildPgAlter(seq: SequenceDef): string {
    const name = seq.schema ? `"${seq.schema}"."${seq.name}"` : `"${seq.name}"`;
    const parts = [`ALTER SEQUENCE ${name}`];
    if (seq.startsAt !== undefined) parts.push(`  RESTART WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    if (seq.cyclesOn !== undefined) parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  // MSSQL

  private buildMssqlCreate(seq: SequenceDef): string {
    const name = seq.schema ? `[${seq.schema}].[${seq.name}]` : `[${seq.name}]`;
    const type = seq.type === 'bigint' ? 'BIGINT' : 'INT';
    const parts = [`CREATE SEQUENCE ${name}`, `  AS ${type}`];
    if (seq.startsAt !== undefined) parts.push(`  START WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    if (seq.cyclesOn !== undefined) parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  private buildMssqlAlter(seq: SequenceDef): string {
    const name = seq.schema ? `[${seq.schema}].[${seq.name}]` : `[${seq.name}]`;
    const parts = [`ALTER SEQUENCE ${name}`];
    if (seq.startsAt !== undefined) parts.push(`  RESTART WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    if (seq.cyclesOn !== undefined) parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  // ─── MySQL emulation ─────────────────────────────────────────────────────

  private _mysqlTableEmitted = false;

  private handleMysql(ops: SequenceDiff[], up: string[], down: string[]): void {
    for (const op of ops) {
      if (op.kind === 'create') {
        if (!this._mysqlTableEmitted) {
          up.push(MYSQL_SEQ_TABLE_DDL + ';');
          this._mysqlTableEmitted = true;
        }
        const { insert, deleteUp } = this.buildMysqlInsert(op.sequence);
        up.push(insert);
        down.push(deleteUp);
      } else if (op.kind === 'drop') {
        const deleteRow = `DELETE FROM \`${MYSQL_SEQ_TABLE}\` WHERE \`name\` = '${op.sequence.name}';`;
        up.push(deleteRow);
        const { insert } = this.buildMysqlInsert(op.sequence);
        down.push(insert);
      }
    }
  }

  private buildMysqlInsert(seq: SequenceDef): { insert: string; deleteUp: string } {
    const startsAt = seq.startsAt ?? 1;
    const incrementsBy = seq.incrementsBy ?? 1;
    const schemaVal = seq.schema ? `'${seq.schema}'` : 'NULL';
    const insert =
      `INSERT INTO \`${MYSQL_SEQ_TABLE}\` (\`name\`, \`schema_name\`, \`current_value\`, \`increment_by\`) ` +
      `VALUES ('${seq.name}', ${schemaVal}, ${startsAt - 1}, ${incrementsBy}) ` +
      `ON DUPLICATE KEY UPDATE \`name\` = \`name\`;`;
    const deleteUp = `DELETE FROM \`${MYSQL_SEQ_TABLE}\` WHERE \`name\` = '${seq.name}';`;
    return { insert, deleteUp };
  }
}
