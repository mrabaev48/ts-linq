---
'@ts-linq/types': minor
'@ts-linq/metadata': minor
---

Introduce the `MetadataSource` (read) and `MetadataSink` (write) ports for entity metadata.

- `@ts-linq/types` now exports two new interfaces: `MetadataSource` (read-only:
  `getEntity`, `getEntities`, `getValidationRules`, `getOwnedEntities`,
  `getStoredProcedureMapping`) and `MetadataSink` (the full registration/write surface).
  They apply Ports-and-Adapters + Interface Segregation so consumers depend on an
  abstraction instead of the `MetadataStorage` global singleton or the concrete
  `MetadataRegistry`.
- `@ts-linq/metadata`'s `MetadataRegistry` now `implements MetadataSource, MetadataSink`
  (no behaviour change — signatures mirror the existing methods), and both ports are
  re-exported from the package entrypoint. `MetadataStorage`'s static API and decorator
  registration are unchanged and fully backward compatible; it is now documented as the
  default-source provider only.

Additive and backward compatible. Prerequisite for the core loader dependency-injection
refactor (`core/task-2`).
