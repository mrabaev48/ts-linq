export class MssqlGroupEmitter {
    emit(parameters, options) {
        if (!options.groupBy)
            return '';
        const groupBy = Array.isArray(options.groupBy)
            ? { columns: options.groupBy }
            : options.groupBy;
        let sql = '';
        if (groupBy.columns && groupBy.columns.length > 0) {
            sql += ` GROUP BY ${groupBy.columns.join(', ')}`;
        }
        if (groupBy.having) {
            sql += ` HAVING ${groupBy.having.condition}`;
            if (groupBy.having.parameters)
                parameters.push(...groupBy.having.parameters);
        }
        return sql;
    }
}
//# sourceMappingURL=MssqlGroupEmitter.js.map