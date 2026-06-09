import { OrmError } from '@ts-linq/types';

export type AstSqlGenerationErrorCode =
  | 'PARAMETER_INDEX_OUT_OF_RANGE'
  | 'UNSUPPORTED_NODE_TYPE'
  | 'INVALID_MEMBER_ACCESS_PATH'
  | 'EMPTY_LOGICAL_EXPRESSION'
  | 'EMPTY_LOGICAL_BRANCH'
  | 'INVALID_UNARY_OPERAND'
  | 'INVALID_PROPERTY_NODE'
  | 'INVALID_IN_VALUES'
  | 'INVALID_IN_NODE'
  | 'INVALID_METHOD_NODE'
  | 'INVALID_METHOD_ARG'
  | 'UNSUPPORTED_METHOD'
  | 'UNSUPPORTED_FUNCTION'
  | 'INVALID_FUNCTION_NODE'
  | 'UNSUPPORTED_JSON_POSITION';

// Declared as a `type` (not `interface`) so it carries an implicit index
// signature and is assignable to `OrmError`'s `Readonly<Record<string, unknown>>`
// `details` contract while keeping its precise, AST-specific shape.
export type AstSqlGenerationErrorDetails = {
  readonly nodeType?: string;
  readonly parameterIndex?: number;
  readonly memberPath?: readonly string[];
  readonly operandType?: string;
  readonly syntaxKind?: number;
  readonly method?: string;
  readonly fn?: string;
  /** JSON path expression details. */
  readonly column?: string;
  readonly path?: readonly string[];
};

/**
 * Domain error thrown when converting an AST to SQL fails.
 *
 * Notes:
 * - Messages are intentionally in English (project standard).
 * - The error is designed to be caught by higher layers (e.g. query pipeline) and handled appropriately.
 * - Re-rooted under `OrmError` so it shares the project-wide error taxonomy
 *   (`instanceof OrmError`, `code`, `details`, `cause`) while keeping its
 *   AST-specific `code` union and `details` payload.
 */
export class AstSqlGenerationError extends OrmError {
  public override readonly code: AstSqlGenerationErrorCode;
  public override readonly details: AstSqlGenerationErrorDetails;

  public constructor(
    code: AstSqlGenerationErrorCode,
    message: string,
    details: AstSqlGenerationErrorDetails = {}
  ) {
    super(message, { details });
    this.code = code;
    this.details = details;
  }
}
