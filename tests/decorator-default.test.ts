import { Column } from '../src/decorators/Column';
import { Default } from '../src/decorators/Default';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

describe('@Default decorator', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  test('applies default value to column metadata when Column.defaultValue is not set', () => {
    class T {
      @Default(0)
      @Column({ type: 'INTEGER' })
      public a!: number;
    }
    const meta = MetadataStorage.getEntity(T)!;
    const col = meta.columns.find((c) => c.columnName === 'a');
    expect(col?.defaultValue).toBe(0);
  });
});


