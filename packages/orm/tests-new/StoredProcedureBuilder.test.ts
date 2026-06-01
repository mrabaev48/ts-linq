import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { StoredProcedureBuilder } from '@ts-linq/metadata';

import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';

@Entity()
class Person {
  @PrimaryKey()
  @Column()
  id!: number;

  @Column()
  name!: string;

  @Column()
  age!: number;
}

describe('StoredProcedureBuilder', () => {
  test('hasParameter accumulates input direction by default', () => {
    const builder = new StoredProcedureBuilder<Person>();
    builder.hasParameter((p) => p.name);
    const config = builder._build('Person_Insert');
    expect(config.procedureName).toBe('Person_Insert');
    expect(config.parameters).toHaveLength(1);
    expect(config.parameters[0]).toMatchObject({ propertyName: 'name', direction: 'input' });
  });

  test('hasParameter with isOutput cfg sets output direction', () => {
    const builder = new StoredProcedureBuilder<Person>();
    builder.hasParameter(
      (p) => p.id,
      (p) => p.isOutput()
    );
    const config = builder._build('Person_Insert');
    expect(config.parameters[0]).toMatchObject({ propertyName: 'id', direction: 'output' });
  });

  test('hasOriginalValueParameter sets isOriginalValue flag', () => {
    const builder = new StoredProcedureBuilder<Person>();
    builder.hasOriginalValueParameter((p) => p.id);
    const config = builder._build('Person_Update');
    expect(config.parameters[0]).toMatchObject({
      propertyName: 'id',
      direction: 'input',
      isOriginalValue: true
    });
  });

  test('hasRowsAffectedResultColumn sets rowsAffectedMode', () => {
    const builder = new StoredProcedureBuilder<Person>();
    builder.hasRowsAffectedResultColumn();
    const config = builder._build('Person_Update');
    expect(config.rowsAffectedMode).toBe('resultColumn');
  });

  test('hasRowsAffectedReturnValue sets rowsAffectedMode', () => {
    const builder = new StoredProcedureBuilder<Person>();
    builder.hasRowsAffectedReturnValue();
    const config = builder._build('Person_Delete');
    expect(config.rowsAffectedMode).toBe('returnValue');
  });

  test('hasRowsAffectedParameter sets mode and optional paramName', () => {
    const builder = new StoredProcedureBuilder<Person>();
    builder.hasRowsAffectedParameter('affected');
    const config = builder._build('Person_Update');
    expect(config.rowsAffectedMode).toBe('parameter');
    expect(config.rowsAffectedParameterName).toBe('affected');
  });

  test('chaining returns this', () => {
    const builder = new StoredProcedureBuilder<Person>();
    const result = builder.hasParameter((p) => p.name).hasParameter((p) => p.age);
    expect(result).toBe(builder);
    const config = result._build('Person_Insert');
    expect(config.parameters).toHaveLength(2);
  });
});

describe('EntityTypeBuilder.insertUsingStoredProcedure', () => {
  test('configures insert SP mapping and registers in registry', () => {
    const registry = createMetadataRegistry();
    const builder = new EntityTypeBuilder<Person>(Person as unknown as new () => Person);
    builder.insertUsingStoredProcedure('Person_Insert', (spb) =>
      spb
        .hasParameter((p) => p.name)
        .hasParameter(
          (p) => p.id,
          (p) => p.isOutput()
        )
    );
    builder._applyToRegistry(registry);

    const mapping = registry.getStoredProcedureMapping(Person);
    expect(mapping).toBeDefined();
    expect(mapping!.insert).toBeDefined();
    expect(mapping!.insert!.procedureName).toBe('Person_Insert');
    expect(mapping!.insert!.parameters).toHaveLength(2);
    expect(mapping!.insert!.parameters[1].direction).toBe('output');
  });

  test('configures update SP mapping', () => {
    const registry = createMetadataRegistry();
    const builder = new EntityTypeBuilder<Person>(Person as unknown as new () => Person);
    builder.updateUsingStoredProcedure('Person_Update', (spb) =>
      spb.hasOriginalValueParameter((p) => p.id).hasRowsAffectedResultColumn()
    );
    builder._applyToRegistry(registry);

    const mapping = registry.getStoredProcedureMapping(Person);
    expect(mapping!.update).toBeDefined();
    expect(mapping!.update!.procedureName).toBe('Person_Update');
    expect(mapping!.update!.parameters[0].isOriginalValue).toBe(true);
    expect(mapping!.update!.rowsAffectedMode).toBe('resultColumn');
  });

  test('configures delete SP mapping', () => {
    const registry = createMetadataRegistry();
    const builder = new EntityTypeBuilder<Person>(Person as unknown as new () => Person);
    builder.deleteUsingStoredProcedure('Person_Delete', (spb) =>
      spb.hasOriginalValueParameter((p) => p.id)
    );
    builder._applyToRegistry(registry);

    const mapping = registry.getStoredProcedureMapping(Person);
    expect(mapping!.delete!.procedureName).toBe('Person_Delete');
  });

  test('all three operations can be chained on the same builder', () => {
    const registry = createMetadataRegistry();
    const builder = new EntityTypeBuilder<Person>(Person as unknown as new () => Person);
    builder
      .insertUsingStoredProcedure('Person_Insert', (spb) => spb.hasParameter((p) => p.name))
      .updateUsingStoredProcedure('Person_Update', (spb) => spb.hasParameter((p) => p.name))
      .deleteUsingStoredProcedure('Person_Delete', (spb) =>
        spb.hasOriginalValueParameter((p) => p.id)
      );
    builder._applyToRegistry(registry);

    const mapping = registry.getStoredProcedureMapping(Person);
    expect(mapping!.insert).toBeDefined();
    expect(mapping!.update).toBeDefined();
    expect(mapping!.delete).toBeDefined();
  });

  test('no SP mapping registered when no method called', () => {
    const registry = createMetadataRegistry();
    const builder = new EntityTypeBuilder<Person>(Person as unknown as new () => Person);
    builder._applyToRegistry(registry);
    expect(registry.getStoredProcedureMapping(Person)).toBeUndefined();
  });
});
