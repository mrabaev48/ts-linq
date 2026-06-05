import type { CheckConstraintMetadata, ValidationRule } from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';

/**
 * Facet store for declarative constraints: validation rules and CHECK
 * constraints. Reads (e.g. `getValidationRules`) stay on the registry facade,
 * which already owns the finalize-on-read path.
 */
export class ConstraintStore {
  public constructor(private readonly state: EntityMetadataState) {}

  /** Decorator-driven validation rule registration (append-only). */
  public addValidationRule(target: Function, rule: ValidationRule): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.validations = [...(finalized.validations || []), rule];
      },
      (builder) => builder.addValidationRule(rule)
    );
  }

  /** Set (replace) CHECK constraints for an entity (P0-14). */
  public setCheckConstraints(target: Function, constraints: CheckConstraintMetadata[]): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.checkConstraints = constraints;
      },
      (builder) => builder.setCheckConstraints(constraints)
    );
  }
}
