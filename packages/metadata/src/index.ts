export * from './builtins/BoolToZeroOneConverter';
export * from './builtins/DateOnlyToStringConverter';
export * from './builtins/EnumToNumberConverter';
export * from './builtins/EnumToStringConverter';
export * from './Column';
export {
  CompiledModelHydrationError,
  CompiledModelVersionError,
  loadCompiledModel
} from './compiled-model-hydrator';
export type {
  CompiledAlternateKeyModel,
  CompiledEntityModel,
  CompiledHierarchyModel,
  CompiledModel,
  CompiledOwnedEntityModel,
  CompiledShadowPropertyModel,
  CompiledSkipNavigationModel
} from './CompiledModel';
export * from './Entity';
export * from './EntityMetadata';
export * from './MetadataRegistry';
export * from './MetadataStorage';
export * from './PendingMetadataCollector';
export * from './PrimaryKey';
export * from './PropertyAccessMode';
export * from './PropertyAccessor';
export { reflectGetOwnMetadata } from './reflectUtils';
export * from './Relationships';
export * from './resolveEntityRef';
export * from './SequenceRegistry';
export * from './stored-procedure-mapping';
export * from './ValidIf';
export * from './ValueComparer';
export * from './ValueConverter';
export * from './ViewMetadata';
export {
  type ComplexTypePropertyMetadata,
  DeleteBehavior,
  type DiscriminatorEntry,
  type DiscriminatorMetadata,
  type HierarchyMetadata,
  InheritanceStrategy,
  type MetadataSink,
  type MetadataSource,
  type OwnedEntityMetadata,
  type SkipNavigationMetadata,
  StorageStrategy,
  type ValueComparerLike,
  type ValueConverterLike,
  ValueGeneratedPolicy,
  type ValueGenerator,
  type ValueGeneratorClass,
  type ValueGeneratorContext
} from '@ts-linq/types';

import { MetadataRegistry } from './MetadataRegistry';

/** Creates a new, empty `MetadataRegistry` instance. Use for test isolation or multi-tenant setups. */
export function createMetadataRegistry(): MetadataRegistry {
  return new MetadataRegistry();
}
