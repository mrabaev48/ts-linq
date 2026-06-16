import { describe, expect, it } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';
import { OrmError, OrmErrorCode, UnsupportedOperationError } from '@ts-linq/types';

import {
  MssqlSchemaInspector,
  MySqlSchemaInspector,
  PostgresSchemaInspector,
  SchemaInspectorFactory
} from '../src/SchemaInspector';

// The factory only stores the provider reference; it never invokes it, so a
// label-only stub is sufficient for selection tests.
function providerWithLabel(label: string): DatabaseProvider {
  return { providerLabel: label } as unknown as DatabaseProvider;
}

describe('SchemaInspectorFactory.for', () => {
  it('returns a PostgresSchemaInspector for the postgresql label', () => {
    const inspector = SchemaInspectorFactory.for('postgresql', providerWithLabel('postgresql'));
    expect(inspector).toBeInstanceOf(PostgresSchemaInspector);
  });

  it('returns a MySqlSchemaInspector for the mysql label', () => {
    const inspector = SchemaInspectorFactory.for('mysql', providerWithLabel('mysql'));
    expect(inspector).toBeInstanceOf(MySqlSchemaInspector);
  });

  it('returns a MssqlSchemaInspector for the mssql label', () => {
    const inspector = SchemaInspectorFactory.for('mssql', providerWithLabel('mssql'));
    expect(inspector).toBeInstanceOf(MssqlSchemaInspector);
  });

  it.each(['sqlite', 'stub', 'oracle', ''])(
    'throws a typed UnsupportedOperationError for the unsupported label %p',
    (label) => {
      expect(() => SchemaInspectorFactory.for(label, providerWithLabel(label))).toThrow(
        UnsupportedOperationError
      );
    }
  );

  it('carries the OrmError code and the offending label in the thrown error', () => {
    let thrown: unknown;
    try {
      SchemaInspectorFactory.for('sqlite', providerWithLabel('sqlite'));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(OrmError);
    const err = thrown as UnsupportedOperationError;
    expect(err.code).toBe(OrmErrorCode.UnsupportedOperation);
    expect(err.details).toMatchObject({
      operation: 'SchemaInspectorFactory.for',
      providerLabel: 'sqlite'
    });
  });
});
