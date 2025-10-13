export class MySqlGroupEmitter {
    emit(parameters, options) {
        if (!options.groupBy)
            return '';
        let sql = ` GROUP BY ${options.groupBy.columns.join(', ')}`;
        if (options.groupBy.having) {
            sql += ` HAVING ${options.groupBy.having.condition}`;
            parameters.push(...options.groupBy.having.parameters);
        }
        return sql;
    }
}
//# sourceMappingURL=MySqlGroupEmitter.js.map