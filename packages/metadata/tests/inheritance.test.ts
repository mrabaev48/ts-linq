import 'reflect-metadata';

import { InheritanceStrategy } from '@ts-linq/types';

import { EntityMetadataBuilder } from '../src/EntityMetadata';
import { MetadataRegistry } from '../src/MetadataRegistry';

class Animal {
  id!: number;
  name!: string;
}

class Dog extends Animal {
  breed!: string;
}

class Cat extends Animal {
  indoor!: boolean;
}

describe('EntityMetadataBuilder — inheritance', () => {
  it('setHierarchy stores hierarchy on the root entity', () => {
    const builder = new EntityMetadataBuilder(Animal);
    builder.addColumn({ propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    builder.addColumn({ propertyName: 'name', columnName: 'name', type: 'TEXT' });
    builder.setHierarchy({
      strategy: InheritanceStrategy.Tph,
      rootEntity: Animal,
      discriminator: {
        columnName: 'kind',
        columnType: 'TEXT',
        entries: [
          { ctor: Dog, value: 'dog' },
          { ctor: Cat, value: 'cat' }
        ],
        isComplete: true
      },
      subtypes: [Dog, Cat]
    });

    const meta = builder.build();
    expect(meta.hierarchy).toBeDefined();
    expect(meta.hierarchy!.strategy).toBe(InheritanceStrategy.Tph);
    expect(meta.hierarchy!.discriminator!.columnName).toBe('kind');
    expect(meta.hierarchy!.discriminator!.entries).toHaveLength(2);
    expect(meta.hierarchyRoot).toBeUndefined();
  });

  it('setHierarchyRoot stores hierarchyRoot on a subtype entity', () => {
    const builder = new EntityMetadataBuilder(Dog);
    builder.setHierarchyRoot(Animal);

    const meta = builder.build();
    expect(meta.hierarchyRoot).toBe(Animal);
    expect(meta.hierarchy).toBeUndefined();
  });
});

describe('MetadataRegistry — inheritance', () => {
  let registry: MetadataRegistry;

  beforeEach(() => {
    registry = new MetadataRegistry();
    registry.addEntity(Animal, 'animals');
    registry.addColumn(Animal, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addColumn(Animal, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
    registry.addEntity(Dog, 'animals');
    registry.addColumn(Dog, { propertyName: 'breed', columnName: 'breed', type: 'TEXT' });
    registry.addEntity(Cat, 'animals');
    registry.addColumn(Cat, { propertyName: 'indoor', columnName: 'indoor', type: 'BOOLEAN' });
  });

  it('setHierarchyMetadata stores hierarchy on root', () => {
    registry.setHierarchyMetadata(Animal, {
      strategy: InheritanceStrategy.Tph,
      rootEntity: Animal,
      discriminator: {
        columnName: 'kind',
        columnType: 'TEXT',
        entries: [
          { ctor: Dog, value: 'dog' },
          { ctor: Cat, value: 'cat' }
        ],
        isComplete: true
      },
      subtypes: [Dog, Cat]
    });

    const meta = registry.getEntity(Animal);
    expect(meta?.hierarchy?.strategy).toBe(InheritanceStrategy.Tph);
    expect(meta?.hierarchy?.discriminator?.columnName).toBe('kind');
    expect(meta?.hierarchy?.subtypes).toHaveLength(2);
  });

  it('setHierarchyRoot stores hierarchyRoot on subtype', () => {
    registry.setHierarchyRoot(Dog, Animal);
    registry.setHierarchyRoot(Cat, Animal);

    expect(registry.getEntity(Dog)?.hierarchyRoot).toBe(Animal);
    expect(registry.getEntity(Cat)?.hierarchyRoot).toBe(Animal);
  });

  it('setHierarchyMetadata works even after entity is finalized', () => {
    // Force finalization
    const _ = registry.getEntity(Animal);

    registry.setHierarchyMetadata(Animal, {
      strategy: InheritanceStrategy.Tpt,
      rootEntity: Animal,
      subtypes: [Dog]
    });

    expect(registry.getEntity(Animal)?.hierarchy?.strategy).toBe(InheritanceStrategy.Tpt);
  });

  it('setHierarchyRoot works even after subtype is finalized', () => {
    const _ = registry.getEntity(Dog);

    registry.setHierarchyRoot(Dog, Animal);

    expect(registry.getEntity(Dog)?.hierarchyRoot).toBe(Animal);
  });
});
