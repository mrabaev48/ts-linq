export class MySqlWhereEmitter {
    emit(parameters, options) {
        if (!options.where)
            return '';
        const whereArray = Array.isArray(options.where) ? options.where : [options.where];
        if (whereArray.length === 0)
            return '';
        const whereClauses = whereArray.map((w) => w.condition);
        for (const w of whereArray)
            parameters.push(...w.parameters);
        return ` WHERE ${whereClauses.join(' AND ')}`;
    }
}
//# sourceMappingURL=MySqlWhereEmitter.js.map