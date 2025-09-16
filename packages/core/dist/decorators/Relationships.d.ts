import 'reflect-metadata';
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
}
/**
 * Declares a one-to-many relationship on a collection navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export declare function OneToMany(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
/**
 * Declares a many-to-one relationship on a reference navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export declare function ManyToOne(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
/**
 * Declares a one-to-one relationship on a reference navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export declare function OneToOne(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
/**
 * Declares a many-to-many relationship on a collection navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export declare function ManyToMany(targetEntity: () => Function, options?: RelationshipOptions): PropertyDecorator;
//# sourceMappingURL=Relationships.d.ts.map