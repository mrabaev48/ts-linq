// @internal — implementation details, not part of the stable public API.
//
// Reachable by sibling packages/tests via the opt-in `@ts-linq/orm/internal` subpath. Nothing
// here is covered by semver; depend on it at your own risk. Public consumers must use the
// `@ts-linq/orm` ("." ) entrypoint instead.
/** @internal Save-pipeline interceptors — not part of the stable public API. */
export { AuditInterceptor } from '../services/AuditInterceptor';
/** @internal Cache-invalidation coordinator driven by the save pipeline. */
export { CacheCoordinator } from '../services/CacheCoordinator';
/** @internal Pre-save change-validation service. */
export { ChangeValidationService } from '../services/ChangeValidationService';
/** @internal Soft-delete save-pipeline interceptor. */
export { SoftDeleteInterceptor } from '../services/SoftDeleteInterceptor';

/** @internal Save-changes execution collaborators (batch executor + change grouper). */
export * from '../save-changes/batch-executor';
export * from '../save-changes/batch-grouper';

/** @internal Identity resolution + interception registry. */
export * from '../IdentityMap';
export * from '../interceptors/InterceptorRegistry';

/** @internal Change-tracking collaborators (cascade traversal + JSON snapshotting). */
export { CascadeWalker } from '../changetracker/CascadeWalker';
export { JsonSnapshotter } from '../changetracker/JsonSnapshotter';

/** @internal Model-change detection probe. */
export * from '../database/has-pending-model-changes';

// Built-in value-generator implementations. The user-implemented `FetchNextHiLoBlock` type
// stays public on `@ts-linq/orm`; only the concrete classes are internal.
/** @internal Concrete Hi-Lo value generator (the `FetchNextHiLoBlock` callback type is public). */
export { HiLoValueGenerator } from '../valueGenerators/HiLoValueGenerator';
/** @internal Concrete ULID value generator. */
export { UlidValueGenerator } from '../valueGenerators/UlidValueGenerator';
/** @internal Concrete UTC-now value generator. */
export { UtcNowValueGenerator } from '../valueGenerators/UtcNowValueGenerator';
/** @internal Concrete UUIDv7 value generator. */
export { UuidV7ValueGenerator } from '../valueGenerators/UuidV7ValueGenerator';
