export interface ColumnDef {
    name: string;
    ormType: string;
    nullable: boolean;
    isPrimary: boolean;
}
export declare class EntityTemplateBuilder {
    buildFromColumns(className: string, table: string, defs: ColumnDef[]): string;
    buildDefault(className: string, table: string): string;
    private mapTsType;
}
//# sourceMappingURL=EntityTemplateBuilder.d.ts.map