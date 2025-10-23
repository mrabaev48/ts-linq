import type { RelationshipMetadata } from '@ts-linq/types';

/**
 * Options for configuring relationships between entities.
 */
export interface RelationshipOptions {
  foreignKey?: string;
  inverseSide?: string;
  cascade?: boolean;
  through?: {
    table: string;
    sourceFk?: string;
    targetFk?: string;
    sourcePk?: string;
    targetPk?: string;
  };
}

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

// Helper function for pending relationships
function getPendingRelationships(ctor: Function): RelationshipMetadata[] {
  if (!(globalThis as any).__tsLinqPendingRelationships) {
    (globalThis as any).__tsLinqPendingRelationships = new WeakMap();
  }
  if (!(globalThis as any).__tsLinqPendingRelationships.has(ctor)) {
    (globalThis as any).__tsLinqPendingRelationships.set(ctor, []);
  }
  return (globalThis as any).__tsLinqPendingRelationships.get(ctor);
}

function defineRelationship(
  kind: RelationshipMetadata['type'],
  targetEntity: () => Function,
  options: RelationshipOptions,
  targetOrValue: unknown,
  propOrContext: unknown
): unknown {
  if (!isStage3FieldContext(propOrContext)) {
    throw new Error('Relationship decorators require TS5 Stage-3 decorators');
  }
  
  const ctx = propOrContext;
  const propertyName = ctx.name.toString();
  
  // Return initializer that queues metadata for @Entity to collect
  return function(this: unknown, initialValue: unknown) {
    const ctor = (this as any)?.constructor;
    if (ctor) {
      // Resolve targetEntity to concrete constructor
      const te = targetEntity as unknown as Function | (() => Function);
      const resolved =
        typeof te === 'function' && (te as { prototype?: unknown }).prototype
          ? (te as Function)
          : (te as () => Function)();
      
      const relationship: RelationshipMetadata = {
        propertyName,
        type: kind,
        targetEntity: resolved,
        foreignKey: options?.foreignKey,
        inverseSide: options?.inverseSide,
        cascade: options?.cascade || false,
        through: options?.through
      };
      
      const pending = getPendingRelationships(ctor);
      if (!pending.some(r => r.propertyName === propertyName)) {
        pending.push(relationship);
      }
    }
    return initialValue;
  };
}

/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export function OneToMany(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship('one-to-many', targetEntity, options, targetOrValue, propOrContext);
  };
}

/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export function ManyToOne(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship('many-to-one', targetEntity, options, targetOrValue, propOrContext);
  };
}

/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export function OneToOne(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship('one-to-one', targetEntity, options, targetOrValue, propOrContext);
  };
}

/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export function ManyToMany(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship('many-to-many', targetEntity, options, targetOrValue, propOrContext);
  };
}
