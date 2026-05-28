import {
  BoolToZeroOneConverter,
  Column,
  Entity,
  EnumToStringConverter,
  PrimaryKey,
  ValueComparer,
  ValueConverter
} from '@ts-linq/metadata';
import { DbContext, ModelBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

// ── Enum-as-string entity ────────────────────────────────────────────────────

enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest'
}

@Entity({ name: 'vc_users' })
class VcUser {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'TEXT' })
  role!: UserRole;
}

class VcUserContext extends DbContext {
  protected override onModelCreating(mb: ModelBuilder): void {
    mb.entity(VcUser, (b) => {
      b.property((u) => u.role).hasConversion(EnumToStringConverter);
    });
  }
}

// ── Bool-as-0/1 entity ───────────────────────────────────────────────────────

@Entity({ name: 'vc_flags' })
class VcFlag {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'INTEGER' })
  active!: boolean;
}

class VcFlagContext extends DbContext {
  protected override onModelCreating(mb: ModelBuilder): void {
    mb.entity(VcFlag, (b) => {
      b.property((f) => f.active).hasConversion(BoolToZeroOneConverter);
    });
  }
}

// ── JSON array + ValueComparer entity ────────────────────────────────────────

@Entity({ name: 'vc_items' })
class VcItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  tags!: string[];
}

const jsonConverter = new ValueConverter<string[], string>(
  (v) => JSON.stringify(v),
  (v) => JSON.parse(v as string) as string[]
);

const arrayComparer = new ValueComparer<string[]>(
  (a, b) => JSON.stringify(a) === JSON.stringify(b),
  (v) => v.reduce((h, s) => h ^ s.charCodeAt(0), 0),
  (v) => [...v]
);

class VcItemContext extends DbContext {
  protected override onModelCreating(mb: ModelBuilder): void {
    mb.entity(VcItem, (b) => {
      b.property((i) => i.tags).hasConversion(jsonConverter, arrayComparer);
    });
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Value Converters Integration - Enum as string', () => {
  let ctx: VcUserContext;

  beforeEach(async () => {
    ctx = new VcUserContext({ provider: new TestProvider({ file: ':memory:' }) });
    await ctx.ensureCreated();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('round-trips enum through string converter', async () => {
    const user = new VcUser();
    user.name = 'Alice';
    user.role = UserRole.Admin;
    ctx.set(VcUser).add(user);
    await ctx.saveChanges();

    // Query back through the context so the converter is applied on read
    const all = await ctx.set(VcUser).toArray();
    const found = all.find((u) => u.name === 'Alice');
    expect(found?.role).toBe(UserRole.Admin);
  });

  it('stores different enum values correctly', async () => {
    const guest = new VcUser();
    guest.name = 'Bob';
    guest.role = UserRole.Guest;
    ctx.set(VcUser).add(guest);
    await ctx.saveChanges();

    const all = await ctx.set(VcUser).toArray();
    const found = all.find((u) => u.name === 'Bob');
    expect(found?.role).toBe(UserRole.Guest);
  });
});

describe('Value Converters Integration - Bool as 0/1', () => {
  let ctx: VcFlagContext;

  beforeEach(async () => {
    ctx = new VcFlagContext({ provider: new TestProvider({ file: ':memory:' }) });
    await ctx.ensureCreated();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('round-trips boolean through 0/1 converter', async () => {
    const flagOn = new VcFlag();
    flagOn.active = true;
    ctx.set(VcFlag).add(flagOn);
    await ctx.saveChanges();

    const all = await ctx.set(VcFlag).toArray();
    expect(all[0]?.active).toBe(true);
  });

  it('stores false and reads back false', async () => {
    const flagOff = new VcFlag();
    flagOff.active = false;
    ctx.set(VcFlag).add(flagOff);
    await ctx.saveChanges();

    const all = await ctx.set(VcFlag).toArray();
    expect(all[0]?.active).toBe(false);
  });
});

describe('Value Converters Integration - JSON array with ValueComparer', () => {
  let ctx: VcItemContext;

  beforeEach(async () => {
    ctx = new VcItemContext({ provider: new TestProvider({ file: ':memory:' }) });
    await ctx.ensureCreated();
  });

  afterEach(async () => {
    await ctx.dispose();
  });

  it('round-trips string[] through JSON converter', async () => {
    const item = new VcItem();
    item.tags = ['ts', 'orm', 'linq'];
    ctx.set(VcItem).add(item);
    await ctx.saveChanges();

    const all = await ctx.set(VcItem).toArray();
    expect(all[0]?.tags).toEqual(['ts', 'orm', 'linq']);
  });

  it('detects in-place array mutation via ValueComparer', async () => {
    const item = new VcItem();
    item.tags = ['a', 'b'];
    ctx.set(VcItem).add(item);
    await ctx.saveChanges();

    const all = await ctx.set(VcItem).toArray();
    const found = all[0]!;

    // Attach as Unchanged so change tracker can detect mutations
    ctx.changeTracker.attach(found, VcItem);

    // Mutate in place — comparer should detect this
    found.tags.push('c');

    ctx.changeTracker.detectChanges();
    const changes = ctx.changeTracker.getChanges();
    expect(changes.length).toBeGreaterThan(0);
  });
});
