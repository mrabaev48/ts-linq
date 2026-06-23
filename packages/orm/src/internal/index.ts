// @internal — implementation details, not part of the stable public API.
//
// Reachable by sibling packages/tests via the opt-in `@ts-linq/orm/internal` subpath. Nothing
// here is covered by semver; depend on it at your own risk. Public consumers must use the
// `@ts-linq/orm` ("." ) entrypoint instead.
export { AuditInterceptor } from '../services/AuditInterceptor';
export { CacheCoordinator } from '../services/CacheCoordinator';
export { ChangeValidationService } from '../services/ChangeValidationService';
export { SoftDeleteInterceptor } from '../services/SoftDeleteInterceptor';

// Save-changes execution collaborators.
export * from '../save-changes/batch-executor';
export * from '../save-changes/batch-grouper';

// Identity resolution + interception registry.
export * from '../IdentityMap';
export * from '../interceptors/InterceptorRegistry';

// Change-tracking collaborators.
export { CascadeWalker } from '../changetracker/CascadeWalker';
export { JsonSnapshotter } from '../changetracker/JsonSnapshotter';

// Model-change detection probe.
export * from '../database/has-pending-model-changes';

// Built-in value-generator implementations. The user-implemented `FetchNextHiLoBlock` type
// stays public on `@ts-linq/orm`; only the concrete classes are internal.
export { HiLoValueGenerator } from '../valueGenerators/HiLoValueGenerator';
export { UlidValueGenerator } from '../valueGenerators/UlidValueGenerator';
export { UtcNowValueGenerator } from '../valueGenerators/UtcNowValueGenerator';
export { UuidV7ValueGenerator } from '../valueGenerators/UuidV7ValueGenerator';
