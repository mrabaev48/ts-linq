export declare function getFlag(argv: string[], flag: string): string | boolean | undefined;
export declare function resolveDialect(label: string): 'sqlite' | 'postgresql' | 'mysql' | 'mssql';
export declare function ensureDir(dirPath: string): void;
export declare function writeFileIfMissing(filePath: string, contents: string): void;
export declare function validateEnv(required: string[]): boolean;
//# sourceMappingURL=utils.d.ts.map