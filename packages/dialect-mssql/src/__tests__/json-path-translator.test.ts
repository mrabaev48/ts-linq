import type { JsonPathNode } from '@ts-linq/sql-visitor';
import { ParameterState, ParameterStyle } from '@ts-linq/sql-visitor';

import { MssqlJsonPathTranslator } from '../json/JsonPathTranslator';

function makeNode(column: string, path: string[]): JsonPathNode {
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
