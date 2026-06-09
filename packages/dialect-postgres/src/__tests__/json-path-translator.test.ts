import type { JsonPathExpression } from '@ts-linq/sql-visitor';
import {
  JsonAccessRewriter,
  ParameterState,
  ParameterStyle,
  SqlVisitor
} from '@ts-linq/sql-visitor';

import { PostgresJsonPathTranslator } from '../json/JsonPathTranslator';

function makeNode(
  column: string,
  path: string[],
  cast?: JsonPathExpression['cast']
): JsonPathExpression {
  return { type: 'jsonPath', column, path, cast };
}

describe('PostgresJsonPathTranslator', () => {
  const translator = new PostgresJsonPathTranslator();
  const state = new ParameterState(ParameterStyle.Positional);

  it('returns bare column expression when path is empty', () => {
    const result = translator.translate(makeNode('prefs', []), state);
    expect(result.fragment).toBe('"prefs"');
    expect(result.params).toEqual([]);
  });

  it('translates single-segment path with ->> operator', () => {
    const result = translator.translate(makeNode('prefs', ['theme']), state);
    expect(result.fragment).toBe(`("prefs"->>'theme')`);
  });

  it('translates multi-segment path', () => {
    const result = translator.translate(makeNode('prefs', ['display', 'theme']), state);
    expect(result.fragment).toBe(`(("prefs"->'display')->>'theme')`);
  });

  it('applies ::integer cast', () => {
    const result = translator.translate(makeNode('prefs', ['count'], 'int'), state);
    expect(result.fragment).toContain('::integer');
  });

  it('applies ::boolean cast', () => {
    const result = translator.translate(makeNode('prefs', ['active'], 'bool'), state);
    expect(result.fragment).toContain('::boolean');
  });

  it('no extra cast for text', () => {
    const result = translator.translate(makeNode('prefs', ['name'], 'text'), state);
    expect(result.fragment).not.toContain('::');
  });

  it('returns no params', () => {
    const result = translator.translate(makeNode('prefs', ['a', 'b', 'c']), state);
    expect(result.params).toEqual([]);
  });
});

describe('PostgresJsonPathTranslator — JSON path in isNull / method positions (task-6)', () => {
  const makeVisitor = () =>
    new SqlVisitor(ParameterStyle.Positional, {
      jsonPathTranslator: new PostgresJsonPathTranslator(),
      jsonAccessRewriter: new JsonAccessRewriter(
        new Map([['preferences', { columnName: 'preferences', properties: new Map() }]])
      )
    });

  it('emits (col->>key) IS NULL with zero parameters', () => {
    const node = {
      type: 'isNull' as const,
      property: { type: 'property' as const, path: ['preferences', 'theme'] }
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe(`(("preferences"->>'theme') IS NULL)`);
    expect(parameters).toEqual([]);
  });

  it('emits (col->>key) IS NOT NULL with zero parameters', () => {
    const node = {
      type: 'isNotNull' as const,
      property: { type: 'property' as const, path: ['preferences', 'theme'] }
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe(`(("preferences"->>'theme') IS NOT NULL)`);
    expect(parameters).toEqual([]);
  });

  it('emits (col->>key) LIKE $1 with the wildcard pattern as the only parameter', () => {
    const node = {
      type: 'method' as const,
      method: 'startsWith' as const,
      object: { type: 'property' as const, path: ['preferences', 'theme'] },
      args: [{ type: 'literal' as const, value: 'd' }]
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe(`(("preferences"->>'theme') LIKE $1)`);
    expect(parameters).toEqual(['d%']);
  });
});
