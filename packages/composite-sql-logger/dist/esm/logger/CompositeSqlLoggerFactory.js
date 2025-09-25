import { CompositeSqlLogger } from './CompositeSqlLogger';
export class CompositeSqlLoggerFactory {
    constructor(options = {}) {
        this.factories = options.factories ?? [];
        this.statics = options.loggers ?? [];
    }
    create(provider) {
        const delegates = [];
        for (const f of this.factories) {
            try {
                const l = f?.create(provider);
                if (l)
                    delegates.push(l);
            }
            catch { /* ignore */ }
        }
        for (const s of this.statics)
            if (s)
                delegates.push(s);
        if (delegates.length === 0)
            return undefined;
        return new CompositeSqlLogger(...delegates);
    }
}
//# sourceMappingURL=CompositeSqlLoggerFactory.js.map