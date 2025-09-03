import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';

class HookedProvider extends SQLiteProvider {
  public before: Array<string> = [];
  public after: Array<string> = [];
  protected async beforeExecute(sql: string, params: any[]): Promise<void> {
    this.before.push(sql);
  }
  protected async afterExecute(sql: string, params: any[], result: any): Promise<void> {
    this.after.push(sql);
  }
}

describe('DatabaseProvider Template Method hooks', () => {
  it('invokes before/after hooks', async () => {
    const provider = new HookedProvider(':memory:');
    await provider.connect();
    await provider.executeNonQuery('CREATE TABLE t (id INTEGER)');
    await provider.executeQuery('SELECT 1');
    expect(provider.before.length).toBeGreaterThan(0);
    expect(provider.after.length).toBeGreaterThan(0);
    await provider.disconnect();
  });
});
