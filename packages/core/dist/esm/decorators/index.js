import 'reflect-metadata';
import { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export { IndexOptionsBuilder } from '../utils/IndexOptionsBuilder';
export {
  ValidIf,
  ValidIfOf,
  RequiredIfOf,
  MinLengthOf,
  MaxLengthOf,
  PatternOf,
  RangeOf
} from './ValidIf';
function isStage3ClassContext(x) {
  return !!x && typeof x === 'object';
}
export function normalizeIndexOptions(input) {
  const built =
    input instanceof IndexOptionsBuilder
      ? input.build()
      : {
          name: input.name,
          columns: input.columns,
          unique: input.unique ?? false,
          where: input.where,
          orders: input.orders,
          expressions: input.expressions,
          collations: input.collations,
          nulls: input.nulls,
          using: input.using,
          concurrently: input.concurrently,
          withParams: input.withParams,
          mysqlVisibility: input.mysqlVisibility,
          include: input.include
        };
  return built;
}
export function Index(options) {
  return function IndexDecorator(_target, context) {
    if (context.kind !== 'class') {
      throw new Error('@Index requires TS5 Stage-3 decorators');
    }
    context.addInitializer?.(function () {
      const ctor = this;
      if (!ctor) return;
      const meta = normalizeIndexOptions(options);
      const existing = Reflect.getOwnMetadata('orm:indexes', ctor) || [];
      existing.push(meta);
      Reflect.defineMetadata('orm:indexes', existing, ctor);
    });
  };
}
// no re-exports from here
//# sourceMappingURL=index.js.map
