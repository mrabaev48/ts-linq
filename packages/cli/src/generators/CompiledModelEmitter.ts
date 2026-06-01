import type { CompiledEntityModel, CompiledModel } from '@ts-linq/metadata';
import type { EntityMetadata } from '@ts-linq/types';
import * as path from 'path';

import { NodeFs } from '../adapters/NodeFs';
import type { FileSystem } from '../ports/FileSystem';

/** Input for the emitter: metadata + source path of the entity class. */
export interface EntityEmitEntry {
  metadata: EntityMetadata;
  /** Absolute path to the source file that declares the entity class. */
  sourcePath?: string;
}

function toSnakeKebab(name: string): string {
  return name
    .replace(/([A-Z])/g, (m, c, i) => (i > 0 ? '-' : '') + c.toLowerCase())
    .replace(/--+/g, '-');
}

function buildCompiledEntity(meta: EntityMetadata): CompiledEntityModel {
  const shadowArr =
    meta.shadowProperties && meta.shadowProperties.size > 0
      ? Array.from(meta.shadowProperties.values()).map((sp) => ({
          propertyName: sp.propertyName,
          columnName: sp.columnName,
          type: sp.type as string,
          nullable: sp.nullable,
          defaultValue: sp.defaultValue,
          defaultExpression: sp.defaultExpression,
          comment: sp.comment,
          length: sp.length,
          precision: sp.precision,
          scale: sp.scale
        }))
      : undefined;

  const ownedArr =
    meta.ownedEntities && meta.ownedEntities.length > 0
      ? meta.ownedEntities.map((oe) => ({
          ownerPropertyName: oe.ownerPropertyName,
          ownedTypeClassName:
            typeof oe.ownedType === 'function'
              ? ((oe.ownedType as Function & { name?: string }).name ?? 'unknown')
              : String(oe.ownedType),
          strategy: oe.strategy as string,
          columnPrefix: oe.columnPrefix,
          jsonColumnName: oe.jsonColumnName,
          foreignKeyColumns: oe.foreignKeyColumns ? [...oe.foreignKeyColumns] : undefined,
          principalKeyColumns: oe.principalKeyColumns ? [...oe.principalKeyColumns] : undefined,
          compositeKeyColumns: oe.compositeKeyColumns ? [...oe.compositeKeyColumns] : undefined,
          isCollection: oe.isCollection
        }))
      : undefined;

  const skipNavArr =
    meta.skipNavigations && meta.skipNavigations.length > 0
      ? meta.skipNavigations.map((sn) => ({
          propertyName: sn.propertyName,
          targetEntityClassName:
            typeof sn.targetEntity === 'function'
              ? ((sn.targetEntity as Function & { name?: string }).name ?? 'unknown')
              : String(sn.targetEntity),
          joinTableName: sn.joinTableName,
          joinEntityClassName:
            typeof sn.joinEntityCtor === 'function'
              ? ((sn.joinEntityCtor as Function & { name?: string }).name ?? 'unknown')
              : String(sn.joinEntityCtor),
          leftForeignKey: sn.leftForeignKey,
          rightForeignKey: sn.rightForeignKey,
          inverseSide: sn.inverseSide,
          isSynthesized: sn.isSynthesized
        }))
      : undefined;

  const hierarchyModel =
    meta.hierarchy !== undefined
      ? {
          strategy: meta.hierarchy.strategy as string,
          rootEntityClassName:
            typeof meta.hierarchy.rootEntity === 'function'
              ? ((meta.hierarchy.rootEntity as Function & { name?: string }).name ?? 'unknown')
              : String(meta.hierarchy.rootEntity),
          subtypeClassNames: meta.hierarchy.subtypes.map((s) =>
            typeof s === 'function'
              ? ((s as Function & { name?: string }).name ?? 'unknown')
              : String(s)
          ),
          discriminator: meta.hierarchy.discriminator
            ? {
                columnName: meta.hierarchy.discriminator.columnName,
                columnType: meta.hierarchy.discriminator.columnType,
                isComplete: meta.hierarchy.discriminator.isComplete,
                entries: meta.hierarchy.discriminator.entries.map((e) => ({
                  ctorClassName:
                    typeof e.ctor === 'function'
                      ? ((e.ctor as Function & { name?: string }).name ?? 'unknown')
                      : String(e.ctor),
                  value: e.value
                }))
              }
            : undefined
        }
      : undefined;

  const relationships = meta.relationships.map((r) => {
    const rel = { ...r };
    if (typeof rel.targetEntity === 'function') {
      rel.targetEntity = (rel.targetEntity as Function & { name?: string }).name ?? 'unknown';
    } else if (typeof rel.targetEntity === 'object' && rel.targetEntity !== null) {
      // lazy thunk (() => Function)
      try {
        const resolved = (rel.targetEntity as () => Function)();
        rel.targetEntity =
          typeof resolved === 'function'
            ? ((resolved as Function & { name?: string }).name ?? 'unknown')
            : String(resolved);
      } catch {
        rel.targetEntity = 'unknown';
      }
    }
    return rel;
  });

  return {
    entityClassName: meta.className ?? meta.target?.name ?? meta.tableName,
    tableName: meta.tableName,
    schema: meta.schema,
    primaryKeys: meta.primaryKeys ? [...meta.primaryKeys] : undefined,
    columns: meta.columns.map((c) => {
      // Strip non-serializable fields (converter/comparer/accessor contain live objects)
      const {
        converter: _c,
        comparer: _cmp,
        accessor: _a,
        ...rest
      } = c as typeof c & {
        converter?: unknown;
        comparer?: unknown;
        accessor?: unknown;
      };
      return rest;
    }),
    relationships,
    indexes: meta.indexes.map((i) => ({ ...i })),
    checkConstraints: meta.checkConstraints ? [...meta.checkConstraints] : undefined,
    shadowProperties: shadowArr,
    alternateKeys: meta.alternateKeys ? meta.alternateKeys.map((ak) => ({ ...ak })) : undefined,
    skipNavigations: skipNavArr,
    ownedEntities: ownedArr,
    hierarchy: hierarchyModel,
    hierarchyRootClassName:
      meta.hierarchyRoot !== undefined
        ? typeof meta.hierarchyRoot === 'function'
          ? ((meta.hierarchyRoot as Function & { name?: string }).name ?? 'unknown')
          : String(meta.hierarchyRoot)
        : undefined,
    isTemporal: meta.isTemporal,
    historyTableName: meta.historyTableName,
    isKeyless: meta.isKeyless,
    viewName: meta.viewName,
    viewSql: meta.viewSql,
    comment: meta.comment,
    seedData: meta.seedData ? meta.seedData.map((row) => ({ ...row })) : undefined
  };
}

function collectClassNames(entities: EntityMetadata[]): string[] {
  const names = new Set<string>();
  for (const m of entities) {
    if (m.target && typeof m.target === 'function') {
      names.add((m.target as Function & { name?: string }).name ?? '');
    }
    for (const r of m.relationships) {
      if (typeof r.targetEntity === 'string') names.add(r.targetEntity);
    }
    for (const oe of m.ownedEntities ?? []) {
      if (typeof oe.ownedType === 'function') {
        names.add((oe.ownedType as Function & { name?: string }).name ?? '');
      }
    }
    for (const sn of m.skipNavigations ?? []) {
      if (typeof sn.targetEntity === 'function') {
        names.add((sn.targetEntity as Function & { name?: string }).name ?? '');
      }
      if (typeof sn.joinEntityCtor === 'function') {
        names.add((sn.joinEntityCtor as Function & { name?: string }).name ?? '');
      }
    }
    if (m.hierarchy) {
      for (const st of m.hierarchy.subtypes) {
        if (typeof st === 'function') {
          names.add((st as Function & { name?: string }).name ?? '');
        }
      }
    }
  }
  names.delete('');
  return [...names].sort();
}

/**
 * Generates a `.generated.ts` file containing the frozen AOT compiled model.
 * Called by DbContextOptimizeCommand after MetadataRegistry is populated.
 */
export class CompiledModelEmitter {
  constructor(private readonly fsAdapter: FileSystem = new NodeFs()) {}

  public emit(
    contextName: string,
    entities: EntityMetadata[],
    outputDir: string,
    /** Resolve a class name to its import path (relative to the output file). */
    resolveImport?: (className: string) => string | undefined
  ): { filePath: string; content: string } {
    const model: CompiledModel = {
      version: 1,
      contextClassName: contextName,
      generatedAt: new Date().toISOString(),
      entities: entities.map(buildCompiledEntity)
    };

    const classNames = collectClassNames(entities);

    const fileName = `${toSnakeKebab(contextName)}-model.generated.ts`;
    const filePath = path.join(outputDir, fileName);

    const importLines: string[] = [];
    const classMapEntries: string[] = [];

    for (const name of classNames) {
      const importPath = resolveImport?.(name);
      if (importPath) {
        importLines.push(`import { ${name} } from '${importPath}';`);
        classMapEntries.push(`  ${name},`);
      }
    }

    const modelJson = JSON.stringify(model, null, 2);

    const lines: string[] = [
      '// This file was auto-generated by `pnpm ts-linq dbcontext optimize`.',
      '// Do not edit manually — re-run the command to regenerate.',
      '/* eslint-disable */',
      '/* tslint:disable */',
      ''
    ];

    if (importLines.length > 0) {
      lines.push(...importLines, '');
    }

    lines.push(
      `import type { CompiledModel } from '@ts-linq/metadata';`,
      '',
      `export const ${contextName}Model: CompiledModel = ${modelJson} as const;`,
      ''
    );

    if (classMapEntries.length > 0) {
      lines.push(
        `export const ${contextName}ModelClassMap: Record<string, Function> = {`,
        ...classMapEntries,
        `};`,
        ''
      );
    } else {
      lines.push(`export const ${contextName}ModelClassMap: Record<string, Function> = {};`, '');
    }

    const content = lines.join('\n');

    this.fsAdapter.ensureDir(outputDir);
    this.fsAdapter.writeText(filePath, content);

    return { filePath, content };
  }
}
