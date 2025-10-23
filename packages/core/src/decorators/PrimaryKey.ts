import type { ColumnMetadata } from '@ts-linq/types';
import { PendingMetadataCollector } from '@ts-linq/metadata';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

export interface PrimaryKeyOptions {
  name?: string;
  type?: string;
  autoIncrement?: boolean;
  version?: boolean;
  branded?: boolean;
}

// WeakMap to track which constructors have already registered their metadata
const registeredConstructors = new WeakMap<Function, Set<string>>();

/**
 * Stage-3 property decorator that marks a column as a primary key.
 * Returns an initializer function that registers metadata on first instance creation.
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function PrimaryKeyDecorator(value: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    
    // Return initializer function (Stage-3 pattern for field decorators)
    return function (this: unknown, initialValue: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor;
      if (ctor) {
        // Register metadata once per constructor
        if (!registeredConstructors.has(ctor)) {
          registeredConstructors.set(ctor, new Set());
        }
        const registered = registeredConstructors.get(ctor)!;
        
        if (!registered.has(name)) {
          const columnMeta: ColumnMetadata = {
            propertyName: name,
            columnName: options?.name || name,
            type: options?.type || 'INTEGER',
            nullable: false,
            isGenerated: !!options?.autoIncrement,
            isVersion: !!options?.version,
            isBranded: options?.branded,
            brand: options?.branded ? ctor.name : undefined
          };
          
          PendingMetadataCollector.addColumn(ctor, columnMeta);
          PendingMetadataCollector.addPrimaryKey(ctor, name);
          registered.add(name);
        }
      }
      return initialValue;
    };
  };
}
