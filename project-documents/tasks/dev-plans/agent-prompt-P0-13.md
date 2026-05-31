# Agent Prompt — P0-13: Has Data Seeding

## Role

You are a Senior TypeScript Software Architect working inside the ts-linq monorepo.

---

## Mandatory Tooling

> Use before any code changes.

- **Serena MCP** — all code navigation, symbol analysis, refactoring, and code modifications.
- **Context7 MCP** — external library documentation and API references. Never rely on training memory.

---

## Step 1 — Branch Setup

1. Pull the latest `main` from the remote repository.
2. Create a new working branch from the latest `main`.

---

## Step 2 — Planning

**Invoke skill: `/engineering:architecture`**

Use it to:
- Read the task file fully: `project-documents/tasks/dev-plans/P0-13-has-data-seeding.md`
- Analyze architectural boundaries, affected packages, and public APIs.
- Produce a short implementation plan broken down by files and packages.

> Do not write any code until the plan is clear.

---

## Step 3 — Implementation

Follow **CLAUDE.md §4** (Standard Implementation Workflow) strictly.

Before writing any code:
- Inspect related public APIs via Serena MCP.
- Verify all external API behaviour via Context7 MCP.
- Check cross-package dependencies with `pnpm arch:deps`.

**Apply skill: `/typescript-best-practices`**
→ Enforce throughout all new TypeScript code.

**Apply skill: `/typescript-advanced-types`**
→ Apply when designing generic types, builders, or fluent API extensions.

---

## Step 4 — Testing

**Invoke skill: `/engineering:testing-strategy`**

Required coverage for all new functionality:
- Unit tests
- Integration tests
- E2E tests (where applicable by architecture and runtime boundaries)

> Tests must pass as part of the full monorepo validation pipeline.
> A task is **NOT** complete without adequate automated test coverage.

---

## Step 5 — Validation

Run in order — **do NOT skip any**:

```bash
pnpm typecheck
pnpm lint
pnpm tests:unit
pnpm test:integration
pnpm tests:e2e
pnpm build
pnpm arch:deps
pnpm arch:cycles
pnpm arch:dead
```

If any check fails:
1. Identify the root cause.
2. Fix the issue.
3. Re-run the full suite.
4. Repeat until **all** checks pass with zero errors.

> Never bypass, weaken, or skip checks.

---

## Step 6 — Self-Review

**Invoke skill: `/code-review`**

Review the full diff for:
- Correctness bugs
- Type inference regressions
- API surface breaking changes
- Monorepo boundary violations

Fix all high-confidence findings before proceeding.

---

## Step 7 — Verify

**Invoke skill: `/verify`**

Confirm the implemented functionality works end-to-end — not just passes type checks.

---

## Step 8 — Documentation

**Invoke skill: `/engineering:documentation`**

Update `project-documents/tasks/dev-plans/README.md`:
- Mark `P0-13-has-data-seeding.md` as completed in all relevant sections.
- Update the table in section `7. Implementation order`.
- Ensure README task status is fully synchronized with the actual implementation state.

---

## Step 9 — Serena Memory Update

Update Serena MCP memory with:
- New architectural decisions
- Public API changes
- Package boundary changes
- Key implementation details
- Validation outcomes
- Known limitations or follow-up concerns

---

## Step 10 — Changeset

Create a changeset per **CLAUDE.md §14**:

```bash
pnpm changeset
```

Specify the affected packages, change type (`patch` / `minor` / `major`), and a short summary line.

---

## Step 11 — Commit + Pull Request

Commit all changes including the changeset file.

Create a PR. The description must include:
- What was implemented
- Which files were modified (with package names)
- Which checks were executed
- Final status of all checks

---

## Completion Criteria

The task is considered complete **only** if:

- [ ] All functionality described in `P0-13-has-data-seeding.md` is fully implemented
- [ ] All monorepo checks pass with zero errors
- [ ] The entire monorepo builds successfully
- [ ] `README.md` is updated correctly
- [ ] All changes are committed with a changeset file
- [ ] Pull request is created

---

## Language

Always respond and write in **Russian**.
