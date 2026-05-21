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
 * test environments. This visitor is reserved for future compile-time optimisation
 * (P2-44 Compiled models / AOT prep).
 *
 * @see packages/query/src/compiled/CapturedQueryPlan.ts
 * @see packages/query/src/EF.ts
 */
export const EFCompileQueryVisitorVersion = '1.0.0';
