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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class ConfigLoader {
    static async load(options = {}) {
        const configPath = this.findConfigFile(options.configPath);
        if (!configPath) {
            throw new Error('Configuration file not found. Please create ts-linq.config.ts|js|json in your project root.');
        }
        const config = await this.loadConfigFile(configPath);
        const environment = options.environment || process.env.NODE_ENV || 'development';
        // Apply environment-specific overrides
        const finalConfig = this.applyEnvironmentOverrides(config, environment);
        if (options.validate !== false) {
            this.validateConfig(finalConfig);
        }
        return finalConfig;
    }
    static findConfigFile(customPath) {
        if (customPath) {
            const resolved = (0, path_1.resolve)(process.cwd(), customPath);
            return (0, fs_1.existsSync)(resolved) ? resolved : null;
        }
        for (const path of this.DEFAULT_PATHS) {
            const resolved = (0, path_1.resolve)(process.cwd(), path);
            if ((0, fs_1.existsSync)(resolved)) {
                return resolved;
            }
        }
        return null;
    }
    static async loadConfigFile(path) {
        if (path.endsWith('.json')) {
            const content = (0, fs_1.readFileSync)(path, 'utf-8');
            return JSON.parse(content);
        }
        // For .ts/.js files, use dynamic import
        const module = await Promise.resolve(`${path}`).then(s => __importStar(require(s)));
        return module.default || module;
    }
    static applyEnvironmentOverrides(config, environment) {
        if (!config.environments || !config.environments[environment]) {
            return config;
        }
        const envOverrides = config.environments[environment];
        return this.deepMerge(config, envOverrides);
    }
    static deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
    static validateConfig(config) {
        if (!config.database) {
            throw new Error('Database configuration is required');
        }
        if (!config.database.provider) {
            throw new Error('Database provider is required');
        }
        const validProviders = ['sqlite', 'postgres', 'mysql', 'mssql'];
        if (!validProviders.includes(config.database.provider)) {
            throw new Error(`Invalid provider: ${config.database.provider}. Must be one of: ${validProviders.join(', ')}`);
        }
        if (!config.database.connection) {
            throw new Error('Database connection is required');
        }
    }
    static getDefaults() {
        return {
            migrations: {
                directory: './migrations',
                tableName: '__migrations',
                pattern: '**/*.ts',
                transactional: true
            },
            entities: {
                directory: './src/entities',
                pattern: '**/*.entity.ts'
            },
            cli: {
                migrationsDir: './migrations',
                entitiesDir: './src/entities',
                seedsDir: './seeds'
            },
            logging: {
                level: 'info',
                sql: false,
                slowQueryThreshold: 1000
            },
            cache: {
                enabled: false,
                provider: 'memory',
                ttl: 300
            }
        };
    }
}
exports.ConfigLoader = ConfigLoader;
ConfigLoader.DEFAULT_PATHS = [
    'ts-linq.config.ts',
    'ts-linq.config.js',
    'ts-linq.config.json',
    '.ts-linq.config.ts',
    '.ts-linq.config.js',
    '.ts-linq.config.json'
];
//# sourceMappingURL=ConfigLoader.js.map