export class SqlSnapshotMatcher {
    static normalize(sql, options = {}) {
        let normalized = sql;
        if (options.normalizeWhitespace !== false) {
            normalized = normalized
                .replace(/\s+/g, ' ')
                .trim();
        }
        if (options.sortParameters) {
            // Sort parameters for consistent comparison
            const params = normalized.match(/\$\d+|\?\d+|@\w+/g) || [];
            params.sort().forEach((param, i) => {
                const placeholder = `__PARAM_${i}__`;
                normalized = normalized.replace(param, placeholder);
            });
        }
        if (options.ignoreParameterValues) {
            normalized = normalized.replace(/\$\d+/g, '$?');
            normalized = normalized.replace(/\?\d+/g, '?');
            normalized = normalized.replace(/@\w+/g, '@?');
        }
        return normalized;
    }
    static toMatchSqlSnapshot(received, expected, options = {}) {
        const normalizedReceived = this.normalize(received, options);
        const normalizedExpected = expected ? this.normalize(expected, options) : '';
        const pass = normalizedReceived === normalizedExpected;
        return {
            pass,
            message: () => {
                if (pass) {
                    return `Expected SQL not to match snapshot`;
                }
                return `Expected SQL to match snapshot\n\nReceived:\n${normalizedReceived}\n\nExpected:\n${normalizedExpected}`;
            }
        };
    }
}
export function setupSqlSnapshotMatchers() {
    expect.extend({
        toMatchSqlSnapshot(received, expected, options) {
            return SqlSnapshotMatcher.toMatchSqlSnapshot(received, expected, options);
        }
    });
}
//# sourceMappingURL=SqlSnapshotMatcher.js.map