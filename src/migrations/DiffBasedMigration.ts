import { Migration } from './Migration';
import { DatabaseProvider } from '../providers/DatabaseProvider';
import { SchemaDiff } from './DiffTypes';
import { Dialect, generateMigrationFromDiff } from './DialectMigrationSql';

/**
 * Template Method-style base for migrations that are generated from a SchemaDiff.
 * Subclasses provide diff() and dialect(), and this class implements up()/down().
 */
export abstract class DiffBasedMigration extends Migration {
  protected abstract provider: DatabaseProvider;
  protected abstract dialect(): Dialect;
  protected abstract diff(): Promise<SchemaDiff> | SchemaDiff;
  /** Hook before executing all UP statements. */
  protected async beforeUp(_sqls: string[]): Promise<void> {}
  /** Hook after executing all UP statements. */
  protected async afterUp(_sqls: string[]): Promise<void> {}
  /** Hook before executing a single UP statement; return false to skip. */
  protected async beforeUpStatement(_sql: string): Promise<boolean> {
    return true;
  }
  /** Hook after executing a single UP statement. */
  protected async afterUpStatement(_sql: string): Promise<void> {}
  /** Hook before executing all DOWN statements. */
  protected async beforeDown(_sqls: string[]): Promise<void> {}
  /** Hook after executing all DOWN statements. */
  protected async afterDown(_sqls: string[]): Promise<void> {}
  /** Hook before executing a single DOWN statement; return false to skip. */
  protected async beforeDownStatement(_sql: string): Promise<boolean> {
    return true;
  }
  /** Hook after executing a single DOWN statement. */
  protected async afterDownStatement(_sql: string): Promise<void> {}

  public async up(): Promise<void> {
    const d = await this.diff();
    const { up } = generateMigrationFromDiff(d, this.dialect());
    await this.beforeUp(up);
    for (const sql of up) {
      if (!(await this.beforeUpStatement(sql))) continue;
      await this.provider.executeNonQuery(sql);
      await this.afterUpStatement(sql);
    }
    await this.afterUp(up);
  }

  public async down(): Promise<void> {
    const d = await this.diff();
    const { down } = generateMigrationFromDiff(d, this.dialect());
    await this.beforeDown(down);
    for (const sql of down) {
      if (!(await this.beforeDownStatement(sql))) continue;
      await this.provider.executeNonQuery(sql);
      await this.afterDownStatement(sql);
    }
    await this.afterDown(down);
  }
}
