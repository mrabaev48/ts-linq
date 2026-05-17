import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

@Entity({ name: 'audit_items' })
class AuditItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;
  @Column()
  name!: string;

  @Column({ nullable: true })
  createdAt!: Date;

  @Column({ nullable: true })
  updatedAt!: Date;

  @Column({ nullable: true })
  createdBy!: string;

  @Column({ nullable: true })
  updatedBy!: string;
}

class AuditContext extends DbContext {
  constructor(provider: TestProvider) {
    super({
      provider,
      audit: {
        enabled: true,
        getCurrentUser: () => 'test-user'
        // Use default column names
      }
    });
  }
}

describe('Advanced Features - Audit & ChangeTracking', () => {
  let provider: TestProvider;
  let context: AuditContext;

  beforeEach(async () => {
    provider = new TestProvider(':memory:');
    context = new AuditContext(provider);
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should set created fields on insert', async () => {
    context.set(AuditItem).add({ name: 'NewItem' } as AuditItem);
    await context.saveChanges();

    const item = await context.set(AuditItem).first();
    expect(item).toBeDefined();
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.createdBy).toBe('test-user');
    // updatedAt should be null or set? Logic says applyUpdatedAudit is also called on added?
    // DbContext line 812: if state === added || modified -> applyUpdatedAudit.
    // So updatedAt should also be set.
    expect(item.updatedAt).toBeInstanceOf(Date);
    expect(item.updatedBy).toBe('test-user');
  });

  it('should update timestamp on modify', async () => {
    context.set(AuditItem).add({ name: 'Item' } as AuditItem);
    await context.saveChanges();

    const item = await context.set(AuditItem).first();
    const originalUpdate = item.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 10));

    item.name = 'Modified';
    // Need to mark as modified via update or change tracker
    context.set(AuditItem).update(item);
    await context.saveChanges();

    const updated = await context.set(AuditItem).first();
    expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdate.getTime());
  });
});
