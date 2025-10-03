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
exports.MigrationsRollbackCommand = void 0;
const path = __importStar(require("path"));
const core_1 = require("@ts-linq/core");
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
const config_1 = require("../config");
class MigrationsRollbackCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.name = 'migration:rollback';
        this.describe = 'Откатить последние миграции (--steps=N) или до версии (--to=YYYYMMDDHHmmss)';
        this.aliases = ['migrations:rollback'];
    }
    async runDb(provider, argv) {
        const { steps, toVersion } = this.parseArgs(argv);
        const migrationsDir = this.resolveMigrationsDir();
        const runner = new core_1.MigrationRunner(provider);
        const applied = await runner.getAppliedMigrations();
        const modules = await this.loadAllMigrations(migrationsDir);
        for (const mod of modules)
            this.registerModuleMigrations(mod, runner);
        const targetVersion = this.computeTargetVersion(applied, steps, toVersion);
        this.logRollbackTarget(steps, targetVersion);
        await runner.rollback(targetVersion);
        this.logger.info('Rollback completed');
    }
    parseArgs(argv) {
        const stepsArg = argv.find((a) => a.startsWith('--steps='));
        const toArg = argv.find((a) => a.startsWith('--to='));
        const steps = stepsArg ? parseInt(stepsArg.split('=')[1] || '0', 10) : 0;
        const toVersion = toArg ? toArg.split('=')[1] : undefined;
        return { steps, toVersion };
    }
    resolveMigrationsDir() {
        const cfg = ((0, config_1.tryLoadConfig)(process.cwd()) || {});
        return path.resolve(process.cwd(), cfg.migrations || 'migrations');
    }
    loadAllMigrations(dir) {
        if (!this.fsAdapter.exists(dir))
            return Promise.resolve([]);
        const files = this.fsAdapter
            .readDir(dir)
            .filter((f) => /\.(ts|js|mjs|cjs)$/.test(f))
            .map((f) => path.join(dir, f));
        if (files.some((f) => f.endsWith('.ts')))
            this.tryRegisterTsNode();
        const mods = [];
        for (const file of files)
            mods.push(this.requireModule(file));
        return Promise.resolve(mods);
    }
    tryRegisterTsNode() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('ts-node/register/transpile-only');
        }
        catch {
            // ignore if not available
        }
    }
    requireModule(file) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(file);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerModuleMigrations(mod, runner) {
        for (const key of Object.keys(mod)) {
            const exported = mod[key];
            if (!exported || typeof exported !== 'function')
                continue;
            const proto = exported.prototype || {};
            const hasUp = Object.prototype.hasOwnProperty.call(proto, 'up');
            const hasDown = Object.prototype.hasOwnProperty.call(proto, 'down');
            if (!hasUp || !hasDown)
                continue;
            try {
                const Ctor = exported;
                const instance = new Ctor();
                if (typeof instance.getVersion === 'function') {
                    runner.addMigration(instance);
                }
            }
            catch {
                // ignore non-constructible exports
            }
        }
    }
    computeTargetVersion(applied, steps, toVersion) {
        if (toVersion)
            return toVersion;
        if (steps <= 0)
            return undefined;
        const sorted = [...applied].sort((a, b) => a.version.localeCompare(b.version));
        const keepCount = Math.max(sorted.length - steps, 0);
        return keepCount > 0 ? sorted[keepCount - 1].version : undefined;
    }
    logRollbackTarget(steps, targetVersion) {
        if (targetVersion) {
            this.logger.info(`Rolling back to version ${targetVersion}...`);
            return;
        }
        if (steps > 0) {
            this.logger.info(`Rolling back ${steps} step(s)...`);
            return;
        }
        this.logger.info('Rolling back all applied migrations...');
    }
}
exports.MigrationsRollbackCommand = MigrationsRollbackCommand;
//# sourceMappingURL=MigrationsRollbackCommand.js.map