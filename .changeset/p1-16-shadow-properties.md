---
'@ts-linq/types': minor
'@ts-linq/metadata': minor
'@ts-linq/orm': minor
'@ts-linq/query': minor
'@ts-linq/migrations': patch
---

feat(P1-16): shadow properties — declare DB columns without entity class fields

- ShadowPropertyMetadata interface added to @ts-linq/types
- EntityMetadata extended with optional shadowProperties: Map<string, ShadowPropertyMetadata>
- ColumnMetadata extended with optional isShadow flag
- EntityTypeBuilder: property<T>(name: string) overload registers shadow properties
- MetadataRegistry.addShadowProperty() and EntityMetadataBuilder.addShadowProperty()
- ChangeTracker: _shadowValues WeakMap for per-entity shadow value storage
- ChangeTracker: getShadowValue / setShadowValue / getShadowValues public API
- ChangeTracker.detectChanges() marks entity Modified when shadow values change
- PropertyEntry<TValue> class with currentValue getter/setter
- EntityEntry.property<T>(name) returns PropertyEntry backed by ChangeTracker
- DbContext.entry<T>(entity) public method returning a fully-initialized EntityEntry
- DbContext.normalizeChange() merges shadow values into entity record before INSERT/UPDATE
- EF.property<TValue>(entity, name) compile-time marker for LINQ shadow column access
- SchemaSnapshot.buildExpectedFromMetadata() includes shadow columns in DDL output
