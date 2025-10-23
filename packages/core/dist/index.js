"use strict";
/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
 */
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
// Core types
__exportStar(require("./types"), exports);
// Removed duplicate: export * from './types/Logger'; (already exported via './types')
// Decorators
__exportStar(require("./decorators/Entity"), exports);
// Removed duplicate: export * from './decorators/Column'; (ColumnOptions already exported via './types')
__exportStar(require("./decorators/PrimaryKey"), exports);
// Removed duplicate: export * from './decorators/Relationships'; (RelationshipOptions already exported via './types')
__exportStar(require("./decorators/ValidIf"), exports);
__exportStar(require("./decorators/CachePolicy"), exports);
// Metadata - moved to @ts-linq/metadata package
// Import from: @ts-linq/metadata
// Change tracking - moved to @ts-linq/orm package  
// Import from: @ts-linq/orm
// Context and DbSet - moved to @ts-linq/orm package
// Import from: @ts-linq/orm
// Query building - moved to @ts-linq/query package
// Import from: @ts-linq/query
// Base provider abstractions
__exportStar(require("./DatabaseProvider"), exports);
__exportStar(require("./DdlStrategy"), exports);
__exportStar(require("./DdlBuilder"), exports);
// Loading
__exportStar(require("./loading/LoadingStrategy"), exports);
__exportStar(require("./loading/EntityLoader"), exports);
__exportStar(require("./loading/LazyLoadingProxy"), exports);
// Migrations - moved to @ts-linq/migrations package
// Import from: @ts-linq/migrations
// Utils
__exportStar(require("./utils/SqlHelper"), exports);
__exportStar(require("./utils/RetryPolicies"), exports);
__exportStar(require("./utils/EntityCache"), exports);
// export * from './utils/InternalLogger'; // Removed
__exportStar(require("./utils/PrometheusEndpoint"), exports);
//# sourceMappingURL=index.js.map