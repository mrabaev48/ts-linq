import { builder, EntityBuilder } from '../src/builders/EntityBuilder';

class TestEntity {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
  active!: boolean;
}

describe('EntityBuilder', () => {
  let entityBuilder: EntityBuilder<TestEntity>;

  beforeEach(() => {
    entityBuilder = new EntityBuilder(TestEntity);
  });

  describe('construction', () => {
    it('should create builder with entity class', () => {
      expect(entityBuilder).toBeInstanceOf(EntityBuilder);
    });

    it('should create builder using factory function', () => {
      const factoryBuilder = builder(TestEntity);

      expect(factoryBuilder).toBeInstanceOf(EntityBuilder);
    });
  });

  describe('withDefaults()', () => {
    it('should set default values', () => {
      entityBuilder.withDefaults({
        name: 'Default Name',
        age: 18
      });

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Default Name');
      expect(entity.age).toBe(18);
    });

    it('should merge multiple default calls', () => {
      entityBuilder.withDefaults({ name: 'Name' }).withDefaults({ age: 25 });

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Name');
      expect(entity.age).toBe(25);
    });

    it('should support method chaining', () => {
      const result = entityBuilder.withDefaults({ name: 'Test' });

      expect(result).toBe(entityBuilder);
    });
  });

  describe('with()', () => {
    it('should set override values', () => {
      entityBuilder.withDefaults({ name: 'Default', age: 20 }).with({ name: 'Override' });

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Override');
      expect(entity.age).toBe(20);
    });

    it('should merge multiple override calls', () => {
      entityBuilder.with({ name: 'Alice' }).with({ age: 30 });

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Alice');
      expect(entity.age).toBe(30);
    });

    it('should override defaults', () => {
      entityBuilder
        .withDefaults({ name: 'Default', email: 'default@example.com' })
        .with({ email: 'override@example.com' });

      const entity = entityBuilder.build();

      expect(entity.email).toBe('override@example.com');
    });

    it('should support method chaining', () => {
      const result = entityBuilder.with({ name: 'Test' });

      expect(result).toBe(entityBuilder);
    });
  });

  describe('build()', () => {
    it('should create entity instance', () => {
      const entity = entityBuilder.build();

      expect(entity).toBeInstanceOf(TestEntity);
    });

    it('should apply defaults', () => {
      entityBuilder.withDefaults({
        id: 1,
        name: 'John',
        email: 'john@example.com',
        age: 25,
        active: true
      });

      const entity = entityBuilder.build();

      expect(entity.id).toBe(1);
      expect(entity.name).toBe('John');
      expect(entity.email).toBe('john@example.com');
      expect(entity.age).toBe(25);
      expect(entity.active).toBe(true);
    });

    it('should apply overrides', () => {
      entityBuilder.withDefaults({ name: 'Default' }).with({ name: 'Override', age: 30 });

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Override');
      expect(entity.age).toBe(30);
    });

    it('should create new instance each time', () => {
      entityBuilder.withDefaults({ id: 1, name: 'Test' });

      const entity1 = entityBuilder.build();
      const entity2 = entityBuilder.build();

      expect(entity1).not.toBe(entity2);
      expect(entity1).toEqual(entity2);
    });
  });

  describe('buildMany()', () => {
    it('should create multiple instances', () => {
      const entities = entityBuilder.buildMany(3);

      expect(entities).toHaveLength(3);
      entities.forEach((entity) => {
        expect(entity).toBeInstanceOf(TestEntity);
      });
    });

    it('should apply defaults to all instances', () => {
      entityBuilder.withDefaults({ name: 'Test', age: 25 });

      const entities = entityBuilder.buildMany(2);

      expect(entities[0].name).toBe('Test');
      expect(entities[0].age).toBe(25);
      expect(entities[1].name).toBe('Test');
      expect(entities[1].age).toBe(25);
    });

    it('should use factory function for custom values', () => {
      const entities = entityBuilder.buildMany(3, (i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      expect(entities[0].id).toBe(1);
      expect(entities[0].name).toBe('User 1');
      expect(entities[1].id).toBe(2);
      expect(entities[1].name).toBe('User 2');
      expect(entities[2].id).toBe(3);
      expect(entities[2].name).toBe('User 3');
    });

    it('should merge defaults with factory values', () => {
      entityBuilder.withDefaults({ age: 25, active: true });

      const entities = entityBuilder.buildMany(2, (i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      expect(entities[0].id).toBe(1);
      expect(entities[0].name).toBe('User 1');
      expect(entities[0].age).toBe(25);
      expect(entities[0].active).toBe(true);
    });

    it('should handle zero count', () => {
      const entities = entityBuilder.buildMany(0);

      expect(entities).toHaveLength(0);
    });
  });

  describe('reset()', () => {
    it('should clear overrides but keep defaults', () => {
      entityBuilder.withDefaults({ name: 'Default', age: 20 }).with({ name: 'Override' });

      entityBuilder.reset();

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Default');
      expect(entity.age).toBe(20);
    });

    it('should allow new overrides after reset', () => {
      entityBuilder
        .withDefaults({ name: 'Default' })
        .with({ name: 'First Override' })
        .reset()
        .with({ name: 'Second Override' });

      const entity = entityBuilder.build();

      expect(entity.name).toBe('Second Override');
    });

    it('should support method chaining', () => {
      const result = entityBuilder.reset();

      expect(result).toBe(entityBuilder);
    });
  });

  describe('complex scenarios', () => {
    it('should handle fluent building', () => {
      const entity = builder(TestEntity)
        .withDefaults({
          id: 1,
          active: true
        })
        .with({
          name: 'Alice',
          email: 'alice@example.com',
          age: 30
        })
        .build();

      expect(entity.id).toBe(1);
      expect(entity.name).toBe('Alice');
      expect(entity.email).toBe('alice@example.com');
      expect(entity.age).toBe(30);
      expect(entity.active).toBe(true);
    });

    it('should handle reusable builder', () => {
      const baseBuilder = builder(TestEntity).withDefaults({
        active: true,
        age: 25
      });

      const user1 = baseBuilder.with({ id: 1, name: 'Alice' }).build();
      const user2 = baseBuilder.reset().with({ id: 2, name: 'Bob' }).build();

      expect(user1.id).toBe(1);
      expect(user1.name).toBe('Alice');
      expect(user1.active).toBe(true);

      expect(user2.id).toBe(2);
      expect(user2.name).toBe('Bob');
      expect(user2.active).toBe(true);
    });
  });
});
