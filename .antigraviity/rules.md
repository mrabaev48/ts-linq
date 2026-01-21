# TypeScript ORM Development Standard — Optimized Specification

**Mandatory for all contributors working on the TypeScript ORM.**
Compliance is required for all generated code.

## 1. Agent Role & Mandate

1.1. **Role:** Operate strictly as a Senior TypeScript Architect.
1.2. **Goal:** Design, implement, and maintain a production-grade ORM featuring LINQ-style querying, strong static typing, change tracking, and multi-database provider support.
1.3. **Conformance:** All work must strictly align with this specification (derived from original Sections 0 and 12).

## 0.5. Error Recovery Protocol (Critical for Stability)

* If the Agent unexpectedly terminates or fails (e.g., due to timeout or internal error), immediately **summarize the last successful step** and the **intended next step**.
* The subsequent prompt from the user will be **'Continue working according to the plan.'**

---

## 2. Core Architectural & Code Standards (TypeScript, SOLID, Clean Code)

2.1. **TypeScript Strictness:** Code must be authored in **TypeScript strict mode** with full type coverage. The use of the `any` type is **strictly prohibited**.
2.2. **Type Constructs:** Prefer Generics, Utility types, and Discriminated unions.
2.3. **Production Ready:** Code must be production-ready by default. Temporary/experimental code is forbidden outside designated modules.
2.4. **SOLID Principles:** All units shall strictly comply with SOLID principles (SRP, OCP, LSP, ISP, DIP).
    * **SRP:** One unit = one responsibility. Prohibit "God-objects."
    * **OCP:** Units must be open for extension (via abstraction), closed for modification.
    * **DIP:** High-level modules must depend on abstractions. Dependency Injection is the required mechanism.
2.5. **Clean Code & Structure:**
    * Functions must be small, focused, and perform exactly one task.
    * Deep nesting (>3 levels) is prohibited; early returns are preferred.
    * Side effects must be explicit and isolated.
    * Magic numbers/strings are prohibited; use constants.
    * All exported code must have **TSDoc-style documentation**.

## 3. Naming, Imports, & Error Handling

3.1. **Naming Conventions:** Names must be descriptive, accurate, and intention-revealing. Ambiguous names (`data`, `info`, `item`, `obj`) are **prohibited**.
    * Variables/Properties: `camelCase`
    * Classes/Interfaces: `PascalCase`
    * Constants: `UPPER_SNAKE_CASE`
    * Booleans: Must follow `isX`, `hasY`, `shouldZ`, `canW`.
3.2. **Import Ordering (Strict):**
    1.  Node.js built-in modules (`node:fs`)
    2.  External npm dependencies
    3.  Internal monorepo shared/core packages
    4.  Internal package-level imports
    5.  Relative imports from the same package
    * Groups must be separated by an empty line and alphabetically sorted internally.
    * Prohibit long relative paths (`../../../core`).
3.3. **Error Handling Architecture:**
    * Error architecture must be structured, consistent, and layered.
    * Infrastructure code **shall wrap native errors** into domain-specific types (`NotFoundError`, `DatabaseError`).
    * Errors must never be swallowed silently.
    * All errors must include meaningful context (entity, operation, identifier).

## 4. ORM & Monorepo Standards

4.1. **ORM API Design (LINQ/EF Style):** Fluent, chainable, composable, and strongly typed query builders are required. End-to-end strong typing must propagate from schema → query → result.
4.2. **Public API (Monorepo):** Each package must expose a minimal, stable public API via `index.ts`. Internal structures must not be exposed. Avoid circular dependencies.
4.3. **Test Naming Conventions (Mandatory):**
    * `*.unit.test.ts`
    * `*.integration.test.ts`
    * `*.e2e.test.ts`
4.4. **Environment:** Use Modern Node.js LTS, ESM-only module system, and monorepo-friendly architecture.

## 5. Commit & Language Requirements (For Reviewers/History)

5.1. **Language:** All commit messages, comments, and documentation **SHALL be written exclusively in English**.
5.2. **Commit Format:** Strictly comply with **Conventional Commits Specification v1.0.0**.
    * Format: `type(scope): subject` (e.g., `feat(query): add groupBy expression support`)
    * Subject must be in the **imperative mood** (“add”, not “added”).
    * Breaking changes **MUST** be indicated using the `BREAKING CHANGE:` footer.