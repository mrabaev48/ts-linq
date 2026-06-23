import { OrmConfigurationError, OrmErrorCode } from '@ts-linq/types';

/**
 * Thrown when a mutation (add/update/remove) is attempted on a keyless entity (P1-26).
 *
 * Extends the canonical {@link OrmConfigurationError} (it is a developer-configuration
 * mistake: keyless entities are read-only) so callers can branch on
 * `e.code === 'ORM_KEYLESS_MUTATION'` or `e instanceof OrmError`.
 */
export class KeylessMutationError extends OrmConfigurationError {
  constructor(entityName: string, operation: string) {
    super(
      `Cannot ${operation} keyless entity '${entityName}'. Keyless entities are read-only and cannot be tracked or mutated.`,
      OrmErrorCode.KeylessMutation,
      { details: { entityName, operation } }
    );
  }
}
