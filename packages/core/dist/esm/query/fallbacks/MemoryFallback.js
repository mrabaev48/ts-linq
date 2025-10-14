export class MemoryFallback {
    constructor(dataProvider) {
        this.label = 'memory';
        this.dataProvider = dataProvider;
    }
    async fetch(_request) {
        const data = await this.dataProvider();
        return data ?? [];
    }
}
//# sourceMappingURL=MemoryFallback.js.map