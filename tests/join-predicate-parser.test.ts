import { JoinPredicateParser } from '../src/query/JoinPredicateParser';

describe('JoinPredicateParser', () => {
  test('parses simple equality predicate', () => {
    const leftMeta = { columns: [{ propertyName: 'authorId', columnName: 'author_id' }] } as any;
    const rightMeta = { columns: [{ propertyName: 'id', columnName: 'id' }] } as any;
    const on = (a: any, b: any) => a.authorId === b.id;
    const sql = JoinPredicateParser.parse(on.toString(), 'books', 'authors', leftMeta, rightMeta);
    expect(sql).toBe('books.author_id = authors.id');
  });
});
