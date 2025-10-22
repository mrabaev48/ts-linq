import { handleIndexCreates, handleIndexDrops } from './MigrationHandlers';
export class IndexesSqlBuilder {
    constructor(dialect) {
        this.dialect = dialect;
    }
    create(td, up) {
        handleIndexCreates(td, this.dialect, up);
    }
    drop(td, up) {
        handleIndexDrops(td, this.dialect, up);
    }
}
//# sourceMappingURL=IndexesSqlBuilder.js.map