export class IndexOptionsBuilder {
    constructor(name) {
        this.current = { name, columns: [], unique: false };
    }
    onColumns(columns) {
        this.current.columns = [...columns];
        return this;
    }
    unique(isUnique = true) {
        this.current.unique = isUnique;
        return this;
    }
    where(predicate) {
        this.current.where = predicate;
        return this;
    }
    orderBy(orders) {
        this.current.orders = { ...(this.current.orders || {}), ...orders };
        return this;
    }
    expressions(exprs) {
        this.current.expressions = [...(this.current.expressions || []), ...exprs];
        return this;
    }
    collations(coll) {
        this.current.collations = { ...(this.current.collations || {}), ...coll };
        return this;
    }
    nulls(opts) {
        this.current.nulls = { ...(this.current.nulls || {}), ...opts };
        return this;
    }
    using(method) {
        this.current.using = method;
        return this;
    }
    concurrently(flag = true) {
        this.current.concurrently = flag;
        return this;
    }
    withParams(params) {
        this.current.withParams = { ...(this.current.withParams || {}), ...params };
        return this;
    }
    mysqlVisibility(mode) {
        this.current.mysqlVisibility = mode;
        return this;
    }
    include(columns) {
        this.current.include = [...(this.current.include || []), ...columns];
        return this;
    }
    build() {
        if (!this.current.name || this.current.name.trim().length === 0) {
            throw new Error('Index name must be provided');
        }
        if (!this.current.columns || this.current.columns.length === 0) {
            throw new Error('Index must reference at least one column');
        }
        return { ...this.current };
    }
}
//# sourceMappingURL=IndexOptionsBuilder.js.map