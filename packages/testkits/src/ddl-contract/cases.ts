import type { DdlStrategy } from '@ts-linq/types';

import {
  cascadeFk,
  commentedEntity,
  compositePkEntity,
  computedCheckEntity,
  computedColumn,
  generatedColumn,
  lengthColumn,
  notNullDefaultColumn,
  plainColumn,
  simpleEntity,
  simpleFk
} from './fixtures';

/** One shared DDL contract input: an id plus how to invoke it against a {@link DdlStrategy}. */
export interface DdlCase<R> {
  id: string;
  invoke(strategy: DdlStrategy): R;
}

export const createTableCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'simple', invoke: (s) => s.generateCreateTableSql(simpleEntity) },
  { id: 'composite-pk', invoke: (s) => s.generateCreateTableSql(compositePkEntity) },
  { id: 'computed-check', invoke: (s) => s.generateCreateTableSql(computedCheckEntity) },
  { id: 'commented', invoke: (s) => s.generateCreateTableSql(commentedEntity) }
];

export const columnDefinitionCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'plain', invoke: (s) => s.generateColumnDefinition(plainColumn) },
  { id: 'not-null-default', invoke: (s) => s.generateColumnDefinition(notNullDefaultColumn) },
  { id: 'generated', invoke: (s) => s.generateColumnDefinition(generatedColumn) },
  { id: 'computed', invoke: (s) => s.generateColumnDefinition(computedColumn) },
  { id: 'length', invoke: (s) => s.generateColumnDefinition(lengthColumn) }
];

export const createIndexCases: ReadonlyArray<DdlCase<string>> = [
  {
    id: 'simple',
    invoke: (s) =>
      s.generateCreateIndexSql('users', {
        name: 'idx_users_name',
        columns: ['name'],
        unique: false
      })
  },
  {
    id: 'unique',
    invoke: (s) =>
      s.generateCreateIndexSql('users', {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true
      })
  }
];

export const addColumnCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'plain', invoke: (s) => s.generateAddColumnSql('users', plainColumn) }
];

export const dropColumnCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'simple', invoke: (s) => s.generateDropColumnSql('users', 'obsolete') }
];

export const alterColumnTypeCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'simple', invoke: (s) => s.generateAlterColumnTypeSql('users', 'description', 'TEXT') }
];

export const renameTableCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'simple', invoke: (s) => s.generateRenameTableSql('old_users', 'new_users') }
];

export const foreignKeyCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'simple', invoke: (s) => s.generateForeignKeySql('posts', simpleFk) },
  { id: 'cascade', invoke: (s) => s.generateForeignKeySql('posts', cascadeFk) }
];

export const addUniqueConstraintCases: ReadonlyArray<DdlCase<string>> = [
  {
    id: 'simple',
    invoke: (s) => s.generateAddUniqueConstraintSql('users', 'AK_User_email', ['email'])
  }
];

export const dropUniqueConstraintCases: ReadonlyArray<DdlCase<string>> = [
  { id: 'simple', invoke: (s) => s.generateDropUniqueConstraintSql('users', 'AK_User_email') }
];

export const commentCases: ReadonlyArray<DdlCase<string[]>> = [
  { id: 'commented', invoke: (s) => s.generateCommentSql(commentedEntity) },
  { id: 'none', invoke: (s) => s.generateCommentSql(simpleEntity) }
];
