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
exports.MigrationsValidateCommand = void 0;
const path = __importStar(require("path"));
const ConsoleLogger_1 = require("../adapters/ConsoleLogger");
const NodeFs_1 = require("../adapters/NodeFs");
const config_1 = require("../config");
class MigrationsValidateCommand {
    constructor(logger = new ConsoleLogger_1.ConsoleLogger(), fsAdapter = new NodeFs_1.NodeFs()) {
        this.logger = logger;
        this.fsAdapter = fsAdapter;
        this.name = 'migration:validate';
        this.describe = 'Validates migrations: name format, duplicates, order, presence of up/down';
        this.aliases = ['migrations:validate'];
    }
    run(_argv) {
        const migrationsDir = this.resolveMigrationsDir();
        if (!this.fsAdapter.exists(migrationsDir)) {
            this.logger.warn?.(`Migrations directory not found: ${migrationsDir}`);
            process.exitCode = 2;
            return Promise.resolve();
        }
        const files = this.readMigrationFiles(migrationsDir);
        const errors = [];
        const parsed = this.parseFilenames(files, errors);
        this.detectDuplicates(parsed, errors);
        this.checkOrder(parsed, errors);
        this.ensureTsSupport(parsed);
        this.validateExports(parsed, errors);
        this.report(errors);
        return Promise.resolve();
    }
    resolveMigrationsDir() {
        const cfg = ((0, config_1.tryLoadConfig)(process.cwd()) || {});
        return path.resolve(process.cwd(), cfg.migrations || 'migrations');
    }
    readMigrationFiles(dir) {
        return this.fsAdapter
            .readDir(dir)
            .filter((f) => /(\.ts|\.js|\.mjs|\.cjs)$/.test(f))
            .map((f) => ({ file: f, abs: path.join(dir, f) }));
    }
    parseFilenames(files, errors) {
        const versionRe = /^(\d{14})_([A-Za-z0-9_]+)\.(?:ts|js|mjs|cjs)$/;
        return files
            .map(({ file, abs }) => {
            const m = versionRe.exec(file);
            if (!m) {
                errors.push(`Invalid migration filename: ${file}`);
                return null;
            }
            return { file, abs, version: m[1], name: m[2] };
        })
            .filter((x) => !!x);
    }
    detectDuplicates(parsed, errors) {
        const seen = new Set();
        for (const p of parsed) {
            if (seen.has(p.version))
                errors.push(`Duplicate version: ${p.version}`);
            seen.add(p.version);
        }
    }
    checkOrder(parsed, errors) {
        const versionsSorted = [...parsed].sort((a, b) => a.version.localeCompare(b.version));
        const filesSorted = [...parsed].sort((a, b) => a.file.localeCompare(b.file));
        for (let i = 0; i < versionsSorted.length; i++) {
            if (versionsSorted[i].file !== filesSorted[i].file) {
                errors.push('Migrations are not ordered by version consistently with filenames');
                break;
            }
        }
    }
    ensureTsSupport(parsed) {
        if (!parsed.some((p) => p.file.endsWith('.ts')))
            return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('ts-node/register/transpile-only');
        }
        catch {
            // ignore
        }
    }
    validateExports(parsed, errors) {
        for (const p of parsed) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require(p.abs);
                const keys = Object.keys(mod || {});
                if (keys.length === 0) {
                    errors.push(`No exports found in ${p.file}`);
                    continue;
                }
                const exported = mod[keys[0]];
                if (!exported || typeof exported !== 'function') {
                    errors.push(`Invalid export in ${p.file}: expected class`);
                    continue;
                }
                const Ctor = exported;
                const inst = new Ctor();
                if (typeof inst.up !== 'function' || typeof inst.down !== 'function') {
                    errors.push(`Migration ${p.file} must implement up() and down()`);
                }
                if (typeof inst.getVersion !== 'function' || typeof inst.getName !== 'function') {
                    errors.push(`Migration ${p.file} must implement getVersion() and getName()`);
                }
                if (typeof inst.getVersion === 'function') {
                    const v = inst.getVersion();
                    if (v !== p.version)
                        errors.push(`Version mismatch in ${p.file}: ${v} != ${p.version}`);
                }
            }
            catch (e) {
                errors.push(`Failed to load ${p.file}: ${e.message}`);
            }
        }
    }
    report(errors) {
        if (errors.length > 0) {
            this.logger.error('Migration validation failed:');
            for (const e of errors)
                this.logger.error(`  - ${e}`);
            process.exitCode = 1;
            return;
        }
        this.logger.info('Migrations validation: OK');
        process.exitCode = 0;
    }
}
exports.MigrationsValidateCommand = MigrationsValidateCommand;
//# sourceMappingURL=MigrationsValidateCommand.js.map