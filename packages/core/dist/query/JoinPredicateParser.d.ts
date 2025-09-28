/**
 * Simple parser that converts a two-parameter equality predicate into an SQL ON clause.
 * Supports patterns like:
 *   (a, b) => a.prop === b.other
 *   (left,right)=>left.id==right.userId
 */
export declare class JoinPredicateParser {
  static parse(
    predicateSource: string,
    leftTable: string,
    rightTable: string,
    leftMeta: {
      columns: Array<{
        propertyName: string;
        columnName: string;
      }>;
    },
    rightMeta: {
      columns: Array<{
        propertyName: string;
        columnName: string;
      }>;
    }
  ): string;
}
//# sourceMappingURL=JoinPredicateParser.d.ts.map
