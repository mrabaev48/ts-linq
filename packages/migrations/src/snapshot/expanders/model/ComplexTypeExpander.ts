import type { ComplexTypePropertyMetadata } from '@ts-linq/types';

import type { ModelColumnSnapshot, ModelTableSnapshot } from '../../model-snapshot.types';
import type { ColumnMapper } from '../ColumnMapper';
import type { EntityExpander, ExpansionContext } from '../EntityExpander';

/**
 * Expands complex types (P1-17) by flattening their columns into the owner table,
 * recursing through nested complex types with accumulated column prefixes.
 */
export class ComplexTypeExpander
  implements EntityExpander<ModelTableSnapshot, ModelColumnSnapshot>
{
  public expand(ctx: ExpansionContext<ModelTableSnapshot, ModelColumnSnapshot>): void {
    for (const cp of ctx.entity.complexProperties ?? []) {
      this.flatten(cp, cp.columnPrefix, ctx.columns, ctx.columnMapper);
    }
  }

  private flatten(
    complex: ComplexTypePropertyMetadata,
    prefix: string,
    ownerColumns: ModelColumnSnapshot[],
    columnMapper: ColumnMapper
  ): void {
    for (const col of complex.properties) {
      ownerColumns.push(
        columnMapper.toModelColumn(col, {
          namePrefix: prefix,
          nullable: !complex.isRequired || (col.nullable ?? true)
        })
      );
    }

    for (const nested of complex.nested) {
      this.flatten(nested, `${prefix}${nested.columnPrefix}`, ownerColumns, columnMapper);
    }
  }
}
