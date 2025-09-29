import { ArgReader } from '../src/services/ArgReader';

describe('ArgReader', () => {
  it('reads flags with space and equals', () => {
    const r = new ArgReader(['cmd', '--dir', 'src/entities', '--name=User', '--dry-run']);
    expect(r.flag('dir')).toBe('src/entities');
    expect(r.flag('name')).toBe('User');
    expect(r.flag('dry-run')).toBe(true);
    expect(r.flag('missing')).toBeUndefined();
  });
});
