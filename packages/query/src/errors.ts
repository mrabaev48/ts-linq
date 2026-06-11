import { OrmError } from '@ts-linq/types';

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
  /** Index signature so the typed details satisfy `OrmError`'s `Record<string, unknown>` bag. */
  readonly [key: string]: unknown;
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
 *
 * Extends {@link OrmError} so consumers can discriminate it via `instanceof OrmError` / `.code`
 * alongside the rest of the hierarchy (CLAUDE.md §16); `name` is derived by `OrmError`.
 */
export class IncludeResolutionError extends OrmError {
  public readonly code: IncludeResolutionErrorCode;
  public override readonly details: IncludeResolutionErrorDetails;

  constructor(
    code: IncludeResolutionErrorCode,
    message: string,
    details: IncludeResolutionErrorDetails
  ) {
    super(message, { details });
    this.code = code;
    this.details = details;
  }
}
