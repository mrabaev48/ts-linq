import type { ColumnMetadata, ColumnType } from '@ts-linq/types';
import { PendingMetadataCollector } from '@ts-linq/metadata';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

/**
 * Options for configuring a column mapping on an entity property.
 */
export interface ColumnOptions {
  name?: string;
  type?: ColumnType | string;
  nullable?: boolean;
  defaultValue?: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  generated?: boolean;
  /** Marks this column as an optimistic concurrency token (version). */
  version?: boolean;
}

// WeakMap to track which constructors have already registered their metadata
const registeredConstructors = new WeakMap<Function, Set<string>>();

/**
 * Stage-3 property decorator that registers column metadata.
 * Returns an initializer function that registers metadata on first instance creation.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function ColumnDecorator(value: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@Column requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    
    // Return initializer function (Stage-3 pattern for field decorators)
    return function (this: unknown, initialValue: unknown) {
      console.log(`[@Column initializer called for ${name}]`);
      const ctor = (this as { constructor?: Function })?.constructor;
      console.log(`[@Column constructor:`, ctor?.name || 'undefined', `]`);
      if (ctor) {
        // Register metadata once per constructor
        if (!registeredConstructors.has(ctor)) {
          registeredConstructors.set(ctor, new Set());
        }
        const registered = registeredConstructors.get(ctor)!;
        
        if (!registered.has(name)) {
          console.log(`[@Column registering ${name} on ${ctor.name}]`);
          const columnMetadata: ColumnMetadata = {
            propertyName: name,
            columnName: options?.name || name,
            type: options?.type || 'TEXT',
            nullable: options?.nullable !== false,
            defaultValue: options?.defaultValue,
            length: options?.length,
            precision: options?.precision,
            scale: options?.scale,
            isGenerated: options?.generated || false,
            isVersion: options?.version || false
          };
          
          PendingMetadataCollector.addColumn(ctor, columnMetadata);
          registered.add(name);
          console.log(`[@Column registered ${name}, pending columns:`, PendingMetadataCollector.getColumns(ctor).size, `]`);
        }
      }
      return initialValue;
    };
  };
}
