import type {
  EntityCtorRef,
  EntityMetadata,
  EntityStoredProcedureMapping,
  MetadataSource,
  OwnedEntityMetadata,
  ValidationRule
} from '@ts-linq/types';

/**
 * Null Object implementation of {@link MetadataSource} that knows about no
 * entities.
 *
 * Intended for tests (and bootstrap edge cases) that need a guaranteed-empty,
 * side-effect-free metadata source instead of mutating the global
 * `MetadataStorage` singleton. Every lookup resolves to "unknown".
 */
export class EmptyMetadataSource implements MetadataSource {
  getEntity(_target: EntityCtorRef): EntityMetadata | undefined {
    return undefined;
  }

  getEntities(): EntityMetadata[] {
    return [];
  }

  getValidationRules(_target: EntityCtorRef): ValidationRule[] {
    return [];
  }

  getOwnedEntities(_owner: EntityCtorRef): OwnedEntityMetadata[] {
    return [];
  }

  getStoredProcedureMapping(_target: EntityCtorRef): EntityStoredProcedureMapping | undefined {
    return undefined;
  }
}
