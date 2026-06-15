import { SequencesSqlBuilder } from '../src/builders/SequencesSqlBuilder';
import type { SchemaDiff, SequenceDef } from '../src/DiffTypes';

function diff(ops: SchemaDiff['sequenceOps']): SchemaDiff {
  return { tables: [], sequenceOps: ops };
}

const basicSeq: SequenceDef = {
  name: 'OrderNumbers',
  schema: 'shared',
  startsAt: 1000,
  incrementsBy: 5
};

describe('SequencesSqlBuilder — PostgreSQL (P1-21)', () => {
  const builder = new SequencesSqlBuilder('postgresql');

  test('emits CREATE SEQUENCE for a create op', () => {
    const up: string[] = [];
    const down: string[] = [];
    builder.generate(diff([{ kind: 'create', sequence: basicSeq }]), up, down);
    expect(up[0]).toContain('CREATE SEQUENCE');
    expect(up[0]).toContain('"shared"."OrderNumbers"');
    expect(up[0]).toContain('START WITH 1000');
    expect(up[0]).toContain('INCREMENT BY 5');
    expect(up[0]).toContain('NO CYCLE');
    expect(down[0]).toContain('DROP SEQUENCE IF EXISTS');
  });

  test('emits DROP SEQUENCE for a drop op', () => {
    const up: string[] = [];
    const down: string[] = [];
    builder.generate(diff([{ kind: 'drop', sequence: basicSeq }]), up, down);
    expect(up[0]).toContain('DROP SEQUENCE IF EXISTS');
    expect(down[0]).toContain('CREATE SEQUENCE');
  });

  test('emits ALTER SEQUENCE for an alter op', () => {
    const up: string[] = [];
    const down: string[] = [];
    const prev: SequenceDef = {
      name: 'OrderNumbers',
      schema: 'shared',
      startsAt: 1,
      incrementsBy: 1
    };
    builder.generate(diff([{ kind: 'alter', sequence: basicSeq, prev }]), up, down);
    expect(up[0]).toContain('ALTER SEQUENCE');
    expect(up[0]).toContain('RESTART WITH 1000');
    expect(down[0]).toContain('RESTART WITH 1');
  });

  test('uses AS BIGINT when type is bigint', () => {
    const up: string[] = [];
    const seq: SequenceDef = { name: 'BigSeq', type: 'bigint' };
    new SequencesSqlBuilder('postgresql').generate(
      diff([{ kind: 'create', sequence: seq }]),
      up,
      []
    );
    expect(up[0]).toContain('AS BIGINT');
  });

  test('emits CYCLE when cyclesOn is true', () => {
    const up: string[] = [];
    const seq: SequenceDef = { name: 'CycleSeq', cyclesOn: true };
    new SequencesSqlBuilder('postgresql').generate(
      diff([{ kind: 'create', sequence: seq }]),
      up,
      []
    );
    expect(up[0]).toContain('  CYCLE');
    expect(up[0]).not.toContain('NO CYCLE');
  });
});

describe('SequencesSqlBuilder — MSSQL (P1-21)', () => {
  const builder = new SequencesSqlBuilder('mssql');

  test('emits CREATE SEQUENCE with MSSQL syntax', () => {
    const up: string[] = [];
    builder.generate(diff([{ kind: 'create', sequence: basicSeq }]), up, []);
    expect(up[0]).toContain('CREATE SEQUENCE');
    expect(up[0]).toContain('[shared].[OrderNumbers]');
    expect(up[0]).toContain('AS INT');
  });

  test('DROP SEQUENCE uses bracket notation', () => {
    const up: string[] = [];
    builder.generate(diff([{ kind: 'drop', sequence: basicSeq }]), up, []);
    expect(up[0]).toContain('DROP SEQUENCE [shared].[OrderNumbers]');
  });
});

describe('SequencesSqlBuilder — MySQL emulation (P1-21)', () => {
  test('emits CREATE TABLE for the emulation table on first sequence', () => {
    const builder = new SequencesSqlBuilder('mysql');
    const up: string[] = [];
    builder.generate(diff([{ kind: 'create', sequence: { name: 'seq1' } }]), up, []);
    expect(up[0]).toContain('CREATE TABLE IF NOT EXISTS');
    expect(up[0]).toContain('__ts_linq_sequences');
  });

  test('emits INSERT for the sequence row', () => {
    const builder = new SequencesSqlBuilder('mysql');
    const up: string[] = [];
    builder.generate(
      diff([{ kind: 'create', sequence: { name: 'seq1', startsAt: 100, incrementsBy: 10 } }]),
      up,
      []
    );
    expect(up[1]).toContain('INSERT INTO');
    expect(up[1]).toContain("'seq1'");
    expect(up[1]).toContain('99'); // startsAt - 1
  });

  test('emits DELETE for a drop op', () => {
    const builder = new SequencesSqlBuilder('mysql');
    const up: string[] = [];
    builder.generate(diff([{ kind: 'drop', sequence: { name: 'seq1' } }]), up, []);
    expect(up[0]).toContain('DELETE FROM');
    expect(up[0]).toContain("'seq1'");
  });

  test('does not repeat CREATE TABLE for multiple sequences', () => {
    const builder = new SequencesSqlBuilder('mysql');
    const up: string[] = [];
    builder.generate(
      diff([
        { kind: 'create', sequence: { name: 'seq1' } },
        { kind: 'create', sequence: { name: 'seq2' } }
      ]),
      up,
      []
    );
    const createTableCount = up.filter((s) => s.includes('CREATE TABLE')).length;
    expect(createTableCount).toBe(1);
  });

  test('no-ops when sequenceOps is empty', () => {
    const builder = new SequencesSqlBuilder('mysql');
    const up: string[] = [];
    const down: string[] = [];
    builder.generate({ tables: [] }, up, down);
    expect(up).toHaveLength(0);
    expect(down).toHaveLength(0);
  });
});

describe('SequencesSqlBuilder — injection-safe quoting (task-1)', () => {
  test('PostgreSQL escapes an embedded double-quote in schema/name', () => {
    const up: string[] = [];
    new SequencesSqlBuilder('postgresql').generate(
      diff([{ kind: 'create', sequence: { name: 'a"b', schema: 's"x' } }]),
      up,
      []
    );
    // the embedded quote is doubled — the name cannot break out of its quoting
    expect(up[0]).toContain('"s""x"."a""b"');
  });

  test('MSSQL escapes an embedded closing bracket in the name', () => {
    const up: string[] = [];
    new SequencesSqlBuilder('mssql').generate(
      diff([{ kind: 'drop', sequence: { name: 'a]b', schema: 'dbo' } }]),
      up,
      []
    );
    expect(up[0]).toBe('DROP SEQUENCE [dbo].[a]]b];');
  });

  test('MySQL escapes embedded backticks and quotes the literal value', () => {
    const up: string[] = [];
    new SequencesSqlBuilder('mysql').generate(
      diff([{ kind: 'create', sequence: { name: "se`q'1" } }]),
      up,
      []
    );
    // backtick doubled inside the table identifier
    expect(up[0]).toContain('`__ts_linq_sequences`');
    // value goes through the literal encoder: single-quote doubled
    expect(up[1]).toContain("'se`q''1'");
  });
});
