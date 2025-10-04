import { DatabaseError, ForeignKeyConstraintError, UniqueConstraintError } from '@ts-linq/core';
export function mapSqliteError(err) {
    const anyErr = err;
    const code = anyErr?.code;
    const message = anyErr?.message || String(err);
    if (!code)
        return new DatabaseError(message);
    if (message && message.toLowerCase().includes('foreign key'))
        return new ForeignKeyConstraintError(message, code);
    if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE')
        return new UniqueConstraintError(message, code);
    if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === 'SQLITE_CONSTRAINT_TRIGGER')
        return new ForeignKeyConstraintError(message, code);
    return new DatabaseError(message, code);
}
//# sourceMappingURL=ErrorMapper.js.map