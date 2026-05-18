export type IncludeResolutionErrorCode =
  | 'ENTITY_NOT_REGISTERED'
  | 'UNKNOWN_PROPERTY'
  | 'UNRESOLVABLE_TARGET';

export interface IncludeResolutionErrorDetails {
  readonly entityName: string;
  /** Full dot-notation path being resolved (e.g. `'posts.author_typo'`). */
  readonly propertyPath: string;
  /** The specific segment that failed (e.g. `'author_typo'`). */
  readonly propertyName: string;
}

/**
 * Thrown by `IncludePlanner.populateIncludes`, `Queryable.include`, and
 * `Queryable.thenInclude` when an include path cannot be resolved against
 * entity relationship metadata.
 *
 * Inspect `.code` to distinguish the failure mode:
 * - `ENTITY_NOT_REGISTERED` — the entity class has no `@Entity` metadata.
 * - `UNKNOWN_PROPERTY` — the property name does not match any declared relationship (typo).
 * - `UNRESOLVABLE_TARGET` — the relationship's `targetEntity` cannot be resolved to a constructor.
 */
export class IncludeResolutionError extends Error {
  public readonly code: IncludeResolutionErrorCode;
  public readonly details: IncludeResolutionErrorDetails;

  constructor(
    code: IncludeResolutionErrorCode,
    message: string,
    details: IncludeResolutionErrorDetails
  ) {
    super(message);
    this.name = 'IncludeResolutionError';
    this.code = code;
    this.details = details;
  }
}
