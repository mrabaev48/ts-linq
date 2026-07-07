import type { DdlStrategyContractGolden } from '@ts-linq/testkits';

/**
 * MySQL golden expectations for the shared DDL contract (task-7). Captured from the current
 * (byte-verified) `MySqlDdlStrategy` output. MySQL emits comments inline (table-level `COMMENT=`
 * and column `COMMENT`), so `generateCommentSql` returns `[]`. Double-quoted strings are used here
 * because the SQL contains backtick identifiers.
 */
export const mysqlGolden: DdlStrategyContractGolden = {
  createTable: {
    simple:
      'CREATE TABLE IF NOT EXISTS `users` (`id` INT NOT NULL AUTO_INCREMENT, `name` TEXT NOT NULL, `age` INT, PRIMARY KEY (`id`))',
    'composite-pk':
      'CREATE TABLE IF NOT EXISTS `order_items` (`order_id` INT NOT NULL, `product_id` INT NOT NULL, `quantity` INT NOT NULL, PRIMARY KEY (`order_id`, `product_id`))',
    'computed-check':
      'CREATE TABLE IF NOT EXISTS `products` (`id` INT NOT NULL AUTO_INCREMENT, `price` INT NOT NULL, `total` INT GENERATED ALWAYS AS (price * 2) VIRTUAL, PRIMARY KEY (`id`), CONSTRAINT `chk_price` CHECK (price > 0))',
    commented:
      "CREATE TABLE IF NOT EXISTS `accounts` (`id` INT NOT NULL AUTO_INCREMENT, `email` TEXT NOT NULL COMMENT 'Login email', PRIMARY KEY (`id`)) COMMENT='User accounts'"
  },
  columnDefinition: {
    plain: '`name` TEXT',
    'not-null-default': '`active` TINYINT(1) NOT NULL DEFAULT 1',
    generated: '`id` INT NOT NULL AUTO_INCREMENT',
    computed: '`total` INT GENERATED ALWAYS AS (a + b) VIRTUAL',
    length: '`code` TEXT(50)'
  },
  createIndex: {
    simple: 'CREATE INDEX IF NOT EXISTS `idx_users_name` ON `users` (`name`)',
    unique: 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_users_email` ON `users` (`email`)'
  },
  addColumn: {
    plain: 'ALTER TABLE `users` ADD COLUMN `name` TEXT'
  },
  dropColumn: {
    simple: 'ALTER TABLE `users` DROP COLUMN `obsolete`'
  },
  alterColumnType: {
    simple: 'ALTER TABLE `users` MODIFY COLUMN `description` TEXT'
  },
  renameTable: {
    simple: 'ALTER TABLE `old_users` RENAME TO `new_users`'
  },
  foreignKey: {
    simple:
      'ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)',
    cascade:
      'ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE'
  },
  addUniqueConstraint: {
    simple: 'ALTER TABLE `users` ADD UNIQUE KEY `AK_User_email` (`email`)'
  },
  dropUniqueConstraint: {
    simple: 'ALTER TABLE `users` DROP INDEX `AK_User_email`'
  },
  comment: {
    commented: [],
    none: []
  }
};
