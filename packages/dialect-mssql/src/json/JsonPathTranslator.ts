import type { JsonPathNode, JsonPathTranslator, ParameterState } from '@ts-linq/sql-visitor';

/**
 * SQL Server JSON path translator.
 *
 * Uses JSON_VALUE(col, '$.a.b') for scalar leaf access.
 */
export class MssqlJsonPathTranslator implements JsonPathTranslator {
  translate(node: JsonPathNode, _state: ParameterState) {
    const col = `[${node.column}]`;
    const jsonPath = '$.'.concat(node.path.join('.'));
    return { fragment: `JSON_VALUE(${col}, '${jsonPath}')`, params: [] as never[] };
  }
}
