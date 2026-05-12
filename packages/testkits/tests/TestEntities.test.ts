import {
  User,
  Post,
  Comment,
  Tag,
  Category,
  Product,
  Order,
  OrderItem,
  sampleUsers,
  samplePosts,
  sampleComments
} from '../src/fixtures/TestEntities';

describe('TestEntities Fixtures', () => {
  describe('Entity Classes', () => {
    it('should create User instance', () => {
      const user = new User();
      
      expect(user).toBeInstanceOf(User);
    });

    it('should create Post instance', () => {
      const post = new Post();
      
      expect(post).toBeInstanceOf(Post);
    });

    it('should create Comment instance', () => {
      const comment = new Comment();
      
      expect(comment).toBeInstanceOf(Comment);
    });

    it('should create Tag instance', () => {
      const tag = new Tag();
      
      expect(tag).toBeInstanceOf(Tag);
    });

    it('should create Category instance', () => {
      const category = new Category();
      
      expect(category).toBeInstanceOf(Category);
    });

    it('should create Product instance', () => {
      const product = new Product();
      
      expect(product).toBeInstanceOf(Product);
    });

    it('should create Order instance', () => {
      const order = new Order();
      
      expect(order).toBeInstanceOf(Order);
    });

    it('should create OrderItem instance', () => {
      const item = new OrderItem();
      
      expect(item).toBeInstanceOf(OrderItem);
    });
  });

  describe('Sample Data', () => {
    describe('sampleUsers', () => {
      it('should provide sample users', () => {
        expect(sampleUsers).toHaveLength(3);
      });

      it('should have valid user data', () => {
        const user = sampleUsers[0];
        
        expect(user.id).toBe(1);
        expect(user.name).toBe('Alice');
        expect(user.email).toBe('alice@example.com');
        expect(user.age).toBe(30);
        expect(user.isActive).toBe(true);
        expect(user.createdAt).toBeInstanceOf(Date);
      });

      it('should have unique IDs', () => {
        const ids = sampleUsers.map(u => u.id);
        const uniqueIds = new Set(ids);
        
        expect(uniqueIds.size).toBe(sampleUsers.length);
      });
    });

    describe('samplePosts', () => {
      it('should provide sample posts', () => {
        expect(samplePosts).toHaveLength(3);
      });

      it('should have valid post data', () => {
        const post = samplePosts[0];
        
        expect(post.id).toBe(1);
        expect(post.title).toBe('First Post');
        expect(post.content).toBe('Hello World');
        expect(post.authorId).toBe(1);
        expect(post.createdAt).toBeInstanceOf(Date);
      });

      it('should reference valid authors', () => {
        const authorIds = samplePosts.map(p => p.authorId);
        const userIds = sampleUsers.map(u => u.id);
        
        authorIds.forEach(authorId => {
          expect(userIds).toContain(authorId);
        });
      });
    });

    describe('sampleComments', () => {
      it('should provide sample comments', () => {
        expect(sampleComments).toHaveLength(3);
      });

      it('should have valid comment data', () => {
        const comment = sampleComments[0];
        
        expect(comment.id).toBe(1);
        expect(comment.text).toBe('Great post!');
        expect(comment.postId).toBe(1);
        expect(comment.userId).toBe(2);
        expect(comment.createdAt).toBeInstanceOf(Date);
      });

      it('should reference valid posts', () => {
        const postIds = sampleComments.map(c => c.postId);
        const validPostIds = samplePosts.map(p => p.id);
        
        postIds.forEach(postId => {
          expect(validPostIds).toContain(postId);
        });
      });

      it('should reference valid users', () => {
        const userIds = sampleComments.map(c => c.userId);
        const validUserIds = sampleUsers.map(u => u.id);
        
        userIds.forEach(userId => {
          expect(validUserIds).toContain(userId);
        });
      });
    });
  });
});
