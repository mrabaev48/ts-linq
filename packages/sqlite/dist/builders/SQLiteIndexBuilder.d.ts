export type SQLiteIndexSpec = {
    name: string;
    columns: string[];
    unique: boolean;
    where?: string;
    orders?: {
        [column: string]: 'ASC' | 'DESC';
    };
    expressions?: string[];
    collations?: {
        [column: string]: string;
    };
};
/**
 * @deprecated Use SQLiteIndexBuilder from @ts-linq/dialect-sqlite instead.
 */
export { SQLiteIndexBuilder } from '@ts-linq/dialect-sqlite';
//# sourceMappingURL=SQLiteIndexBuilder.d.ts.map