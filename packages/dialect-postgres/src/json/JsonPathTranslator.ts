import type { JsonPathNode, JsonPathTranslator, ParameterState } from '@ts-linq/sql-visitor';

/**
 * PostgreSQL JSON path translator.
 *
 * Uses JSONB operators:
 *   - Intermediate segments: col->'seg'
 *   - Final text extraction: col->>'seg'
 *   - Cast variants: (col->>'seg')::integer etc.
 */
export class PostgresJsonPathTranslator implements JsonPathTranslator {
  translate(node: JsonPathNode, _state: ParameterState) {
    const col = `"${node.column}"`;
    const segments = node.path;

    if (segments.length === 0) {
      return { fragment: col, params: [] as never[] };
    }

    let expr = col;
    for (let i = 0; i < segments.length - 1; i++) {
      expr = `(${expr}->'${segments[i]}')`;
    }
    const last = segments[segments.length - 1];
    expr = `(${expr}->>'${last}')`;

    if (node.cast && node.cast !== 'text') {
      const pgCast = this.toPgType(node.cast);
      expr = `(${expr})::${pgCast}`;
    }

    return { fragment: expr, params: [] as never[] };
  }

  private toPgType(cast: NonNullable<JsonPathNode['cast']>): string {
    switch (cast) {
      case 'int':
        return 'integer';
      case 'bool':
        return 'boolean';
      case 'float':
        return 'double precision';
      default:
        return 'text';
    }
  }
}
