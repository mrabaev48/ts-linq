import type { DeleteBehavior, RelationshipMetadata } from '@ts-linq/types';

import { extractPropertyName } from './utils';

/**
 * Fluent builder for a one-to-many relationship (HasMany().WithOne()).
 * Mirrors EF Core's CollectionNavigationBuilder → WithOne result.
 *
 * The "collection" is the navigation on the principal entity (HasMany side);
 * the "reference" is the navigation on the dependent entity (WithOne side).
 */
export class CollectionReferenceBuilder<T, TRel> {
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
