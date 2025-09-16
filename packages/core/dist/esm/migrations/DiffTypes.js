export function compareSchemas(expected, actual) {
    const diffs = [];
    const actualByName = new Map(actual.tables.map((t) => [t.name, t]));
    const expectedNames = new Set(expected.tables.map((t) => t.name));
    // New or altered tables
    for (const expectedTable of expected.tables) {
        const actualTable = actualByName.get(expectedTable.name);
        if (!actualTable) {
            diffs.push({ table: expectedTable.name, create: expectedTable });
            continue;
        }
        const changes = [];
        const actualColsByName = new Map(actualTable.columns.map((c) => [c.name, c]));
        for (const expectedColumn of expectedTable.columns) {
            const actualColumn = actualColsByName.get(expectedColumn.name);
            if (!actualColumn) {
                changes.push({ kind: 'add', column: expectedColumn });
            }
            else {
                const typeChanged = normalizeType(expectedColumn.type) !==
                    normalizeType(actualColumn.type ?? '');
                // Compare by nullable flag when available in snapshot
                const nullableChanged = typeof actualColumn.nullable === 'boolean'
                    ? expectedColumn.nullable !== actualColumn.nullable
                    : false;
                const needsAlter = typeChanged || nullableChanged;
                if (needsAlter) {
                    changes.push({ kind: 'alter', column: expectedColumn, prev: actualColumn });
                }
            }
        }
        // Drops
        const expectedColsByName = new Map(expectedTable.columns.map((c) => [c.name, c]));
        for (const actualColumn of actualTable.columns) {
            if (!expectedColsByName.has(actualColumn.name)) {
                changes.push({ kind: 'drop', column: actualColumn });
            }
        }
        if (changes.length > 0)
            diffs.push({ table: expectedTable.name, columnChanges: changes });
    }
    // Dropped tables
    const expectedByName = new Map(expected.tables.map((table) => [table.name, table]));
    for (const actualTable of actual.tables) {
        if (!expectedByName.has(actualTable.name)) {
            diffs.push({ table: actualTable.name, drop: true });
        }
    }
    return { tables: diffs };
}
function normalizeType(typeName) {
    return String(typeName || '')
        .trim()
        .toUpperCase();
}
//# sourceMappingURL=DiffTypes.js.map