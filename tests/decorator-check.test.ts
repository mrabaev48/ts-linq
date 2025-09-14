import { Check } from '../src/decorators/Check';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

describe('@Check decorator', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  test('registers check constraint in metadata', () => {
    @Check('age >= 0', 'ck_users_age_non_negative')
    class User {}
    const meta = MetadataStorage.getEntity(User)!;
    expect(meta.checks).toBeDefined();
    expect(meta.checks!.some((c) => c.name === 'ck_users_age_non_negative' && c.expression === 'age >= 0')).toBe(true);
  });
});


