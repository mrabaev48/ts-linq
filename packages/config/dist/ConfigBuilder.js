"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigBuilder = void 0;
class ConfigBuilder {
    constructor() {
        this.config = {};
    }
    database(config) {
        this.config.database = config;
        return this;
    }
    migrations(config) {
        this.config.migrations = config;
        return this;
    }
    entities(directory, pattern) {
        this.config.entities = {
            directory,
            pattern: pattern || '**/*.entity.ts'
        };
        return this;
    }
    cli(migrationsDir, entitiesDir) {
        this.config.cli = {
            migrationsDir: migrationsDir || './migrations',
            entitiesDir: entitiesDir || './src/entities'
        };
        return this;
    }
    logging(level, sql) {
        this.config.logging = {
            level: level || 'info',
            sql: sql !== undefined ? sql : false
        };
        return this;
    }
    cache(enabled, provider) {
        this.config.cache = {
            enabled,
            provider: provider || 'memory'
        };
        return this;
    }
    environment(name, overrides) {
        if (!this.config.environments) {
            this.config.environments = {};
        }
        this.config.environments[name] = overrides;
        return this;
    }
    build() {
        if (!this.config.database) {
            throw new Error('Database configuration is required');
        }
        return this.config;
    }
    // Helper methods for common configurations
    static sqlite(database) {
        return new ConfigBuilder().database({
            provider: 'sqlite',
            connection: database
        });
    }
    static postgres(connection) {
        return new ConfigBuilder().database({
            provider: 'postgres',
            connection
        });
    }
    static mysql(connection) {
        return new ConfigBuilder().database({
            provider: 'mysql',
            connection
        });
    }
    static mssql(connection) {
        return new ConfigBuilder().database({
            provider: 'mssql',
            connection
        });
    }
}
exports.ConfigBuilder = ConfigBuilder;
//# sourceMappingURL=ConfigBuilder.js.map