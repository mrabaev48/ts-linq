export declare class EntityBuilder<T extends object> {
    private entityClass;
    private defaults;
    private overrides;
    constructor(entityClass: new () => T);
    withDefaults(defaults: Partial<T>): this;
    with(overrides: Partial<T>): this;
    build(): T;
    buildMany(count: number, factory?: (index: number) => Partial<T>): T[];
    reset(): this;
}
export declare function builder<T extends object>(entityClass: new () => T): EntityBuilder<T>;
export declare class TestUser {
    id: number;
    name: string;
    email: string;
    age: number;
    isActive: boolean;
    createdAt: Date;
}
export declare class TestPost {
    id: number;
    title: string;
    content: string;
    authorId: number;
    publishedAt?: Date;
}
export declare class TestComment {
    id: number;
    text: string;
    postId: number;
    userId: number;
    createdAt: Date;
}
export declare const userBuilder: () => EntityBuilder<TestUser>;
export declare const postBuilder: () => EntityBuilder<TestPost>;
export declare const commentBuilder: () => EntityBuilder<TestComment>;
//# sourceMappingURL=EntityBuilder.d.ts.map