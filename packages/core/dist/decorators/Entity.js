'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Entity = Entity;
require('reflect-metadata');
const MetadataStorage_1 = require('../metadata/MetadataStorage');
function isStage3ClassContext(x) {
  return !!x && typeof x === 'object' && x.kind === 'class';
}
/**
 * Class decorator that registers a class as a database entity (table).
 * Supports TS5 Stage-3 decorators and legacy decorators.
 */
function Entity(options = {}) {
  return function (target, context) {
    const tableName = options?.name || target.name;
    // TS5 Stage-3 path only
    if (isStage3ClassContext(context)) {
      // Persist table name via reflect so metadata survives storage.clear()
      try {
        Reflect.defineMetadata?.('orm:tableName', tableName, target);
      } catch {
        /* ignore */
      }
      // Register entity immediately
      MetadataStorage_1.MetadataStorage.addEntity(target, tableName);
      context.addInitializer?.(function () {
        const ctor = target;
        // Ensure entity exists after possible MetadataStorage.clear() calls between module eval and first instantiation
        const existing = MetadataStorage_1.MetadataStorage.getEntity(ctor);
        if (!existing) {
          MetadataStorage_1.MetadataStorage.addEntity(ctor, tableName);
        }
        // Sync any reflect-stored columns/primaryKeys/relationships into MetadataStorage
        try {
          const cols = Reflect.getOwnMetadata('orm:columns', ctor) || [];
          for (const col of cols) {
            MetadataStorage_1.MetadataStorage.addColumn(ctor, col);
          }
          const pks = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
          for (const pk of pks) {
            MetadataStorage_1.MetadataStorage.addPrimaryKey(ctor, pk);
          }
          const rels = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
          for (const rel of rels) {
            const te = rel.targetEntity;
            const resolvedTarget = typeof te === 'function' && te.prototype ? te : te();
            MetadataStorage_1.MetadataStorage.addRelationship(ctor, {
              ...rel,
              targetEntity: resolvedTarget
            });
          }
          const idxs = Reflect.getOwnMetadata('orm:indexes', ctor) || [];
          for (const idx of idxs) {
            MetadataStorage_1.MetadataStorage.addIndex(ctor, idx);
          }
        } catch {
          /* ignore */
        }
      });
      return;
    }
    // If not Stage-3, fail fast per project policy
    throw new Error('@Entity requires TS5 Stage-3 decorators');
  };
}
//# sourceMappingURL=Entity.js.map
