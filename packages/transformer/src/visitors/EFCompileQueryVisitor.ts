/**
 * EFCompileQueryVisitor — compile-time AST rewriter for EF.compileQuery / EF.compileAsyncQuery.
 *
 * At build time (when ts-patch is configured) this visitor would replace:
 *
 *   EF.compileQuery((ctx, id) => ctx.users.where(u => u.id === id).firstOrDefault())
 *
 * with a CapturedQueryPlan factory that has the WHERE AST pre-serialised.
 *
 * Status: runtime path (CapturedQueryPlan) is the primary execution path in all
 * test environments. This visitor is reserved for future compile-time optimisation.
 *
 * @see packages/query/src/compiled/CapturedQueryPlan.ts
 * @see packages/query/src/EF.ts
 *
 * @todo TODO(P2-44): Implement the real visitor when Compiled models / AOT prep task ships.
 */
export const EFCompileQueryVisitorVersion = '1.0.0';

/** @internal placeholder type — will become a real type in P2-44 */
export type EFCompileQueryVisitorVersion = typeof EFCompileQueryVisitorVersion;
