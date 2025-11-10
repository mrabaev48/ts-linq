import 'reflect-metadata';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../../src/types';
import { Index, IndexOptionsBuilder } from '../../src/decorators';

@Index({
  name: 'idx_users_email_created',
  columns: ['email', 'createdAt'],
  unique: true,
  orders: { email: 'ASC', createdAt: 'DESC' }
})
class User {
  id!: number;
  email!: string;
  createdAt!: string;
}

test('Index decorator accepts IndexOptionsBuilder and registers metadata', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'Users');
  const cols: ColumnMetadata[] = [
    { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
    { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false },
    { propertyName: 'createdAt', columnName: 'createdAt', type: 'TEXT', nullable: false }
  ];
  cols.forEach((c) => MetadataStorage.addColumn(User, c));
  MetadataStorage.addPrimaryKey(User, 'id');

  // Trigger class initializer by instantiation (for Stage-3 addInitializer)
  // and then synchronize via @Entity initializer simulation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _user = new User();
  const ctor = User as unknown as Function;
  const pendingIndexes = (Reflect.getOwnMetadata('orm:indexes', ctor) as any[]) || [];
  for (const idx of pendingIndexes) {
    MetadataStorage.addIndex(User, idx);
  }
  const meta = MetadataStorage.getEntity(User)!;
  expect(meta.indexes.length).toBeGreaterThan(0);
  const idx = meta.indexes.find((i) => i.name === 'idx_users_email_created');
  expect(idx).toBeDefined();
  expect(idx!.columns).toEqual(['email', 'createdAt']);
  expect(idx!.unique).toBe(true);
  expect(idx!.orders).toEqual({ email: 'ASC', createdAt: 'DESC' });
});
