"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLazyProxy = exports.getLazyTarget = exports.awaitLazyLoad = exports.LAZY_LOADING_TARGET = exports.LAZY_LOADING_STATE = exports.LAZY_LOADING_PROVIDER = exports.LAZY_LOADING_PROXY = exports.LazyLoadingProxy = exports.EntityLoader = exports.LoadingStrategy = void 0;
var types_1 = require("@ts-linq/core/dist/types");
Object.defineProperty(exports, "LoadingStrategy", { enumerable: true, get: function () { return types_1.LoadingStrategy; } });
var EntityLoader_1 = require("@ts-linq/core/dist/loading/EntityLoader");
Object.defineProperty(exports, "EntityLoader", { enumerable: true, get: function () { return EntityLoader_1.EntityLoader; } });
var LazyLoadingProxy_1 = require("@ts-linq/core/dist/loading/LazyLoadingProxy");
Object.defineProperty(exports, "LazyLoadingProxy", { enumerable: true, get: function () { return LazyLoadingProxy_1.LazyLoadingProxy; } });
Object.defineProperty(exports, "LAZY_LOADING_PROXY", { enumerable: true, get: function () { return LazyLoadingProxy_1.LAZY_LOADING_PROXY; } });
Object.defineProperty(exports, "LAZY_LOADING_PROVIDER", { enumerable: true, get: function () { return LazyLoadingProxy_1.LAZY_LOADING_PROVIDER; } });
Object.defineProperty(exports, "LAZY_LOADING_STATE", { enumerable: true, get: function () { return LazyLoadingProxy_1.LAZY_LOADING_STATE; } });
Object.defineProperty(exports, "LAZY_LOADING_TARGET", { enumerable: true, get: function () { return LazyLoadingProxy_1.LAZY_LOADING_TARGET; } });
Object.defineProperty(exports, "awaitLazyLoad", { enumerable: true, get: function () { return LazyLoadingProxy_1.awaitLazyLoad; } });
Object.defineProperty(exports, "getLazyTarget", { enumerable: true, get: function () { return LazyLoadingProxy_1.getLazyTarget; } });
Object.defineProperty(exports, "isLazyProxy", { enumerable: true, get: function () { return LazyLoadingProxy_1.isLazyProxy; } });
//# sourceMappingURL=index.js.map