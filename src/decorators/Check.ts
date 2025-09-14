import { MetadataStorage } from '../metadata/MetadataStorage';

/**
 * Table-level CHECK constraint decorator.
 * Usage: @Check('age >= 0', 'ck_users_age_non_negative')
 */
export function Check(expression: string, name?: string): ClassDecorator {
  return (target: Function) => {
    MetadataStorage.addCheck(target, { name, expression });
  };
}


