"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinPredicateParser = void 0;
/**
 * Simple parser that converts a two-parameter equality predicate into an SQL ON clause.
 * Supports patterns like:
 *   (a, b) => a.prop === b.other
 *   (left,right)=>left.id==right.userId
 */
class JoinPredicateParser {
    static parse(predicateSource, leftTable, rightTable, leftMeta, rightMeta) {
        const onStr = predicateSource.trim();
        // Extract identifiers and props using regex
        // e.g., (a, b) => a.authorId === b.id
        const match = onStr.match(/\((\w+)\s*,\s*(\w+)\)\s*=>\s*\1\.(\w+)\s*===?\s*\2\.(\w+)/);
        if (!match)
            throw new Error(`Unable to parse join predicate: ${onStr}`);
        const leftProp = match[3];
        const rightProp = match[4];
        const leftCol = leftMeta.columns.find((c) => c.propertyName === leftProp)?.columnName || leftProp;
        const rightCol = rightMeta.columns.find((c) => c.propertyName === rightProp)?.columnName || rightProp;
        return `${leftTable}.${leftCol} = ${rightTable}.${rightCol}`;
    }
}
exports.JoinPredicateParser = JoinPredicateParser;
//# sourceMappingURL=JoinPredicateParser.js.map