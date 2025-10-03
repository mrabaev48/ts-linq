import { Migration } from './Migration';
import type { DatabaseProvider } from '../DatabaseProvider';
import type { SchemaDiff } from './DiffTypes';
import type { Dialect } from './DialectMigrationSql';
import { generateMigrationFromDiff } from './DialectMigrationSql';

/**
 * Template Method-style base for migrations that are generated from a SchemaDiff.
 * Subclasses provide diff() and dialect(), and this class implements up()/down().
 */
export abstract class DiffBasedMigration extends Migration {
  protected abstract provider: DatabaseProvider;
  protected abstract dialect(): Dialect;
  protected abstract diff(): Promise<SchemaDiff> | SchemaDiff;
  /** Hook before executing all UP statements. */
  protected beforeUp(_sqls: string[]): void {}
  /** Hook after executing all UP statements. */
  protected afterUp(_sqls: string[]): void {}
  /** Hook before executing a single UP statement; return false to skip. */
  protected beforeUpStatement(_sql: string): boolean {
    return true;
  }
  /** Hook after executing a single UP statement. */
  protected afterUpStatement(_sql: string): void {}
  /** Hook before executing all DOWN statements. */
  protected beforeDown(_sqls: string[]): void {}
  /** Hook after executing all DOWN statements. */
  protected afterDown(_sqls: string[]): void {}
  /** Hook before executing a single DOWN statement; return false to skip. */
  protected beforeDownStatement(_sql: string): boolean {
    return true;
  }
  /** Hook after executing a single DOWN statement. */
  protected afterDownStatement(_sql: string): void {}

  public async up(): Promise<void> {
    const schemaDiff = await this.diff();
    const { up } = generateMigrationFromDiff(schemaDiff, this.dialect());
    this.beforeUp(up);
    for (const sql of up) {
      if (!this.beforeUpStatement(sql)) continue;
      await this.provider.executeNonQuery(sql);
      this.afterUpStatement(sql);
    }
    this.afterUp(up);
  }

  public async down(): Promise<void> {
    const schemaDiff = await this.diff();
    const { down } = generateMigrationFromDiff(schemaDiff, this.dialect());
    this.beforeDown(down);
    for (const sql of down) {
      if (!this.beforeDownStatement(sql)) continue;
      await this.provider.executeNonQuery(sql);
      this.afterDownStatement(sql);
    }
    this.afterDown(down);
  }
}
