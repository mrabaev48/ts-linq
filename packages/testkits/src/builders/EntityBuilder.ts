export class EntityBuilder<T extends object> {
  private defaults: Partial<T> = {};
  private overrides: Partial<T> = {};

  constructor(private entityClass: new () => T) {}

  withDefaults(defaults: Partial<T>): this {
    this.defaults = { ...this.defaults, ...defaults };
    return this;
  }

  with(overrides: Partial<T>): this {
    this.overrides = { ...this.overrides, ...overrides };
    return this;
  }

  build(): T {
    const instance = new this.entityClass();
    return Object.assign(instance, this.defaults, this.overrides) as T;
  }

  buildMany(count: number, factory?: (index: number) => Partial<T>): T[] {
    return Array.from({ length: count }, (_, i) => {
      const instance = new this.entityClass();
      const overrides = factory ? factory(i) : {};
      return Object.assign(instance, this.defaults, overrides) as T;
    });
  }

  reset(): this {
    this.overrides = {};
    return this;
  }
}

export function builder<T extends object>(entityClass: new () => T): EntityBuilder<T> {
  return new EntityBuilder(entityClass);
}

export class TestUser {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
  isActive!: boolean;
  createdAt!: Date;
}

export class TestPost {
  id!: number;
  title!: string;
  content!: string;
  authorId!: number;
  publishedAt?: Date;
}

export class TestComment {
  id!: number;
  text!: string;
  postId!: number;
  userId!: number;
  createdAt!: Date;
}

export const userBuilder = () => builder(TestUser).withDefaults({
  name: 'Test User',
  email: 'test@example.com',
  age: 25,
  isActive: true,
  createdAt: new Date()
});

export const postBuilder = () => builder(TestPost).withDefaults({
  title: 'Test Post',
  content: 'Test content',
  authorId: 1
});

export const commentBuilder = () => builder(TestComment).withDefaults({
  text: 'Test comment',
  postId: 1,
  userId: 1,
  createdAt: new Date()
});
