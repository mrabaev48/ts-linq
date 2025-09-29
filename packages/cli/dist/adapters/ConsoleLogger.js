"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
class ConsoleLogger {
    info(message) {
        // eslint-disable-next-line no-console
        console.log(message);
    }
    warn(message) {
        // eslint-disable-next-line no-console
        console.warn(message);
    }
    error(message) {
        // eslint-disable-next-line no-console
        console.error(message);
    }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=ConsoleLogger.js.map