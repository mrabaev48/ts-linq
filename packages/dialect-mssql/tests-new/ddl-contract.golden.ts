import type { DdlStrategyContractGolden } from '@ts-linq/testkits';

/**
 * SQL Server golden expectations for the shared DDL contract (task-7). Captured from the current
 * (byte-verified) `MssqlDdlStrategy` output. See `@ts-linq/testkits` `runDdlStrategyContract`.
 */
export const mssqlGolden: DdlStrategyContractGolden = {
  createTable: {
    simple: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users') BEGIN CREATE TABLE [users] ([id] INT IDENTITY(1,1) NOT NULL, [name] NVARCHAR(MAX) NOT NULL, [age] INT, PRIMARY KEY ([id])) END`,
    'composite-pk': `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'order_items') BEGIN CREATE TABLE [order_items] ([order_id] INT NOT NULL, [product_id] INT NOT NULL, [quantity] INT NOT NULL, PRIMARY KEY ([order_id], [product_id])) END`,
    'computed-check': `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products') BEGIN CREATE TABLE [products] ([id] INT IDENTITY(1,1) NOT NULL, [price] INT NOT NULL, [total] AS (price * 2), PRIMARY KEY ([id]), CONSTRAINT [chk_price] CHECK (price > 0)) END`,
    commented: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'accounts') BEGIN CREATE TABLE [accounts] ([id] INT IDENTITY(1,1) NOT NULL, [email] NVARCHAR(MAX) NOT NULL, PRIMARY KEY ([id])) END`
  },
  columnDefinition: {
    plain: `[name] NVARCHAR(MAX)`,
    'not-null-default': `[active] BIT NOT NULL DEFAULT 1`,
    generated: `[id] INT IDENTITY(1,1) NOT NULL`,
    computed: `[total] AS (a + b)`,
    length: `[code] NVARCHAR(50)`
  },
  createIndex: {
    simple: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_users_name' AND object_id=OBJECT_ID('users')) CREATE INDEX [idx_users_name] ON [users] ([name])`,
    unique: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_users_email' AND object_id=OBJECT_ID('users')) CREATE UNIQUE INDEX [idx_users_email] ON [users] ([email])`
  },
  addColumn: {
    plain: `ALTER TABLE [users] ADD [name] NVARCHAR(MAX)`
  },
  dropColumn: {
    simple: `ALTER TABLE [users] DROP COLUMN [obsolete]`
  },
  alterColumnType: {
    simple: `ALTER TABLE [users] ALTER COLUMN [description] NVARCHAR(MAX)`
  },
  renameTable: {
    simple: `EXEC sp_rename 'old_users', 'new_users'`
  },
  foreignKey: {
    simple: `ALTER TABLE [posts] ADD CONSTRAINT [fk_posts_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id])`,
    cascade: `ALTER TABLE [posts] ADD CONSTRAINT [fk_posts_user] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON DELETE CASCADE ON UPDATE CASCADE`
  },
  addUniqueConstraint: {
    simple: `ALTER TABLE [users] ADD CONSTRAINT [AK_User_email] UNIQUE ([email])`
  },
  dropUniqueConstraint: {
    simple: `ALTER TABLE [users] DROP CONSTRAINT [AK_User_email]`
  },
  comment: {
    commented: [
      `EXEC sp_addextendedproperty 'MS_Description', N'User accounts', 'SCHEMA', N'dbo', 'TABLE', N'accounts'`,
      `EXEC sp_addextendedproperty 'MS_Description', N'Login email', 'SCHEMA', N'dbo', 'TABLE', N'accounts', 'COLUMN', N'email'`
    ],
    none: []
  }
};
