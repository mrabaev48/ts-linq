/**
 * Immutable-ish carrier for a query intent. Used by Queryable to
 * accumulate options (with cloning), and by QueryBuilder to generate SQL.
 */
export class QueryModel {
    /**
     * Create a deep copy of the query model to preserve immutability
     * when applying read-only operations (e.g., first/any).
     */
    clone() {
        const clonedModel = new QueryModel();
        clonedModel.select = this.select ? [...this.select] : undefined;
        clonedModel.where = this.where
            ? this.where.map((w) => ({ condition: w.condition, parameters: [...w.parameters] }))
            : undefined;
        clonedModel.orderBy = this.orderBy ? this.orderBy.map((o) => ({ ...o })) : undefined;
        clonedModel.groupBy = this.groupBy
            ? {
                columns: [...this.groupBy.columns],
                having: this.groupBy.having
                    ? {
                        condition: this.groupBy.having.condition,
                        parameters: [...this.groupBy.having.parameters]
                    }
                    : undefined
            }
            : undefined;
        clonedModel.joins = this.joins ? this.joins.map((j) => ({ ...j })) : undefined;
        clonedModel.limit = this.limit;
        clonedModel.offset = this.offset;
        clonedModel.distinct = this.distinct;
        clonedModel.unions = this.unions
            ? this.unions.map((unionItem) => ({
                all: unionItem.all,
                other: unionItem.other.clone(),
                entity: unionItem.entity
            }))
            : undefined;
        return clonedModel;
    }
}
//# sourceMappingURL=QueryModel.js.map