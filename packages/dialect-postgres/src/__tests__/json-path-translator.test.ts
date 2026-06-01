import type { JsonPathNode } from '@ts-linq/sql-visitor';
import { ParameterState, ParameterStyle } from '@ts-linq/sql-visitor';

import { PostgresJsonPathTranslator } from '../json/JsonPathTranslator';

function makeNode(column: string, path: string[], cast?: JsonPathNode['cast']): JsonPathNode {
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
