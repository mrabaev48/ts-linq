'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.IncludePlanner = void 0;
const LoadingStrategy_1 = require('../loading/LoadingStrategy');
class IncludePlanner {
  constructor(entityLoader, entityClass) {
    this.entityLoader = entityLoader;
    this.entityClass = entityClass;
  }
  async populateIncludes(entities, includes, limit) {
    if (!this.entityLoader || includes.length === 0 || limit === 1) return;
    await this.entityLoader.populateRelationshipsMany(entities, this.entityClass, {
      strategy: LoadingStrategy_1.LoadingStrategy.Eager,
      includes,
      depth: 1
    });
  }
}
exports.IncludePlanner = IncludePlanner;
//# sourceMappingURL=IncludePlanner.js.map
