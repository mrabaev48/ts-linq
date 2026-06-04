// ORM metadata model — ColumnMetadata, EntityMetadata and the full entity description system

import type {
  DeleteBehavior,
  InheritanceStrategy,
  StorageStrategy,
  ValueGeneratedPolicy
} from './enums';
import type { QueryFilterMetadata } from './query-filters';
import type { EntityStoredProcedureMapping } from './stored-procedure';
import type {
  ColumnType,
  ValueComparerLike,
  ValueConverterLike,
  ValueGeneratorClass
} from './value-conversion';

/**
 * Constructor of an entity class.
 *
 * Accepts both `abstract` and concrete classes via an abstract construct signature.
 * A plain `function` or arrow function is NOT assignable to a construct signature,
 * so this makes non-constructor entity targets unrepresentable at compile time —
 * unlike the opaque `Function`, which accepts any callable.
 */
export type EntityCtor = abstract new (...args: unknown[]) => object;

/**
 * A reference to an entity class: either the constructor itself, or a lazy thunk
 * returning it. The thunk form (`() => Target`) resolves declaration-order cycles
 * in relationship decorators (e.g. `@ManyToOne(() => Post)`).
 */
export type EntityRef = EntityCtor | (() => EntityCtor);

// Entity metadata types
export interface ColumnOptions {
  name?: string;
  type?: string;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  primaryKey?: boolean;
}

export interface RelationshipOptions {
  targetEntity: () => EntityCtor;
  inverseSide?: string;
  cascade?: boolean;
}

export interface ColumnMetadata {
  propertyName: string;
  columnName: string;
  type: ColumnType;
  nullable?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  default?: unknown;
  defaultValue?: unknown;
  defaultExpression?: string;
  defaultExpressionDialect?: Record<string, string | undefined>;
  computedExpression?: string;
  computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED';
  comment?: string;
  length?: number;
  precision?: number;
  scale?: number;
  generated?: boolean;
  isGenerated?: boolean;
  isComputed?: boolean;
  version?: boolean;
  isVersion?: boolean;
  isConcurrencyToken?: boolean;
  converter?: ValueConverterLike;
  comparer?: ValueComparerLike;
  /** True if this column is a shadow property — no field on the entity class (P1-16). */
  isShadow?: boolean;
  /** Value generation policy for this column (P1-30). */
  valueGeneratedPolicy?: ValueGeneratedPolicy;
  /** Sentinel value: if the current property value equals this, the client-side generator runs (P1-30). */
  sentinel?: unknown;
  /** Client-side value generator class (P1-30). Instantiated per-call. */
  valueGeneratorClass?: ValueGeneratorClass;
  /** Backing field name for this property (P1-32). E.g. `_total` for a `total` property. */
  fieldName?: string;
  /** Property access mode controlling how the ORM reads/writes this property (P1-32). */
  accessMode?: string;
  /** Name of a database sequence used for this column via useSequence() (P1-21). */
  sequenceName?: string;
  /** Schema of the sequence used for this column (P1-21). */
  sequenceSchema?: string;
  /** HiLo block size: reserves this many IDs per round-trip (P1-21). Default 10. */
  hiLoBlockSize?: number;
  /**
   * Pre-built property accessor resolved at model-build time (P1-32).
   * Opaque at the types layer — typed as `unknown` to avoid a dependency on @ts-linq/metadata.
   * Cast to `PropertyAccessor` in packages that import @ts-linq/metadata.
   */
  accessor?: unknown;
}

export interface RelationshipMetadata {
  propertyName: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
  targetEntity: string | EntityRef | undefined;
  foreignKey?: string;
  inverseSide?: string;
  cascade?: boolean;
  through?: string | object;
  onDelete?: DeleteBehavior;
  nullable?: boolean;
}

// ─── Check Constraint ─────────────────────────────────────────────────────────

export interface CheckConstraintMetadata {
  name: string;
  sql: string;
}

export interface IndexMetadata {
  name: string;
  columns: string[];
  unique?: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  expressions?: string[];
  collations?: { [column: string]: string };
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
  using?: string;
  concurrently?: boolean;
  withParams?: Record<string, unknown>;
  mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
  include?: string[];
  /** Per-column descending flags (mirrors EF Core's IsDescending). Index matches columns[]. */
  isDescending?: boolean[];
}

/** Describes an alternate (non-PK) unique key — a named UNIQUE constraint usable as FK target. */
export interface AlternateKeyMetadata {
  /** Constraint name, e.g. "AK_User_email". */
  name: string;
  /** Property names that form this alternate key. */
  columns: string[];
}

export interface ValidationRule {
  propertyName?: string;
  validator?: (value: unknown, entity: unknown) => boolean;
  message?: string;
  predicate?: (value: unknown) => boolean;
  phase?: 'onCreate' | 'onUpdate' | 'always';
  messageKey?: string;
  messageParams?: Record<string, unknown>;
}

export interface DiscriminatorEntry {
  ctor: EntityCtor;
  value: unknown;
}

export interface DiscriminatorMetadata {
  columnName: string;
  columnType: string;
  entries: DiscriminatorEntry[];
  isComplete: boolean;
}

export interface HierarchyMetadata {
  strategy: InheritanceStrategy;
  rootEntity: EntityCtor;
  discriminator?: DiscriminatorMetadata;
  subtypes: EntityCtor[];
}

/**
 * Describes a single node in the JSON shape tree.
 * A leaf node has no children; an aggregate node has children mapping property names to sub-nodes.
 */
export interface JsonShapeNode {
  children?: Map<string, JsonShapeNode>;
  isArray?: boolean;
  converter?: ValueConverterLike;
}

/**
 * Describes the complete shape of a JSON-stored owned aggregate.
 * Used by the SQL visitor rewriter, hydrator, and change tracker.
 */
export interface JsonShape {
  /** Physical column name on the owner table. */
  columnName: string;
  /** Top-level property names of the aggregate mapped to their shape nodes. */
  properties: Map<string, JsonShapeNode>;
}

export interface OwnedEntityMetadata {
  ownerPropertyName: string;
  ownedType: EntityCtor;
  strategy: StorageStrategy;
  columnPrefix?: string;
  jsonColumnName?: string;
  /** Full shape descriptor for Json-strategy owned aggregates. */
  jsonShape?: JsonShape;
  foreignKeyColumns?: string[];
  principalKeyColumns?: string[];
  compositeKeyColumns?: string[];
  isCollection: boolean;
  /** Nested owned navigations when strategy === Json (stored inside JSON, not as separate rows). */
  nestedOwned?: OwnedEntityMetadata[];
}

/**
 * Metadata for a complex type property (P1-17).
 * A complex type is a value-object with no identity, no DbSet, and no ChangeTracker entry.
 * Columns are flattened into the owner table with a prefix (e.g. shippingAddress_street).
 */
export interface ComplexTypePropertyMetadata {
  /** Property name on the owner entity (e.g. "shippingAddress"). */
  propertyName: string;
  /** Column name prefix. Defaults to "<propertyName>_". */
  columnPrefix: string;
  /** Whether the complex property is required (non-nullable). Defaults to true, mirroring EF Core. */
  isRequired: boolean;
  /** Leaf column overrides configured via ComplexTypeBuilder.property(). */
  properties: ColumnMetadata[];
  /** Recursively nested complex types within this complex type. */
  nested: ComplexTypePropertyMetadata[];
}

export interface SkipNavigationMetadata {
  /** Property name on the owning entity (e.g. "tags" on Post). */
  propertyName: string;
  /** Constructor of the related entity (e.g. Tag). */
  targetEntity: EntityCtor;
  /** Name of the join table (e.g. "PostTag"). */
  joinTableName: string;
  /** Synthetic or explicit join entity constructor registered in MetadataRegistry. */
  joinEntityCtor: EntityCtor;
  /** FK column on the join table pointing back to the owning entity (e.g. "postId"). */
  leftForeignKey: string;
  /** FK column on the join table pointing to the related entity (e.g. "tagId"). */
  rightForeignKey: string;
  /** Property name of the inverse navigation on the related entity (e.g. "posts" on Tag). */
  inverseSide?: string;
  /** True when the join entity was auto-synthesised (no explicit UsingEntity call). */
  isSynthesized: boolean;
}

/** Describes a single physical table fragment for entity splitting (P1-25). */
export interface TableFragmentMetadata {
  tableName: string;
  schema?: string;
  /** Property names mapped to this fragment. Undefined means "all remaining properties". */
  properties?: string[];
}

export interface EntityMetadata {
  target?: EntityCtor;
  className?: string;
  tableName: string;
  columns: ColumnMetadata[];
  relationships: RelationshipMetadata[];
  indexes: IndexMetadata[];
  validationRules?: ValidationRule[];
  validations?: ValidationRule[];
  primaryKeys?: string[];
  primaryKeyColumn?: string;
  schema?: string;
  /** Whether this entity maps to a SQL Server system-versioned (temporal) table. */
  isTemporal?: boolean;
  /** Custom history table name (default: `tableName + 'History'`). */
  historyTableName?: string;
  ownedEntities?: OwnedEntityMetadata[];
  /** Hierarchy metadata — present on the root entity of a TPH/TPT/TPC hierarchy. */
  hierarchy?: HierarchyMetadata;
  /** Points to the root entity constructor — present on every subtype in a hierarchy. */
  hierarchyRoot?: EntityCtor;
  /** Skip navigation metadata for many-to-many relationships (P0-08). */
  skipNavigations?: SkipNavigationMetadata[];
  /** Named model-level query filters (P0-11). Auto-appended to every SELECT. */
  queryFilters?: QueryFilterMetadata[];
  /** Seed rows declared via hasData() (P0-13). Keyed by property names. */
  seedData?: Record<string, unknown>[];
  /** CHECK constraints declared via hasCheckConstraint() (P0-14). */
  checkConstraints?: CheckConstraintMetadata[];
  /** Table-level comment declared via hasComment() (P0-14). */
  comment?: string;
  /** Shadow properties — exist in DB but have no field on the entity class (P1-16). */
  shadowProperties?: Map<string, ShadowPropertyMetadata>;
  /** Additional table fragments for entity splitting (P1-25). Length > 0 means entity splitting is active. */
  tableFragments?: TableFragmentMetadata[];
  /** Whether this entity is keyless — no PK, never tracked, mutations forbidden (P1-26). */
  isKeyless?: boolean;
  /** Maps this entity to a database view instead of a table (P1-26). */
  viewName?: string;
  /** Optional CREATE VIEW DDL supplied via hasViewSql() (P1-26). Emitted by migrations if present. */
  viewSql?: string;
  /** Alternate (non-PK) unique keys declared via hasAlternateKey() (P1-31). */
  alternateKeys?: AlternateKeyMetadata[];
  /** Complex type properties (P1-17): value-objects flattened into the owner table. */
  complexProperties?: ComplexTypePropertyMetadata[];
}

/** Metadata for a shadow property (P1-16): a DB column with no corresponding entity field. */
export interface ShadowPropertyMetadata {
  propertyName: string;
  columnName: string;
  type: ColumnType;
  nullable?: boolean;
  defaultValue?: unknown;
  defaultExpression?: string;
  comment?: string;
  length?: number;
  precision?: number;
  scale?: number;
}

/** Minimal interface for attaching entities to a change tracker. Used by Queryable to avoid circular deps. */
export interface EntityAttacher {
  attach(entity: object, entityClass: Function): void;
}

/**
 * Read-only port for retrieving entity metadata (Ports-and-Adapters / ISP).
 *
 * This is the abstraction consumers depend on instead of the process-wide
 * `MetadataStorage` singleton or the concrete `MetadataRegistry`. The default
 * registry implements it; a tenant-specific registry, a compiled model, or an
 * in-memory fake can be substituted without touching consumer code.
 *
 * Method signatures intentionally mirror `MetadataRegistry` exactly (including
 * the `Function` entity-target parameter) to keep behaviour and call-site
 * compatibility unchanged.
 *
 * @see MetadataSink for the corresponding write port.
 */
export interface MetadataSource {
  /** Resolve finalized metadata for an entity class, or `undefined` if unknown. */
  getEntity(target: Function): EntityMetadata | undefined;
  /** Return all registered entities, finalizing any pending builders. */
  getEntities(): EntityMetadata[];
  /** Return the validation rules declared on an entity (empty if none). */
  getValidationRules(target: Function): ValidationRule[];
  /** Return the owned-entity relationships declared on an owner (empty if none). */
  getOwnedEntities(owner: Function): OwnedEntityMetadata[];
  /** Return the stored-procedure CUD mapping for an entity, if configured. */
  getStoredProcedureMapping(target: Function): EntityStoredProcedureMapping | undefined;
}

/**
 * Write port for registering entity metadata (Ports-and-Adapters / ISP).
 *
 * Segregated from {@link MetadataSource} so read-only consumers (e.g. the
 * loading layer) never gain access to mutation. Implemented by
 * `MetadataRegistry`; the surface mirrors the decorator/fluent registration API
 * driven through the `MetadataStorage` facade at module load.
 *
 * Method signatures intentionally mirror `MetadataRegistry` exactly.
 */
export interface MetadataSink {
  addEntity(target: Function, tableName?: string): void;
  addColumn(target: Function, column: ColumnMetadata): void;
  addPrimaryKey(target: Function, propertyName: string): void;
  addRelationship(target: Function, relationship: RelationshipMetadata): void;
  addIndex(target: Function, index: IndexMetadata): void;
  addValidationRule(target: Function, rule: ValidationRule): void;

  mergeFluentColumn(target: Function, column: ColumnMetadata): void;
  setFluentPrimaryKeys(target: Function, keys: string[]): void;
  mergeFluentRelationship(target: Function, relationship: RelationshipMetadata): void;
  mergeFluentIndex(target: Function, index: IndexMetadata): void;
  mergeFluentAlternateKey(target: Function, ak: AlternateKeyMetadata): void;
  mergeFluentSchema(target: Function, schema: string): void;
  mergeFluentTemporal(target: Function, isTemporal: boolean, historyTableName?: string): void;
  mergeFluentSkipNavigation(target: Function, nav: SkipNavigationMetadata): void;
  mergeFluentQueryFilter(target: Function, filter: QueryFilterMetadata): void;
  mergeFluentTableFragments(target: Function, fragments: TableFragmentMetadata[]): void;
  setFluentKeyless(target: Function, value: boolean): void;
  setFluentViewName(target: Function, name: string): void;
  setFluentViewSql(target: Function, sql: string): void;

  addComplexProperty(owner: Function, complex: ComplexTypePropertyMetadata): void;
  addOwnedEntity(owner: Function, owned: OwnedEntityMetadata): void;
  addShadowProperty(target: Function, prop: ShadowPropertyMetadata): void;

  setHierarchyMetadata(target: Function, h: HierarchyMetadata): void;
  setHierarchyRoot(subtype: Function, root: Function): void;
  setSeedData(target: Function, rows: Record<string, unknown>[]): void;
  setCheckConstraints(target: Function, constraints: CheckConstraintMetadata[]): void;
  setEntityComment(target: Function, comment: string): void;
  setStoredProcedureMapping(target: Function, mapping: EntityStoredProcedureMapping): void;

  /** Clear all stored metadata and pending builders. */
  clear(): void;
}
