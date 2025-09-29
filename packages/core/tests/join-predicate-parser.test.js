"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const JoinPredicateParser_1 = require("../src/query/JoinPredicateParser");
describe('JoinPredicateParser', () => {
    test('parses simple equality predicate', () => {
        const leftMeta = { columns: [{ propertyName: 'authorId', columnName: 'author_id' }] };
        const rightMeta = { columns: [{ propertyName: 'id', columnName: 'id' }] };
        const on = (a, b) => a.authorId === b.id;
        const sql = JoinPredicateParser_1.JoinPredicateParser.parse(on.toString(), 'books', 'authors', leftMeta, rightMeta);
        expect(sql).toBe('books.author_id = authors.id');
    });
});
//# sourceMappingURL=join-predicate-parser.test.js.map