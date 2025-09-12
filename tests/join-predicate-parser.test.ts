import { JoinPredicateParser } from '../src/query/JoinPredicateParser';

describe('JoinPredicateParser', () => {
  test('parses simple equality predicate', () => {
    const leftMeta = { columns: [{ propertyName: 'authorId', columnName: 'author_id' }] };
    const rightMeta = { columns: [{ propertyName: 'id', columnName: 'id' }] };
    const on = (a: { authorId: unknown }, b: { id: unknown }) => a.authorId === b.id;
    const sql = JoinPredicateParser.parse(on.toString(), 'books', 'authors', leftMeta as any, rightMeta as any);
    expect(sql).toBe('books.author_id = authors.id');
  });
});
