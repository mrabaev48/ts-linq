import 'reflect-metadata';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Index, Unique } from '../src/decorators/Index';

describe('@Index and @Unique decorators', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('registers column-based index', () => {
    @Index({ name: 'IX_User_name', columns: ['name'] })
    class User {}
    MetadataStorage.addEntity(User, 'User');
    const meta = MetadataStorage.getEntity(User)!;
    expect(meta.indexes.some((i) => i.name === 'IX_User_name' && i.columns.join(',') === 'name' && !i.unique)).toBe(true);
  });

  it('registers unique index', () => {
    @Unique({ name: 'UQ_User_email', columns: ['email'] })
    class User {}
    MetadataStorage.addEntity(User, 'User');
    const meta = MetadataStorage.getEntity(User)!;
    expect(meta.indexes.some((i) => i.name === 'UQ_User_email' && i.unique === true)).toBe(true);
  });

  it('registers expression index with where filter (PG)', () => {
    @Index({ name: 'IX_Post_lower_title', expression: '(lower("title"))', where: 'published = true' })
    class Post {}
    MetadataStorage.addEntity(Post, 'Post');
    const meta = MetadataStorage.getEntity(Post)!;
    const idx = meta.indexes.find((i) => i.name === 'IX_Post_lower_title');
    expect(idx?.expression).toBe('(lower("title"))');
    expect(idx?.where).toBe('published = true');
  });
});


