export class User {
}
export class Post {
}
export class Comment {
}
export class Tag {
}
export class Category {
}
export class Product {
}
export class Order {
}
export class OrderItem {
}
export const sampleUsers = [
    { id: 1, name: 'Alice', email: 'alice@example.com', age: 30, isActive: true, createdAt: new Date('2024-01-01') },
    { id: 2, name: 'Bob', email: 'bob@example.com', age: 25, isActive: true, createdAt: new Date('2024-01-02') },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: false, createdAt: new Date('2024-01-03') }
];
export const samplePosts = [
    { id: 1, title: 'First Post', content: 'Hello World', authorId: 1, createdAt: new Date('2024-01-01') },
    { id: 2, title: 'Second Post', content: 'TypeScript ORM', authorId: 1, createdAt: new Date('2024-01-02') },
    { id: 3, title: 'Third Post', content: 'Entity Framework', authorId: 2, createdAt: new Date('2024-01-03') }
];
export const sampleComments = [
    { id: 1, text: 'Great post!', postId: 1, userId: 2, createdAt: new Date('2024-01-01') },
    { id: 2, text: 'Very helpful', postId: 1, userId: 3, createdAt: new Date('2024-01-02') },
    { id: 3, text: 'Thanks!', postId: 2, userId: 2, createdAt: new Date('2024-01-03') }
];
//# sourceMappingURL=TestEntities.js.map