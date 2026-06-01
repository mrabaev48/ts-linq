import type { StoredProcedureConfig } from '@ts-linq/types';

import { CallSyntaxEmitter, ExecSyntaxEmitter } from '../src/sp-call-emitter';

function makeConfig(overrides: Partial<StoredProcedureConfig> = {}): StoredProcedureConfig {
  return {
    procedureName: 'TestProc',
    parameters: [],
    rowsAffectedMode: 'none',
    ...overrides
  };
}

describe('CallSyntaxEmitter (postgres)', () => {
  const emitter = new CallSyntaxEmitter('postgres');

  test('emits CALL with positional placeholders for input params', () => {
    const config = makeConfig({
      parameters: [
        { propertyName: 'name', direction: 'input' },
        { propertyName: 'age', direction: 'input' }
      ]
    });
    const { sql, parameters } = emitter.emitCall(config, { name: 'Alice', age: 30 }, undefined);
    expect(sql).toBe('CALL TestProc($1, $2)');
    expect(parameters).toEqual(['Alice', 30]);
  });

  test('emits null placeholder for output params', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', direction: 'output' }]
    });
    const { sql, parameters } = emitter.emitCall(config, {}, undefined);
    expect(sql).toBe('CALL TestProc($1)');
    expect(parameters).toEqual([null]);
  });

  test('binds original value for isOriginalValue params', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', direction: 'input', isOriginalValue: true }]
    });
    const { sql, parameters } = emitter.emitCall(config, { id: 99 }, { id: 1 });
    expect(sql).toBe('CALL TestProc($1)');
    expect(parameters).toEqual([1]);
  });

  test('extractRowsAffected reads resultColumn', () => {
    const config = makeConfig({ rowsAffectedMode: 'resultColumn' });
    const rows = [{ rows_affected: 3 }];
    expect(emitter.extractRowsAffected(config, rows)).toBe(3);
  });

  test('extractRowsAffected returns 0 when no row', () => {
    const config = makeConfig({ rowsAffectedMode: 'resultColumn' });
    expect(emitter.extractRowsAffected(config, [])).toBe(0);
  });

  test('extractOutputValues reads output column from result row', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', direction: 'output' }]
    });
    const result = emitter.extractOutputValues(config, [{ id: 42 }]);
    expect(result).toEqual({ id: 42 });
  });

  test('getFollowUpSelectParams returns empty for postgres', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', direction: 'output' }]
    });
    expect(emitter.getFollowUpSelectParams!(config)).toEqual([]);
  });
});

describe('CallSyntaxEmitter (mysql)', () => {
  const emitter = new CallSyntaxEmitter('mysql');

  test('emits CALL with ? placeholders for input params', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'name', direction: 'input' }]
    });
    const { sql, parameters } = emitter.emitCall(config, { name: 'Bob' }, undefined);
    expect(sql).toBe('CALL TestProc(?)');
    expect(parameters).toEqual(['Bob']);
  });

  test('emits session variable for output params', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'generatedId', direction: 'output' }]
    });
    const { sql } = emitter.emitCall(config, {}, undefined);
    expect(sql).toBe('CALL TestProc(@generatedId)');
  });

  test('uses parameterName override in session variable', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', parameterName: 'p_id', direction: 'output' }]
    });
    const { sql } = emitter.emitCall(config, {}, undefined);
    expect(sql).toBe('CALL TestProc(@p_id)');
  });

  test('getFollowUpSelectParams returns output param names', () => {
    const config = makeConfig({
      parameters: [
        { propertyName: 'id', direction: 'output' },
        { propertyName: 'name', direction: 'input' }
      ]
    });
    expect(emitter.getFollowUpSelectParams!(config)).toEqual(['id']);
  });
});

describe('ExecSyntaxEmitter (mssql)', () => {
  const emitter = new ExecSyntaxEmitter();

  test('emits EXEC with named params', () => {
    const config = makeConfig({
      parameters: [
        { propertyName: 'name', direction: 'input' },
        { propertyName: 'age', direction: 'input' }
      ]
    });
    const { sql, parameters } = emitter.emitCall(config, { name: 'Carol', age: 25 }, undefined);
    expect(sql).toBe('EXEC TestProc @name = @v0, @age = @v1');
    expect(parameters).toEqual(['Carol', 25]);
  });

  test('emits OUTPUT keyword for output params', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', direction: 'output' }]
    });
    const { sql } = emitter.emitCall(config, { id: null }, undefined);
    expect(sql).toBe('EXEC TestProc @id = @v0 OUTPUT');
  });

  test('appends SELECT @@ROWCOUNT for returnValue mode', () => {
    const config = makeConfig({ rowsAffectedMode: 'returnValue' });
    const { sql } = emitter.emitCall(config, {}, undefined);
    expect(sql).toContain('SELECT @@ROWCOUNT AS rows_affected');
  });

  test('uses parameterName override', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'personId', parameterName: 'PersonId', direction: 'input' }]
    });
    const { sql } = emitter.emitCall(config, { personId: 5 }, undefined);
    expect(sql).toBe('EXEC TestProc @PersonId = @v0');
  });

  test('extractRowsAffected reads rows_affected for returnValue mode', () => {
    const config = makeConfig({ rowsAffectedMode: 'returnValue' });
    expect(emitter.extractRowsAffected(config, [{ rows_affected: 7 }])).toBe(7);
  });

  test('extractOutputValues reads output columns from result', () => {
    const config = makeConfig({
      parameters: [{ propertyName: 'id', direction: 'output' }]
    });
    expect(emitter.extractOutputValues(config, [{ id: 123 }])).toEqual({ id: 123 });
  });

  test('emits EXEC with no params when no parameters', () => {
    const config = makeConfig();
    const { sql } = emitter.emitCall(config, {}, undefined);
    expect(sql).toBe('EXEC TestProc');
  });
});
