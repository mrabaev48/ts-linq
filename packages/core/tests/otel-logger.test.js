"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const open_telemetry_sql_logger_1 = require("open-telemetry-sql-logger");
describe('OpenTelemetrySqlLogger', () => {
    it('does not throw when @opentelemetry/api is not installed', () => {
        const logger = new open_telemetry_sql_logger_1.OpenTelemetrySqlLogger('test');
        expect(() => logger.queryStart({ sql: 'SELECT 1', params: [] })).not.toThrow();
        expect(() => logger.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 1 })).not.toThrow();
    });
});
//# sourceMappingURL=otel-logger.test.js.map