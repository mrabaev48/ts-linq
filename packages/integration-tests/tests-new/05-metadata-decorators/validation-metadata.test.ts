import { Column, Entity, MaxLengthOf, MinLengthOf, PrimaryKey, RangeOf } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';
import { ValidationError } from '@ts-linq/types';

@Entity({ name: 'meta_validated' })
class ValidatedItem {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  @MinLengthOf(3)
  @MaxLengthOf(10)
  name!: string;

  @Column()
  @RangeOf(0, 100)
  score!: number;
}

class ValidationContext extends DbContext {
  constructor(provider: TestProvider) {
    super({ provider });
  }
}

describe('Metadata Integration - Validation', () => {
  let provider: TestProvider;
  let context: ValidationContext;

  beforeEach(async () => {
    provider = new TestProvider({ file: ':memory:' });
    context = new ValidationContext(provider);
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should pass if data is valid', async () => {
    context.set(ValidatedItem).add({ name: 'Valid', score: 50 } as ValidatedItem);
    await expect(context.saveChanges()).resolves.toBe(1);
  });

  it('should throw if min length violated', async () => {
    context.set(ValidatedItem).add({ name: 'No', score: 50 } as ValidatedItem);
    await expect(context.saveChanges()).rejects.toThrow(ValidationError);
  });

  it('should throw if max length violated', async () => {
    context.set(ValidatedItem).add({ name: 'TooLongNameDetected', score: 50 } as ValidatedItem);
    await expect(context.saveChanges()).rejects.toThrow(ValidationError);
  });

  it('should throw if range violated', async () => {
    context.set(ValidatedItem).add({ name: 'Valid', score: 101 } as ValidatedItem);
    await expect(context.saveChanges()).rejects.toThrow(ValidationError);
  });
});
