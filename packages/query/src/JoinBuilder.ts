import { MetadataStorage } from '@ts-linq/metadata';
import { type JoinClause, MetadataError } from '@ts-linq/types';

/**
 * Builds a structured {@link JoinClause} for `innerJoinOn` / `leftJoinOn`. The clause carries
 * unquoted `onColumns`; the dialect renders + quotes the `ON` expression (refactor query/task-6),
 * so no raw SQL is assembled here.
 *
 * Stateless — shared by reference across all clones of a `Queryable` chain.
 */
export class JoinBuilder {
  build<TLeft, TRight>(
    type: 'INNER' | 'LEFT',
    leftEntity: new () => TLeft,
    rightEntity: new () => TRight,
    leftKey: string,
    rightKey: string,
    alias?: string
  ): JoinClause {
    const leftMeta = MetadataStorage.getEntity(leftEntity);
    const rightMeta = MetadataStorage.getEntity(rightEntity);
    if (!leftMeta || !rightMeta) {
      throw new MetadataError('ts-linq: entity metadata not found for join');
    }
    const leftCol = leftMeta.columns.find((c) => c.propertyName === leftKey)?.columnName ?? leftKey;
    const rightCol =
      rightMeta.columns.find((c) => c.propertyName === rightKey)?.columnName ?? rightKey;
    // Emit a structured equi-join; the dialect renders the ON clause and quotes each identifier.
    return {
      type,
      table: rightMeta.tableName,
      onColumns: [
        {
          left: { table: leftMeta.tableName, column: leftCol },
          right: { table: rightMeta.tableName, column: rightCol }
        }
      ],
      alias
    };
  }
}
