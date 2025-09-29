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
exports.tryLoadConfig = tryLoadConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function tryLoadConfig(cwd) {
    const candidates = [
        'ts-linq.config.ts',
        'ts-linq.config.cjs',
        'ts-linq.config.js',
        'ts-linq.config.json'
    ];
    for (const name of candidates) {
        const p = path.resolve(cwd, name);
        if (!fs.existsSync(p))
            continue;
        try {
            if (name.endsWith('.json'))
                return JSON.parse(fs.readFileSync(p, 'utf8'));
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require(p);
            return (mod && (mod.default || mod));
        }
        catch (e) {
            console.error(`Failed to load config ${name}:`, e.message);
            return undefined;
        }
    }
    return undefined;
}
//# sourceMappingURL=config.js.map