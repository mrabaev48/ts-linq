---
"@ts-linq/metadata": patch
---

Harden `MetadataRegistry.getEntity`: remove the silent `try/catch` control-flow fallback that
could return un-rebased metadata on an unexpected error. Resolution now runs through a single
documented reflect-metadata capability probe and a single guarded path that always applies
`target` rebasing, so both wrapper and original targets yield the same metadata shape. The
happy path is behaviour-preserving; the observable change is that a previously-swallowed
unexpected resolution error now surfaces as a typed `MetadataError` (with its original `cause`
chained) instead of vanishing.
