/**
 * Type-level tests for the parameter-state collaborator contract of
 * `@ts-linq/sql-visitor`.
 *
 * These guard the Required Collaborator invariant of the unified visitor contract:
 * every node visitor receives the shared `ParameterState` through `VisitContext.state`,
 * which is a *required* field. Omitting it must be a compile error so a stray visitor
 * can never silently create a fresh counter and mis-number positional placeholders
 * ($1, $1 instead of $1, $2).
 *
 * Run with `tsd` (build first so the package `.d.ts` exists):
 *   `pnpm -F @ts-linq/sql-visitor test-d`  or repo-wide `pnpm test-d`.
 * Negative assertions use `tsd`'s `expectError` / `expectNotAssignable` — no `any`,
 * casts, or suppression comments.
 */
import type { BinaryNode } from '@ts-linq/ast';
import { expectAssignable, expectError, expectNotAssignable } from 'tsd';

import {
  BinaryVisitor,
  type ConditionFragment,
  ParameterState,
  ParameterStyle,
  type VisitContext
} from '..';

declare const node: BinaryNode;
const recurse = (): ConditionFragment => ({ condition: '', parameters: [] });
const state = new ParameterState(ParameterStyle.Question);

// A fully-formed context (carrying the required shared `state`) is a valid VisitContext.
expectAssignable<VisitContext>({
  inputParameters: [],
  state,
  recurse
});

// `state` is load-bearing: a context literal without it is NOT a VisitContext.
expectNotAssignable<VisitContext>({
  inputParameters: [],
  recurse
});

// A visitor cannot be invoked with a context that is missing the shared `state`.
expectError(new BinaryVisitor().visit(node, { inputParameters: [], recurse }));

// The visitor takes a single VisitContext — the former positional signature
// (inputParameters, recurse, resolver, state) no longer type-checks.
expectError(new BinaryVisitor().visit(node, [], recurse, undefined, state));
