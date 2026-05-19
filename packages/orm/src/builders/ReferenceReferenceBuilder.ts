import type { RelationshipMetadata } from '@ts-linq/types';
import type { DeleteBehavior } from '@ts-linq/types';

import { extractPropertyName } from './utils';

export class ReferenceReferenceBuilder<T, TRel> {
  constructor(private readonly _rel: RelationshipMetadata) {}

  hasForeignKey<TDep>(selector: (e: TDep) => unknown): this {
    this._rel.foreignKey = extractPropertyName(selector);
    return this;
  }

  hasPrincipalKey<TPrin>(selector: (e: TPrin) => unknown): this {
    // Stored as inverseSide; consumed by migration strategies.
    this._rel.inverseSide = extractPropertyName(selector);
    return this;
  }

  onDelete(behavior: DeleteBehavior): this {
    this._rel.onDelete = behavior;
    return this;
  }

  isRequired(required = true): this {
    this._rel.nullable = !required;
    return this;
  }
}
