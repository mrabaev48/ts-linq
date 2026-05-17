import { Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';
import { OrmMiddleware } from '@ts-linq/types';

@Entity({ name: 'mw_items' })
class MwItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;
}

class MwContext extends DbContext {
  constructor(provider: TestProvider) {
    super({ provider });
  }
}

describe('Advanced Features - Middleware Pipeline', () => {
  let provider: TestProvider;
  let context: MwContext;
  let middleware: OrmMiddleware;
  let beforeCalled = 0;
  let afterCalled = 0;

  beforeEach(async () => {
    beforeCalled = 0;
    afterCalled = 0;

    middleware = {
      beforeExecute: async (info) => {
        beforeCalled++;
        // Can inspect info.sql
      },
      afterExecute: async (info) => {
        afterCalled++;
      }
    };

    provider = new TestProvider({
      file: ':memory:',
      middlewares: [middleware]
    });

    context = new MwContext(provider);
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should invoke middleware hooks around queries', async () => {
    // This should trigger at least one query (SELECT or INSERT) logic inside ensureCreated triggers creates.
    // But reset counters first
    beforeCalled = 0;
    afterCalled = 0;

    await context.set(MwItem).count();

    expect(beforeCalled).toBeGreaterThan(0);
    expect(afterCalled).toBeGreaterThan(0);
    expect(beforeCalled).toBe(afterCalled);
  });

  it('should allow middleware to error', async () => {
    // Create new provider with failing middleware
    const blockingMiddleware = {
      beforeExecute: async () => {
        throw new Error('Blocked by MW');
      }
    };
    const blockingProvider = new TestProvider({
      file: ':memory:',
      middlewares: [blockingMiddleware]
    });
    const blockingContext = new MwContext(blockingProvider);

    await expect(blockingContext.set(MwItem).count()).rejects.toThrow('Blocked by MW');
  });
});
