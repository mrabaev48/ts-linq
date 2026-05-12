export type AstSqlGenerationErrorCode =
  | 'PARAMETER_INDEX_OUT_OF_RANGE'
  | 'UNSUPPORTED_NODE_TYPE'
  | 'INVALID_MEMBER_ACCESS_PATH'
  | 'EMPTY_LOGICAL_EXPRESSION'
  | 'INVALID_UNARY_OPERAND';

export interface AstSqlGenerationErrorDetails {
  readonly nodeType?: string;
  readonly parameterIndex?: number;
  readonly memberPath?: readonly string[];
  readonly operandType?: string;
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

