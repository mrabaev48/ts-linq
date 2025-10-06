'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BatchPlan = void 0;
class BatchPlan {
  planChunks(items, chunkSize) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
exports.BatchPlan = BatchPlan;
//# sourceMappingURL=BatchPlan.js.map
