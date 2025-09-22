import { MetadataStorage } from './MetadataStorage';
import type { ColumnMetadata } from '../types';
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


