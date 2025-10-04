"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteIndexBuilder = exports.SQLiteDdlStrategy = exports.SQLiteDialect = void 0;
var SQLiteDialect_1 = require("./query/SQLiteDialect");
Object.defineProperty(exports, "SQLiteDialect", { enumerable: true, get: function () { return SQLiteDialect_1.SQLiteDialect; } });
var SQLiteDdlStrategy_1 = require("./providers/sqlite/SQLiteDdlStrategy");
Object.defineProperty(exports, "SQLiteDdlStrategy", { enumerable: true, get: function () { return SQLiteDdlStrategy_1.SQLiteDdlStrategy; } });
var SQLiteIndexBuilder_1 = require("./providers/sqlite/builders/SQLiteIndexBuilder");
Object.defineProperty(exports, "SQLiteIndexBuilder", { enumerable: true, get: function () { return SQLiteIndexBuilder_1.SQLiteIndexBuilder; } });
__exportStar(require("./providers/sqlite/emitters"), exports);
//# sourceMappingURL=index.js.map