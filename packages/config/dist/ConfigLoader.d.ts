import type { TsLinqConfig, ConfigOptions } from './types';
export declare class ConfigLoader {
    private static DEFAULT_PATHS;
    static load(options?: ConfigOptions): Promise<TsLinqConfig>;
    private static findConfigFile;
    private static loadConfigFile;
    private static applyEnvironmentOverrides;
    private static deepMerge;
    private static validateConfig;
    static getDefaults(): Partial<TsLinqConfig>;
}
//# sourceMappingURL=ConfigLoader.d.ts.map