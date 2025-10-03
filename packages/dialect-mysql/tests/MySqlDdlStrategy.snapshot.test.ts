import { MySqlDdlStrategy } from '../src';

describe('MySqlDdlStrategy snapshots (smoke)', () => {
  it('maps simple column types', () => {
    const ddl = new MySqlDdlStrategy();
    expect(ddl.mapTypeToMySql('INTEGER')).toBe('INT');
    expect(ddl.mapTypeToMySql('BOOLEAN')).toBe('TINYINT(1)');
  });
});
