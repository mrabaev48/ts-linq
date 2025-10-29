"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIndexEqual = isIndexEqual;
exports.diffIndexes = diffIndexes;
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
function isIndexEqual(expIdx, actIdx) {
    if (!actIdx)
        return false;
    if (!arraysEqual(expIdx.columns, actIdx.columns))
        return false;
    if (!!expIdx.unique !== !!actIdx.unique)
        return false;
    if ((expIdx.where || '') !== (actIdx.where || ''))
        return false;
    const actOrders = actIdx.orders;
    const actCollations = actIdx.collations;
    const actNulls = actIdx.nulls;
    const expExpressions = expIdx.expressions || [];
    const actExpressions = actIdx.expressions || [];
    if (!shallowObjEqual(expIdx.orders, actOrders))
        return false;
    if (!shallowObjEqual(expIdx.collations, actCollations))
        return false;
    if (!shallowObjEqual(expIdx.nulls, actNulls))
        return false;
    if (!arraysEqual(expExpressions, actExpressions))
        return false;
    return true;
}
function diffIndexes(expectedTable, actualTable) {
    const creates = [];
    const drops = [];
    const expIdxByName = new Map(expectedTable.indexes.map((i) => [i.name, i]));
    const actIdxByName = new Map(actualTable.indexes.map((i) => [i.name, i]));
    for (const [name, expIdx] of expIdxByName) {
        const actIdx = actIdxByName.get(name);
        const equal = isIndexEqual(expIdx, actIdx);
        if (!actIdx || !equal) {
            if (actIdx && !equal)
                drops.push(name);
            creates.push(expIdx);
        }
    }
    for (const [name] of actIdxByName) {
        if (!expIdxByName.has(name))
            drops.push(name);
    }
    return { creates, drops };
}
//# sourceMappingURL=IndexComparator.js.map