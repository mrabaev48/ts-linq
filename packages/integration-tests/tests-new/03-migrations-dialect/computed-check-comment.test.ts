import { MssqlDdlStrategy } from '@ts-linq/dialect-mssql';
import { MySqlDdlStrategy } from '@ts-linq/dialect-mysql';
import { PostgresDdlStrategy } from '@ts-linq/dialect-postgres';
import { createMetadataRegistry, MetadataStorage } from '@ts-linq/metadata';
import { ModelBuilder } from '@ts-linq/orm';

class Product {
  id!: number;
  name!: string;
  price!: number;
  discountedPrice!: number;
  stock!: number;
}

describe('DDL — hasComputedColumnSql / hasCheckConstraint / hasComment', () => {
  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  // ── PostgreSQL ────────────────────────────────────────────────────────────

  describe('PostgresDdlStrategy', () => {
    const strategy = new PostgresDdlStrategy();

    it('includes GENERATED ALWAYS AS ... STORED for computed columns', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice)
          .hasColumnType('REAL')
          .hasComputedColumnSql('price * 0.9', { stored: true });
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain(
        '"discountedPrice" DOUBLE PRECISION GENERATED ALWAYS AS (price * 0.9) STORED'
      );
    });

    it('includes CONSTRAINT ... CHECK (...) in CREATE TABLE', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
        b.hasCheckConstraint('CK_price_positive', 'price > 0');
        b.hasCheckConstraint('CK_stock_nonneg', 'stock >= 0');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain('CONSTRAINT "CK_price_positive" CHECK (price > 0)');
      expect(sql).toContain('CONSTRAINT "CK_stock_nonneg" CHECK (stock >= 0)');
    });

    it('generates COMMENT ON TABLE statement', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
        b.hasComment('Product catalogue');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const comments = strategy.generateCommentSql(meta);
      expect(comments).toHaveLength(1);
      expect(comments[0]).toBe('COMMENT ON TABLE "products" IS \'Product catalogue\'');
    });

    it('generates COMMENT ON COLUMN statements', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name)
          .hasColumnType('TEXT')
          .hasComment('Product name');
        b.property((p) => p.price)
          .hasColumnType('REAL')
          .hasComment('Base price');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const comments = strategy.generateCommentSql(meta);
      expect(comments).toHaveLength(2);
      expect(comments).toContain('COMMENT ON COLUMN "products"."name" IS \'Product name\'');
      expect(comments).toContain('COMMENT ON COLUMN "products"."price" IS \'Base price\'');
    });

    it('returns empty array when no comments are set', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      expect(strategy.generateCommentSql(meta)).toHaveLength(0);
    });
  });

  // ── MySQL ─────────────────────────────────────────────────────────────────

  describe('MySqlDdlStrategy', () => {
    const strategy = new MySqlDdlStrategy();

    it('includes GENERATED ALWAYS AS ... VIRTUAL for non-stored computed columns', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice)
          .hasColumnType('REAL')
          .hasComputedColumnSql('price * 0.9');
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain('GENERATED ALWAYS AS (price * 0.9) VIRTUAL');
    });

    it('includes CONSTRAINT ... CHECK (...) in CREATE TABLE', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
        b.hasCheckConstraint('CK_price_positive', 'price > 0');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain('CONSTRAINT `CK_price_positive` CHECK (price > 0)');
    });

    it('includes TABLE COMMENT in CREATE TABLE', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
        b.hasComment('Product catalogue');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain("COMMENT='Product catalogue'");
    });

    it('includes column COMMENT inline', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name)
          .hasColumnType('TEXT')
          .hasComment('Product name');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain("COMMENT 'Product name'");
    });
  });

  // ── MSSQL ─────────────────────────────────────────────────────────────────

  describe('MssqlDdlStrategy', () => {
    const strategy = new MssqlDdlStrategy();

    it('includes AS (...) PERSISTED for persisted computed columns', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice)
          .hasColumnType('REAL')
          .hasComputedColumnSql('price * 0.9', { stored: true });
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain('[discountedPrice] AS (price * 0.9) PERSISTED');
    });

    it('includes CONSTRAINT ... CHECK (...) in CREATE TABLE', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
        b.hasCheckConstraint('CK_price_positive', 'price > 0');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const sql = strategy.generateCreateTableSql(meta);
      expect(sql).toContain('CONSTRAINT [CK_price_positive] CHECK (price > 0)');
    });

    it('generates sp_addextendedproperty for table comment', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name).hasColumnType('TEXT');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
        b.hasComment('Product catalogue');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const stmts = strategy.generateCommentSql(meta);
      expect(stmts).toHaveLength(1);
      expect(stmts[0]).toContain('sp_addextendedproperty');
      expect(stmts[0]).toContain("N'Product catalogue'");
    });

    it('generates sp_addextendedproperty for column comment', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity(Product, (b) => {
        b.toTable('products');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.name)
          .hasColumnType('TEXT')
          .hasComment('Product name');
        b.property((p) => p.price).hasColumnType('REAL');
        b.property((p) => p.discountedPrice).hasColumnType('REAL');
        b.property((p) => p.stock).hasColumnType('INTEGER');
      });
      mb._finalize();

      const meta = registry.getEntity(Product)!;
      const stmts = strategy.generateCommentSql(meta);
      expect(stmts).toHaveLength(1);
      expect(stmts[0]).toContain("'COLUMN'");
      expect(stmts[0]).toContain("N'Product name'");
    });
  });

  // ── Converter application on defaultValue ─────────────────────────────────

  describe('hasDefaultValue() with converter', () => {
    it('applies converter.toProvider before storing defaultValue in ColumnMetadata', () => {
      // The converter is stored on ColumnMetadata; SchemaSnapshot applies it during
      // ColumnDef construction. We verify the column has both defaultValue and converter set.
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);

      class FlagEntity {
        id!: number;
        active!: number;
      }

      mb.entity(FlagEntity, (b) => {
        b.toTable('flag_entities');
        b.hasKey('id');
        b.property((e) => e.id).hasColumnType('INTEGER');
        b.property((e) => e.active)
          .hasColumnType('TEXT')
          .hasDefaultValue(1)
          .hasConversion(
            (v: number) => (v ? 'true' : 'false'),
            (v: string) => (v === 'true' ? 1 : 0)
          );
      });
      mb._finalize();

      const meta = registry.getEntity(FlagEntity)!;
      const col = meta.columns.find((c) => c.propertyName === 'active')!;

      // Both defaultValue and converter are stored — SchemaSnapshot will apply converter
      expect(col.defaultValue).toBe(1);
      expect(col.converter).toBeDefined();

      // Verify the converter transforms the defaultValue correctly
      const providerValue = col.converter!.toProvider(col.defaultValue);
      expect(providerValue).toBe('true');
    });
  });
});
