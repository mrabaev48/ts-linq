"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareSchemas = compareSchemas;
function compareSchemas(expected, actual) {
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
                // Computed changes: detect when expected vs actual differ by flags/expression/storage
                const expectedIsComputed = !!expectedColumn.isComputed;
                const actualIsComputed = !!actualColumn.isComputed;
                const expectedExpr = expectedColumn.computedExpression;
                const actualExpr = actualColumn.computedExpression;
                const expectedStorage = expectedColumn.computedStorage;
                const actualStorage = actualColumn.computedStorage;
                const computedChanged = expectedIsComputed !== actualIsComputed ||
                    (expectedExpr || '') !== (actualExpr || '') ||
                    (expectedStorage || '') !== (actualStorage || '');
                const defaultExprChanged = (expectedColumn.defaultExpression || '') !==
                    (actualColumn.defaultExpression || '');
                const needsAlter = typeChanged || nullableChanged || computedChanged || defaultExprChanged;
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
        // Index diffs
        const indexCreates = [];
        const indexDrops = [];
        const expIdxByName = new Map(expectedTable.indexes.map((i) => [i.name, i]));
        const actIdxByName = new Map(actualTable.indexes.map((i) => [i.name, i]));
        for (const [name, expIdx] of expIdxByName) {
            const actIdx = actIdxByName.get(name);
            const equal = actIdx
                ? arraysEqual(expIdx.columns, actIdx.columns) &&
                    !!expIdx.unique === !!actIdx.unique &&
                    (expIdx.where || '') === (actIdx.where || '') &&
                    shallowObjEqual(expIdx.orders, actIdx.orders) &&
                    shallowObjEqual(expIdx.collations, actIdx.collations) &&
                    shallowObjEqual(expIdx.nulls, actIdx.nulls) &&
                    arraysEqual(expIdx.expressions || [], actIdx.expressions || [])
                : false;
            if (!actIdx || !equal) {
                if (actIdx && !equal)
                    indexDrops.push(name);
                indexCreates.push(expIdx);
            }
        }
        for (const [name] of actIdxByName) {
            if (!expIdxByName.has(name))
                indexDrops.push(name);
        }
        if (changes.length > 0 || indexCreates.length > 0 || indexDrops.length > 0) {
            diffs.push({
                table: expectedTable.name,
                columnChanges: changes.length ? changes : undefined,
                indexCreates: indexCreates.length ? indexCreates : undefined,
                indexDrops: indexDrops.length ? indexDrops : undefined
            });
        }
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
function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
function shallowObjEqual(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length)
        return false;
    for (const k of ak) {
        if (a[k] !== b[k])
            return false;
    }
    return true;
}
//# sourceMappingURL=DiffTypes.js.map