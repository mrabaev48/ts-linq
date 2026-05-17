export class User {
  id!: number;
  name!: string;
  email!: string;
  age!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt?: Date;
}

export class Post {
  id!: number;
  title!: string;
  content!: string;
  authorId!: number;
  author?: User;
  comments?: Comment[];
  tags?: Tag[];
  publishedAt?: Date;
  createdAt!: Date;
}

export class Comment {
  id!: number;
  text!: string;
  postId!: number;
  post?: Post;
  userId!: number;
  user?: User;
  createdAt!: Date;
}

export class Tag {
  id!: number;
  name!: string;
  posts?: Post[];
}

export class Category {
  id!: number;
  name!: string;
  parentId?: number;
  parent?: Category;
  children?: Category[];
}

export class Product {
  id!: number;
  name!: string;
  price!: number;
  stock!: number;
  categoryId?: number;
  category?: Category;
}

export class Order {
  id!: number;
  orderNumber!: string;
  userId!: number;
  user?: User;
  items?: OrderItem[];
  total!: number;
  status!: 'pending' | 'paid' | 'shipped' | 'delivered';
  createdAt!: Date;
}

export class OrderItem {
  id!: number;
  orderId!: number;
  order?: Order;
  productId!: number;
  product?: Product;
  quantity!: number;
  price!: number;
}

export const sampleUsers: Partial<User>[] = [
  {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    age: 30,
    isActive: true,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 2,
    name: 'Bob',
    email: 'bob@example.com',
    age: 25,
    isActive: true,
    createdAt: new Date('2024-01-02')
  },
  {
    id: 3,
    name: 'Charlie',
    email: 'charlie@example.com',
    age: 35,
    isActive: false,
    createdAt: new Date('2024-01-03')
  }
];

export const samplePosts: Partial<Post>[] = [
  {
    id: 1,
    title: 'First Post',
    content: 'Hello World',
    authorId: 1,
    createdAt: new Date('2024-01-01')
  },
  {
    id: 2,
    title: 'Second Post',
    content: 'TypeScript ORM',
    authorId: 1,
    createdAt: new Date('2024-01-02')
  },
  {
    id: 3,
    title: 'Third Post',
    content: 'Entity Framework',
    authorId: 2,
    createdAt: new Date('2024-01-03')
  }
];

export const sampleComments: Partial<Comment>[] = [
  { id: 1, text: 'Great post!', postId: 1, userId: 2, createdAt: new Date('2024-01-01') },
  { id: 2, text: 'Very helpful', postId: 1, userId: 3, createdAt: new Date('2024-01-02') },
  { id: 3, text: 'Thanks!', postId: 2, userId: 2, createdAt: new Date('2024-01-03') }
];
