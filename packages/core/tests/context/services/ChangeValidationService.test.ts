import 'reflect-metadata';
import { ChangeValidationService } from '../../../src/context/services/ChangeValidationService';
import { MetadataStorage } from '../../../src/metadata/MetadataStorage';
import { ValidationError } from '../../../src/types';

describe('ChangeValidationService', () => {
  class E {}

  beforeEach(() => {
    // Сбрасываем метаданные между тестами
    (MetadataStorage as unknown as { getInstance: () => MetadataStorage }).getInstance().clear();
  });

  function registerBaseEntityMeta() {
    MetadataStorage.addEntity(E, 'E');
    MetadataStorage.addColumn(E, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      isGenerated: true
    } as any);
    MetadataStorage.addPrimaryKey(E, 'id');
  }

  test('computed column: cannot set on insert', () => {
    registerBaseEntityMeta();
    MetadataStorage.addColumn(E, {
      propertyName: 'fullName',
      columnName: 'full_name',
      type: 'TEXT',
      isComputed: true
    } as any);

    const svc = new ChangeValidationService();
    expect(() =>
      svc.validate([
        {
          entity: { fullName: 'John Doe' },
          entityClass: E,
          state: 'added'
        } as any
      ])
    ).toThrow(ValidationError);
  });

  test('computed column: cannot change on update', () => {
    registerBaseEntityMeta();
    MetadataStorage.addColumn(E, {
      propertyName: 'fullName',
      columnName: 'full_name',
      type: 'TEXT',
      isComputed: true
    } as any);

    const svc = new ChangeValidationService();
    expect(() =>
      svc.validate([
        {
          entity: { fullName: 'New' },
          entityClass: E,
          state: 'modified',
          originalValues: { fullName: 'Old' }
        } as any
      ])
    ).toThrow(ValidationError);
  });

  test('not-null without defaults: requires value', () => {
    registerBaseEntityMeta();
    MetadataStorage.addColumn(E, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    } as any);

    const svc = new ChangeValidationService();
    expect(() =>
      svc.validate([
        {
          entity: {},
          entityClass: E,
          state: 'added'
        } as any
      ])
    ).toThrow(ValidationError);
  });

  test('length check: string too long -> error', () => {
    registerBaseEntityMeta();
    MetadataStorage.addColumn(E, {
      propertyName: 'code',
      columnName: 'code',
      type: 'TEXT',
      length: 2,
      nullable: false
    } as any);

    const svc = new ChangeValidationService();
    expect(() =>
      svc.validate([
        {
          entity: { code: 'LONG' },
          entityClass: E,
          state: 'added'
        } as any
      ])
    ).toThrow(ValidationError);
  });

  test('audit satisfies createdAt/updatedAt without explicit values', () => {
    registerBaseEntityMeta();
    MetadataStorage.addColumn(E, {
      propertyName: 'createdAt',
      columnName: 'created_at',
      type: 'DATETIME',
      nullable: false
    } as any);
    MetadataStorage.addColumn(E, {
      propertyName: 'updatedBy',
      columnName: 'updated_by',
      type: 'TEXT',
      nullable: false
    } as any);

    const audit = {
      enabled: true,
      timeColumns: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
      userColumns: { createdBy: 'createdBy', updatedBy: 'updatedBy' },
      getCurrentUserId: () => 'u1'
    } as any;

    const svc = new ChangeValidationService(undefined, audit);
    expect(() =>
      svc.validate([
        {
          entity: {},
          entityClass: E,
          state: 'added'
        } as any
      ])
    ).not.toThrow();
  });

  test('conditional validations via metadata: failing rule emits error', () => {
    registerBaseEntityMeta();
    MetadataStorage.addColumn(E, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: true
    } as any);

    // Добавляем «правило» в metadata
    const rules = [
      {
        propertyName: 'name',
        predicate: (e: any) => e.name === 'ok',
        message: 'Name must be ok'
      }
    ];
    (Reflect as any).defineMetadata('orm:validations', rules, E);

    const svc = new ChangeValidationService();
    expect(() =>
      svc.validate([
        {
          entity: { name: 'bad' },
          entityClass: E,
          state: 'added'
        } as any
      ])
    ).toThrow(ValidationError);
  });
});
