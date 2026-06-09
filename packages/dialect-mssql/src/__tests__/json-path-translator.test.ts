import type { JsonPathExpression } from '@ts-linq/sql-visitor';
import {
  JsonAccessRewriter,
  ParameterState,
  ParameterStyle,
  SqlVisitor
} from '@ts-linq/sql-visitor';

import { MssqlJsonPathTranslator } from '../json/JsonPathTranslator';

function makeNode(column: string, path: string[]): JsonPathExpression {
  return { type: 'jsonPath', column, path };
}

describe('MssqlJsonPathTranslator', () => {
  const translator = new MssqlJsonPathTranslator();
  const state = new ParameterState(ParameterStyle.Named);

  it('translates single-segment path with JSON_VALUE', () => {
    const result = translator.translate(makeNode('prefs', ['theme']), state);
    expect(result.fragment).toBe("JSON_VALUE([prefs], '$.theme')");
  });

  it('translates multi-segment path', () => {
    const result = translator.translate(makeNode('prefs', ['display', 'theme']), state);
    expect(result.fragment).toBe("JSON_VALUE([prefs], '$.display.theme')");
  });

  it('returns no params', () => {
    const result = translator.translate(makeNode('prefs', ['a', 'b']), state);
    expect(result.params).toEqual([]);
  });
});

describe('MssqlJsonPathTranslator — JSON path in isNull / method positions (task-6)', () => {
  const makeVisitor = () =>
    new SqlVisitor(ParameterStyle.Named, {
      jsonPathTranslator: new MssqlJsonPathTranslator(),
      jsonAccessRewriter: new JsonAccessRewriter(
        new Map([['preferences', { columnName: 'preferences', properties: new Map() }]])
      )
    });

  it('emits JSON_VALUE(col,$.key) IS NULL with zero parameters', () => {
    const node = {
      type: 'isNull' as const,
      property: { type: 'property' as const, path: ['preferences', 'theme'] }
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe("(JSON_VALUE([preferences], '$.theme') IS NULL)");
    expect(parameters).toEqual([]);
  });

  it('emits JSON_VALUE(col,$.key) IS NOT NULL with zero parameters', () => {
    const node = {
      type: 'isNotNull' as const,
      property: { type: 'property' as const, path: ['preferences', 'theme'] }
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe("(JSON_VALUE([preferences], '$.theme') IS NOT NULL)");
    expect(parameters).toEqual([]);
  });

  it('emits JSON_VALUE(col,$.key) LIKE @p1 with the wildcard pattern as the only parameter', () => {
    const node = {
      type: 'method' as const,
      method: 'startsWith' as const,
      object: { type: 'property' as const, path: ['preferences', 'theme'] },
      args: [{ type: 'literal' as const, value: 'd' }]
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe("(JSON_VALUE([preferences], '$.theme') LIKE @p1)");
    expect(parameters).toEqual(['d%']);
  });
});
