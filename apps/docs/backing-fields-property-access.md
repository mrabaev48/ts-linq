# Backing Fields and Property Access Mode

## Why this matters

By default `ts-linq` reads and writes entity properties through the public getter/setter.  
In Domain-Driven Design (DDD) entities often enforce business invariants inside setters:

```ts
class Order {
  private _total: number = 0;

  get total(): number { return this._total; }
  set total(v: number) {
    if (v < 0) throw new Error('Total cannot be negative');
    this._total = v;
  }
}
```

If the database ever stores a legacy `total < 0`, hydration would throw.  
Backing fields let `ts-linq` bypass the setter during materialization while still running it on user mutations.

---

## Configuration

### Per-property: `hasField`

```ts
modelBuilder.entity<Order>(Order)
  .property(o => o.total)
  .hasField('_total');
```

When only `hasField` is called, `ts-linq` defaults to `FieldDuringConstruction`:  
the backing field is used during DB hydration; the public setter is used for all subsequent writes.

### Per-property: `usePropertyAccessMode`

```ts
import { PropertyAccessMode } from '@ts-linq/metadata';

modelBuilder.entity<Order>(Order)
  .property(o => o.status)
  .usePropertyAccessMode(PropertyAccessMode.Field);
```

### Entity-level: override for all properties

```ts
modelBuilder.entity<Order>(Order)
  .usePropertyAccessMode(PropertyAccessMode.FieldDuringConstruction);
```

Individual properties can still override the entity-level mode via `.property(...).usePropertyAccessMode(...)`.

---

## Property access modes

| Mode | Hydration (DB → entity) | User mutation (entity → DB) |
|---|---|---|
| `Property` (default) | Public setter | Public setter |
| `Field` | Direct field write (bypasses setter) | Direct field write (bypasses setter) |
| `FieldDuringConstruction` | Direct field write (bypasses setter) | Public setter |

---

## Backing field convention: `_underscored`

`ts-linq` assumes the backing field is named `_propertyName` when no explicit `hasField(name)` is provided.  
TypeScript `private` fields declared as `private _foo` are ordinary JavaScript object properties — `Reflect.set` can reach them.

```ts
class Order {
  private _total: number = 0;   // ts-linq can read/write `_total`
  get total() { return this._total; }
  set total(v: number) { /* validation */ this._total = v; }
}

modelBuilder.entity<Order>(Order)
  .property(o => o.total)
  .usePropertyAccessMode(PropertyAccessMode.FieldDuringConstruction);
  // No hasField() needed — `_total` is assumed automatically
```

---

## ECMAScript hard-private fields (`#field`)

TypeScript's `#field` syntax (stage-3 private fields) is **not reflectable** from outside the class.  
`ts-linq` cannot read or write `#total` without cooperation from the class itself.

**Workaround**: expose a pair of accessor methods and use the `FieldDuringConstruction` mode with an explicit field name that maps to a shadow property, or simply use the `_underscored` convention instead of `#`.

Full `#field` support via a user-supplied accessor lambda is planned as a follow-up.

---

## Full example: DDD order entity

```ts
class Order {
  private _total: number = 0;
  private _status: string = 'pending';

  get total() { return this._total; }
  set total(v: number) {
    if (v < 0) throw new Error('Total cannot be negative');
    this._total = v;
  }

  get status() { return this._status; }
  set status(v: string) {
    if (!['pending', 'shipped', 'cancelled'].includes(v))
      throw new Error(`Invalid status: ${v}`);
    this._status = v;
  }
}

// In your DbContext.onModelCreating:
modelBuilder.entity<Order>(Order)
  .property(o => o.total)
  .hasField('_total')
  .usePropertyAccessMode(PropertyAccessMode.FieldDuringConstruction);

modelBuilder.entity<Order>(Order)
  .property(o => o.status)
  .hasField('_status')
  .usePropertyAccessMode(PropertyAccessMode.FieldDuringConstruction);
```

Now when `ts-linq` loads an `Order` from the database, it writes `_total` and `_status` directly,  
bypassing the setter invariants. When your application code assigns `order.total = 100`, the setter runs normally.
