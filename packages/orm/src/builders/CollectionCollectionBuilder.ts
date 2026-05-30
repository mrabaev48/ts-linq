import type { MetadataRegistry, SkipNavigationMetadata } from '@ts-linq/metadata';
import type { RelationshipMetadata } from '@ts-linq/types';

import type { EntityTypeBuilder } from './EntityTypeBuilder';
import type { ReferenceCollectionBuilder } from './ReferenceCollectionBuilder';

/** Derives a camelCase FK name from a class name: "Post" → "postId". */
function deriveFk(ctorName: string): string {
  const first = ctorName.charAt(0).toLowerCase();
  return first + ctorName.slice(1) + 'Id';
}

/** Creates a synthetic named class used as the join-entity key in MetadataRegistry. */
function createSyntheticClass(name: string): new () => unknown {
  const cls = class {};
  Object.defineProperty(cls, 'name', { value: name, writable: false });
  return cls as new () => unknown;
}

/**
 * Returned by `CollectionNavigationBuilder.withMany()`.
 * Represents a configured many-to-many relationship; call `usingEntity()` for
 * explicit join-entity support (extra columns, custom FK names).
 */
export class CollectionCollectionBuilder<TLeft, TRight> {
  private _usingEntityBuilder?: EntityTypeBuilder<unknown>;

  constructor(
    private readonly _leftCtor: new () => TLeft,
    private readonly _leftPropertyName: string,
    private readonly _rightCtor: (new () => TRight) | undefined,
    private readonly _rightPropertyName: string | undefined,
    private readonly _relationships: RelationshipMetadata[]
  ) {}

  /**
   * Configure an explicit join entity (e.g. PostTag) with custom columns/FKs.
   * Mirrors EF Core's `.UsingEntity<TJoin>(configureRight, configureLeft, configureJoin)`.
   */
  usingEntity<TJoin>(
    configureRight: (j: EntityTypeBuilder<TJoin>) => ReferenceCollectionBuilder<TRight, TJoin>,
    configureLeft: (j: EntityTypeBuilder<TJoin>) => ReferenceCollectionBuilder<TLeft, TJoin>,
    configureJoin?: (j: EntityTypeBuilder<TJoin>) => void
  ): EntityTypeBuilder<TJoin> {
    // Lazy import to avoid circular dep at module load time

    const { EntityTypeBuilder: ETB } = require('./EntityTypeBuilder') as {
      EntityTypeBuilder: new (ctor: new () => TJoin) => EntityTypeBuilder<TJoin>;
    };

    const joinTableName = this._deriveJoinTableName();
    const syntheticCtor = createSyntheticClass(joinTableName) as new () => TJoin;
    const joinBuilder = new ETB(syntheticCtor);

    configureRight(joinBuilder);
    configureLeft(joinBuilder);
    configureJoin?.(joinBuilder);

    this._usingEntityBuilder = joinBuilder as unknown as EntityTypeBuilder<unknown>;
    return joinBuilder;
  }

  /** Called by `EntityTypeBuilder._applyToRegistry()` to register the skip navigation. */
  _applyToRegistry(registry: MetadataRegistry, leftPkProp: string, rightPkProp: string): void {
    if (!this._rightCtor) return;

    const rightMeta = registry.getEntity(this._rightCtor);
    const resolvedRightPk = rightMeta?.primaryKeys?.[0] ?? rightPkProp;

    const joinTableName = this._deriveJoinTableName();
    const leftFk = deriveFk(this._leftCtor.name);
    const rightFk = deriveFk(this._rightCtor.name);

    // Synthesise join entity and register it in the registry so provider.insert / delete work.
    const syntheticCtor = createSyntheticClass(joinTableName);
    registry.addEntity(syntheticCtor, joinTableName);
    registry.mergeFluentColumn(syntheticCtor, {
      propertyName: leftFk,
      columnName: leftFk,
      type: 'int',
      nullable: false
    });
    registry.mergeFluentColumn(syntheticCtor, {
      propertyName: rightFk,
      columnName: rightFk,
      type: 'int',
      nullable: false
    });
    registry.setFluentPrimaryKeys(syntheticCtor, [leftFk, rightFk]);

    // Skip navigation metadata for the left side
    const leftNav: SkipNavigationMetadata = {
      propertyName: this._leftPropertyName,
      targetEntity: this._rightCtor,
      joinTableName,
      joinEntityCtor: syntheticCtor,
      leftForeignKey: leftFk,
      rightForeignKey: rightFk,
      inverseSide: this._rightPropertyName,
      isSynthesized: true
    };
    registry.mergeFluentSkipNavigation(this._leftCtor, leftNav);

    // Also register a RelationshipMetadata so the existing RelationshipLoader handles include()
    const leftRel: RelationshipMetadata = {
      propertyName: this._leftPropertyName,
      type: 'many-to-many',
      targetEntity: this._rightCtor,
      inverseSide: this._rightPropertyName,
      through: { table: joinTableName, sourceFk: leftFk, targetFk: rightFk }
    };
    registry.mergeFluentRelationship(this._leftCtor, leftRel);

    // Skip navigation metadata for the right side (inverse)
    if (this._rightPropertyName) {
      const rightNav: SkipNavigationMetadata = {
        propertyName: this._rightPropertyName,
        targetEntity: this._leftCtor,
        joinTableName,
        joinEntityCtor: syntheticCtor,
        leftForeignKey: rightFk,
        rightForeignKey: leftFk,
        inverseSide: this._leftPropertyName,
        isSynthesized: true
      };
      registry.mergeFluentSkipNavigation(this._rightCtor, rightNav);

      const rightRel: RelationshipMetadata = {
        propertyName: this._rightPropertyName,
        type: 'many-to-many',
        targetEntity: this._leftCtor,
        inverseSide: this._leftPropertyName,
        through: { table: joinTableName, sourceFk: rightFk, targetFk: leftFk }
      };
      registry.mergeFluentRelationship(this._rightCtor, rightRel);
    }

    // Remove the stub relationship pushed by withMany() (it has no 'through' yet)
    const stubIdx = this._relationships.findIndex(
      (r) => r.propertyName === this._leftPropertyName && r.type === 'many-to-many' && !r.through
    );
    if (stubIdx >= 0) this._relationships.splice(stubIdx, 1);

    // Store PKs for diff during saveChanges (used by ChangeTracker)
    void leftPkProp;
    void resolvedRightPk;
  }

  private _deriveJoinTableName(): string {
    const l = this._leftCtor.name;
    const r = this._rightCtor?.name ?? 'Unknown';
    return l + r;
  }
}
