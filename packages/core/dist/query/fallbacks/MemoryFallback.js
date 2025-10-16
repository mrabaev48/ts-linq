"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryFallback = void 0;
class MemoryFallback {
    constructor(dataProvider) {
        this.label = 'memory';
        this.dataProvider = dataProvider;
    }
    async fetch(_request) {
        const data = await this.dataProvider();
        return data ?? [];
    }
}
exports.MemoryFallback = MemoryFallback;
//# sourceMappingURL=MemoryFallback.js.map