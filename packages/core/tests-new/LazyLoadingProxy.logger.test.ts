import 'reflect-metadata';

import { LazyLoadingProxy } from '../src/loading/LazyLoadingProxy';

class Author {}

class Post {
  id = 1;
  authorId = 1;
  author?: Author = undefined;
}

/** Relationship whose lazy load fails because the provider rejects. */
function makeMetadataSource(): any {
  const postMeta = {
    target: Post,
    tableName: 'posts',
    primaryKeys: ['id'],
    columns: [],
    relationships: [
      {
        propertyName: 'author',
        type: 'many-to-one',
        targetEntity: Author,
        foreignKey: 'authorId'
      }
    ]
  };
  return {
    getEntity: (cls: unknown) => (cls === Post ? postMeta : undefined)
  };
}

/** Provider whose `findById` rejects, driving the lazy-load failure path. */
function makeRejectingProvider(): any {
  return {
    findById: jest.fn().mockRejectedValue(new Error('db unavailable'))
  };
}

describe('LazyLoadingProxy logger injection', () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('stays silent by default — no console output on a lazy-load failure', async () => {
    const proxy = LazyLoadingProxy.create(
      new Post(),
      Post,
      makeRejectingProvider(),
      makeMetadataSource()
    ) as Post & { author: Promise<unknown> };

    // Accessing the navigation triggers the failing lazy load; the catch path
    // routes a warning through the (default) Null Object logger.
    await proxy.author;

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('routes lazy-load warnings to an injected logger', async () => {
    const logger = { warn: jest.fn<void, [string, unknown?]>() };

    const proxy = LazyLoadingProxy.create(
      new Post(),
      Post,
      makeRejectingProvider(),
      makeMetadataSource(),
      logger
    ) as Post & { author: Promise<unknown> };

    await proxy.author;

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [message, error] = logger.warn.mock.calls[0];
    expect(message).toContain('author');
    expect(error).toBeInstanceOf(Error);
    // The injected sink receives the event; the console stays untouched.
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('threads the injected logger through createMany', async () => {
    const logger = { warn: jest.fn<void, [string, unknown?]>() };

    const [proxy] = LazyLoadingProxy.createMany(
      [new Post()],
      Post,
      makeRejectingProvider(),
      makeMetadataSource(),
      logger
    ) as Array<Post & { author: Promise<unknown> }>;

    await proxy.author;

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
