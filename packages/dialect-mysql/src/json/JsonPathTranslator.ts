import type { JsonPathExpression, JsonPathTranslator, ParameterState } from '@ts-linq/sql-visitor';

/**
 * MySQL JSON path translator.
 *
 * Uses the ->> operator (JSON_UNQUOTE(JSON_EXTRACT)) for unquoted text extraction.
 */
export class MySqlJsonPathTranslator implements JsonPathTranslator {
  translate(node: JsonPathExpression, _state: ParameterState) {
    const col = `\`${node.column}\``;
    const jsonPath = '$.'.concat(node.path.join('.'));
    return { fragment: `(${col}->>'${jsonPath}')`, params: [] as never[] };
  }
}
