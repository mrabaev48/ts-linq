import type { EntityTypeBuilder } from './EntityTypeBuilder';

export interface IEntityTypeConfiguration<T extends object> {
  /** The entity class this configuration targets. Required because TypeScript erases generics. */
  readonly entityType: new () => T;
  configure(builder: EntityTypeBuilder<T>): void;
}
