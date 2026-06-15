import type { Dialect } from '../Dialect';
import type { SchemaDiff, SequenceDef, SequenceDiff } from '../DiffTypes';
import { QuoterFactory } from './quoting/QuoterFactory';
import type { SqlQuoter } from './quoting/SqlQuoter';

/** Name of the MySQL sequence emulation table. */
const MYSQL_SEQ_TABLE = '__ts_linq_sequences';

/**
 * Generates CREATE SEQUENCE / DROP SEQUENCE DDL for migration UP/DOWN scripts.
 *
 * - PostgreSQL: native CREATE SEQUENCE with optional schema, type, START, INCREMENT, MINVALUE,
 *   MAXVALUE, CYCLE/NO CYCLE.
 * - MSSQL: native CREATE SEQUENCE with AS type.
 * - MySQL: INSERT into the emulation table `__ts_linq_sequences`; the table itself is
 *   created once on first sequence declaration.
 *
 * All identifiers and literals are routed through the audited {@link SqlQuoter} — no name
 * or value is interpolated into a quote character directly (migrations/task-1).
 */
export class SequencesSqlBuilder {
  private readonly quoter: SqlQuoter;

  constructor(private readonly dialect: Dialect) {
    this.quoter = QuoterFactory.for(dialect);
  }

  /** Appends sequence UP/DOWN SQL from `diff.sequenceOps` (if any). */
  generate(diff: SchemaDiff, up: string[], down: string[]): void {
    if (!diff.sequenceOps?.length) return;

    if (this.dialect === 'mysql') {
      this.handleMysql(diff.sequenceOps, up, down);
    } else {
      this.handleNative(diff.sequenceOps, up, down);
    }
  }

  /** Quotes a (optionally schema-qualified) sequence name through the audited quoter. */
  private seqName(seq: SequenceDef): string {
    return seq.schema ? this.quoter.qualified(seq.schema, seq.name) : this.quoter.id(seq.name);
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
    const name = this.seqName(seq);
    if (this.dialect === 'postgresql') {
      return `DROP SEQUENCE IF EXISTS ${name};`;
    }
    // MSSQL
    return `DROP SEQUENCE ${name};`;
  }

  private buildAlterSequence(seq: SequenceDef): string {
    if (this.dialect === 'postgresql') return this.buildPgAlter(seq);
    return this.buildMssqlAlter(seq);
  }

  // PostgreSQL

  private buildPgCreate(seq: SequenceDef): string {
    const type = seq.type === 'bigint' ? 'BIGINT' : 'INTEGER';
    const parts = [`CREATE SEQUENCE ${this.seqName(seq)}`, `  AS ${type}`];
    if (seq.startsAt !== undefined) parts.push(`  START WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  private buildPgAlter(seq: SequenceDef): string {
    const parts = [`ALTER SEQUENCE ${this.seqName(seq)}`];
    if (seq.startsAt !== undefined) parts.push(`  RESTART WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    if (seq.cyclesOn !== undefined) parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  // MSSQL

  private buildMssqlCreate(seq: SequenceDef): string {
    const type = seq.type === 'bigint' ? 'BIGINT' : 'INT';
    const parts = [`CREATE SEQUENCE ${this.seqName(seq)}`, `  AS ${type}`];
    if (seq.startsAt !== undefined) parts.push(`  START WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    if (seq.cyclesOn !== undefined) parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  private buildMssqlAlter(seq: SequenceDef): string {
    const parts = [`ALTER SEQUENCE ${this.seqName(seq)}`];
    if (seq.startsAt !== undefined) parts.push(`  RESTART WITH ${seq.startsAt}`);
    if (seq.incrementsBy !== undefined) parts.push(`  INCREMENT BY ${seq.incrementsBy}`);
    if (seq.minValue !== undefined) parts.push(`  MINVALUE ${seq.minValue}`);
    if (seq.maxValue !== undefined) parts.push(`  MAXVALUE ${seq.maxValue}`);
    if (seq.cyclesOn !== undefined) parts.push(seq.cyclesOn ? '  CYCLE' : '  NO CYCLE');
    return parts.join('\n') + ';';
  }

  // ─── MySQL emulation ─────────────────────────────────────────────────────

  private _mysqlTableEmitted = false;

  /** DDL for the MySQL sequence emulation table, with every identifier quoted. */
  private mysqlTableDdl(): string {
    const t = this.quoter.id(MYSQL_SEQ_TABLE);
    return (
      `CREATE TABLE IF NOT EXISTS ${t} (\n` +
      `  ${this.quoter.id('name')}           VARCHAR(128) NOT NULL,\n` +
      `  ${this.quoter.id('schema_name')}    VARCHAR(128)          DEFAULT NULL,\n` +
      `  ${this.quoter.id('current_value')}  BIGINT       NOT NULL DEFAULT 0,\n` +
      `  ${this.quoter.id('increment_by')}   INT          NOT NULL DEFAULT 1,\n` +
      `  PRIMARY KEY (${this.quoter.id('name')})\n` +
      `) ENGINE=InnoDB`
    );
  }

  private handleMysql(ops: SequenceDiff[], up: string[], down: string[]): void {
    for (const op of ops) {
      if (op.kind === 'create') {
        if (!this._mysqlTableEmitted) {
          up.push(this.mysqlTableDdl() + ';');
          this._mysqlTableEmitted = true;
        }
        const { insert, deleteUp } = this.buildMysqlInsert(op.sequence);
        up.push(insert);
        down.push(deleteUp);
      } else if (op.kind === 'drop') {
        up.push(this.buildMysqlDelete(op.sequence));
        const { insert } = this.buildMysqlInsert(op.sequence);
        down.push(insert);
      }
    }
  }

  private buildMysqlDelete(seq: SequenceDef): string {
    const table = this.quoter.id(MYSQL_SEQ_TABLE);
    const nameCol = this.quoter.id('name');
    return `DELETE FROM ${table} WHERE ${nameCol} = ${this.quoter.literal(seq.name)};`;
  }

  private buildMysqlInsert(seq: SequenceDef): { insert: string; deleteUp: string } {
    const startsAt = seq.startsAt ?? 1;
    const incrementsBy = seq.incrementsBy ?? 1;
    const table = this.quoter.id(MYSQL_SEQ_TABLE);
    const nameCol = this.quoter.id('name');
    const schemaVal = seq.schema ? this.quoter.literal(seq.schema) : 'NULL';
    const cols = [
      nameCol,
      this.quoter.id('schema_name'),
      this.quoter.id('current_value'),
      this.quoter.id('increment_by')
    ].join(', ');
    const insert =
      `INSERT INTO ${table} (${cols}) ` +
      `VALUES (${this.quoter.literal(seq.name)}, ${schemaVal}, ${startsAt - 1}, ${incrementsBy}) ` +
      `ON DUPLICATE KEY UPDATE ${nameCol} = ${nameCol};`;
    return { insert, deleteUp: this.buildMysqlDelete(seq) };
  }
}
