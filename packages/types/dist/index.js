// Pure type definitions and interfaces - NO imports from other packages
export function ok(value) {
    return { success: true, value };
}
export function err(error) {
    return { success: false, error };
}
// Loading strategy enum
export var LoadingStrategy;
(function (LoadingStrategy) {
    LoadingStrategy["Lazy"] = "lazy";
    LoadingStrategy["Eager"] = "eager";
    LoadingStrategy["Explicit"] = "explicit";
})(LoadingStrategy || (LoadingStrategy = {}));
// Export error classes
export * from './errors';
export { ValidationError } from './errors';
//# sourceMappingURL=index.js.map