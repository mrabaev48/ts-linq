/**
 * Options for configuring relationships between entities.
 *
 * - foreignKey: Column name on the dependent side used as the foreign key.
 * - inverseSide: Name of the property on the related entity that points back.
 * - cascade: Whether related operations should cascade (insert/update/delete).
 */
export interface RelationshipOptions {
    foreignKey?: string;
    inverseSide?: string;
    cascade?: boolean;
    through?: {
        table: string;
        sourceFk?: string;
        targetFk?: string;
        sourcePk?: string;
        targetPk?: string;
    };
}
/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export declare function OneToMany(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export declare function ManyToOne(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export declare function OneToOne(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export declare function ManyToMany(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
//# sourceMappingURL=Relationships.d.ts.map