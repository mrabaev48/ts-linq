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
  | 'INVALID_FUNCTION_NODE';

export interface AstSqlGenerationErrorDetails {
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
}

/**
 * Domain error thrown when converting an AST to SQL fails.
 *
 * Notes:
 * - Messages are intentionally in English (project standard).
 * - The error is designed to be caught by higher layers (e.g. query pipeline) and handled appropriately.
 */
export class AstSqlGenerationError extends Error {
  public readonly code: AstSqlGenerationErrorCode;
  public readonly details: AstSqlGenerationErrorDetails;

  public constructor(
    code: AstSqlGenerationErrorCode,
    message: string,
    details: AstSqlGenerationErrorDetails = {}
  ) {
    super(message);
    this.name = 'AstSqlGenerationError';
    this.code = code;
    this.details = details;
  }
}
