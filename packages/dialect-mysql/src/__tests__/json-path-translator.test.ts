import type { JsonPathExpression } from '@ts-linq/sql-visitor';
import {
  JsonAccessRewriter,
  ParameterState,
  ParameterStyle,
  SqlVisitor
} from '@ts-linq/sql-visitor';

import { MySqlJsonPathTranslator } from '../json/JsonPathTranslator';

function makeNode(column: string, path: string[]): JsonPathExpression {
  return { type: 'jsonPath', column, path };
}

describe('MySqlJsonPathTranslator', () => {
  const translator = new MySqlJsonPathTranslator();
  const state = new ParameterState(ParameterStyle.Question);

  it('translates single-segment path', () => {
    const result = translator.translate(makeNode('prefs', ['theme']), state);
    expect(result.fragment).toBe("(`prefs`->>'$.theme')");
  });

  it('translates multi-segment path', () => {
    const result = translator.translate(makeNode('prefs', ['display', 'theme']), state);
    expect(result.fragment).toBe("(`prefs`->>'$.display.theme')");
  });

  it('returns no params', () => {
    const result = translator.translate(makeNode('prefs', ['a']), state);
    expect(result.params).toEqual([]);
  });
});

describe('MySqlJsonPathTranslator — JSON path in isNull / method positions (task-6)', () => {
  const makeVisitor = () =>
    new SqlVisitor(ParameterStyle.Question, {
      jsonPathTranslator: new MySqlJsonPathTranslator(),
      jsonAccessRewriter: new JsonAccessRewriter(
        new Map([['preferences', { columnName: 'preferences', properties: new Map() }]])
      )
    });

  it('emits (col->>$.key) IS NULL with zero parameters', () => {
    const node = {
      type: 'isNull' as const,
      property: { type: 'property' as const, path: ['preferences', 'theme'] }
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe("((`preferences`->>'$.theme') IS NULL)");
    expect(parameters).toEqual([]);
  });

  it('emits (col->>$.key) IS NOT NULL with zero parameters', () => {
    const node = {
      type: 'isNotNull' as const,
      property: { type: 'property' as const, path: ['preferences', 'theme'] }
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe("((`preferences`->>'$.theme') IS NOT NULL)");
    expect(parameters).toEqual([]);
  });

  it('emits (col->>$.key) LIKE ? with the wildcard pattern as the only parameter', () => {
    const node = {
      type: 'method' as const,
      method: 'startsWith' as const,
      object: { type: 'property' as const, path: ['preferences', 'theme'] },
      args: [{ type: 'literal' as const, value: 'd' }]
    };
    const { condition, parameters } = makeVisitor().toSql(node);
    expect(condition).toBe("((`preferences`->>'$.theme') LIKE ?)");
    expect(parameters).toEqual(['d%']);
  });
});
