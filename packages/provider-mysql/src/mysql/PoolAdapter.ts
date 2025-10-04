import type { SqlParameter } from '@ts-linq/core';

export interface MySqlPoolLike {
  query(sql: string, params?: readonly SqlParameter[]): Promise<[unknown]>;
  execute(sql: string, params?: readonly SqlParameter[]): Promise<[unknown]>;
  end(): Promise<void>;
}

export function createMySqlPool(connectionString: string): MySqlPoolLike {
  const mysql = safeRequireMysql2();
  return mysql.createPool(connectionString);
}

function safeRequireMysql2(): { createPool: (connectionString: string) => MySqlPoolLike } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mysql2/promise');
  } catch {
    throw new Error(
      'Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2'
    );
  }
}
