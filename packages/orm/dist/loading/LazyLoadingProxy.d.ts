import type { DatabaseProvider } from '@ts-linq/core/dist/DatabaseProvider';
export declare const LAZY_LOADING_TARGET: unique symbol;
export declare const LAZY_LOADING_PROVIDER: unique symbol;
export declare const LAZY_LOADING_PROXY: unique symbol;
export declare const LAZY_LOADING_STATE: unique symbol;
interface LazyLoadingState {
    [propertyName: string]: {
        isLoaded: boolean;
        isLoading: boolean;
        loadingPromise?: Promise<unknown>;
    };
}
export declare class LazyLoadingProxy {
    private static _logger?;
    static setLogger(logger?: {
        warn(message: string, error?: unknown): void;
    }): void;
    private static getOrInitStateEntry;
    private static markLoading;
    private static markLoaded;
    private static resetLoading;
    private static defaultValueFor;
    private static getLogger;
    static create<T extends object>(entity: T, entityClass: new () => T, provider: DatabaseProvider): T;
    private static proxyGet;
    private static proxySet;
    private static proxyHas;
    private static proxyOwnKeys;
    private static proxyGetOwnPropertyDescriptor;
    private static loadRelationship;
    private static resolveTargetEntity;
    private static defaultForeignKeyFor;
    static createMany<T extends object>(entities: T[], entityClass: new () => T, provider: DatabaseProvider): T[];
    static isLazyProxy(entity: unknown): boolean;
    static getTarget<T>(entity: T): T;
    static getLoadingState(entity: unknown): LazyLoadingState | null;
    static isRelationshipLoaded(entity: unknown, propertyName: string): boolean;
}
export declare function isLazyProxy<T>(entity: T): entity is T & {
    [LAZY_LOADING_PROXY]: true;
};
export declare function getLazyTarget<T>(entity: T): T;
export declare function awaitLazyLoad<T>(propertyValue: T | Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=LazyLoadingProxy.d.ts.map