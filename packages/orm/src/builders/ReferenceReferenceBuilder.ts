import type { DeleteBehavior, RelationshipMetadata } from '@ts-linq/types';

import { extractPropertyName } from './utils';

/**
 * Fluent builder for a one-to-one relationship (HasOne().WithOne()).
 * Mirrors EF Core's ReferenceReferenceBuilder<TEntity, TRelatedEntity>.
 */
export class ReferenceReferenceBuilder<T, TRel> {
  private readonly _rel: RelationshipMetadata;

  constructor(rel: RelationshipMetadata) {
    this._rel = rel;
  }

  /**
   * Specifies which entity holds the foreign key and which property it is.
   * Generic TDep is erased at runtime; the FK property name is extracted from
   * the selector.
   */
  hasForeignKey<TDep>(selector: (e: TDep) => unknown): this {
    this._rel.foreignKey = extractPropertyName(selector);
    return this;
  }

  /**
   * Specify the principal key when it is not the primary key of the principal
   * entity.
   */
  hasPrincipalKey<TPrin>(selector: (e: TPrin) => unknown): this {
    // Store as inverseSide FK indicator — full support comes with P1-31
    void selector;
    return this;
  }

  /** Configure the referential action on the dependent foreign key. */
  onDelete(behavior: DeleteBehavior): this {
    this._rel.onDelete = behavior;
    return this;
  }

  /** Mark the relationship as required (NOT NULL FK) or optional. */
  isRequired(required = true): this {
    this._rel.nullable = !required;
    return this;
  }
}
