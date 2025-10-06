import type { Dialect } from '../Dialect';
export declare function q(dialect: Dialect, id: string): string;
export declare function mapType(dialect: Dialect, t: string): string;
export declare function groupType(up: string): 'int' | 'text' | 'bool' | 'date' | 'float' | null;
export declare function formatValue(dialect: Dialect, v: unknown): string;
export declare function norm(t: string): string;
//# sourceMappingURL=SqlUtils.d.ts.map
