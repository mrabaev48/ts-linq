import type { Dialect } from '../../src/Dialect';
import { generateMigrationFromDiff } from '../../src/DialectMigrationSql';
import { ddlConvergenceDiff } from './__fixtures__/ddl-convergence-fixture';

/**
 * Byte-equality net for the migrations DDL generator (dialect-postgres/task-10).
 *
 * Column / PRIMARY KEY / UNIQUE / ADD-DROP-ALTER COLUMN emission moved off the migrations-local
 * per-dialect emitters onto the shared `DdlStrategy` owned by the dialect packages. These strings
 * were captured from the generator **before** that move and verified byte-identical after it. Any
 * drift here is a change to the SQL every existing migration emits and must be deliberate.
 */
const GOLDEN: Record<Dialect, { up: string[]; down: string[] }> = {
  postgresql: {
    up: [
      'CREATE SEQUENCE "order_seq"\n  AS INTEGER\n  START WITH 1\n  INCREMENT BY 1\n  NO CYCLE;',
      'CREATE TABLE IF NOT EXISTS "app_user" ("id" INTEGER NOT NULL, "tenant_id" INTEGER NOT NULL, "email" TEXT NOT NULL, "nick""name`weird]" TEXT, "age" INTEGER DEFAULT 18, "balance" DECIMAL(10,2) NOT NULL DEFAULT 0, "code" VARCHAR(255) DEFAULT \'o\'\'brien\', "external_id" UUID, "avatar" BLOB, "is_active" BOOLEAN NOT NULL DEFAULT TRUE, "is_deleted" BOOLEAN NOT NULL DEFAULT FALSE, "deleted_at" TIMESTAMPTZ DEFAULT NULL, "rating" DOUBLE PRECISION DEFAULT 1.5, "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "full_name" TEXT GENERATED ALWAYS AS (first_name || \' \' || last_name) STORED, "virtual_name" TEXT GENERATED ALWAYS AS (UPPER(email)) STORED, "persisted_name" TEXT GENERATED ALWAYS AS (LOWER(email)) STORED, "no_storage_computed" TEXT GENERATED ALWAYS AS (TRIM(email)) STORED, PRIMARY KEY ("id", "tenant_id"), CONSTRAINT "fk_app_user_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)',
      'ALTER TABLE "app_user" ADD CONSTRAINT "ak_app_user_email" UNIQUE ("email", "tenant_id")',
      'CREATE UNIQUE INDEX "ix_app_user_email" ON "app_user" ("email")',
      'CREATE INDEX "ix_app_user_active" ON "app_user" ("is_active") WHERE is_active = true',
      'ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "ak_orders_legacy"',
      'ALTER TABLE "orders" ADD CONSTRAINT "ak_orders_number" UNIQUE ("number")',
      'CREATE INDEX "ix_orders_placed_at" ON "orders" ("placed_at")',
      'DROP INDEX IF EXISTS "ix_orders_legacy"',
      'ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY ("user_id", "tenant_id") REFERENCES "app_user" ("id", "tenant_id") ON DELETE CASCADE',
      'ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_legacy"',
      'ALTER TABLE "orders" ADD COLUMN "note" TEXT',
      'ALTER TABLE "orders" ADD COLUMN "total" DECIMAL(10,2) NOT NULL DEFAULT 0',
      'ALTER TABLE "orders" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT FALSE',
      'ALTER TABLE "orders" ADD COLUMN "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE "orders" ADD COLUMN "summary" TEXT GENERATED ALWAYS AS (CONCAT(note, total)) STORED',
      'ALTER TABLE "orders" ALTER COLUMN "total" TYPE DECIMAL(10,2)',
      'ALTER TABLE "orders" ALTER COLUMN "total" DROP NOT NULL',
      'ALTER TABLE "orders" DROP COLUMN "summary"',
      'ALTER TABLE "orders" ADD COLUMN "summary" TEXT GENERATED ALWAYS AS (CONCAT(note, total)) STORED',
      'ALTER TABLE "orders" DROP COLUMN "legacy_flag"',
      'ALTER TABLE "orders" RENAME COLUMN "qty" TO "quantity"',
      'ALTER TABLE "audit_log" RENAME TO "audit_trail"',
      'DROP TABLE "obsolete"',
      'INSERT INTO "tenant" ("id", "name", "active") VALUES (1, \'acme\'\'s\', TRUE)',
      'UPDATE "tenant" SET "name" = \'acme\', "active" = FALSE WHERE "id" = 1',
      'DELETE FROM "tenant" WHERE "id" = 2'
    ],
    down: [
      'DROP SEQUENCE IF EXISTS "order_seq";',
      'DROP TABLE "app_user"',
      'ALTER TABLE "orders" DROP COLUMN "note"',
      'ALTER TABLE "orders" DROP COLUMN "total"',
      'ALTER TABLE "orders" DROP COLUMN "paid"',
      'ALTER TABLE "orders" DROP COLUMN "placed_at"',
      'ALTER TABLE "orders" DROP COLUMN "summary"',
      'DELETE FROM "tenant" WHERE "id" = 1',
      'UPDATE "tenant" SET "name" = \'acme\'\'s\', "active" = TRUE WHERE "id" = 1',
      'INSERT INTO "tenant" ("id", "name") VALUES (2, \'old\')'
    ]
  },
  mysql: {
    up: [
      'CREATE TABLE IF NOT EXISTS `__ts_linq_sequences` (\n  `name`           VARCHAR(128) NOT NULL,\n  `schema_name`    VARCHAR(128)          DEFAULT NULL,\n  `current_value`  BIGINT       NOT NULL DEFAULT 0,\n  `increment_by`   INT          NOT NULL DEFAULT 1,\n  PRIMARY KEY (`name`)\n) ENGINE=InnoDB;',
      "INSERT INTO `__ts_linq_sequences` (`name`, `schema_name`, `current_value`, `increment_by`) VALUES ('order_seq', NULL, 0, 1) ON DUPLICATE KEY UPDATE `name` = `name`;",
      "CREATE TABLE IF NOT EXISTS `app_user` (`id` INT NOT NULL, `tenant_id` INT NOT NULL, `email` TEXT NOT NULL COMMENT 'user''s e-mail', `nick\"name``weird]` TEXT, `age` INT DEFAULT 18, `balance` DECIMAL(10,2) NOT NULL DEFAULT 0, `code` VARCHAR(255) DEFAULT 'o''brien', `external_id` UUID, `avatar` BLOB, `is_active` TINYINT(1) NOT NULL DEFAULT 1, `is_deleted` TINYINT(1) NOT NULL DEFAULT 0, `deleted_at` DATETIME DEFAULT NULL, `rating` DOUBLE DEFAULT 1.5, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `full_name` TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED, `virtual_name` TEXT GENERATED ALWAYS AS (UPPER(email)) VIRTUAL, `persisted_name` TEXT GENERATED ALWAYS AS (LOWER(email)) VIRTUAL, `no_storage_computed` TEXT GENERATED ALWAYS AS (TRIM(email)) VIRTUAL, PRIMARY KEY (`id`, `tenant_id`), CONSTRAINT `fk_app_user_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION)",
      'ALTER TABLE `app_user` ADD UNIQUE KEY `ak_app_user_email` (`email`, `tenant_id`)',
      'CREATE UNIQUE INDEX `ix_app_user_email` ON `app_user` (`email`)',
      'CREATE INDEX `ix_app_user_active` ON `app_user` (`is_active`)',
      'ALTER TABLE `orders` DROP INDEX `ak_orders_legacy`',
      'ALTER TABLE `orders` ADD UNIQUE KEY `ak_orders_number` (`number`)',
      'CREATE INDEX `ix_orders_placed_at` ON `orders` (`placed_at`)',
      'ALTER TABLE `orders` DROP INDEX `ix_orders_legacy`',
      'ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`, `tenant_id`) REFERENCES `app_user` (`id`, `tenant_id`) ON DELETE CASCADE',
      'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_legacy`',
      'ALTER TABLE `orders` ADD COLUMN `note` TEXT',
      'ALTER TABLE `orders` ADD COLUMN `total` DECIMAL(10,2) NOT NULL DEFAULT 0',
      'ALTER TABLE `orders` ADD COLUMN `paid` TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE `orders` ADD COLUMN `placed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE `orders` ADD COLUMN `summary` TEXT GENERATED ALWAYS AS (CONCAT(note, total)) STORED',
      'ALTER TABLE `orders` MODIFY COLUMN `total` DECIMAL(10,2)',
      '-- MySQL requires full type in MODIFY for nullability; include in type alter',
      'ALTER TABLE `orders` DROP COLUMN `summary`',
      'ALTER TABLE `orders` ADD COLUMN `summary` TEXT GENERATED ALWAYS AS (CONCAT(note, total)) STORED',
      'ALTER TABLE `orders` DROP COLUMN `legacy_flag`',
      '-- MySQL requires full type for CHANGE COLUMN qty -> quantity',
      'RENAME TABLE `audit_log` TO `audit_trail`',
      'DROP TABLE `obsolete`',
      "INSERT INTO `tenant` (`id`, `name`, `active`) VALUES (1, 'acme''s', 1)",
      "UPDATE `tenant` SET `name` = 'acme', `active` = 0 WHERE `id` = 1",
      'DELETE FROM `tenant` WHERE `id` = 2'
    ],
    down: [
      "DELETE FROM `__ts_linq_sequences` WHERE `name` = 'order_seq';",
      'DROP TABLE `app_user`',
      'ALTER TABLE `orders` DROP COLUMN `note`',
      'ALTER TABLE `orders` DROP COLUMN `total`',
      'ALTER TABLE `orders` DROP COLUMN `paid`',
      'ALTER TABLE `orders` DROP COLUMN `placed_at`',
      'ALTER TABLE `orders` DROP COLUMN `summary`',
      'DELETE FROM `tenant` WHERE `id` = 1',
      "UPDATE `tenant` SET `name` = 'acme''s', `active` = 1 WHERE `id` = 1",
      "INSERT INTO `tenant` (`id`, `name`) VALUES (2, 'old')"
    ]
  },
  mssql: {
    up: [
      'CREATE SEQUENCE [order_seq]\n  AS INT\n  START WITH 1\n  INCREMENT BY 1;',
      "IF OBJECT_ID(N'app_user', N'U') IS NULL BEGIN CREATE TABLE [app_user] ([id] INT NOT NULL, [tenant_id] INT NOT NULL, [email] NVARCHAR(MAX) NOT NULL, [nick\"name`weird]]] NVARCHAR(MAX), [age] INT DEFAULT 18, [balance] DECIMAL(10,2) NOT NULL DEFAULT 0, [code] VARCHAR(255) DEFAULT 'o''brien', [external_id] UUID, [avatar] BLOB, [is_active] BIT NOT NULL DEFAULT 1, [is_deleted] BIT NOT NULL DEFAULT 0, [deleted_at] DATETIME2 DEFAULT NULL, [rating] FLOAT DEFAULT 1.5, [created_at] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP, [updated_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), [full_name] AS (first_name || ' ' || last_name) PERSISTED, [virtual_name] AS (UPPER(email)), [persisted_name] AS (LOWER(email)) PERSISTED, [no_storage_computed] AS (TRIM(email)), PRIMARY KEY ([id], [tenant_id]), CONSTRAINT [fk_app_user_tenant] FOREIGN KEY ([tenant_id]) REFERENCES [tenant] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION) END",
      'ALTER TABLE [app_user] ADD CONSTRAINT [ak_app_user_email] UNIQUE ([email], [tenant_id])',
      'CREATE UNIQUE INDEX [ix_app_user_email] ON [app_user] ([email])',
      'CREATE INDEX [ix_app_user_active] ON [app_user] ([is_active]) WHERE is_active = true',
      'ALTER TABLE [orders] DROP CONSTRAINT [ak_orders_legacy]',
      'ALTER TABLE [orders] ADD CONSTRAINT [ak_orders_number] UNIQUE ([number])',
      'CREATE INDEX [ix_orders_placed_at] ON [orders] ([placed_at])',
      'DROP INDEX [ix_orders_legacy] ON [orders]',
      'ALTER TABLE [orders] ADD CONSTRAINT [fk_orders_user] FOREIGN KEY ([user_id], [tenant_id]) REFERENCES [app_user] ([id], [tenant_id]) ON DELETE CASCADE',
      'ALTER TABLE [orders] DROP CONSTRAINT [fk_orders_legacy]',
      'ALTER TABLE [orders] ADD [note] NVARCHAR(MAX)',
      'ALTER TABLE [orders] ADD [total] DECIMAL(10,2) NOT NULL DEFAULT 0',
      'ALTER TABLE [orders] ADD [paid] BIT NOT NULL DEFAULT 0',
      'ALTER TABLE [orders] ADD [placed_at] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE [orders] ADD [summary] AS (CONCAT(note, total)) PERSISTED',
      'ALTER TABLE [orders] ALTER COLUMN [total] DECIMAL(10,2)',
      '-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter',
      'ALTER TABLE [orders] DROP COLUMN [summary]',
      'ALTER TABLE [orders] ADD [summary] AS (CONCAT(note, total)) PERSISTED',
      'ALTER TABLE [orders] DROP COLUMN [legacy_flag]',
      "EXEC sp_rename 'orders.qty', 'quantity', 'COLUMN'",
      "EXEC sp_rename 'audit_log', 'audit_trail'",
      'DROP TABLE [obsolete]',
      "INSERT INTO [tenant] ([id], [name], [active]) VALUES (1, 'acme''s', 1)",
      "UPDATE [tenant] SET [name] = 'acme', [active] = 0 WHERE [id] = 1",
      'DELETE FROM [tenant] WHERE [id] = 2'
    ],
    down: [
      'DROP SEQUENCE [order_seq];',
      'DROP TABLE [app_user]',
      'ALTER TABLE [orders] DROP COLUMN [note]',
      'ALTER TABLE [orders] DROP COLUMN [total]',
      'ALTER TABLE [orders] DROP COLUMN [paid]',
      'ALTER TABLE [orders] DROP COLUMN [placed_at]',
      'ALTER TABLE [orders] DROP COLUMN [summary]',
      'DELETE FROM [tenant] WHERE [id] = 1',
      "UPDATE [tenant] SET [name] = 'acme''s', [active] = 1 WHERE [id] = 1",
      "INSERT INTO [tenant] ([id], [name]) VALUES (2, 'old')"
    ]
  }
};

describe('migration DDL survives the DdlStrategy convergence byte-for-byte', () => {
  const dialects: Dialect[] = ['postgresql', 'mysql', 'mssql'];

  for (const dialect of dialects) {
    test(`${dialect}: UP and DOWN match the pre-convergence golden`, () => {
      const sql = generateMigrationFromDiff(ddlConvergenceDiff, dialect);
      expect(sql.up).toEqual(GOLDEN[dialect].up);
      expect(sql.down).toEqual(GOLDEN[dialect].down);
    });
  }
});
