import { Entity, Column, PrimaryKey, MetadataStorage } from '@ts-linq/metadata';
import { MssqlDdlStrategy } from '@ts-linq/dialect-mssql';

describe('MSSQL Migrations + Dialect Integration', () => {
  const strategy = new MssqlDdlStrategy();

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('CREATE TABLE', () => {
    it('should generate CREATE TABLE with correct type mappings', () => {
      @Entity({ name: 'users' })
      class User {
        @PrimaryKey({ autoIncrement: true })
        id!: number;

        @Column({ type: 'TEXT', nullable: false })
        name!: string;
        
        @Column({ type: 'BOOLEAN' })
        isActive!: boolean;

        @Column({ type: 'DATETIME' })
        created!: Date;
      }

      const metadata = MetadataStorage.getEntity(User);
      const sql = strategy.generateCreateTableSql(metadata!);
      
      expect(sql).toContain("IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')");
      expect(sql).toContain('CREATE TABLE [users]');
      expect(sql).toContain('[name] NVARCHAR(MAX) NOT NULL');
      expect(sql).toContain('[isActive] BIT');
      expect(sql).toContain('[created] DATETIME2');
    });

    it('should generate DEFAULT value', () => {
      @Entity({ name: 'configs' })
      class Config {
        @PrimaryKey()
        id!: number;

        @Column({ type: 'INTEGER', defaultValue: 5 })
        retries!: number;
        
        @Column({ type: 'TEXT', defaultValue: 'default' })
        mode!: string;
      }
      
      const metadata = MetadataStorage.getEntity(Config);
      const sql = strategy.generateCreateTableSql(metadata!);
      
      expect(sql).toContain('[retries] INT DEFAULT 5');
      expect(sql).toContain("[mode] NVARCHAR(MAX) DEFAULT 'default'");
    });

    it('should generate composite PRIMARY KEY', () => {
      @Entity({ name: 'links' })
      class Link {
        @PrimaryKey()
        sourceId!: number;

        @PrimaryKey()
        targetId!: number;
      }

      const metadata = MetadataStorage.getEntity(Link);
      const sql = strategy.generateCreateTableSql(metadata!);

      expect(sql).toContain('PRIMARY KEY ([sourceId], [targetId])');
    });
  });

  describe('INDEXES', () => {
    it('should generate CREATE INDEX', () => {
       const sql = strategy.generateCreateIndexSql('users', {
         name: 'idx_users_name',
         columns: ['name'],
         unique: false
       });
       expect(sql).toContain("IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_users_name' AND object_id=OBJECT_ID('users'))");
       expect(sql).toContain('CREATE INDEX idx_users_name ON users (name)');
    });

    it('should generate CREATE UNIQUE INDEX', () => {
      const sql = strategy.generateCreateIndexSql('users', {
         name: 'idx_users_email',
         columns: ['email'],
         unique: true
      });
      expect(sql).toContain('CREATE UNIQUE INDEX idx_users_email ON users (email)');
    });
    
     it('should generate INDEX with INCLUDE columns', () => {
      const sql = strategy.generateCreateIndexSql('orders', {
         name: 'idx_orders_customer',
         columns: ['customerId'],
         unique: false,
         include: ['total']
      });
      expect(sql).toContain('CREATE INDEX idx_orders_customer ON orders (customerId) INCLUDE (total)');
    });
  });

  describe('ALTER TABLE', () => {
    it('should generate ADD COLUMN', () => {
      const sql = strategy.generateAddColumnSql('users', {
        columnName: 'age',
        type: 'INTEGER',
        nullable: true
      });
      expect(sql).toBe('ALTER TABLE [users] ADD [age] INT');
    });

    it('should generate DROP COLUMN', () => {
      const sql = strategy.generateDropColumnSql('users', 'obsolete');
      expect(sql).toBe('ALTER TABLE [users] DROP COLUMN [obsolete]');
    });

    it('should generate ALTER COLUMN TYPE', () => {
      const sql = strategy.generateAlterColumnTypeSql('users', 'description', 'TEXT');
      expect(sql).toBe('ALTER TABLE [users] ALTER COLUMN [description] NVARCHAR(MAX)');
    });

    it('should support RENAME TABLE', () => {
      const sql = strategy.generateRenameTableSql('old_users', 'new_users');
      expect(sql).toBe("EXEC sp_rename 'old_users', 'new_users'");
    });
  });

  describe('FOREIGN KEYS', () => {
    it('should generate FOREIGN KEY constraint', () => {
        const sql = strategy.generateForeignKeySql('posts', {
            name: 'fk_posts_author',
            columnName: 'authorId',
            relatedTableName: 'users',
            relatedColumnName: 'id'
        });
        expect(sql).toBe('ALTER TABLE [posts] ADD CONSTRAINT [fk_posts_author] FOREIGN KEY ([authorId]) REFERENCES [users] ([id])');
    });
    it('should handle ON DELETE/UPDATE actions', () => {
        const sql = strategy.generateForeignKeySql('comments', {
            name: 'fk_comments_post',
            columnName: 'postId',
            relatedTableName: 'posts',
            relatedColumnName: 'id',
            onDelete: 'CASCADE',
            onUpdate: 'SET NULL'
        });
        expect(sql).toBe('ALTER TABLE [comments] ADD CONSTRAINT [fk_comments_post] FOREIGN KEY ([postId]) REFERENCES [posts] ([id]) ON DELETE CASCADE ON UPDATE SET NULL');
    });
  });
});
