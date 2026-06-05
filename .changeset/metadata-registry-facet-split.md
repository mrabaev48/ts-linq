---
"@ts-linq/metadata": patch
---

Internal restructure of `MetadataRegistry` (behaviour-preserving, no public API change). The
duplicated "finalized-vs-builder" branch across ~27 mutators is collapsed into a single
`EntityMetadataState.mutate` Template Method, index dedup/unknown-column validation is unified into
one `validateIndex` helper used by both states, and the mutators are grouped into cohesive internal
facet stores composed behind the unchanged `MetadataRegistry` facade.
