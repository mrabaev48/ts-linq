import type { EntityCtor, EntityMetadata } from '@ts-linq/types';

import type { CompiledEntityModel, CompiledModel } from './CompiledModel';
import type { MetadataRegistry } from './MetadataRegistry';

/** Thrown when a class name referenced in the compiled model is absent from the classMap. */
export class CompiledModelHydrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompiledModelHydrationError';
  }
}

/** Thrown when the compiled model version is not supported by this runtime. */
export class CompiledModelVersionError extends Error {
  constructor(actual: number) {
    super(
      `Compiled model version ${actual} is not supported by this runtime (expected version 1). ` +
        `Re-generate the compiled model with: pnpm ts-linq dbcontext optimize`
    );
    this.name = 'CompiledModelVersionError';
  }
}

function resolveClass(
  name: string,
  classMap: Record<string, EntityCtor>,
  context: string
): EntityCtor {
  const resolved = classMap[name];
  if (!resolved) {
    throw new CompiledModelHydrationError(
      `Compiled model references class "${name}" (${context}) but it was not found in the ` +
        `classMap supplied to loadCompiledModel. Add "${name}" to the compiled model class map.`
    );
  }
  return resolved;
}

function hydrateEntity(
  em: CompiledEntityModel,
  classMap: Record<string, EntityCtor>
): { target: EntityCtor; metadata: EntityMetadata } {
  const target = resolveClass(em.entityClassName, classMap, 'entity');

  const metadata: EntityMetadata = {
    target,
    className: em.entityClassName,
    tableName: em.tableName,
    schema: em.schema,
    primaryKeys: em.primaryKeys ? [...em.primaryKeys] : [],
    columns: em.columns.map((c) => ({ ...c })),
    relationships: em.relationships.map((r) => {
      const rel = { ...r };
      if (typeof rel.targetEntity === 'string') {
        const resolved = classMap[rel.targetEntity];
        if (resolved) rel.targetEntity = resolved;
      }
      return rel;
    }),
    indexes: em.indexes.map((i) => ({ ...i })),
    isTemporal: em.isTemporal,
    historyTableName: em.historyTableName,
    isKeyless: em.isKeyless,
    viewName: em.viewName,
    viewSql: em.viewSql,
    comment: em.comment,
    seedData: em.seedData ? em.seedData.map((row) => ({ ...row })) : undefined,
    checkConstraints: em.checkConstraints ? em.checkConstraints.map((c) => ({ ...c })) : undefined,
    alternateKeys: em.alternateKeys
      ? em.alternateKeys.map((ak) => ({ name: ak.name, columns: [...ak.columns] }))
      : undefined
  };

  if (em.shadowProperties && em.shadowProperties.length > 0) {
    const shadowMap = new Map<string, import('@ts-linq/types').ShadowPropertyMetadata>();
    for (const sp of em.shadowProperties) {
      shadowMap.set(sp.propertyName, {
        propertyName: sp.propertyName,
        columnName: sp.columnName,
        type: sp.type,
        nullable: sp.nullable,
        defaultValue: sp.defaultValue,
        defaultExpression: sp.defaultExpression,
        comment: sp.comment,
        length: sp.length,
        precision: sp.precision,
        scale: sp.scale
      });
    }
    metadata.shadowProperties = shadowMap;
  }

  if (em.skipNavigations && em.skipNavigations.length > 0) {
    metadata.skipNavigations = em.skipNavigations.map((sn) => ({
      propertyName: sn.propertyName,
      targetEntity: resolveClass(sn.targetEntityClassName, classMap, `skipNavigation.targetEntity`),
      joinTableName: sn.joinTableName,
      joinEntityCtor: resolveClass(
        sn.joinEntityClassName,
        classMap,
        `skipNavigation.joinEntityCtor`
      ),
      leftForeignKey: sn.leftForeignKey,
      rightForeignKey: sn.rightForeignKey,
      inverseSide: sn.inverseSide,
      isSynthesized: sn.isSynthesized
    }));
  }

  if (em.ownedEntities && em.ownedEntities.length > 0) {
    metadata.ownedEntities = em.ownedEntities.map((oe) => ({
      ownerPropertyName: oe.ownerPropertyName,
      ownedType: resolveClass(oe.ownedTypeClassName, classMap, `ownedEntity.ownedType`),
      strategy: oe.strategy as import('@ts-linq/types').StorageStrategy,
      columnPrefix: oe.columnPrefix,
      jsonColumnName: oe.jsonColumnName,
      foreignKeyColumns: oe.foreignKeyColumns ? [...oe.foreignKeyColumns] : undefined,
      principalKeyColumns: oe.principalKeyColumns ? [...oe.principalKeyColumns] : undefined,
      compositeKeyColumns: oe.compositeKeyColumns ? [...oe.compositeKeyColumns] : undefined,
      isCollection: oe.isCollection
    }));
  }

  if (em.hierarchy) {
    const h = em.hierarchy;
    metadata.hierarchy = {
      strategy: h.strategy as import('@ts-linq/types').InheritanceStrategy,
      rootEntity: resolveClass(h.rootEntityClassName, classMap, `hierarchy.rootEntity`),
      subtypes: h.subtypeClassNames.map((name) =>
        resolveClass(name, classMap, `hierarchy.subtypes`)
      ),
      discriminator: h.discriminator
        ? {
            columnName: h.discriminator.columnName,
            columnType: h.discriminator.columnType,
            isComplete: h.discriminator.isComplete,
            entries: h.discriminator.entries.map((e) => ({
              ctor: resolveClass(e.ctorClassName, classMap, `hierarchy.discriminator.entry`),
              value: e.value
            }))
          }
        : undefined
    };
  }

  if (em.hierarchyRootClassName) {
    metadata.hierarchyRoot = resolveClass(em.hierarchyRootClassName, classMap, `hierarchyRoot`);
  }

  return { target, metadata };
}

/**
 * Hydrates a MetadataRegistry from a pre-compiled AOT snapshot.
 * Called by the DbContext bootstrap path when `options.compiledModel` is set.
 *
 * @param model   - The frozen compiled model (from the .generated.ts file).
 * @param classMap - Maps entity class names (string) → entity constructor.
 * @param registry - The isolated registry to populate.
 */
export function loadCompiledModel(
  model: CompiledModel,
  classMap: Record<string, EntityCtor>,
  registry: MetadataRegistry
): void {
  if (model.version !== 1) {
    throw new CompiledModelVersionError(model.version);
  }

  for (const em of model.entities) {
    const { target, metadata } = hydrateEntity(em, classMap);

    registry.addEntity(target, metadata.tableName);
    if (metadata.schema) registry.mergeFluentSchema(target, metadata.schema);
    if (metadata.isTemporal) registry.mergeFluentTemporal(target, true, metadata.historyTableName);
    if (metadata.isKeyless !== undefined) registry.setFluentKeyless(target, metadata.isKeyless);
    if (metadata.viewName) registry.setFluentViewName(target, metadata.viewName);
    if (metadata.viewSql) registry.setFluentViewSql(target, metadata.viewSql);
    if (metadata.comment) registry.setEntityComment(target, metadata.comment);
    if (metadata.seedData) registry.setSeedData(target, [...metadata.seedData]);
    if (metadata.checkConstraints)
      registry.setCheckConstraints(target, [...metadata.checkConstraints]);

    if (metadata.primaryKeys && metadata.primaryKeys.length > 0) {
      registry.setFluentPrimaryKeys(target, [...metadata.primaryKeys]);
    }

    for (const col of metadata.columns) {
      registry.addColumn(target, col);
    }

    for (const rel of metadata.relationships) {
      registry.addRelationship(target, rel);
    }

    for (const idx of metadata.indexes) {
      registry.addIndex(target, idx);
    }

    if (metadata.shadowProperties) {
      for (const [, sp] of metadata.shadowProperties) {
        registry.addShadowProperty(target, sp);
      }
    }

    if (metadata.alternateKeys) {
      for (const ak of metadata.alternateKeys) {
        registry.mergeFluentAlternateKey(target, ak);
      }
    }

    if (metadata.skipNavigations) {
      for (const sn of metadata.skipNavigations) {
        registry.mergeFluentSkipNavigation(target, sn);
      }
    }

    if (metadata.ownedEntities) {
      for (const oe of metadata.ownedEntities) {
        registry.addOwnedEntity(target, oe);
      }
    }

    if (metadata.hierarchy) {
      registry.setHierarchyMetadata(target, metadata.hierarchy);
    }

    if (metadata.hierarchyRoot) {
      registry.setHierarchyRoot(target, metadata.hierarchyRoot);
    }
  }
}
