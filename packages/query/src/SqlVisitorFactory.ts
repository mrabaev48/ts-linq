import type { ConverterResolver, SqlVisitorOptions } from '@ts-linq/sql-visitor';
import {
  ComplexAccessRewriter,
  hasVisitorSupport,
  JsonAccessRewriter,
  ParameterStyle,
  SqlVisitor
} from '@ts-linq/sql-visitor';
import type { EntityMetadata, JsonShape, SqlDialect } from '@ts-linq/types';
import { StorageStrategy } from '@ts-linq/types';

/** Inputs the factory needs to assemble a fully-configured {@link SqlVisitor}. */
export interface SqlVisitorFactoryInput {
  /** Entity metadata — source of value converters and JSON/complex-type rewriters. */
  readonly metadata: EntityMetadata | undefined;
  /** The active dialect — probed for spatial/hierarchy/JSON/EF translators. */
  readonly dialect: SqlDialect;
  /** Property → ValueConverter resolver, built by the caller from the same metadata. */
  readonly converterResolver?: ConverterResolver;
  /**
   * Placeholder style. Defaults to {@link ParameterStyle.Question} to preserve the historical
   * behaviour of the bare `new SqlVisitor()` call sites — downstream `QueryBuilder`/dialect
   * renumbers `?` placeholders to the dialect's native style.
   */
  readonly parameterStyle?: ParameterStyle;
}

/**
 * Single assembly point for {@link SqlVisitor} construction in the query layer (Abstract Factory).
 *
 * Replaces the former bare `new SqlVisitor()` calls in `whereCompiled`, `havingCompiled` and
 * `GlobalFilterApplier`, which silently dropped the entire {@link SqlVisitorOptions} surface —
 * value converters were ignored in WHERE/HAVING (wrong results, no error) and spatial / JSON /
 * EF.functions predicates threw. This is the Dependency-Inversion fix: the visitor's collaborators
 * flow from the composition root (dialect + metadata) instead of defaulting to nothing.
 *
 * Stateless and self-contained: `query/task-3` (the `QueryContext` value object) can fold this in
 * by moving the single `create()` call onto the context with no behavioural change.
 */
export class SqlVisitorFactory {
  public create(input: SqlVisitorFactoryInput): SqlVisitor {
    const dialectTranslators = hasVisitorSupport(input.dialect)
      ? input.dialect.getVisitorTranslators()
      : {};

    const options: SqlVisitorOptions = {
      ...dialectTranslators,
      converterResolver: input.converterResolver,
      jsonAccessRewriter: this.buildJsonAccessRewriter(input.metadata),
      complexAccessRewriter: this.buildComplexAccessRewriter(input.metadata)
      // userFunctions (ModelBuilder.hasDbFunction) live in @ts-linq/orm and are not reachable from
      // the query layer yet — tracked as follow-up tech debt (see query/task-4 notes).
    };

    return new SqlVisitor(input.parameterStyle ?? ParameterStyle.Question, options);
  }

  /**
   * Builds the JSON-access rewriter from Json-strategy owned navigations, mapping owner property
   * name → {@link JsonShape}. Returns `undefined` when the entity has no JSON-owned aggregates so
   * the visitor skips the rewrite pre-pass entirely.
   */
  private buildJsonAccessRewriter(
    metadata: EntityMetadata | undefined
  ): JsonAccessRewriter | undefined {
    const owned = metadata?.ownedEntities;
    if (!owned || owned.length === 0) return undefined;

    const jsonOwned = new Map<string, JsonShape>();
    for (const o of owned) {
      if (o.strategy === StorageStrategy.Json && o.jsonShape) {
        jsonOwned.set(o.ownerPropertyName, o.jsonShape);
      }
    }
    if (jsonOwned.size === 0) return undefined;
    return new JsonAccessRewriter(jsonOwned);
  }

  /**
   * Builds the complex-type access rewriter that flattens multi-segment complex-property paths
   * into prefixed column names. Returns `undefined` when the entity has no complex properties.
   */
  private buildComplexAccessRewriter(
    metadata: EntityMetadata | undefined
  ): ComplexAccessRewriter | undefined {
    const complex = metadata?.complexProperties;
    if (!complex || complex.length === 0) return undefined;
    return new ComplexAccessRewriter(complex);
  }
}
