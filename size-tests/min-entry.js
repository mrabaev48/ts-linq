import { DbContext } from '../packages/core/dist/esm/context/DbContext.js';
import { QueryBuilder } from '../packages/core/dist/esm/query/QueryBuilder.js';
import '../packages/core/dist/esm/decorators/Entity.js';

export function makeCtx() {
  return new DbContext({ provider: 'postgresql' });
}

export function qb() {
  return new QueryBuilder();
}
