import { MetadataStorage } from './MetadataStorage';
import type { ColumnMetadata, IndexMetadata } from '../types';
import { ValidationError } from '../types';

class T { x!: number; }

test('throws ValidationError when both defaultExpression and defaultValue are set', () => {
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(T, 'T');
  const bad: ColumnMetadata = {
    propertyName: 'x', columnName: 'x', type: 'INTEGER', nullable: false,
    defaultValue: 1, defaultExpression: 'CURRENT_TIMESTAMP'
  } as unknown as ColumnMetadata;
  expect(() => MetadataStorage.addColumn(T, bad)).toThrow(ValidationError);
});


test('addIndex validates duplicate name and column existence', () => {
  class User {}
  MetadataStorage.getInstance().clear();
  MetadataStorage.addEntity(User, 'Users');
  const idCol: ColumnMetadata = { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false } as unknown as ColumnMetadata;
  MetadataStorage.addColumn(User, idCol);
  // Unknown column should fail
  expect(() => {
    const badIdx: IndexMetadata = { name: 'idx_unknown', columns: ['missing'], unique: false } as unknown as IndexMetadata;
    MetadataStorage.addIndex(User, badIdx);
  }).toThrow(ValidationError);
  // Valid index
  const okIdx: IndexMetadata = { name: 'idx_id', columns: ['id'], unique: false } as unknown as IndexMetadata;
  MetadataStorage.addIndex(User, okIdx);
  // Duplicate name should fail
  expect(() => {
    const dupIdx: IndexMetadata = { name: 'idx_id', columns: ['id'], unique: false } as unknown as IndexMetadata;
    MetadataStorage.addIndex(User, dupIdx);
  }).toThrow(ValidationError);
});

