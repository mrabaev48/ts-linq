"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPgPool = createPgPool;
let Pg;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Pg = require('pg');
}
catch {
    Pg = undefined;
}
function createPgPool(connectionString) {
    if (!Pg)
        throw new Error('pg module is not installed');
    const { Pool } = Pg;
    return new Pool({ connectionString });
}
//# sourceMappingURL=PoolAdapter.js.map