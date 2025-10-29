export interface SnapshotOptions {
    normalizeWhitespace?: boolean;
    sortParameters?: boolean;
    ignoreParameterValues?: boolean;
}
export declare class SqlSnapshotMatcher {
    static normalize(sql: string, options?: SnapshotOptions): string;
    static toMatchSqlSnapshot(received: string, expected?: string, options?: SnapshotOptions): {
        pass: boolean;
        message: () => string;
    };
}
declare global {
    namespace jest {
        interface Matchers<R> {
            toMatchSqlSnapshot(expected?: string, options?: SnapshotOptions): R;
        }
    }
}
export declare function setupSqlSnapshotMatchers(): void;
//# sourceMappingURL=SqlSnapshotMatcher.d.ts.map