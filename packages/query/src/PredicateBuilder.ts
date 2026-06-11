import type { ExpressionNode, PropertyNode } from '@ts-linq/ast';
import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnResolver, ConverterResolver, SqlVisitor } from '@ts-linq/sql-visitor';
import type { SqlParameter, WhereClause } from '@ts-linq/types';

import type { QueryBuilder } from './QueryBuilder';
import type { QueryModel } from './QueryModel';
import type { SqlVisitorFactory } from './SqlVisitorFactory';

/** A built WHERE clause plus the fragment to append to the chain's count-cache signature. */
export interface BuiltPredicate {
  clause: WhereClause;
  signature: string;
}

/** A compiled HAVING expression (no signature — HAVING is not part of the count-cache key). */
export interface CompiledExpression {
  condition: string;
  parameters: readonly SqlParameter[];
}

/** Compiled-predicate input emitted by the build-time transformer. */
export interface CompiledPredicateInput {
  readonly ast: ExpressionNode;
  readonly parameters: readonly unknown[];
}

/**
 * Owns predicate (`where*` / `having`) clause construction and the SQL-visitor / column-resolver
 * plumbing it depends on. Centralizing the visitor wiring here keeps converters/options threaded
 * end-to-end (refactor query/task-4) in one place rather than duplicated across the facade.
 *
 * Stateless — constructed once per `Queryable` from immutable deps (entity, provider, visitor
 * factory) and shared by reference across clones.
 */
export class PredicateBuilder<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly visitorFactory: SqlVisitorFactory
  ) {}

  /** Resolve a TypeScript property name to its database column name via entity metadata. */
  resolveColumnName(propName: string): string {
    const meta = MetadataStorage.getEntity(this.entityClass);
    return meta?.columns.find((c) => c.propertyName === propName)?.columnName ?? propName;
  }

  /**
   * Builds a ColumnResolver that maps TypeScript property names to SQL column names using entity
   * metadata. Falls back to the property name when no mapping is found. For multi-segment paths
   * (`u.profile.city`), only the last segment is resolved; prefix segments are left as-is.
   */
  buildColumnResolver(): ColumnResolver | undefined {
    const metadata = MetadataStorage.getEntity(this.entityClass);
    if (!metadata || metadata.columns.length === 0) return undefined;

    return (node: PropertyNode): string => {
      const lastSegment = node.name ?? node.path?.[node.path.length - 1];
      const col =
        lastSegment !== undefined
          ? metadata.columns.find((c) => c.propertyName === lastSegment)
          : undefined;
      const resolvedName = col?.columnName ?? lastSegment;

      if (node.name !== undefined) {
        return resolvedName ?? node.name;
      }
      if (node.path !== undefined && node.path.length > 0) {
        if (resolvedName === undefined) return node.path.join('.');
        return [...node.path.slice(0, -1), resolvedName].join('.');
      }
      return '';
    };
  }

  /**
   * Builds a ConverterResolver that maps a TypeScript property name to its registered
   * ValueConverter (via `HasConversion`). Without this, value converters are silently ignored in
   * WHERE/HAVING predicates. Returns `undefined` when the entity registers no converters.
   */
  buildConverterResolver(): ConverterResolver | undefined {
    const metadata = MetadataStorage.getEntity(this.entityClass);
    if (!metadata || metadata.columns.length === 0) return undefined;
    const hasConverter = metadata.columns.some((c) => c.converter !== undefined);
    if (!hasConverter) return undefined;

    return (propertyName: string) =>
      metadata.columns.find((c) => c.propertyName === propertyName)?.converter;
  }

  /** Assembles a fully-configured SqlVisitor (dialect translators + metadata converters/rewriters). */
  createSqlVisitor(): SqlVisitor {
    return this.visitorFactory.create({
      metadata: MetadataStorage.getEntity(this.entityClass),
      dialect: this.provider.getDialect(),
      converterResolver: this.buildConverterResolver()
    });
  }

  /** Build a WHERE predicate from a compiled AST (transformer output). */
  whereCompiled(input: CompiledPredicateInput): BuiltPredicate {
    const visitor = this.createSqlVisitor();
    const { condition, parameters } = visitor.toSql(
      input.ast,
      input.parameters,
      this.buildColumnResolver()
    );
    return this.toBuiltPredicate({ condition, parameters });
  }

  /** Compile a HAVING expression from a compiled AST (transformer output). */
  compileHaving(input: CompiledPredicateInput): CompiledExpression {
    const visitor = this.createSqlVisitor();
    const { condition, parameters } = visitor.toSql(
      input.ast,
      input.parameters,
      this.buildColumnResolver()
    );
    return { condition, parameters };
  }

  /** Build an `EXISTS (subquery)` predicate. */
  whereExists(
    subBuilder: QueryBuilder,
    subModel: QueryModel,
    subEntity: new () => unknown
  ): BuiltPredicate {
    const { query, parameters } = subBuilder.generateFromModel(subEntity, subModel);
    return this.toBuiltPredicate({
      condition: `EXISTS (${this.normalizeSplicedSubquerySql(query)})`,
      parameters
    });
  }

  /** Build a `<column> IN (subquery)` predicate; the column is resolved + quoted via the dialect. */
  whereInSubquery(
    column: string,
    subBuilder: QueryBuilder,
    subModel: QueryModel,
    subEntity: new () => unknown
  ): BuiltPredicate {
    const { query, parameters } = subBuilder.generateFromModel(subEntity, subModel);
    const quotedColumn = this.provider.getDialect().quoteIdentifier(this.resolveColumnName(column));
    return this.toBuiltPredicate({
      condition: `${quotedColumn} IN (${this.normalizeSplicedSubquerySql(query)})`,
      parameters
    });
  }

  /** Build a `<column> IN (v1, v2, …)` predicate. An empty value list compiles to `1 = 0`. */
  whereIn(column: string, values: ReadonlyArray<unknown>): BuiltPredicate {
    if (!values || values.length === 0) {
      // IN (empty) matches nothing; ensure we return empty set via condition "1 = 0".
      return { clause: { condition: '1 = 0', parameters: [] }, signature: '|1=0:[]' };
    }

    // Resolve column name from metadata (if available) or use property name
    const metadata = MetadataStorage.getEntity(this.entityClass);
    const dbColumn = metadata
      ? metadata.columns.find((c) => c.propertyName === column || c.columnName === column)
          ?.columnName || column
      : column;

    const quotedCol = this.provider.getDialect().quoteIdentifier(dbColumn);

    const clause: WhereClause = {
      condition: `${quotedCol} IN (${values.map(() => '?').join(', ')})`,
      parameters: values as unknown as SqlParameter[]
    };

    const sigParams = values.length > 5 ? `[${values.length} values]` : JSON.stringify(values);
    return { clause, signature: `|${column}IN:${sigParams}` };
  }

  private toBuiltPredicate(clause: WhereClause): BuiltPredicate {
    return {
      clause,
      signature: `|${clause.condition}:${JSON.stringify(clause.parameters)}`
    };
  }

  /**
   * Reset a spliced subquery's placeholders back to positional `?`. The subquery is rendered by its
   * own dialect pass (which may have numbered placeholders `$1`/`@p1`); normalizing to `?` lets the
   * single outer renumber assign consistent indices. Values are always parameterized, so no literal
   * can contain a `$N`/`@pN` token.
   */
  private normalizeSplicedSubquerySql(sql: string): string {
    return sql.replace(/@p\d+|\$\d+/g, '?');
  }
}
