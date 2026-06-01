import type {
  AlternateKeyMetadata,
  CheckConstraintMetadata,
  ColumnMetadata,
  ComplexTypePropertyMetadata,
  EntityMetadata,
  HierarchyMetadata,
  IndexMetadata,
  OwnedEntityMetadata,
  QueryFilterMetadata,
  RelationshipMetadata,
  ShadowPropertyMetadata,
  SkipNavigationMetadata,
  TableFragmentMetadata,
  ValidationRule
} from '@ts-linq/types';

/**
 * Builder for incrementally constructing `EntityMetadata` while decorators
 * are being applied. The built metadata describes table name, columns,
 * primary keys, relationships, and indexes for an entity class.
 */
export class EntityMetadataBuilder {
  private metadata: Partial<EntityMetadata> & {
    ownedEntities?: OwnedEntityMetadata[];
    hierarchy?: HierarchyMetadata;
    hierarchyRoot?: Function;
    skipNavigations?: SkipNavigationMetadata[];
    queryFilters?: QueryFilterMetadata[];
    seedData?: Record<string, unknown>[];
    checkConstraints?: CheckConstraintMetadata[];
    comment?: string;
    shadowProperties?: Map<string, ShadowPropertyMetadata>;
    tableFragments?: TableFragmentMetadata[];
    isKeyless?: boolean;
    viewName?: string;
    viewSql?: string;
    alternateKeys?: AlternateKeyMetadata[];
    complexProperties?: ComplexTypePropertyMetadata[];
  };

  /**
   * Create a metadata builder for a specific entity constructor.
   * @param target Entity constructor function.
   */
  constructor(target: Function) {
    this.metadata = {
      target,
      tableName: target.name, // Default to class name, can be overridden by setTableName
      columns: [],
      primaryKeys: [],
      relationships: [],
      indexes: [],
      validations: []
    };
  }

  /**
   * Override the table name stored in metadata.
   */
  public setTableName(name: string): this {
    this.metadata.tableName = name;
    return this;
  }

  /**
   * Add a column definition to the entity.
   */
  public addColumn(column: ColumnMetadata): this {
    this.metadata.columns = this.metadata.columns || [];
    this.metadata.columns.push(column);
    return this;
  }

  /**
   * Add a primary key property name if not already present.
   */
  public addPrimaryKey(propertyName: string): this {
    this.metadata.primaryKeys = this.metadata.primaryKeys || [];
    if (!this.metadata.primaryKeys.includes(propertyName)) {
      this.metadata.primaryKeys.push(propertyName);
    }
    return this;
  }

  /**
   * Add a relationship definition to the entity.
   */
  public addRelationship(relationship: RelationshipMetadata): this {
    this.metadata.relationships = this.metadata.relationships || [];
    this.metadata.relationships.push(relationship);
    return this;
  }

  /**
   * Add an index definition to the entity.
   */
  public addIndex(index: IndexMetadata): this {
    this.metadata.indexes = this.metadata.indexes || [];
    this.metadata.indexes.push(index);
    return this;
  }

  /**
   * Add an alternate key definition to the entity.
   * Replaces existing entry with the same name.
   */
  public addAlternateKey(ak: AlternateKeyMetadata): this {
    this.metadata.alternateKeys = this.metadata.alternateKeys || [];
    const idx = this.metadata.alternateKeys.findIndex((k) => k.name === ak.name);
    if (idx >= 0) {
      this.metadata.alternateKeys[idx] = ak;
    } else {
      this.metadata.alternateKeys.push(ak);
    }
    return this;
  }

  /**
   * Add a validation rule to the entity.
   */
  public addValidationRule(rule: ValidationRule): this {
    this.metadata.validations = this.metadata.validations || [];
    this.metadata.validations.push(rule);
    return this;
  }

  /** Replace all primary keys (fluent HasKey wins over decorators). */
  public setPrimaryKeys(keys: string[]): this {
    this.metadata.primaryKeys = [...keys];
    return this;
  }

  /** Merge a fluent column: replace existing by propertyName, or append. */
  public mergeColumn(column: ColumnMetadata): this {
    this.metadata.columns = this.metadata.columns || [];
    const idx = this.metadata.columns.findIndex((c) => c.propertyName === column.propertyName);
    if (idx >= 0) {
      this.metadata.columns[idx] = { ...this.metadata.columns[idx], ...column };
    } else {
      this.metadata.columns.push(column);
    }
    return this;
  }

  /** Merge a fluent relationship: replace existing by propertyName, or append. */
  public mergeRelationship(relationship: RelationshipMetadata): this {
    this.metadata.relationships = this.metadata.relationships || [];
    const idx = this.metadata.relationships.findIndex(
      (r) => r.propertyName === relationship.propertyName
    );
    if (idx >= 0) {
      this.metadata.relationships[idx] = { ...this.metadata.relationships[idx], ...relationship };
    } else {
      this.metadata.relationships.push(relationship);
    }
    return this;
  }

  /** Merge a fluent index: replace existing by name, or append. */
  public mergeIndex(index: IndexMetadata): this {
    this.metadata.indexes = this.metadata.indexes || [];
    const idx = this.metadata.indexes.findIndex((i) => i.name === index.name);
    if (idx >= 0) {
      this.metadata.indexes[idx] = { ...this.metadata.indexes[idx], ...index };
    } else {
      this.metadata.indexes.push(index);
    }
    return this;
  }

  /** Set the schema for this entity. */
  public setSchema(schema: string): this {
    this.metadata.schema = schema;
    return this;
  }

  /** Mark this entity as mapped to a SQL Server system-versioned (temporal) table. */
  public setTemporal(isTemporalTable: boolean): this {
    this.metadata.isTemporal = isTemporalTable;
    return this;
  }

  /** Set the name of the associated history table (default: `tableName + 'History'`). */
  public setHistoryTableName(name: string): this {
    this.metadata.historyTableName = name;
    return this;
  }

  public addComplexProperty(complex: ComplexTypePropertyMetadata): this {
    this.metadata.complexProperties = this.metadata.complexProperties ?? [];
    this.metadata.complexProperties.push(complex);
    return this;
  }

  public addOwnedEntity(owned: OwnedEntityMetadata): this {
    this.metadata.ownedEntities = this.metadata.ownedEntities || [];
    this.metadata.ownedEntities.push(owned);
    return this;
  }

  public setHierarchy(h: HierarchyMetadata): this {
    this.metadata.hierarchy = h;
    return this;
  }

  public setHierarchyRoot(root: Function): this {
    this.metadata.hierarchyRoot = root;
    return this;
  }

  public addQueryFilter(filter: QueryFilterMetadata): this {
    this.metadata.queryFilters = this.metadata.queryFilters ?? [];
    const idx = this.metadata.queryFilters.findIndex((f) => f.name === filter.name);
    if (idx >= 0) {
      this.metadata.queryFilters[idx] = filter;
    } else {
      this.metadata.queryFilters.push(filter);
    }
    return this;
  }

  public setSeedData(rows: Record<string, unknown>[]): this {
    this.metadata.seedData = rows;
    return this;
  }

  public setCheckConstraints(constraints: CheckConstraintMetadata[]): this {
    this.metadata.checkConstraints = constraints;
    return this;
  }

  public setEntityComment(comment: string): this {
    this.metadata.comment = comment;
    return this;
  }

  public addShadowProperty(prop: ShadowPropertyMetadata): this {
    if (!this.metadata.shadowProperties) {
      this.metadata.shadowProperties = new Map();
    }
    this.metadata.shadowProperties.set(prop.propertyName, prop);
    return this;
  }

  public setTableFragments(fragments: TableFragmentMetadata[]): this {
    this.metadata.tableFragments = [...fragments];
    return this;
  }

  /** Mark entity as keyless — no PK, never tracked (P1-26). */
  public setIsKeyless(value: boolean): this {
    this.metadata.isKeyless = value;
    return this;
  }

  /** Set the database view name this entity maps to (P1-26). */
  public setViewName(name: string): this {
    this.metadata.viewName = name;
    return this;
  }

  /** Set optional CREATE VIEW DDL to be emitted by migrations (P1-26). */
  public setViewSql(sql: string): this {
    this.metadata.viewSql = sql;
    return this;
  }

  public addSkipNavigation(nav: SkipNavigationMetadata): this {
    this.metadata.skipNavigations = this.metadata.skipNavigations ?? [];
    const idx = this.metadata.skipNavigations.findIndex(
      (sn) => sn.propertyName === nav.propertyName
    );
    if (idx >= 0) {
      this.metadata.skipNavigations[idx] = nav;
    } else {
      this.metadata.skipNavigations.push(nav);
    }
    return this;
  }

  /**
   * Finalize and return the constructed `EntityMetadata` object.
   */
  public build(): EntityMetadata {
    if (!this.metadata.target) {
      throw new Error('Entity target is required');
    }

    return {
      target: this.metadata.target,
      tableName: this.metadata.tableName || this.metadata.target.name,
      columns: this.metadata.columns || [],
      primaryKeys: this.metadata.primaryKeys || [],
      relationships: this.metadata.relationships || [],
      indexes: this.metadata.indexes || [],
      validations: this.metadata.validations || [],
      ...(this.metadata.schema !== undefined ? { schema: this.metadata.schema } : {}),
      ...(this.metadata.isTemporal !== undefined ? { isTemporal: this.metadata.isTemporal } : {}),
      ...(this.metadata.historyTableName !== undefined
        ? { historyTableName: this.metadata.historyTableName }
        : {}),
      ...(this.metadata.ownedEntities !== undefined && this.metadata.ownedEntities.length > 0
        ? { ownedEntities: this.metadata.ownedEntities }
        : {}),
      ...(this.metadata.hierarchy !== undefined ? { hierarchy: this.metadata.hierarchy } : {}),
      ...(this.metadata.hierarchyRoot !== undefined
        ? { hierarchyRoot: this.metadata.hierarchyRoot }
        : {}),
      ...(this.metadata.skipNavigations !== undefined && this.metadata.skipNavigations.length > 0
        ? { skipNavigations: this.metadata.skipNavigations }
        : {}),
      ...(this.metadata.queryFilters !== undefined && this.metadata.queryFilters.length > 0
        ? { queryFilters: this.metadata.queryFilters }
        : {}),
      ...(this.metadata.seedData !== undefined && this.metadata.seedData.length > 0
        ? { seedData: this.metadata.seedData }
        : {}),
      ...(this.metadata.checkConstraints !== undefined && this.metadata.checkConstraints.length > 0
        ? { checkConstraints: this.metadata.checkConstraints }
        : {}),
      ...(this.metadata.comment !== undefined ? { comment: this.metadata.comment } : {}),
      ...(this.metadata.shadowProperties !== undefined && this.metadata.shadowProperties.size > 0
        ? { shadowProperties: this.metadata.shadowProperties }
        : {}),
      ...(this.metadata.tableFragments !== undefined && this.metadata.tableFragments.length > 0
        ? { tableFragments: this.metadata.tableFragments }
        : {}),
      ...(this.metadata.isKeyless !== undefined ? { isKeyless: this.metadata.isKeyless } : {}),
      ...(this.metadata.viewName !== undefined ? { viewName: this.metadata.viewName } : {}),
      ...(this.metadata.viewSql !== undefined ? { viewSql: this.metadata.viewSql } : {}),
      ...(this.metadata.alternateKeys !== undefined && this.metadata.alternateKeys.length > 0
        ? { alternateKeys: this.metadata.alternateKeys }
        : {}),
      ...(this.metadata.complexProperties !== undefined &&
      this.metadata.complexProperties.length > 0
        ? { complexProperties: this.metadata.complexProperties }
        : {})
    };
  }
}
