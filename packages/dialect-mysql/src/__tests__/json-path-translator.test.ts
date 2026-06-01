import type { JsonPathNode } from '@ts-linq/sql-visitor';
import { ParameterState, ParameterStyle } from '@ts-linq/sql-visitor';

import { MySqlJsonPathTranslator } from '../json/JsonPathTranslator';

function makeNode(column: string, path: string[]): JsonPathNode {
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
