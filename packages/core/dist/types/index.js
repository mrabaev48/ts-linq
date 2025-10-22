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
exports.MetadataStorage = exports.EntityState = void 0;
// Re-export types from @ts-linq/types and @ts-linq/metadata for backwards compatibility
__exportStar(require("@ts-linq/types"), exports);
/**
 * Core-specific types that don't belong in @ts-linq/types
 */
/** Entity state for change tracking */
var EntityState;
(function (EntityState) {
    EntityState["Unchanged"] = "unchanged";
    EntityState["Added"] = "added";
    EntityState["Modified"] = "modified";
    EntityState["Deleted"] = "deleted";
})(EntityState || (exports.EntityState = EntityState = {}));
// Re-export metadata types for backwards compatibility  
var metadata_1 = require("@ts-linq/metadata");
Object.defineProperty(exports, "MetadataStorage", { enumerable: true, get: function () { return metadata_1.MetadataStorage; } });
//# sourceMappingURL=index.js.map