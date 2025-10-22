// Pure type definitions and interfaces - NO imports from other packages
export function ok(value) {
    return { success: true, value };
}
export function err(error) {
    return { success: false, error };
}
// Export error classes
export * from './errors';
//# sourceMappingURL=index.js.map