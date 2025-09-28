'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Column = Column;
require('reflect-metadata');
const MetadataStorage_1 = require('../metadata/MetadataStorage');
function isStage3FieldContext(x) {
  return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
/**
 * Stage-3 property decorator that registers column metadata.
 * If type is omitted and design:type is unavailable, defaults to TEXT.
 */
function Column(options = {}) {
  return function ColumnDecorator(_targetOrValue, propOrContext) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@Column requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function () {
      const ctor = this?.constructor;
      if (!ctor) return;
      const designType = Reflect.getMetadata('design:type', ctor.prototype, name);
      const columnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || getTypeString(designType),
        nullable: options?.nullable !== false,
        defaultValue: options?.defaultValue,
        length: options?.length,
        precision: options?.precision,
        scale: options?.scale,
        isGenerated: options?.generated || false,
        isVersion: options?.version || false
      };
      MetadataStorage_1.MetadataStorage.addColumn(ctor, columnMetadata);
      const existing = Reflect.getOwnMetadata('orm:columns', ctor) || [];
      existing.push(columnMetadata);
      Reflect.defineMetadata('orm:columns', existing, ctor);
    });
  };
}
function getTypeString(type) {
  if (!type || !type.name) return 'TEXT';
  switch (type.name) {
    case 'String':
      return 'TEXT';
    case 'Number':
      return 'INTEGER';
    case 'Boolean':
      return 'BOOLEAN';
    case 'Date':
      return 'DATETIME';
    case 'Array':
      return 'TEXT';
    case 'Object':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}
//# sourceMappingURL=Column.js.map
