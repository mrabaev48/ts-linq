"use strict";
// Pure type definitions and interfaces - NO imports from other packages
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ForeignKeyConstraintError = exports.UniqueConstraintError = exports.OptimisticConcurrencyError = exports.DatabaseError = exports.LoadingStrategy = void 0;
exports.ok = ok;
exports.err = err;
function ok(value) {
    return { success: true, value };
}
function err(error) {
    return { success: false, error };
}
// Loading strategy enum
var LoadingStrategy;
(function (LoadingStrategy) {
    LoadingStrategy["Lazy"] = "lazy";
    LoadingStrategy["Eager"] = "eager";
    LoadingStrategy["Explicit"] = "explicit";
})(LoadingStrategy || (exports.LoadingStrategy = LoadingStrategy = {}));
// Export error classes
var errors_1 = require("./errors");
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return errors_1.DatabaseError; } });
Object.defineProperty(exports, "OptimisticConcurrencyError", { enumerable: true, get: function () { return errors_1.OptimisticConcurrencyError; } });
Object.defineProperty(exports, "UniqueConstraintError", { enumerable: true, get: function () { return errors_1.UniqueConstraintError; } });
Object.defineProperty(exports, "ForeignKeyConstraintError", { enumerable: true, get: function () { return errors_1.ForeignKeyConstraintError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
//# sourceMappingURL=index.js.map