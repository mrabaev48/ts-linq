export declare class User {
    id: number;
    name: string;
    email: string;
    age: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt?: Date;
}
export declare class Post {
    id: number;
    title: string;
    content: string;
    authorId: number;
    author?: User;
    comments?: Comment[];
    tags?: Tag[];
    publishedAt?: Date;
    createdAt: Date;
}
export declare class Comment {
    id: number;
    text: string;
    postId: number;
    post?: Post;
    userId: number;
    user?: User;
    createdAt: Date;
}
export declare class Tag {
    id: number;
    name: string;
    posts?: Post[];
}
export declare class Category {
    id: number;
    name: string;
    parentId?: number;
    parent?: Category;
    children?: Category[];
}
export declare class Product {
    id: number;
    name: string;
    price: number;
    stock: number;
    categoryId?: number;
    category?: Category;
}
export declare class Order {
    id: number;
    orderNumber: string;
    userId: number;
    user?: User;
    items?: OrderItem[];
    total: number;
    status: 'pending' | 'paid' | 'shipped' | 'delivered';
    createdAt: Date;
}
export declare class OrderItem {
    id: number;
    orderId: number;
    order?: Order;
    productId: number;
    product?: Product;
    quantity: number;
    price: number;
}
export declare const sampleUsers: Partial<User>[];
export declare const samplePosts: Partial<Post>[];
export declare const sampleComments: Partial<Comment>[];
//# sourceMappingURL=TestEntities.d.ts.map