import type { DeleteBehavior, RelationshipMetadata } from '@ts-linq/types';

import { extractPropertyName } from './utils';

/**
 * Fluent builder for a many-to-one relationship (HasOne().WithMany()).
 * Mirrors EF Core's ReferenceCollectionBuilder<TPrincipalEntity, TDependentEntity>.
 *
 * The "reference" is the navigation on the dependent entity (HasOne side);
 * the "collection" is the inverse navigation on the principal (WithMany side).
 */
export class ReferenceCollectionBuilder<T, TRel> {
  private readonly _rel: RelationshipMetadata;

  constructor(rel: RelationshipMetadata) {
    this._rel = rel;
  }

  /** Specify the foreign key property on the dependent entity. */
  hasForeignKey<TDep>(selector: (e: TDep) => unknown): this {
    this._rel.foreignKey = extractPropertyName(selector);
    return this;
  }

  /** Specify the principal key when not the primary key. */
  hasPrincipalKey<TPrin>(selector: (e: TPrin) => unknown): this {
    void selector;
    return this;
  }

  /** Configure the referential delete action. */
  onDelete(behavior: DeleteBehavior): this {
    this._rel.onDelete = behavior;
    return this;
  }

  /** Mark the relationship as required (NOT NULL FK). */
  isRequired(required = true): this {
    this._rel.nullable = !required;
    return this;
  }
}
