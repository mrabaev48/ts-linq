'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const MigrationTemplate_1 = require('../src/migrations/MigrationTemplate');
describe('MigrationTemplate', () => {
  it('generates a TS class with up/down', () => {
    const diff = {
      tables: [
        {
          table: 'Users',
          create: {
            name: 'Users',
            columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
            primaryKeys: ['id'],
            indexes: [],
            foreignKeys: []
          }
        }
      ]
    };
    const src = (0, MigrationTemplate_1.generateMigrationClassSource)(diff, {
      className: 'CreateUsers',
      version: '001',
      dialect: 'postgresql'
    });
    expect(src.includes('class CreateUsers extends Migration')).toBe(true);
    expect(src.includes('await provider.executeNonQuery')).toBe(true);
    expect(src.includes('CREATE TABLE IF NOT EXISTS')).toBe(true);
  });
});
//# sourceMappingURL=migration-template.test.js.map
