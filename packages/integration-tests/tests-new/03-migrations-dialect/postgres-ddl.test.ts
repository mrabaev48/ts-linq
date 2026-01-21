import { Entity, Column, PrimaryKey, MetadataStorage } from '@ts-linq/metadata';
import { PostgresDdlStrategy } from '@ts-linq/dialect-postgres';

describe('PostgreSQL Migrations + Dialect Integration', () => {
  const strategy = new PostgresDdlStrategy();

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('CREATE TABLE', () => {
    it('should generate CREATE TABLE with quoted identifiers', () => {
      @Entity({ name: 'users' })
      class User {
        @PrimaryKey()
        id!: number;

        @Column({ type: 'TEXT', nullable: false })
        name!: string;
      }

      const metadata = MetadataStorage.getEntity(User);
      const sql = strategy.generateCreateTableSql(metadata!);
      
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
      expect(sql).toContain('"id" INTEGER');
      expect(sql).toContain('"name" TEXT NOT NULL');
      expect(sql).toContain('PRIMARY KEY ("id")');
    });

    it('should map types correctly (BOOLEAN, TIMESTAMPTZ)', () => {
       @Entity({ name: 'events' })
       class Event {
         @PrimaryKey()
         id!: number;
         
         @Column({ type: 'BOOLEAN' })
         isActive!: boolean;
         
         @Column({ type: 'DATETIME' })
         createdAt!: Date;

         @Column({ type: 'REAL' })
         score!: number;
       }
       
       const metadata = MetadataStorage.getEntity(Event);
       const sql = strategy.generateCreateTableSql(metadata!);
       
       expect(sql).toContain('"isActive" BOOLEAN');
       expect(sql).toContain('"createdAt" TIMESTAMPTZ');
       expect(sql).toContain('"score" DOUBLE PRECISION');
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
      
      expect(sql).toContain('"retries" INTEGER DEFAULT 5');
      expect(sql).toContain('"mode" TEXT DEFAULT \'default\'');
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

      expect(sql).toContain('PRIMARY KEY ("sourceId", "targetId")');
    });
  });

  describe('INDEXES', () => {
    it('should generate CREATE INDEX', () => {
       const sql = strategy.generateCreateIndexSql('users', {
         name: 'idx_users_name',
         columns: ['name'],
         unique: false
       });
       expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_users_name" ON "users" ("name")');
    });

    it('should generate CREATE UNIQUE INDEX', () => {
      const sql = strategy.generateCreateIndexSql('users', {
         name: 'idx_users_email',
         columns: ['email'],
         unique: true
      });
      expect(sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email")');
    });
  });

  describe('ALTER TABLE', () => {
    it('should generate ADD COLUMN', () => {
      const sql = strategy.generateAddColumnSql('users', {
        columnName: 'age',
        type: 'INTEGER',
        nullable: true
      });
      expect(sql).toBe('ALTER TABLE "users" ADD COLUMN "age" INTEGER');
    });

    it('should generate ADD COLUMN with defaults', () => {
      const sql = strategy.generateAddColumnSql('users', {
        columnName: 'active',
        type: 'BOOLEAN',
        nullable: false,
        defaultValue: true
      });
      expect(sql).toBe('ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT 1');
    });

    it('should generate DROP COLUMN', () => {
      const sql = strategy.generateDropColumnSql('users', 'obsolete');
      expect(sql).toBe('ALTER TABLE "users" DROP COLUMN "obsolete"');
    });

    it('should generate ALTER COLUMN TYPE', () => {
      const sql = strategy.generateAlterColumnTypeSql('users', 'description', 'TEXT');
      expect(sql).toBe('ALTER TABLE "users" ALTER COLUMN "description" TYPE TEXT');
    });

    it('should support RENAME TABLE', () => {
      const sql = strategy.generateRenameTableSql('old_users', 'new_users');
      expect(sql).toBe('ALTER TABLE "old_users" RENAME TO "new_users"');
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
        expect(sql).toBe('ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_author" FOREIGN KEY ("authorId") REFERENCES "users" ("id")');
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
        expect(sql).toBe('ALTER TABLE "comments" ADD CONSTRAINT "fk_comments_post" FOREIGN KEY ("postId") REFERENCES "posts" ("id") ON DELETE CASCADE ON UPDATE SET NULL');
    });
  });
});


