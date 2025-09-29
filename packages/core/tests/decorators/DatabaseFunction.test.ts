import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../../src/types';

class Log {
  id!: number;
  createdAt!: Date;
}

test('DatabaseFunction metadata shape (without decorator)', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(Log, 'Logs');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
    {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'DATETIME',
      nullable: false,
      defaultExpression: 'CURRENT_TIMESTAMP'
    }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(Log, c));
  MetadataStorage.addPrimaryKey(Log, 'id');
  const meta = MetadataStorage.getEntity(Log)!;
  const col = meta.columns.find((c) => c.columnName === 'created_at');
  expect(col?.defaultExpression).toBe('CURRENT_TIMESTAMP');
});
