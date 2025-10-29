export class EntityBuilder {
    constructor(entityClass) {
        this.entityClass = entityClass;
        this.defaults = {};
        this.overrides = {};
    }
    withDefaults(defaults) {
        this.defaults = { ...this.defaults, ...defaults };
        return this;
    }
    with(overrides) {
        this.overrides = { ...this.overrides, ...overrides };
        return this;
    }
    build() {
        const instance = new this.entityClass();
        return Object.assign(instance, this.defaults, this.overrides);
    }
    buildMany(count, factory) {
        return Array.from({ length: count }, (_, i) => {
            const instance = new this.entityClass();
            const overrides = factory ? factory(i) : {};
            return Object.assign(instance, this.defaults, overrides);
        });
    }
    reset() {
        this.overrides = {};
        return this;
    }
}
export function builder(entityClass) {
    return new EntityBuilder(entityClass);
}
export class TestUser {
}
export class TestPost {
}
export class TestComment {
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
//# sourceMappingURL=EntityBuilder.js.map