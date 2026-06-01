export interface NormalizerOptions {
  useDatabaseNames: boolean;
  pluralize: boolean;
}

function toPascalCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(s: string): string {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function singularize(name: string): string {
  if (name.endsWith('ies') && name.length > 3) return name.slice(0, -3) + 'y';
  if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes'))
    return name.slice(0, -2);
  if (name.endsWith('s') && !name.endsWith('ss') && name.length > 2) return name.slice(0, -1);
  return name;
}

function pluralizeWord(name: string): string {
  if (name.endsWith('y') && !/[aeiou]y$/.test(name)) return name.slice(0, -1) + 'ies';
  if (name.endsWith('s') || name.endsWith('x') || name.endsWith('z')) return name + 'es';
  return name + 's';
}

export function toClassName(tableName: string, opts: NormalizerOptions): string {
  if (opts.useDatabaseNames) {
    // Preserve original casing from DB; only apply singularization when pluralize=false
    return opts.pluralize ? tableName : singularize(tableName);
  }
  const pascal = toPascalCase(tableName);
  return singularize(pascal);
}

export function toPropertyName(columnName: string, opts: NormalizerOptions): string {
  if (opts.useDatabaseNames) return columnName;
  return toCamelCase(columnName);
}

export function toNavigationPropertyName(
  referencedClassName: string,
  foreignKeyColumns: string[]
): string {
  const fkHint = foreignKeyColumns[0] ?? '';
  const cleaned = fkHint
    .replace(/[Ii][Dd]$/, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (cleaned) return toCamelCase(cleaned) || toCamelCase(referencedClassName);
  return toCamelCase(referencedClassName);
}

export function toContextPropertyName(tableName: string, opts: NormalizerOptions): string {
  if (opts.useDatabaseNames) {
    return opts.pluralize
      ? toCamelCase(tableName)
      : toCamelCase(pluralizeWord(toPascalCase(tableName)));
  }
  const pascal = toPascalCase(tableName);
  const singular = singularize(pascal);
  const plural = opts.pluralize ? pascal : pluralizeWord(singular);
  return toCamelCase(plural);
}
