import 'reflect-metadata';
import { DbContext, Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '../src';

// Define entities
@Entity()
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @OneToMany(() => Post, { foreignKey: 'userId' })
  posts!: Post[];
}

@Entity()
class Post {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  title!: string;

  @Column()
  content!: string;

  @Column()
  userId!: number;

  @ManyToOne(() => User, { foreignKey: 'userId' })
  user!: User;
}

// Define DbContext
class BlogDbContext extends DbContext {
  public users!: any; // Will be properly typed by DbContext initialization
  public posts!: any; // Will be properly typed by DbContext initialization
}

async function basicUsageExample() {
  // Create context
  const context = new BlogDbContext({
    connectionString:
      process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/ts_linq',
    provider: 'postgresql'
  });

  try {
    // Ensure database is created
    await context.ensureCreated();

    // Create a new user
    const user = new User();
    user.name = 'John Doe';
    user.email = 'john@example.com';

    // Add to context for tracking
    context.set(User).add(user);

    // Save changes (similar to Entity Framework)
    await context.saveChanges();

    console.log('User created with ID:', user.id);

    // Create posts for the user
    const post1 = new Post();
    post1.title = 'First Post';
    post1.content = 'This is my first blog post';
    post1.userId = user.id;

    const post2 = new Post();
    post2.title = 'Second Post';
    post2.content = 'This is my second blog post';
    post2.userId = user.id;

    context.set(Post).add(post1);
    context.set(Post).add(post2);
    await context.saveChanges();

    // Query data (LINQ-style)
    const allUsers = await context.set(User).toArray();
    console.log('All users:', allUsers);

    const userPosts = await context
      .set(Post)
      .where((p) => p.userId === user.id)
      .orderBy((p) => p.title)
      .toArray();
    console.log('User posts:', userPosts);

    // Find specific user
    const foundUser = await context.set(User).find(user.id);
    console.log('Found user:', foundUser);

    // Update user
    if (foundUser) {
      foundUser.name = 'John Updated';
      context.set(User).update(foundUser);
      await context.saveChanges();
    }

    // Count posts
    const postCount = await context.set(Post).count();
    console.log('Total posts:', postCount);

    // Get first post
    const firstPost = await context
      .set(Post)
      .orderBy((p) => p.id)
      .first();
    console.log('First post:', firstPost);

    // Delete a post
    context.set(Post).remove(post1);
    await context.saveChanges();

    console.log('Post deleted');
  } finally {
    // Always dispose of the context
    await context.dispose();
  }
}

// Run the example
basicUsageExample().catch(console.error);
