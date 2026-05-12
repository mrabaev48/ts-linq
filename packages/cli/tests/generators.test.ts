import { EntityTemplateBuilder } from '../src/generators/EntityTemplateBuilder';
import { MigrationTemplateBuilder } from '../src/generators/MigrationTemplateBuilder';

describe('generators', () => {
  it('EntityTemplateBuilder builds default and from columns', () => {
    const b = new EntityTemplateBuilder();
    const def = b.buildDefault('User', 'users');
    expect(def).toContain("@Entity({ name: 'users' })");
    expect(def).toContain('export class User');

    const tpl = b.buildFromColumns('User', 'users', [
      { name: 'id', ormType: 'INTEGER', nullable: false, isPrimary: true },
      { name: 'name', ormType: 'TEXT', nullable: false, isPrimary: false }
    ]);
    expect(tpl).toContain('@PrimaryKey');
    expect(tpl).toContain('@Column');
    expect(tpl).toContain('public name!: string;');
  });

  it('MigrationTemplateBuilder builds up/down class', () => {
    const m = new MigrationTemplateBuilder();
    const code = m.build('AddUsers', '20250101010101');
    expect(code).toContain('export class AddUsers extends Migration');
    expect(code).toContain("protected get version() { return '20250101010101'; }");
  });
});
