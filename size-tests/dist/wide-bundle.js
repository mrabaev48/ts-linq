import 'reflect-metadata';
import { createHash as e } from 'node:crypto';
var t, r, s;
(!(function (e) {
  ((e.Unchanged = 'unchanged'),
    (e.Added = 'added'),
    (e.Modified = 'modified'),
    (e.Deleted = 'deleted'));
})(t || (t = {})),
  (function (e) {
    ((e.Lazy = 'lazy'), (e.Eager = 'eager'));
  })(r || (r = {})),
  (function (e) {
    ((e.Inner = 'INNER'), (e.Left = 'LEFT'), (e.Right = 'RIGHT'), (e.Full = 'FULL'));
  })(s || (s = {})));
const i = (e) => ({ ok: !0, value: e }),
  n = (e) => ({ ok: !1, error: e });
class a extends Error {
  constructor(e, t) {
    (super(e), (this.name = 'DatabaseError'), (this.code = t));
  }
}
class o extends Error {
  constructor(e, t) {
    (super(e), (this.name = 'ValidationError'), (this.details = t));
  }
}
class l {
  constructor(e) {
    this.metadata = {
      target: e,
      tableName: e.name,
      columns: [],
      primaryKeys: [],
      relationships: [],
      indexes: []
    };
  }
  setTableName(e) {
    return ((this.metadata.tableName = e), this);
  }
  addColumn(e) {
    return (
      (this.metadata.columns = this.metadata.columns || []),
      this.metadata.columns.push(e),
      this
    );
  }
  addPrimaryKey(e) {
    return (
      (this.metadata.primaryKeys = this.metadata.primaryKeys || []),
      this.metadata.primaryKeys.includes(e) || this.metadata.primaryKeys.push(e),
      this
    );
  }
  addRelationship(e) {
    return (
      (this.metadata.relationships = this.metadata.relationships || []),
      this.metadata.relationships.push(e),
      this
    );
  }
  addIndex(e) {
    return (
      (this.metadata.indexes = this.metadata.indexes || []),
      this.metadata.indexes.push(e),
      this
    );
  }
  build() {
    if (!this.metadata.target) throw new Error('Entity target is required');
    return {
      target: this.metadata.target,
      tableName: this.metadata.tableName || this.metadata.target.name,
      columns: this.metadata.columns || [],
      primaryKeys: this.metadata.primaryKeys || [],
      relationships: this.metadata.relationships || [],
      indexes: this.metadata.indexes || []
    };
  }
}
class c {
  normalizeTarget(e) {
    const t = Reflect.getOwnMetadata,
      r = t?.('orm:original', e);
    return ('function' == typeof r ? r : void 0) ?? e;
  }
  constructor() {
    ((this.entities = new Map()), (this.builders = new Map()));
  }
  static getInstance() {
    return (c.instance || (c.instance = new c()), c.instance);
  }
  static getEntities() {
    return c.getInstance().getAllEntities();
  }
  static getEntity(e) {
    const t = Reflect.getOwnMetadata,
      r = t?.('orm:original', e),
      s = 'function' == typeof r ? r : e,
      i = c.getInstance().getEntityMetadata(s);
    if (i) return s !== e ? { ...i, target: e } : i;
  }
  static addEntity(e, t) {
    c.getInstance().registerEntity(e, t);
  }
  static addColumn(e, t) {
    c.getInstance().addColumnMetadata(e, t);
  }
  static addPrimaryKey(e, t) {
    c.getInstance().addPrimaryKeyMetadata(e, t);
  }
  static addRelationship(e, t) {
    c.getInstance().addRelationshipMetadata(e, t);
  }
  static addIndex(e, t) {
    c.getInstance().addIndexMetadata(e, t);
  }
  getOrCreateBuilder(e) {
    const t = this.normalizeTarget(e);
    return (this.builders.has(t) || this.builders.set(t, new l(t)), this.builders.get(t));
  }
  registerEntity(e, t) {
    const r = this.getOrCreateBuilder(e);
    t && r.setTableName(t);
  }
  addColumnMetadata(e, t) {
    if (void 0 !== t.defaultExpression && void 0 !== t.defaultValue)
      throw new o(`Column ${t.columnName} cannot have both defaultExpression and defaultValue`);
    if (t.isComputed) {
      if (void 0 !== t.defaultValue || void 0 !== t.defaultExpression)
        throw new o(`Computed column ${t.columnName} cannot have defaultValue/defaultExpression`);
      if (t.isGenerated)
        throw new o(`Computed column ${t.columnName} cannot be marked as isGenerated`);
      if (t.isVersion) throw new o(`Computed column ${t.columnName} cannot be a version column`);
      t.isReadOnly = !0;
    }
    const r = this.normalizeTarget(e),
      s = this.entities.get(r);
    if (s)
      return void (
        s.columns.some((e) => e.propertyName === t.propertyName) || (s.columns = [...s.columns, t])
      );
    this.getOrCreateBuilder(e).addColumn(t);
  }
  addPrimaryKeyMetadata(e, t) {
    const r = this.normalizeTarget(e),
      s = this.entities.get(r);
    if (s) return void (s.primaryKeys.includes(t) || (s.primaryKeys = [...s.primaryKeys, t]));
    this.getOrCreateBuilder(e).addPrimaryKey(t);
  }
  addRelationshipMetadata(e, t) {
    this.getOrCreateBuilder(e).addRelationship(t);
  }
  addIndexMetadata(e, t) {
    const r = this.normalizeTarget(e),
      s = this.entities.get(r);
    if (s) {
      if (s.indexes.some((e) => e.name === t.name))
        throw new o(`Duplicate index name '${t.name}' on entity '${s.tableName}'`);
      const e = new Set(s.columns.map((e) => [e.columnName, e.propertyName]).flat()),
        r = t.columns.filter((t) => !e.has(t));
      if (r.length > 0)
        throw new o(
          `Index '${t.name}' on entity '${s.tableName}' references unknown columns: ${r.join(', ')}`
        );
      return void (s.indexes = [...s.indexes, t]);
    }
    const i = this.getOrCreateBuilder(e),
      n = i.build();
    if ((n.indexes || []).some((e) => e.name === t.name))
      throw new o(`Duplicate index name '${t.name}' on entity '${n.tableName}'`);
    const a = new Set((n.columns || []).map((e) => [e.columnName, e.propertyName]).flat()),
      l = t.columns.filter((e) => !a.has(e));
    if (l.length > 0)
      throw new o(
        `Index '${t.name}' on entity '${n.tableName}' references unknown columns: ${l.join(', ')}`
      );
    i.addIndex(t);
  }
  finalizeEntity(e) {
    const t = this.normalizeTarget(e);
    if (this.builders.has(t)) {
      const e = this.builders.get(t).build();
      (this.entities.set(t, e), this.builders.delete(t));
    }
  }
  getEntityMetadata(e) {
    const t = this.normalizeTarget(e);
    return (this.builders.has(t) && this.finalizeEntity(t), this.entities.get(t));
  }
  getAllEntities() {
    for (const e of this.builders.keys()) this.finalizeEntity(e);
    return Array.from(this.entities.values());
  }
  clear() {
    (this.entities.clear(), this.builders.clear());
  }
}
function u(e) {
  if (!e || !e.name) return 'TEXT';
  switch (e.name) {
    case 'String':
    case 'Array':
    case 'Object':
    default:
      return 'TEXT';
    case 'Number':
      return 'INTEGER';
    case 'Boolean':
      return 'BOOLEAN';
    case 'Date':
      return 'DATETIME';
  }
}
function h(e, t, r, s, i) {
  if ((n = i) && 'object' == typeof n && 'field' === n.kind && 'name' in n) {
    const s = i,
      n = s.name.toString();
    return void s.addInitializer?.(function () {
      const s = this?.constructor;
      if (!s) return;
      const i = {
        propertyName: n,
        type: e,
        targetEntity: t,
        foreignKey: r?.foreignKey,
        inverseSide: r?.inverseSide,
        cascade: r?.cascade || !1
      };
      c.addRelationship(s, i);
      const a = Reflect.getOwnMetadata('orm:relationships', s) || [];
      (a.push(i), Reflect.defineMetadata('orm:relationships', a, s));
    });
  }
  var n;
  const a = s,
    o = {
      propertyName: i.toString(),
      type: e,
      targetEntity: t,
      foreignKey: r?.foreignKey,
      inverseSide: r?.inverseSide,
      cascade: r?.cascade || !1
    };
  c.addRelationship(a.constructor, o);
  const l = a.constructor,
    u = Reflect.getOwnMetadata('orm:relationships', l) || [];
  (u.push(o), Reflect.defineMetadata('orm:relationships', u, l));
}
function d(e) {
  return !!e && 'object' == typeof e && 'field' === e.kind && 'name' in e;
}
function p(e, t, r) {
  return function (s, i) {
    if (!d(i)) throw new Error('@ValidIf requires TS5 Stage-3 decorators');
    const n = i,
      a = n.name.toString();
    n.addInitializer?.(function () {
      const s = this?.constructor;
      if (!s) return;
      const i = Reflect.getOwnMetadata('orm:validations', s) || [];
      (i.push({
        propertyName: a,
        predicate: e,
        message: t,
        phase: r?.phase,
        messageKey: r?.messageKey,
        messageParams: r?.messageParams
      }),
        Reflect.defineMetadata('orm:validations', i, s));
    });
  };
}
class m {
  constructor() {
    this._trackedEntities = new Map();
  }
  add(e, r) {
    this._trackedEntities.set(e, { entity: e, entityClass: r, state: t.Added });
  }
  update(e, r) {
    const s = this._trackedEntities.get(e);
    s
      ? (s.state = t.Modified)
      : this._trackedEntities.set(e, {
          entity: e,
          entityClass: r,
          state: t.Modified,
          originalValues: this.cloneObject(e)
        });
  }
  remove(e, r) {
    const s = this._trackedEntities.get(e);
    s
      ? (s.state = t.Deleted)
      : this._trackedEntities.set(e, { entity: e, entityClass: r, state: t.Deleted });
  }
  attach(e, r) {
    this._trackedEntities.set(e, {
      entity: e,
      entityClass: r,
      state: t.Unchanged,
      originalValues: this.cloneObject(e)
    });
  }
  getChanges() {
    return Array.from(this._trackedEntities.values()).filter((e) => e.state !== t.Unchanged);
  }
  getEntityState(e) {
    const r = this._trackedEntities.get(e);
    return r ? r.state : t.Unchanged;
  }
  acceptAllChanges() {
    for (const e of this._trackedEntities.values())
      e.state === t.Deleted
        ? this._trackedEntities.delete(e.entity)
        : ((e.state = t.Unchanged), (e.originalValues = this.cloneObject(e.entity)));
  }
  clear() {
    this._trackedEntities.clear();
  }
  detectChanges() {
    for (const e of this._trackedEntities.values())
      e.state === t.Unchanged &&
        e.originalValues &&
        (this.areObjectsEqual(e.entity, e.originalValues) || (e.state = t.Modified));
  }
  cloneObject(e) {
    return JSON.parse(JSON.stringify(e));
  }
  areObjectsEqual(e, t) {
    return JSON.stringify(e) === JSON.stringify(t);
  }
}
const y = Symbol('lazyLoadingTarget'),
  f = Symbol('lazyLoadingProvider'),
  g = Symbol('lazyLoadingProxy'),
  _ = Symbol('lazyLoadingState');
class E {
  static create(e, t, r) {
    if (this.isLazyProxy(e)) return e;
    const s = c.getEntity(t);
    if (!s || 0 === s.relationships.length) return e;
    const i = {};
    for (const t of s.relationships) {
      i[t.propertyName] = { isLoaded: !1, isLoading: !1 };
      const r = e[t.propertyName];
      null != r && (i[t.propertyName].isLoaded = !0);
    }
    return new Proxy(e, {
      get(e, n, a) {
        if (n === y) return e;
        if (n === f) return r;
        if (n === g) return !0;
        if (n === _) return i;
        const o = String(n),
          l = s.relationships.find((e) => e.propertyName === o);
        return !l || i[o].isLoaded || i[o].isLoading
          ? l && i[o].isLoading
            ? i[o].loadingPromise
            : Reflect.get(e, n, a)
          : ((i[o].isLoading = !0),
            (i[o].loadingPromise = E.loadRelationship(e, t, l, r)
              .then(
                (t) => (
                  (e[o] = t),
                  (i[o].isLoaded = !0),
                  (i[o].isLoading = !1),
                  delete i[o].loadingPromise,
                  t
                )
              )
              .catch(
                (e) => (
                  console.warn(`Failed to lazy load ${o}:`, e),
                  (i[o].isLoading = !1),
                  delete i[o].loadingPromise,
                  'one-to-many' === l.type ? [] : null
                )
              )),
            i[o].loadingPromise);
      },
      set(e, t, r, n) {
        const a = String(t);
        return (
          s.relationships.find((e) => e.propertyName === a) &&
            ((i[a].isLoaded = !0), (i[a].isLoading = !1), delete i[a].loadingPromise),
          Reflect.set(e, t, r, n)
        );
      },
      has: (e, t) => t === g || t === y || t === f || t === _ || Reflect.has(e, t),
      ownKeys: (e) => Reflect.ownKeys(e).filter((e) => e !== y && e !== f && e !== g && e !== _),
      getOwnPropertyDescriptor: (e, t) =>
        t === g || t === y || t === f || t === _
          ? { configurable: !0, enumerable: !1, writable: !1, value: !0 }
          : Reflect.getOwnPropertyDescriptor(e, t)
    });
  }
  static createMany(e, t, r) {
    return e.map((e) => this.create(e, t, r));
  }
  static isLazyProxy(e) {
    return !!e?.[g];
  }
  static getTarget(e) {
    return this.isLazyProxy(e) ? e[y] : e;
  }
  static getLoadingState(e) {
    return this.isLazyProxy(e) ? e[_] : null;
  }
  static isRelationshipLoaded(e, t) {
    const r = this.getLoadingState(e);
    return r?.[t]?.isLoaded ?? !1;
  }
  static async preloadRelationships(e, t, r, s) {
    if (0 === e.length) return;
    const i = c.getEntity(t);
    if (!i) return;
    const n = [],
      a = [];
    for (const t of e) this.isLazyProxy(t) ? n.push(t) : a.push(t);
    for (const e of r) {
      const r = i.relationships.find((t) => t.propertyName === e);
      if (!r) continue;
      const o = n.filter((t) => {
        const r = this.getLoadingState(t);
        return r && !r[e].isLoaded && !r[e].isLoading;
      });
      (o.length > 0 && (await this.batchLoadRelationship(o, t, r, s)),
        a.length > 0 && (await this.batchLoadRelationship(a, t, r, s)));
    }
  }
  static async loadRelationship(e, t, r, s) {
    const i = c.getEntity(t);
    if (!i) return null;
    const n = this.resolveTargetEntity(r.targetEntity);
    switch (r.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const t = e[r.foreignKey || this.defaultForeignKeyFor(n)];
        if (null == t) return null;
        const i = await s.findById(t, n);
        return i ? this.create(i, n, s) : null;
      }
      case 'one-to-many': {
        const a = i.primaryKeys[0];
        if (!a) return [];
        const o = e[a];
        if (null == o) return [];
        const l = r.foreignKey || this.defaultForeignKeyFor(t),
          c = await s.findWhere(n, { [l]: o });
        return this.createMany(c, n, s);
      }
      case 'many-to-many':
        return (console.warn('Many-to-many lazy loading not yet implemented'), []);
      default:
        return null;
    }
  }
  static async batchLoadRelationship(e, t, r, s) {
    if (0 === e.length) return;
    const i = c.getEntity(t);
    if (!i) return;
    const n = this.resolveTargetEntity(r.targetEntity);
    switch (r.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const t = r.foreignKey || this.defaultForeignKeyFor(n),
          a = e.map((e) => e[t]).filter((e) => null != e),
          o = Array.from(new Set(a));
        if (0 === o.length) break;
        const l = await s.findWhereIn(
            n,
            i.columns.find((e) => e.propertyName === i.primaryKeys[0])?.columnName ||
              i.primaryKeys[0],
            o
          ),
          u = this.createMany(l, n, s),
          h = new Map(),
          d = c.getEntity(n),
          p = d?.primaryKeys[0];
        if (!p) break;
        for (const e of u) {
          const t = this.getTarget(e);
          h.set(t[p], e);
        }
        for (const s of e) {
          const e = s[t];
          if (null != e) {
            s[r.propertyName] = h.get(e) || null;
            const t = this.getLoadingState(s);
            t && ((t[r.propertyName].isLoaded = !0), (t[r.propertyName].isLoading = !1));
          }
        }
        break;
      }
      case 'one-to-many': {
        const a = i.primaryKeys[0];
        if (!a) break;
        const o = e.map((e) => e[a]).filter((e) => null != e),
          l = Array.from(new Set(o));
        if (0 === l.length) break;
        const c = r.foreignKey || this.defaultForeignKeyFor(t),
          u = (await s.findWhereIn(n, c, l)) || [],
          h = this.createMany(u, n, s),
          d = new Map();
        for (const e of h) {
          const t = this.getTarget(e)[c],
            r = d.get(t) || [];
          (r.push(e), d.set(t, r));
        }
        for (const t of e) {
          const e = t[a];
          t[r.propertyName] = d.get(e) || [];
          const s = this.getLoadingState(t);
          s && ((s[r.propertyName].isLoaded = !0), (s[r.propertyName].isLoading = !1));
        }
        break;
      }
    }
  }
  static resolveTargetEntity(e) {
    const t = e;
    return 'function' == typeof t && 'prototype' in t && t.prototype ? t : e();
  }
  static defaultForeignKeyFor(e) {
    const t = e.name || 'id';
    return `${t.charAt(0).toLowerCase() + t.slice(1)}Id`;
  }
}
class w {
  constructor(e) {
    ((this._defaultStrategy = r.Lazy), (this._provider = e));
  }
  setDefaultStrategy(e) {
    this._defaultStrategy = e;
  }
  async loadEntity(e, t, s) {
    const i = await this._provider.findById(t, e);
    if (!i) return null;
    const n = { strategy: this._defaultStrategy, ...s };
    return n.strategy === r.Eager || n.includes
      ? (await this.loadRelationships(i, e, n), i)
      : n.strategy === r.Lazy
        ? E.create(i, e, this._provider)
        : i;
  }
  async loadEntities(e, t) {
    const s = await this._provider.findAll(e),
      i = { strategy: this._defaultStrategy, ...t };
    return i.strategy === r.Eager || i.includes
      ? (await this.loadRelationshipsBatched(s, e, i), s)
      : i.strategy === r.Lazy
        ? E.createMany(s, e, this._provider)
        : s;
  }
  async loadRelationships(e, t, r) {
    const s = c.getEntity(t);
    if (!s) return;
    const i = r.depth ?? 1;
    if (!(i <= 0))
      for (const n of s.relationships) {
        if (r.includes)
          for (const e of r.includes) {
            if (!s.relationships.some((t) => t.propertyName === e))
              throw new Error(`Invalid include '${e}' for ${s.target.name}`);
          }
        if (!r.includes || r.includes.includes(n.propertyName))
          try {
            const a = this.resolveTargetEntity(n.targetEntity);
            switch (n.type) {
              case 'many-to-one':
              case 'one-to-one': {
                const t = e[n.foreignKey || this.defaultForeignKeyFor(a)];
                if (null == t) break;
                const s = await this.loadEntity(a, t, { ...r, depth: i - 1 });
                s && (e[n.propertyName] = s);
                break;
              }
              case 'one-to-many': {
                const r = s.primaryKeys[0];
                if (!r) break;
                const i = e[r];
                if (null == i) break;
                const o = n.foreignKey || this.defaultForeignKeyFor(t),
                  l = await this._provider.findWhere(a, { [o]: i });
                e[n.propertyName] = l;
                break;
              }
            }
          } catch (e) {
            console.warn(`Failed to load relationship ${n.propertyName}:`, e);
          }
      }
  }
  async loadRelationshipsBatched(e, t, r) {
    if (0 === e.length) return;
    const s = c.getEntity(t);
    if (!s) return;
    const i = r.depth ?? 1;
    if (!(i <= 0))
      for (const n of s.relationships) {
        if (!(!r.includes || r.includes.includes(n.propertyName))) continue;
        const a = this.resolveTargetEntity(n.targetEntity);
        switch (n.type) {
          case 'many-to-one':
          case 'one-to-one': {
            const t = n.foreignKey || this.defaultForeignKeyFor(a),
              o = e.map((e) => e[t]).filter((e) => null != e),
              l = Array.from(new Set(o));
            if (0 === l.length) break;
            const u = await this._provider.findWhereIn(
                a,
                s.columns.find((e) => e.propertyName === s.primaryKeys[0])?.columnName ||
                  s.primaryKeys[0],
                l
              ),
              h = new Map(),
              d = c.getEntity(a),
              p = d?.primaryKeys[0];
            for (const e of u) h.set(e[p], e);
            for (const r of e) {
              const e = r[t];
              null != e && (r[n.propertyName] = h.get(e));
            }
            i - 1 > 0 &&
              (await this.loadRelationshipsBatched(Array.from(h.values()), a, {
                ...r,
                depth: i - 1
              }));
            break;
          }
          case 'one-to-many': {
            const o = s.primaryKeys[0];
            if (!o) break;
            const l = e.map((e) => e[o]).filter((e) => null != e),
              c = Array.from(new Set(l));
            if (0 === c.length) break;
            const u = n.foreignKey || this.defaultForeignKeyFor(t),
              h = await this._provider.findWhereIn(a, u, c),
              d = new Map();
            for (const e of h) {
              const t = e[u],
                r = d.get(t) || [];
              (r.push(e), d.set(t, r));
            }
            for (const t of e) {
              const e = t[o];
              t[n.propertyName] = d.get(e) || [];
            }
            i - 1 > 0 && (await this.loadRelationshipsBatched(h, a, { ...r, depth: i - 1 }));
            break;
          }
        }
      }
  }
  async populateRelationships(e, t, r) {
    await this.loadRelationships(e, t, r);
  }
  async populateRelationshipsMany(e, t, r) {
    await this.loadRelationshipsBatched(e, t, r);
  }
  resolveTargetEntity(e) {
    const t = e;
    if ('function' == typeof t && 'prototype' in t && t.prototype) return t;
    return e();
  }
  defaultForeignKeyFor(e) {
    const t = e.name || 'id';
    return `${t.charAt(0).toLowerCase() + t.slice(1)}Id`;
  }
}
function b(e, t, r) {
  try {
    const s = e?.[t];
    s?.(r);
  } catch (e) {
    if (
      (function () {
        try {
          const e = process.env,
            t = e?.TSL_METRICS_DEBUG;
          return '1' === t || 'true' === t || 'on' === t;
        } catch {
          return !1;
        }
      })()
    )
      try {
        console.warn('[ts-linq metrics]', t, e);
      } catch {}
  }
}
function C(e, t) {
  b(e, 'cache', t);
}
function T(e, t) {
  b(e, 'cacheSize', t);
}
function N(e, t) {
  b(e, 'cacheEvicted', t);
}
class v {
  constructor(e = {}) {
    ((this.store = new Map()), (this.keyMap = new Map()));
    const t =
      'undefined' != typeof process &&
      (void 0 !== process.env.JEST_WORKER_ID || 'test' === process.env.NODE_ENV);
    ((this.options = {
      maxSize: e.maxSize ?? 2e3,
      defaultTtl: e.defaultTtl ?? (t ? 0 : 3e5),
      enableLru: e.enableLru ?? !0,
      enableKeyCompression: e.enableKeyCompression ?? !0,
      compressionThreshold: e.compressionThreshold ?? 200,
      enableMetrics: e.enableMetrics ?? !0,
      warmingBatchSize: e.warmingBatchSize ?? 50
    }),
      (this.metrics = this.initializeMetrics()),
      this.options.defaultTtl > 0 && this.startPeriodicCleanup());
  }
  get(e) {
    this.options.enableMetrics && this.metrics.totalRequests++;
    const t = this.getCompressedKey(e),
      r = this.store.get(t);
    if (r)
      return this.isExpired(r)
        ? (this.store.delete(t),
          void (
            this.options.enableMetrics &&
            (this.metrics.expirations++, this.metrics.misses++, this.updateHitRatio())
          ))
        : ((r.lastAccessedAt = Date.now()),
          r.accessCount++,
          this.options.enableLru && (this.store.delete(t), this.store.set(t, r)),
          this.options.enableMetrics && (this.metrics.hits++, this.updateHitRatio()),
          { query: r.query, parameters: [...r.parameters] });
    this.options.enableMetrics && (this.metrics.misses++, this.updateHitRatio());
  }
  set(e, t, r) {
    const s = this.getCompressedKey(e),
      i = Date.now(),
      n = r ?? this.options.defaultTtl,
      a = {
        query: t.query,
        parameters: [...t.parameters],
        createdAt: i,
        lastAccessedAt: i,
        accessCount: 1,
        ttl: n
      };
    (this.ensureCapacity(),
      this.store.set(s, a),
      this.options.enableKeyCompression &&
        e.length > this.options.compressionThreshold &&
        this.keyMap.set(e, s),
      this.options.enableMetrics &&
        ((this.metrics.currentSize = this.store.size), this.updateMemoryUsage()));
  }
  clear() {
    (this.store.clear(),
      this.keyMap.clear(),
      this.options.enableMetrics && (this.metrics = this.initializeMetrics()));
  }
  size() {
    return this.store.size;
  }
  getMetrics() {
    return this.options.enableMetrics
      ? ((this.metrics.currentSize = this.store.size),
        this.updateMemoryUsage(),
        this.updateAverageAccessCount(),
        { ...this.metrics })
      : this.initializeMetrics();
  }
  expireEntries() {
    let e = 0;
    for (const [t, r] of this.store.entries()) this.isExpired(r) && (this.store.delete(t), e++);
    return (
      this.options.enableMetrics &&
        ((this.metrics.expirations += e), (this.metrics.currentSize = this.store.size)),
      e
    );
  }
  warm(e) {
    const t = this.chunkArray(e, this.options.warmingBatchSize);
    for (const e of t) for (const t of e) this.set(t.key, t.value, t.ttl);
  }
  getOptimizationInsights() {
    const e = this.getMetrics();
    return {
      shouldIncreaseSize: e.hitRatio < 0.7 && e.evictions > 0.1 * e.currentSize,
      shouldDecreaseTtl: e.expirations > 0.2 * e.totalRequests,
      shouldIncreaseTtl: e.hitRatio > 0.95 && e.expirations < 0.05 * e.totalRequests,
      topAccessedEntries: Array.from(this.store.entries())
        .map(([e, t]) => ({ key: e, accessCount: t.accessCount }))
        .sort((e, t) => t.accessCount - e.accessCount)
        .slice(0, 10)
    };
  }
  getCompressedKey(t) {
    if (!this.options.enableKeyCompression || t.length <= this.options.compressionThreshold)
      return t;
    const r = this.keyMap.get(t);
    if (r) return r;
    return `hash_${e('sha256').update(t).digest('hex').substring(0, 16)}`;
  }
  isExpired(e) {
    return !(e.ttl <= 0) && Date.now() - e.createdAt > e.ttl;
  }
  ensureCapacity() {
    if (this.store.size < this.options.maxSize) return;
    const e = Math.floor(0.1 * this.options.maxSize) || 1;
    let t = 0;
    if (this.options.enableLru) {
      const r = [];
      for (const [s] of this.store) if ((r.push(s), t++, t >= e)) break;
      r.forEach((e) => this.store.delete(e));
    } else {
      const r = [];
      for (const [s] of this.store) if ((r.push(s), t++, t >= e)) break;
      r.forEach((e) => this.store.delete(e));
    }
    this.options.enableMetrics && (this.metrics.evictions += t);
  }
  initializeMetrics() {
    return {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRatio: 0,
      evictions: 0,
      expirations: 0,
      currentSize: 0,
      averageAccessCount: 0,
      estimatedMemoryUsage: 0
    };
  }
  updateHitRatio() {
    this.metrics.totalRequests > 0 &&
      (this.metrics.hitRatio = this.metrics.hits / this.metrics.totalRequests);
  }
  updateMemoryUsage() {
    let e = 0;
    for (const t of this.store.values())
      ((e += 2 * t.query.length), (e += 20 * t.parameters.length), (e += 64));
    this.metrics.estimatedMemoryUsage = e;
  }
  updateAverageAccessCount() {
    if (0 === this.store.size) return void (this.metrics.averageAccessCount = 0);
    const e = Array.from(this.store.values()).reduce((e, t) => e + t.accessCount, 0);
    this.metrics.averageAccessCount = e / this.store.size;
  }
  startPeriodicCleanup() {
    const e = Math.max(this.options.defaultTtl / 4, 6e4);
    ((this.cleanupInterval = setInterval(() => {
      this.expireEntries();
    }, e)),
      this.cleanupInterval?.unref?.());
  }
  chunkArray(e, t) {
    const r = [];
    for (let s = 0; s < e.length; s += t) r.push(e.slice(s, s + t));
    return r;
  }
  dispose() {
    (this.cleanupInterval && (clearInterval(this.cleanupInterval), (this.cleanupInterval = void 0)),
      this.clear());
  }
}
class S {
  constructor(e, t, r, s) {
    ((this._dialect = e),
      (this._logger = t),
      (this._providerName = r),
      (this._cache = s ?? S._defaultCache));
  }
  generateSql(e, t) {
    const r = S.buildCacheKey(e, t),
      s = this.getFromCache(r);
    if (s)
      return (
        this._logger?.cache?.({ cache: 'sqlGen', hit: !0, provider: this._providerName }),
        { query: s.query, parameters: [...s.parameters] }
      );
    const i = { ...t };
    t.select &&
      ((i.selectParams = []),
      (i.select = t.select.map((e) => {
        if ('string' == typeof e) return e;
        const t = e,
          r = t.toString(),
          s = t.getParameters?.() ?? [];
        return (i.selectParams.push(...s), r);
      })));
    const n = this._dialect.buildSelect(e, i);
    return (
      this.remember(r, n),
      this._logger?.cache?.({ cache: 'sqlGen', hit: !1, provider: this._providerName }),
      n
    );
  }
  generateFromModel(e, t) {
    const r = {
        select: t.select,
        where: t.where,
        orderBy: t.orderBy,
        groupBy: t.groupBy,
        joins: t.joins,
        limit: t.limit,
        offset: t.offset,
        distinct: t.distinct
      },
      s = this.generateSql(e, r);
    if (t.unions && t.unions.length > 0) {
      let e = `${s.query}`;
      const r = [...s.parameters];
      for (const s of t.unions) {
        const t = this.generateFromModel(s.entity, s.other);
        ((e += s.all ? ` UNION ALL ${t.query}` : ` UNION ${t.query}`), r.push(...t.parameters));
      }
      return { query: e, parameters: r };
    }
    return s;
  }
  static clearCache() {
    S._defaultCache.clear();
  }
  static disposeCache() {
    (S._defaultCache.dispose(), (S._defaultCache = new v()));
  }
  getCacheMetrics() {
    return this._cache instanceof v
      ? this._cache.getMetrics()
      : {
          currentSize: this._cache.size?.() ?? 0,
          totalRequests: 0,
          hits: 0,
          misses: 0,
          hitRatio: 0,
          evictions: 0,
          expirations: 0,
          averageAccessCount: 0,
          estimatedMemoryUsage: 0
        };
  }
  getOptimizationInsights() {
    return this._cache instanceof v
      ? this._cache.getOptimizationInsights()
      : {
          shouldIncreaseSize: !1,
          shouldDecreaseTtl: !1,
          shouldIncreaseTtl: !1,
          topAccessedEntries: []
        };
  }
  static buildCacheKey(e, t) {
    let r = e.name;
    if (((r += '|s:' + (t.select ? t.select.join(',') : '')), t.where && t.where.length)) {
      r += '|w:';
      for (const e of t.where) r += e.condition + '(' + (e.parameters?.join('|') ?? '') + ')';
    }
    if (t.orderBy && t.orderBy.length) {
      r += '|o:';
      for (const e of t.orderBy) r += e.column + ':' + e.direction + ';';
    }
    if (
      (t.groupBy &&
        ((r += '|g:' + t.groupBy.columns.join(',')),
        t.groupBy.having &&
          (r +=
            '{' +
            t.groupBy.having.condition +
            '(' +
            (t.groupBy.having.parameters?.join('|') ?? '') +
            ')}')),
      t.joins && t.joins.length)
    ) {
      r += '|j:';
      for (const e of t.joins) r += e.type + ':' + e.table + ':' + e.on + ';';
    }
    return (
      void 0 !== t.limit && (r += '|l:' + t.limit),
      void 0 !== t.offset && (r += '|f:' + t.offset),
      t.distinct && (r += '|d:1'),
      r
    );
  }
  remember(e, t) {
    (this._cache.set(e, { query: t.query, parameters: [...t.parameters] }),
      T(this._logger, {
        cache: 'sqlGen',
        size: this._cache.size?.() ?? -1,
        provider: this._providerName
      }));
  }
  getFromCache(e) {
    return this._cache.get(e);
  }
}
var A, R;
((S._defaultCache = new v()),
  (function (e) {
    ((e.And = 'AND'), (e.Or = 'OR'));
  })(A || (A = {})),
  (function (e) {
    ((e.Eq = '='), (e.Gt = '>'), (e.Gte = '>='), (e.Lt = '<'), (e.Lte = '<='));
  })(R || (R = {})));
class L {
  parse(e) {
    const t = e.toString();
    if (t.length > L.MAX_LENGTH) return null;
    if (L.UNSUPPORTED_TOKENS.some((e) => t.includes(e))) return null;
    const r = t.indexOf('=>');
    if (-1 === r) return null;
    const s = t.slice(r + 2).trim();
    if (s.includes('&&')) {
      const e = s.split('&&').map((e) => e.trim()),
        t = [];
      for (const r of e) {
        const e = this.parseBinary(r);
        if (!e) return null;
        t.push(e);
      }
      return { type: 'LogicalExpression', operator: A.And, expressions: t };
    }
    return this.parseBinary(s);
  }
  parseBinary(e) {
    const t = [
      { re: /\w+\.(\w+)\s*===?\s*(.+)/, op: R.Eq },
      { re: /\w+\.(\w+)\s*>=\s*(.+)/, op: R.Gte },
      { re: /\w+\.(\w+)\s*<=\s*(.+)/, op: R.Lte },
      { re: /\w+\.(\w+)\s*>\s*(.+)/, op: R.Gt },
      { re: /\w+\.(\w+)\s*<\s*(.+)/, op: R.Lt }
    ];
    for (const { re: r, op: s } of t) {
      const t = e.match(r);
      if (t) {
        const e = t[1];
        if (!/^[_A-Za-z][_\w]*$/.test(e)) return null;
        const r = { type: 'Identifier', name: e },
          i = t[2].trim();
        if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(i)) return null;
        const n = this.parseLiteral(i);
        if (void 0 === n && !/^(null)$/i.test(i)) return null;
        return {
          type: 'BinaryExpression',
          left: r,
          operator: s,
          right: { type: 'Literal', value: n ?? null }
        };
      }
    }
    return null;
  }
  parseLiteral(e) {
    if ((e.startsWith('"') && e.endsWith('"')) || (e.startsWith("'") && e.endsWith("'")))
      return e.slice(1, -1);
    const t = Number(e);
    return Number.isNaN(t)
      ? 'true' === e || ('false' !== e && ('null' === e.toLowerCase() ? null : void 0))
      : t;
  }
}
((L.MAX_LENGTH = 500), (L.UNSUPPORTED_TOKENS = ['function', '=> {', 'return', '||', '??']));
class M {
  toSql(e) {
    switch (e.type) {
      case 'BinaryExpression':
        return this.visitBinary(e);
      case 'LogicalExpression':
        return this.visitLogical(e);
      default:
        return { condition: '1=1', parameters: [] };
    }
  }
  visitBinary(e) {
    const t = e.left.name,
      r = e.right.value;
    return { condition: `${t} ${e.operator} ?`, parameters: [r] };
  }
  visitLogical(e) {
    const t = [],
      r = [];
    for (const s of e.expressions) {
      const e = this.toSql(s);
      (t.push(e.condition), r.push(...e.parameters));
    }
    const s = e.operator === A.And ? ' AND ' : ' OR ';
    return { condition: t.join(s), parameters: r };
  }
}
class O {
  clone() {
    const e = new O();
    return (
      (e.select = this.select ? [...this.select] : void 0),
      (e.where = this.where
        ? this.where.map((e) => ({ condition: e.condition, parameters: [...e.parameters] }))
        : void 0),
      (e.orderBy = this.orderBy ? this.orderBy.map((e) => ({ ...e })) : void 0),
      (e.groupBy = this.groupBy
        ? {
            columns: [...this.groupBy.columns],
            having: this.groupBy.having
              ? {
                  condition: this.groupBy.having.condition,
                  parameters: [...this.groupBy.having.parameters]
                }
              : void 0
          }
        : void 0),
      (e.joins = this.joins ? this.joins.map((e) => ({ ...e })) : void 0),
      (e.limit = this.limit),
      (e.offset = this.offset),
      (e.distinct = this.distinct),
      (e.from = this.from),
      (e.unions = this.unions
        ? this.unions.map((e) => ({ all: e.all, other: e.other.clone(), entity: e.entity }))
        : void 0),
      e
    );
  }
}
class x {
  static parse(e, t, r, s, i) {
    const n = e.trim(),
      a = n.match(/\((\w+)\s*,\s*(\w+)\)\s*=>\s*\1\.(\w+)\s*===?\s*\2\.(\w+)/);
    if (!a) throw new Error(`Unable to parse join predicate: ${n}`);
    const o = a[3],
      l = a[4];
    return `${t}.${s.columns.find((e) => e.propertyName === o)?.columnName || o} = ${r}.${i.columns.find((e) => e.propertyName === l)?.columnName || l}`;
  }
}
class $ {
  apply(e, t, r, s) {
    const i = c.getEntity(e);
    if (i) {
      if (((t.where = t.where || []), r?.enabled)) {
        const e = r.column ?? 'isDeleted',
          s = i.columns.find((t) => t.propertyName === e || t.columnName === e);
        s && t.where.push({ condition: `${s.columnName} = 0`, parameters: [] });
      }
      if (s && s.length > 0)
        for (const e of s) {
          const r = c.getEntity(e.entity);
          r &&
            i.tableName === r.tableName &&
            t.where.push({ condition: e.where.condition, parameters: [...e.where.parameters] });
        }
    }
  }
}
class D {
  constructor(e, t, r, s, i, n) {
    ((this._model = new O()),
      (this._fallbackPredicates = []),
      (this._includes = []),
      (this._globalFilterApplier = new $()),
      (this._whereSignature = '[]'),
      (this._entityClass = e),
      (this._provider = t),
      (this._entityLoader = r),
      (this._entityCache = s),
      (this._performance = i),
      (this._globalFilters = n),
      (this._externalCountCache = i?.countCache),
      (this._sqlBuilder = new S(t.getDialect(), t.loggerRef, t.providerLabel, i?.sqlCache)));
  }
  static clearCountCache() {
    D._countCache.clear();
  }
  clone() {
    const e = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    );
    return ((e._model = this._model.clone()), (e._whereSignature = this._whereSignature), e);
  }
  innerJoin(e, t, r) {
    return (this.addJoin('INNER', e, t, r), this);
  }
  leftJoin(e, t, r) {
    return (this.addJoin('LEFT', e, t, r), this);
  }
  where(e) {
    return (this.addWhereOrFallback(e), this);
  }
  whereExists(e) {
    const t = e._sqlBuilder,
      r = e._model,
      s = e._entityClass,
      { query: i, parameters: n } = t.generateFromModel(s, r);
    this._model.where = this._model.where || [];
    const a = { condition: `EXISTS (${i})`, parameters: n };
    return (
      this._model.where.push(a),
      (this._whereSignature += `|${a.condition}:${JSON.stringify(a.parameters)}`),
      this
    );
  }
  whereInSubquery(e, t) {
    const r = t._sqlBuilder,
      s = t._model,
      i = t._entityClass,
      { query: n, parameters: a } = r.generateFromModel(i, s);
    this._model.where = this._model.where || [];
    const o = { condition: `${e} IN (${n})`, parameters: a };
    return (
      this._model.where.push(o),
      (this._whereSignature += `|${o.condition}:${JSON.stringify(o.parameters)}`),
      this
    );
  }
  withCte(e, t) {
    const { query: r } = t._sqlBuilder.generateFromModel(t._entityClass, t._model),
      s = this.clone();
    return ((s._model.from = e), (s._cte = { name: e, sql: r }), s);
  }
  select(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance
    );
    t._model = this._model.clone();
    const r = e.toString(),
      s = this.extractPropertiesFromSelector(r);
    return ((t._model.select = s), t);
  }
  orderBy(e) {
    const t = e.toString(),
      r = { column: this.extractPropertyFromKeySelector(t), direction: 'ASC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(r), this);
  }
  orderByDescending(e) {
    const t = e.toString(),
      r = { column: this.extractPropertyFromKeySelector(t), direction: 'DESC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(r), this);
  }
  thenBy(e) {
    const t = e.toString(),
      r = { column: this.extractPropertyFromKeySelector(t), direction: 'ASC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(r), this);
  }
  thenByDescending(e) {
    const t = e.toString(),
      r = { column: this.extractPropertyFromKeySelector(t), direction: 'DESC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(r), this);
  }
  take(e) {
    return ((this._model.limit = e), this);
  }
  skip(e) {
    return ((this._model.offset = e), this);
  }
  distinct() {
    return ((this._model.distinct = !0), this);
  }
  union(e) {
    return (
      (this._model.unions = this._model.unions || []),
      this._model.unions.push({ all: !1, other: e._model.clone(), entity: e._entityClass }),
      this
    );
  }
  unionAll(e) {
    return (
      (this._model.unions = this._model.unions || []),
      this._model.unions.push({ all: !0, other: e._model.clone(), entity: e._entityClass }),
      this
    );
  }
  groupBy(e) {
    const t = e.toString(),
      r = this.extractPropertiesFromSelector(t);
    return ((this._model.groupBy = { columns: r }), this);
  }
  having(e) {
    if (!this._model.groupBy) throw new Error('having() requires a preceding groupBy()');
    const t = new L().parse(e);
    if (t) {
      const e = new M(),
        { condition: r, parameters: s } = e.toSql(t);
      this._model.groupBy.having = { condition: r, parameters: s };
    } else this._model.groupBy.having = { condition: '1=1', parameters: [] };
    return this;
  }
  async paginate(e, t) {
    if (e < 1 || t < 1) throw new Error('paginate requires page >= 1 and size >= 1');
    const r = this._model.clone();
    (this.applyGlobalFiltersToModel(r), (r.limit = t), (r.offset = (e - 1) * t));
    return {
      items: await this.executeAndMaterialize(r),
      total: await this.count(),
      page: e,
      size: t
    };
  }
  async keysetPaginate(e, t, r) {
    if (r < 1) throw new Error('keysetPaginate requires size >= 1');
    const s = this._model.clone();
    s.orderBy = s.orderBy || [];
    if (
      (s.orderBy.some((t) => t.column === String(e)) ||
        s.orderBy.push({ column: String(e), direction: 'ASC' }),
      (s.limit = r),
      null != t)
    ) {
      const r = { condition: `${String(e)} > ?`, parameters: [t] };
      ((s.where = s.where || []), s.where.push(r));
    }
    this.applyGlobalFiltersToModel(s);
    const i = await this.executeAndMaterialize(s),
      n = i.length > 0 ? i[i.length - 1] : null;
    return { items: i, pageSize: r, nextAfter: n ? n[String(e)] : null };
  }
  include(e) {
    const t = this.extractIncludeProperty(e),
      r = c.getEntity(this._entityClass),
      s = r?.relationships.some((e) => e.propertyName === t);
    if (!s)
      throw new Error(
        `Invalid include '${t}' for ${this._entityClass.name}. Define relationship '${t}' via decorators or fix the name.`
      );
    return (this._includes.includes(t) || this._includes.push(t), this);
  }
  async toArray() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = this._model.clone();
    return (this.applyGlobalFiltersToModel(e), this.executeAndMaterialize(e));
  }
  async first() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = this._model.clone();
    ((e.limit = 1), this.applyGlobalFiltersToModel(e));
    const t = await this.executeAndMaterialize(e);
    if (!t.length) throw new Error('Sequence contains no elements');
    return t[0];
  }
  async tryFirst() {
    try {
      const e = await this.first();
      return i(e);
    } catch (e) {
      return n(e);
    }
  }
  async firstOrDefault() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = this._model.clone();
    ((e.limit = 1), this.applyGlobalFiltersToModel(e));
    return (await this.executeAndMaterialize(e))[0] ?? null;
  }
  async single() {
    const e = await this.toArray();
    if (0 === e.length) throw new Error('Sequence contains no elements');
    if (e.length > 1) throw new Error('Sequence contains more than one element');
    return e[0];
  }
  async trySingle() {
    try {
      const e = await this.single();
      return i(e);
    } catch (e) {
      return n(e);
    }
  }
  async singleOrDefault() {
    const e = await this.toArray();
    if (e.length > 1) throw new Error('Sequence contains more than one element');
    return e[0] ?? null;
  }
  async count() {
    const e = c.getEntity(this._entityClass);
    if (!e) throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
    if (this._performance?.enableCountCache) {
      const t = this.buildCountCacheKey(e.tableName),
        r = this._performance.countCacheTtlMs ?? 0,
        s = this._externalCountCache?.get(t) ?? D._countCache.get(t);
      if (s && (r <= 0 || Date.now() - s.ts <= r))
        return (
          this._externalCountCache || (D._countCache.delete(t), D._countCache.set(t, s)),
          C(this._provider.loggerRef, {
            cache: 'count',
            hit: !0,
            provider: this._provider.providerLabel,
            ttl: r > 0
          }),
          s.value
        );
      const i = await this.executeCountQuery(e.tableName),
        n = { value: i, ts: Date.now() };
      if (this._externalCountCache) this._externalCountCache.set(t, n);
      else {
        if (D._countCache.size >= D._COUNT_CACHE_MAX) {
          const e = D._countCache.keys().next().value;
          void 0 !== e &&
            (D._countCache.delete(e),
            N(this._provider.loggerRef, {
              cache: 'count',
              provider: this._provider.providerLabel
            }));
        }
        D._countCache.set(t, n);
      }
      return (
        T(this._provider.loggerRef, {
          cache: 'count',
          size: this._externalCountCache ? -1 : D._countCache.size,
          provider: this._provider.providerLabel
        }),
        C(this._provider.loggerRef, {
          cache: 'count',
          hit: !1,
          provider: this._provider.providerLabel
        }),
        i
      );
    }
    return this.executeCountQuery(e.tableName);
  }
  buildCountCacheKey(e) {
    return `${this._entityClass.name}|count|${e}|${this._whereSignature}`;
  }
  async executeCountQuery(e) {
    let t = `SELECT COUNT(*) as count FROM ${e}`;
    const r = [],
      s = this._model.clone();
    if ((this.applyGlobalFiltersToModel(s), s.where && s.where.length > 0)) {
      let e = !0;
      t += ' WHERE ';
      for (const i of s.where) {
        (e || (t += ' AND '), (e = !1), (t += i.condition));
        const s = i.parameters;
        for (let e = 0; e < s.length; e++) r.push(s[e]);
      }
    }
    const i = await this._provider.executeQuery(t, r);
    return i[0]?.count ?? 0;
  }
  async any() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = this._model.clone();
    ((e.limit = 1), this.applyGlobalFiltersToModel(e));
    return (await this.executeAndMaterialize(e)).length > 0;
  }
  addWhereOrFallback(e) {
    const t = e.toString(),
      r = D._predicateSqlCache.get(t);
    if (r)
      return (
        (this._model.where = this._model.where || []),
        this._model.where.push({ condition: r.condition, parameters: [...r.parameters] }),
        void (this._whereSignature += `|${r.condition}:${JSON.stringify(r.parameters)}`)
      );
    const s = new L().parse(e);
    if (!s) return void this._fallbackPredicates.push(e);
    const i = new M(),
      { condition: n, parameters: a } = i.toSql(s),
      o = { condition: n, parameters: a };
    if (
      ((this._model.where = this._model.where || []),
      this._model.where.push(o),
      (this._whereSignature += `|${o.condition}:${JSON.stringify(o.parameters)}`),
      D._predicateSqlCache.size >= D.PREDICATE_CACHE_MAX)
    ) {
      const e = D._predicateSqlCache.keys().next().value;
      void 0 !== e && D._predicateSqlCache.delete(e);
    }
    D._predicateSqlCache.set(t, { condition: o.condition, parameters: [...o.parameters] });
  }
  applyFallbackPredicates(e) {
    if (0 === this._fallbackPredicates.length) return e;
    let t = e;
    for (const e of this._fallbackPredicates)
      t = t.filter((t) => {
        try {
          return e(t);
        } catch {
          return !1;
        }
      });
    return t;
  }
  async executeAndMaterialize(e) {
    this._cte && (e.cte = this._cte);
    const t = this._sqlBuilder.generateFromModel(this._entityClass, e);
    let s = (await this._provider.executeQuery(t.query, t.parameters)).map((e) =>
      this.mapRowToEntity(e)
    );
    return (
      (s = this.applyFallbackPredicates(s)),
      this._entityLoader &&
        this._includes.length > 0 &&
        1 !== e.limit &&
        (await this._entityLoader.populateRelationshipsMany(s, this._entityClass, {
          strategy: r.Eager,
          includes: this._includes,
          depth: 1
        })),
      s
    );
  }
  extractIncludeProperty(e) {
    const t = e.toString(),
      r = D._includePropCache.get(t);
    if (r) return r;
    const s = t.match(D.REGEX_SINGLE_PROP);
    if (s && s[1]) return (D._includePropCache.set(t, s[1]), s[1]);
    throw new Error(`Unable to parse include selector: ${t}`);
  }
  extractPropertiesFromSelector(e) {
    const t = D._selectorPropsCache.get(e);
    if (t) return [...t];
    const r = e.match(D.REGEX_SINGLE_PROP);
    if (r) return [r[1]];
    const s = e.match(D.REGEX_OBJECT);
    if (s) {
      const t = s[1].split(',').map((e) => {
        const t = e.match(D.REGEX_PROP_IN_OBJECT);
        return t ? t[1] : e.trim();
      });
      return (D._selectorPropsCache.set(e, [...t]), t);
    }
    const i = e.match(D.REGEX_SIMPLE_OBJECT);
    if (i) {
      const t = i[1].split(',').map((e) => {
        const t = e.match(D.REGEX_PROP_IN_OBJECT) || e.match(D.REGEX_ANY_PROP);
        return t ? t[1] : e.trim();
      });
      return (D._selectorPropsCache.set(e, [...t]), t);
    }
    return ['*'];
  }
  extractPropertyFromKeySelector(e) {
    const t = D._keySelectorCache.get(e);
    if (t) return t;
    const r = e.match(D.REGEX_SINGLE_PROP);
    if (r) return (D._keySelectorCache.set(e, r[1]), r[1]);
    throw new Error(`Unable to parse key selector: ${e}`);
  }
  mapRowToEntity(e) {
    const t = c.getEntity(this._entityClass);
    if (
      this._performance?.enableEntityCache &&
      this._entityCache &&
      t &&
      t.primaryKeys.length > 0
    ) {
      const r = t.primaryKeys[0],
        s = t.columns.find((e) => e.propertyName === r),
        i = s ? e[s.columnName] : e[r],
        n = this._entityCache.get(this._entityClass, i);
      if (n)
        return (
          this._provider.loggerRef?.cache?.({
            cache: 'entityL2',
            hit: !0,
            provider: this._provider.providerLabel
          }),
          n
        );
      const a = new this._entityClass();
      for (const r of t.columns)
        e.hasOwnProperty(r.columnName) &&
          (a[r.propertyName] = this.convertValue(e[r.columnName], r.type));
      (this._entityCache.set(this._entityClass, i, a),
        this._provider.loggerRef?.cache?.({
          cache: 'entityL2',
          hit: !1,
          provider: this._provider.providerLabel
        }));
      try {
        this._provider.loggerRef?.cacheSize?.({
          cache: 'entityL2',
          size: this._entityCache.size?.() ?? -1,
          provider: this._provider.providerLabel
        });
      } catch (e) {
        try {
          const { warnIfLoggerDebug: t } = require('../utils/MetricsSafe');
          t('notify:entityMaterialized', e);
        } catch {}
      }
      try {
        this._provider.notifyEntityMaterialized?.(a, t);
      } catch (e) {
        try {
          const { warnIfLoggerDebug: t } = require('../utils/MetricsSafe');
          t('notify:entityMaterialized', e);
        } catch {}
      }
      return a;
    }
    const r = new this._entityClass();
    if (t)
      for (const s of t.columns)
        e.hasOwnProperty(s.columnName) &&
          (r[s.propertyName] = this.convertValue(e[s.columnName], s.type));
    else Object.assign(r, e);
    try {
      t && this._provider.notifyEntityMaterialized?.(r, t);
    } catch (e) {
      try {
        const { warnIfLoggerDebug: t } = require('../utils/MetricsSafe');
        t('notify:entityMaterialized', e);
      } catch {}
    }
    return r;
  }
  convertValue(e, t) {
    if (null == e) return e;
    switch (t.toUpperCase()) {
      case 'BOOLEAN':
        return Boolean(e);
      case 'INTEGER':
      case 'NUMBER':
        return Number(e);
      case 'DATETIME':
      case 'DATE':
        return new Date(e);
      default:
        return e;
    }
  }
  withAbort(e) {
    return ((this._abortSignal = e), this);
  }
  async all(e) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    return null === (await this.where((t) => !e(t)).firstOrDefault());
  }
  async average(e) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = await this.toArray();
    if (0 === t.length) throw new Error('Sequence contains no elements');
    const r = t.map((t) => {
      const r = e(t);
      return 'number' == typeof r ? r : Number(r) || 0;
    });
    return r.reduce((e, t) => e + t, 0) / r.length;
  }
  async sum(e) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    return (await this.toArray())
      .map((t) => {
        const r = e(t);
        return 'number' == typeof r ? r : Number(r) || 0;
      })
      .reduce((e, t) => e + t, 0);
  }
  async min(e) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = await this.toArray();
    if (0 === t.length) throw new Error('Sequence contains no elements');
    let r = e(t[0]);
    for (let s = 1; s < t.length; s++) {
      const i = e(t[s]);
      i < r && (r = i);
    }
    return r;
  }
  async max(e) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = await this.toArray();
    if (0 === t.length) throw new Error('Sequence contains no elements');
    let r = e(t[0]);
    for (let s = 1; s < t.length; s++) {
      const i = e(t[s]);
      i > r && (r = i);
    }
    return r;
  }
  async contains(e) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = c.getEntity(this._entityClass);
    if (t && t.primaryKeys.length > 0) {
      const r = t.primaryKeys[0],
        s = e[r];
      if (null != s) {
        return (await this.toArray()).some((e) => e[r] === s);
      }
    }
    const r = await this.toArray(),
      s = JSON.stringify(e);
    return r.some((e) => JSON.stringify(e) === s);
  }
  except(e) {
    const t = this.clone(),
      r = t.toArray;
    return (
      (t.toArray = async function () {
        const t = await r.call(this),
          s = await e.toArray(),
          i = new Set(s.map((e) => JSON.stringify(e)));
        return t.filter((e) => !i.has(JSON.stringify(e)));
      }.bind(t)),
      t
    );
  }
  intersect(e) {
    const t = this.clone(),
      r = t.toArray;
    return (
      (t.toArray = async function () {
        const t = await r.call(this),
          s = await e.toArray(),
          i = new Set(s.map((e) => JSON.stringify(e)));
        return t.filter((e) => i.has(JSON.stringify(e)));
      }.bind(t)),
      t
    );
  }
  concat(e) {
    const t = this.clone(),
      r = t.toArray;
    return (
      (t.toArray = async function () {
        return [...(await r.call(this)), ...(await e.toArray())];
      }.bind(t)),
      t
    );
  }
  addJoin(e, t, r, s) {
    const i = c.getEntity(this._entityClass),
      n = c.getEntity(t);
    if (!i || !n) throw new Error('Entity metadata not found for join');
    const a = this.parseJoinPredicate(r.toString(), i.tableName, n.tableName, i, n);
    ((this._model.joins = this._model.joins || []),
      this._model.joins.push({ type: e, table: n.tableName, on: a, alias: s }));
  }
  parseJoinPredicate(e, t, r, s, i) {
    return x.parse(e, t, r, s, i);
  }
  applyGlobalFiltersToModel(e) {
    this._globalFilterApplier.apply(
      this._entityClass,
      e,
      this._provider.softDeleteOptions,
      this._globalFilters
    );
  }
}
((D._countCache = new Map()),
  (D._COUNT_CACHE_MAX = 2e3),
  (D.REGEX_SINGLE_PROP = /=>\s*\w+\.(\w+)/),
  (D.REGEX_OBJECT = /=>\s*\(\s*\{([^}]+)\}\s*\)/),
  (D.REGEX_SIMPLE_OBJECT = /=>\s*\{([^}]+)\}/),
  (D.REGEX_PROP_IN_OBJECT = /\w+:\s*\w+\.(\w+)/),
  (D.REGEX_ANY_PROP = /(\w+)/),
  (D.PREDICATE_CACHE_MAX = 1e3),
  (D._predicateSqlCache = new Map()),
  (D.SELECTOR_CACHE_MAX = 1e3),
  (D._selectorPropsCache = new Map()),
  (D._keySelectorCache = new Map()),
  (D._includePropCache = new Map()));
class q {
  constructor(e) {
    this._queryable = e;
  }
  static from(e) {
    return new q(e);
  }
  select(e) {
    const t = this._queryable.select(e);
    return new q(t);
  }
  where(e) {
    const t = this._queryable.where(e);
    return new q(t);
  }
  orderBy(e, t = 'ASC') {
    const r = 'DESC' === t ? this._queryable.orderByDescending(e) : this._queryable.orderBy(e);
    return new q(r);
  }
  include(e) {
    const t = this._queryable.include(e);
    return new q(t);
  }
  take(e) {
    const t = this._queryable.take(e);
    return new q(t);
  }
  skip(e) {
    const t = this._queryable.skip(e);
    return new q(t);
  }
  distinct() {
    const e = this._queryable.distinct();
    return new q(e);
  }
  thenBy(e) {
    const t = this._queryable.thenBy(e);
    return new q(t);
  }
  thenByDescending(e) {
    const t = this._queryable.thenByDescending(e);
    return new q(t);
  }
  async first() {
    return this._queryable.first();
  }
  async firstOrDefault() {
    return this._queryable.firstOrDefault();
  }
  async single() {
    return this._queryable.single();
  }
  async toArray() {
    return this._queryable.toArray();
  }
  async count() {
    return this._queryable.count();
  }
  async any() {
    return this._queryable.any();
  }
  async all(e) {
    return (await this.toArray()).every((t) => e(t));
  }
  async average(e) {
    return await this._queryable.average(e);
  }
  async sum(e) {
    return await this._queryable.sum(e);
  }
  async min(e) {
    return await this._queryable.min(e);
  }
  async max(e) {
    return await this._queryable.max(e);
  }
  async contains(e) {
    return await this._queryable.contains(e);
  }
  except(e) {
    const t = this._queryable.except(e._queryable);
    return q.from(t);
  }
  intersect(e) {
    const t = this._queryable.intersect(e._queryable);
    return q.from(t);
  }
  concat(e) {
    const t = this._queryable.concat(e._queryable);
    return q.from(t);
  }
  get raw() {
    return this._queryable;
  }
}
class I {
  constructor(e, t, r, s, i, n, a) {
    ((this._entityClass = e),
      (this._provider = t),
      (this._changeTracker = r),
      (this._entityLoader = s),
      (this._entityCache = i),
      (this._performance = n),
      (this._globalFilters = a));
  }
  add(e) {
    return (this._changeTracker.add(e, this._entityClass), e);
  }
  update(e) {
    return (this._changeTracker.update(e, this._entityClass), e);
  }
  remove(e) {
    return (this._changeTracker.remove(e, this._entityClass), e);
  }
  addRange(e) {
    for (const t of e) this._changeTracker.add(t, this._entityClass);
    return e;
  }
  updateRange(e) {
    for (const t of e) this._changeTracker.update(t, this._entityClass);
    return e;
  }
  removeRange(e) {
    for (const t of e) this._changeTracker.remove(t, this._entityClass);
    return e;
  }
  async find(e, t) {
    if (this._entityLoader && t)
      return await this._entityLoader.loadEntity(this._entityClass, e, t);
    const r = c.getEntity(this._entityClass);
    if (!r || 0 === r.primaryKeys.length)
      return await this._provider.findById(e, this._entityClass);
    const s = r.primaryKeys[0];
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    )
      .where((t) => t[s] === e)
      .firstOrDefault();
  }
  async toArray(e) {
    return this._entityLoader && e
      ? await this._entityLoader.loadEntities(this._entityClass, e)
      : await new D(
          this._entityClass,
          this._provider,
          this._entityLoader,
          this._entityCache,
          this._performance,
          this._globalFilters
        ).toArray();
  }
  async findByIds(e) {
    if (!e || 0 === e.length) return [];
    const t = c.getEntity(this._entityClass);
    if (!t || 0 === t.primaryKeys.length) {
      const t = [];
      for (const r of e) {
        const e = await this.find(r);
        e && t.push(e);
      }
      return t;
    }
    const r = t.primaryKeys[0],
      s = t.columns.find((e) => e.propertyName === r)?.columnName || r;
    return await this._provider.findWhereIn(this._entityClass, s, e);
  }
  async findWhereIn(e, t) {
    if (!t || 0 === t.length) return [];
    const r = c.getEntity(this._entityClass),
      s =
        (r && r.columns.find((t) => t.propertyName === e || t.columnName === e)?.columnName) ||
        String(e);
    return await this._provider.findWhereIn(this._entityClass, s, t);
  }
  where(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).where(e);
    return q.from(t);
  }
  whereExists(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).whereExists(e);
    return q.from(t);
  }
  whereInSubquery(e, t) {
    const r = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).whereInSubquery(e, t);
    return q.from(r);
  }
  select(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).select(e);
    return q.from(t);
  }
  orderBy(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderBy(e);
    return q.from(t);
  }
  orderByDescending(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderByDescending(e);
    return q.from(t);
  }
  take(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).take(e);
    return q.from(t);
  }
  skip(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).skip(e);
    return q.from(t);
  }
  distinct() {
    const e = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).distinct();
    return q.from(e);
  }
  union(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).union(e);
    return q.from(t);
  }
  unionAll(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).unionAll(e);
    return q.from(t);
  }
  async first() {
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).first();
  }
  async firstOrDefault() {
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).firstOrDefault();
  }
  async single() {
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).single();
  }
  async singleOrDefault() {
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).singleOrDefault();
  }
  async count() {
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).count();
  }
  async any() {
    return await new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).any();
  }
  include(e) {
    const t = new D(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).include(e);
    return q.from(t);
  }
  async insertMany(e) {
    return await this._provider.insertMany(e, this._entityClass);
  }
  async updateMany(e) {
    return await this._provider.updateMany(e, this._entityClass);
  }
  async upsert(e) {
    const t = c.getEntity(this._entityClass);
    if (!t || 0 === t.primaryKeys.length)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const r = e[t.primaryKeys[0]];
    if (null == r) return (this.add(e), e);
    return (
      (await this._provider.findById(r, this._entityClass)) ? this.update(e) : this.add(e),
      e
    );
  }
  async upsertMany(e) {
    const t = c.getEntity(this._entityClass);
    if (!t || 0 === t.primaryKeys.length)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const r = t.primaryKeys[0],
      s = e.map((e) => ({ entity: e, id: e[r] })),
      i = s.filter((e) => void 0 !== e.id && null !== e.id).map((e) => e.id);
    if (i.length > 0) {
      const e = t.columns.find((e) => e.propertyName === r),
        n = await this._provider.findWhereIn(this._entityClass, e ? e.propertyName : r, i),
        a = new Set(n.map((e) => e[r]));
      for (const { entity: e, id: t } of s) null != t && a.has(t) ? this.update(e) : this.add(e);
    } else this.addRange(e);
    return e;
  }
}
class B {
  constructor(e = 1e4, t, r) {
    ((this._store = new Map()), (this._maxSize = e), (this._logger = t), (this._providerLabel = r));
  }
  buildKey(e, t) {
    return `${e.name}|${String(t)}`;
  }
  get(e, t) {
    if (null == t) return;
    const r = this.buildKey(e, t);
    return this._store.get(r);
  }
  set(e, t, r) {
    if (null == t) return;
    if (this._store.size >= this._maxSize) {
      const e = this._store.keys().next().value;
      if (void 0 !== e) {
        this._store.delete(e);
        try {
          N(this._logger, { cache: 'entityL2', provider: this._providerLabel });
        } catch {}
      }
    }
    const s = this.buildKey(e, t);
    this._store.set(s, r);
  }
  remove(e, t) {
    if (null == t) return;
    const r = this.buildKey(e, t);
    this._store.delete(r);
  }
  clear() {
    this._store.clear();
  }
  size() {
    return this._store.size;
  }
}
function k(e) {
  try {
    const t = Reflect.getOwnMetadata;
    return t?.('orm:original', e) || e;
  } catch {
    return e;
  }
}
class P {
  constructor(e, t) {
    ((this.operator = e), (this.specs = t));
  }
  toExpression() {
    const e = this.specs.map((e) => e.toExpression()).filter((e) => !!e);
    if (0 === e.length) return null;
    return { type: 'LogicalExpression', operator: this.operator, expressions: e };
  }
  test(e) {
    return this.operator === A.And
      ? this.specs.every((t) => t.test(e))
      : this.specs.some((t) => t.test(e));
  }
}
const K = { and: (...e) => new P(A.And, e), or: (...e) => new P(A.Or, e) };
class F {
  constructor(e) {
    ((this.partitions = []), (this.orders = []), (this.funcCall = e));
  }
  partitionBy(e) {
    const t = Array.isArray(e) ? e : [e];
    return (this.partitions.push(...t), this);
  }
  orderBy(e, t = 'ASC') {
    return (this.orders.push({ column: e, direction: t }), this);
  }
  toString() {
    const e = [];
    return (
      this.partitions.length && e.push(`PARTITION BY ${this.partitions.join(', ')}`),
      this.orders.length &&
        e.push(`ORDER BY ${this.orders.map((e) => `${e.column} ${e.direction}`).join(', ')}`),
      `${this.funcCall} OVER (${e.join(' ')})`
    );
  }
  as(e) {
    return `${this.toString()} AS ${e}`;
  }
}
class z {
  over() {
    return new F('RANK()');
  }
}
class U {
  over() {
    return new F('DENSE_RANK()');
  }
}
class V {
  over() {
    return new F('ROW_NUMBER()');
  }
}
const G = {
  rank: () => new z(),
  denseRank: () => new U(),
  rowNumber: () => new V(),
  jsonExtract: (e, t) => new j(`JSON_EXTRACT(${e}, ?)`, [t]),
  jsonContains: (e, t) => new j(`JSON_CONTAINS(${e}, ?)`, [t]),
  mysqlMatchAgainst(e, t, r = 'natural') {
    const s = Array.isArray(e) ? e.join(', ') : e;
    return new j(
      `MATCH(${s}) AGAINST (?${'boolean' === r ? ' IN BOOLEAN MODE' : 'query expansion' === r ? ' WITH QUERY EXPANSION' : ' IN NATURAL LANGUAGE MODE'})`,
      [t]
    );
  },
  pgToTsVector(e, t = 'simple') {
    const r = (Array.isArray(e) ? e : [e]).map((e) => `COALESCE(${e}, '')`).join(" || ' ' || ");
    return new j(`to_tsvector(?, ${r})`, [t]);
  },
  pgPlainToTsQuery: (e, t = 'simple') => new j('plainto_tsquery(?, ?)', [t, e]),
  pgWebsearchToTsQuery: (e, t = 'simple') => new j('websearch_to_tsquery(?, ?)', [t, e]),
  pgRank: (e, t) => new j(`ts_rank(${e}, ${t})`)
};
class j {
  constructor(e, t = []) {
    ((this.expr = e), (this.params = t));
  }
  toString() {
    return this.expr;
  }
  getParameters() {
    return this.params;
  }
  as(e) {
    return new j(`${this.expr} AS ${e}`, this.params);
  }
}
class X {
  getName() {
    return this.name;
  }
  getVersion() {
    return this.version;
  }
}
function Q(e, t) {
  const r = [],
    s = new Map(t.tables.map((e) => [e.name, e]));
  new Set(e.tables.map((e) => e.name));
  for (const t of e.tables) {
    const e = s.get(t.name);
    if (!e) {
      r.push({ table: t.name, create: t });
      continue;
    }
    const i = [],
      n = new Map(e.columns.map((e) => [e.name, e]));
    for (const e of t.columns) {
      const t = n.get(e.name);
      if (t) {
        const r = W(e.type) !== W(t.type ?? ''),
          s = 'boolean' == typeof t.nullable && e.nullable !== t.nullable,
          n = !!e.isComputed,
          a = !!t.isComputed,
          o = e.computedExpression,
          l = t.computedExpression,
          c = e.computedStorage,
          u = t.computedStorage,
          h = n !== a || (o || '') !== (l || '') || (c || '') !== (u || ''),
          d = (e.defaultExpression || '') !== (t.defaultExpression || '');
        (r || s || h || d) && i.push({ kind: 'alter', column: e, prev: t });
      } else i.push({ kind: 'add', column: e });
    }
    const a = new Map(t.columns.map((e) => [e.name, e]));
    for (const t of e.columns) a.has(t.name) || i.push({ kind: 'drop', column: t });
    const o = [],
      l = [],
      c = new Map(t.indexes.map((e) => [e.name, e])),
      u = new Map(e.indexes.map((e) => [e.name, e]));
    for (const [e, t] of c) {
      const r = u.get(e),
        s =
          !!r &&
          J(t.columns, r.columns) &&
          !!t.unique == !!r.unique &&
          (t.where || '') === (r.where || '') &&
          H(t.orders, r.orders) &&
          H(t.collations, r.collations) &&
          H(t.nulls, r.nulls) &&
          J(t.expressions || [], r.expressions || []);
      (r && s) || (r && !s && l.push(e), o.push(t));
    }
    for (const [e] of u) c.has(e) || l.push(e);
    (i.length > 0 || o.length > 0 || l.length > 0) &&
      r.push({
        table: t.name,
        columnChanges: i.length ? i : void 0,
        indexCreates: o.length ? o : void 0,
        indexDrops: l.length ? l : void 0
      });
  }
  const i = new Map(e.tables.map((e) => [e.name, e]));
  for (const e of t.tables) i.has(e.name) || r.push({ table: e.name, drop: !0 });
  return { tables: r };
}
function W(e) {
  return String(e || '')
    .trim()
    .toUpperCase();
}
function J(e, t) {
  if (e.length !== t.length) return !1;
  for (let r = 0; r < e.length; r++) if (e[r] !== t[r]) return !1;
  return !0;
}
function H(e, t) {
  if (!e && !t) return !0;
  if (!e || !t) return !1;
  const r = Object.keys(e),
    s = Object.keys(t);
  if (r.length !== s.length) return !1;
  for (const s of r) if (e[s] !== t[s]) return !1;
  return !0;
}
function Y(e, t) {
  const r = [],
    s = [];
  for (const i of e.tables) {
    if (i.renameTo) {
      const e = i.renameTo;
      switch (t) {
        case 'postgresql':
        default:
          r.push(`ALTER TABLE ${ne(t, i.table)} RENAME TO ${ne(t, e)}`);
          break;
        case 'mysql':
          r.push(`RENAME TABLE ${ne(t, i.table)} TO ${ne(t, e)}`);
          break;
        case 'mssql':
          r.push(`EXEC sp_rename '${i.table}', '${e}'`);
      }
    }
    if (i.create) {
      if ((r.push(Z(i, t)), i.create.indexes && i.create.indexes.length > 0))
        for (const e of i.create.indexes) {
          const s = e.unique ? 'UNIQUE ' : '',
            n = e.columns.map((e) => ne(t, e)).join(', '),
            a = ne(t, e.name),
            o = e.where && 'mysql' !== t ? ` WHERE ${e.where}` : '';
          r.push(`CREATE ${s}INDEX ${a} ON ${ne(t, i.create.name)} (${n})${o}`);
        }
      s.push(`DROP TABLE ${ne(t, i.create.name)}`);
    } else if (i.drop) r.push(`DROP TABLE ${ne(t, i.table)}`);
    else {
      if (i.indexCreates && i.indexCreates.length > 0)
        for (const e of i.indexCreates) {
          const s = e.unique ? 'UNIQUE ' : '',
            n = ne(t, e.name),
            a = [];
          for (const r of e.columns) {
            const s = e.orders?.[r] ? ` ${e.orders[r]}` : '',
              i =
                e.collations?.[r] && ('postgresql' === t || 'sqlite' === t)
                  ? ` COLLATE ${e.collations[r]}`
                  : '',
              n = 'postgresql' === t && e.nulls?.[r] ? ` NULLS ${e.nulls[r]}` : '';
            a.push(`${ne(t, r)}${s}${i}${n}`);
          }
          for (const t of e.expressions || []) a.push(`(${t})`);
          const o = a.join(', '),
            l = e.where && 'mysql' !== t ? ` WHERE ${e.where}` : '',
            c = 'postgresql' === t && e.using ? ` USING ${e.using.toUpperCase()}` : '',
            u = 'postgresql' === t && e.concurrently ? ' CONCURRENTLY' : '',
            h =
              'postgresql' === t && e.withParams && Object.keys(e.withParams).length > 0
                ? ` WITH (${Object.entries(e.withParams)
                    .map(([e, t]) => `${e}=${'string' == typeof t ? `'${t}'` : String(t)}`)
                    .join(', ')})`
                : '',
            d = 'mysql' === t && e.mysqlVisibility ? ` ${e.mysqlVisibility}` : '',
            p =
              'mssql' === t && e.include && e.include.length > 0
                ? ` INCLUDE (${e.include.map((e) => ne(t, e)).join(', ')})`
                : '';
          switch (t) {
            case 'postgresql':
              r.push(`CREATE ${s}INDEX${u} ${n} ON ${ne(t, i.table)}${c} (${o})${h}${l}`);
              break;
            case 'mysql':
              r.push(`CREATE ${s}INDEX ${n} ON ${ne(t, i.table)} (${o})${d}`);
              break;
            case 'mssql':
              r.push(`CREATE ${s}INDEX ${n} ON ${ne(t, i.table)} (${o})${p}${l}`);
              break;
            default:
              r.push(`CREATE ${s}INDEX ${n} ON ${ne(t, i.table)} (${o})${l}`);
          }
        }
      if (i.indexDrops && i.indexDrops.length > 0)
        for (const e of i.indexDrops)
          switch (t) {
            case 'postgresql':
            default:
              r.push(`DROP INDEX IF EXISTS ${ne(t, e)}`);
              break;
            case 'mysql':
              r.push(`ALTER TABLE ${ne(t, i.table)} DROP INDEX ${ne(t, e)}`);
              break;
            case 'mssql':
              r.push(`DROP INDEX ${ne(t, e)} ON ${ne(t, i.table)}`);
          }
      if (i.fkCreates && i.fkCreates.length > 0)
        for (const e of i.fkCreates) {
          const s = e.name ? `CONSTRAINT ${ne(t, e.name)} ` : '',
            n = e.columns.map((e) => ne(t, e)).join(', '),
            a = e.refColumns.map((e) => ne(t, e)).join(', '),
            o = e.onDelete ? ` ON DELETE ${e.onDelete}` : '',
            l = e.onUpdate ? ` ON UPDATE ${e.onUpdate}` : '';
          switch (t) {
            case 'postgresql':
            case 'mysql':
            case 'mssql':
              r.push(
                `ALTER TABLE ${ne(t, i.table)} ADD ${s}FOREIGN KEY (${n}) REFERENCES ${ne(t, e.refTable)} (${a})${o}${l}`
              );
              break;
            default:
              r.push(
                `-- SQLite requires table rebuild to add FK: ${s}(${n}) -> ${e.refTable}(${a})`
              );
          }
        }
      if (i.fkDrops && i.fkDrops.length > 0)
        for (const e of i.fkDrops)
          switch (t) {
            case 'postgresql':
            case 'mssql':
              r.push(`ALTER TABLE ${ne(t, i.table)} DROP CONSTRAINT ${ne(t, e)}`);
              break;
            case 'mysql':
              r.push(`ALTER TABLE ${ne(t, i.table)} DROP FOREIGN KEY ${ne(t, e)}`);
              break;
            default:
              r.push(`-- SQLite requires table rebuild to drop FK: ${e}`);
          }
      if (i.columnChanges && i.columnChanges.length > 0)
        for (const e of i.columnChanges)
          if ('add' === e.kind) {
            if (e.column.isComputed && e.column.computedExpression) {
              const s = ee(t, e.column),
                n = 'mssql' === t ? 'ADD' : 'ADD COLUMN';
              r.push(`ALTER TABLE ${ne(t, i.table)} ${n} ${s}`);
            } else if (e.column.defaultExpression) {
              const s = ee(t, e.column),
                n = 'mssql' === t ? 'ADD' : 'ADD COLUMN';
              r.push(`ALTER TABLE ${ne(t, i.table)} ${n} ${s}`);
            } else
              r.push(
                te(t, i, e.column.name, e.column.type, e.column.nullable, e.column.defaultValue)
              );
            s.push(re(t, i.table, e.column.name));
          } else if ('alter' === e.kind) {
            const s = e.prev && le(e.prev.type) !== le(e.column.type);
            if (
              e.prev?.isComputed !== e.column.isComputed ||
              e.prev?.computedExpression !== e.column.computedExpression ||
              e.prev?.computedStorage !== e.column.computedStorage
            ) {
              r.push(re(t, i.table, e.column.name));
              const s = 'mssql' === t ? 'ADD' : 'ADD COLUMN';
              r.push(`ALTER TABLE ${ne(t, i.table)} ${s} ${ee(t, e.column)}`);
              continue;
            }
            s && r.push(se(t, i.table, e.column.name, e.column.type));
            const n = e.prev?.nullable;
            'boolean' == typeof n &&
              n !== e.column.nullable &&
              r.push(ie(t, i.table, e.column.name, e.column.nullable));
          } else 'drop' === e.kind && r.push(re(t, i.table, e.column.name));
      if (i.columnRenames && i.columnRenames.length > 0)
        for (const e of i.columnRenames)
          switch (t) {
            case 'postgresql':
              r.push(
                `ALTER TABLE ${ne(t, i.table)} RENAME COLUMN ${ne(t, e.from)} TO ${ne(t, e.to)}`
              );
              break;
            case 'mysql':
              r.push(`-- MySQL requires full type for CHANGE COLUMN ${e.from} -> ${e.to}`);
              break;
            case 'mssql':
              r.push(`EXEC sp_rename '${i.table}.${e.from}', '${e.to}', 'COLUMN'`);
              break;
            default:
              r.push(`-- SQLite column rename requires pragma or rebuild: ${e.from} -> ${e.to}`);
          }
    }
  }
  return { up: r, down: s };
}
function Z(e, t) {
  const r = e.create,
    s = r.columns.map((e) => ee(t, e));
  if (
    (r.primaryKeys &&
      r.primaryKeys.length > 0 &&
      s.push(`PRIMARY KEY (${r.primaryKeys.map((e) => ne(t, e)).join(', ')})`),
    r.foreignKeys && r.foreignKeys.length > 0)
  )
    for (const e of r.foreignKeys) {
      const r = e.name ? `CONSTRAINT ${ne(t, e.name)} ` : '',
        i = e.columns.map((e) => ne(t, e)).join(', '),
        n = e.refColumns.map((e) => ne(t, e)).join(', '),
        a = e.onDelete ? ` ON DELETE ${e.onDelete}` : '',
        o = e.onUpdate ? ` ON UPDATE ${e.onUpdate}` : '';
      s.push(`${r}FOREIGN KEY (${i}) REFERENCES ${ne(t, e.refTable)} (${n})${a}${o}`);
    }
  return `CREATE TABLE IF NOT EXISTS ${ne(t, r.name)} (${s.join(', ')})`;
}
function ee(e, t) {
  if (t.isComputed && t.computedExpression)
    switch (e) {
      case 'postgresql':
        return `${ne(e, t.name)} ${ae(e, t.type)} GENERATED ALWAYS AS (${t.computedExpression}) STORED`;
      case 'mysql': {
        const r = 'STORED' === t.computedStorage ? 'STORED' : 'VIRTUAL';
        return `${ne(e, t.name)} ${ae(e, t.type)} GENERATED ALWAYS AS (${t.computedExpression}) ${r}`;
      }
      case 'mssql': {
        const r = 'PERSISTED' === t.computedStorage ? ' PERSISTED' : '';
        return `${ne(e, t.name)} AS (${t.computedExpression})${r}`;
      }
      default: {
        const r = 'STORED' === t.computedStorage ? 'STORED' : 'VIRTUAL';
        return `${ne(e, t.name)} GENERATED ALWAYS AS (${t.computedExpression}) ${r}`;
      }
    }
  const r = (t.defaultExpressionDialect || {})[e] || t.defaultExpression,
    s = r ? ` DEFAULT ${r}` : void 0 !== t.defaultValue ? ' DEFAULT ' + oe(e, t.defaultValue) : '';
  return `${ne(e, t.name)} ${ae(e, t.type)}${t.nullable ? '' : ' NOT NULL'}${s}`;
}
function te(e, t, r, s, i, n) {
  return `ALTER TABLE ${ne(e, t.table)} ${'mssql' === e ? 'ADD' : 'ADD COLUMN'} ${ne(e, r)} ${ae(e, s)}${i ? '' : ' NOT NULL'}${void 0 !== n ? ` DEFAULT ${oe(e, n)}` : ''}`;
}
function re(e, t, r) {
  return 'sqlite' === e
    ? `-- DROP COLUMN ${r} is not supported directly in SQLite`
    : `ALTER TABLE ${ne(e, t)} DROP COLUMN ${ne(e, r)}`;
}
function se(e, t, r, s) {
  const i = ne(e, t),
    n = ne(e, r),
    a = ae(e, s);
  switch (e) {
    case 'postgresql':
      return `ALTER TABLE ${i} ALTER COLUMN ${n} TYPE ${a}`;
    case 'mysql':
      return `ALTER TABLE ${i} MODIFY COLUMN ${n} ${a}`;
    case 'mssql':
      return `ALTER TABLE ${i} ALTER COLUMN ${n} ${a}`;
    default:
      return '-- ALTER TYPE not supported for sqlite; requires rebuild';
  }
}
function ie(e, t, r, s) {
  const i = ne(e, t),
    n = ne(e, r);
  switch (e) {
    case 'postgresql':
      return `ALTER TABLE ${i} ALTER COLUMN ${n} ${s ? 'DROP NOT NULL' : 'SET NOT NULL'}`;
    case 'mysql':
      return '-- MySQL requires full type in MODIFY for nullability; include in type alter';
    case 'mssql':
      return '-- MSSQL requires full type in ALTER COLUMN for nullability; include in type alter';
    default:
      return '-- SQLite nullability alter requires rebuild';
  }
}
function ne(e, t) {
  switch (e) {
    case 'postgresql':
      return '"' + t + '"';
    case 'mysql':
      return '`' + t + '`';
    case 'mssql':
      return '[' + t + ']';
    default:
      return t;
  }
}
function ae(e, t) {
  const r = String(t || '').toUpperCase();
  switch (e) {
    case 'postgresql':
      return 'INTEGER' === r || 'NUMBER' === r
        ? 'INTEGER'
        : 'TEXT' === r || 'STRING' === r
          ? 'TEXT'
          : 'BOOLEAN' === r
            ? 'BOOLEAN'
            : 'DATETIME' === r || 'DATE' === r
              ? 'TIMESTAMPTZ'
              : 'REAL' === r || 'FLOAT' === r || 'DOUBLE' === r
                ? 'DOUBLE PRECISION'
                : r;
    case 'mysql':
      return 'INTEGER' === r || 'NUMBER' === r
        ? 'INT'
        : 'TEXT' === r || 'STRING' === r
          ? 'TEXT'
          : 'BOOLEAN' === r
            ? 'TINYINT(1)'
            : 'DATETIME' === r || 'DATE' === r
              ? 'DATETIME'
              : 'REAL' === r || 'FLOAT' === r || 'DOUBLE' === r
                ? 'DOUBLE'
                : r;
    case 'mssql':
      return 'INTEGER' === r || 'NUMBER' === r
        ? 'INT'
        : 'TEXT' === r || 'STRING' === r
          ? 'NVARCHAR(MAX)'
          : 'BOOLEAN' === r
            ? 'BIT'
            : 'DATETIME' === r || 'DATE' === r
              ? 'DATETIME2'
              : 'REAL' === r || 'FLOAT' === r || 'DOUBLE' === r
                ? 'FLOAT'
                : r;
    default:
      return 'INTEGER' === r || 'NUMBER' === r
        ? 'INTEGER'
        : 'TEXT' === r || 'STRING' === r
          ? 'TEXT'
          : 'BOOLEAN' === r
            ? 'INTEGER'
            : 'DATETIME' === r || 'DATE' === r
              ? 'TEXT'
              : 'REAL' === r || 'FLOAT' === r || 'DOUBLE' === r
                ? 'REAL'
                : r;
  }
}
function oe(e, t) {
  return null === t
    ? 'NULL'
    : 'number' == typeof t
      ? String(t)
      : 'boolean' == typeof t
        ? 'postgresql' === e
          ? t
            ? 'TRUE'
            : 'FALSE'
          : t
            ? '1'
            : '0'
        : t instanceof Date
          ? `'${t.toISOString()}'`
          : `'${String(t).replace(/'/g, "''")}'`;
}
function le(e) {
  return String(e || '')
    .trim()
    .toUpperCase();
}
class ce {
  constructor(e) {
    ((this.columns = []),
      (this.primaryKeys = []),
      (this.indexes = []),
      (this.foreignKeys = []),
      (this.name = e));
  }
  column(e, t, r) {
    return (
      this.columns.push({
        name: e,
        type: t,
        nullable: r?.nullable ?? !0,
        defaultValue: r?.defaultValue,
        defaultExpression: r?.defaultExpression
      }),
      this
    );
  }
  primaryKey(...e) {
    return ((this.primaryKeys = e), this);
  }
  index(e, t, r = !1) {
    return (this.indexes.push({ name: e, columns: t, unique: r }), this);
  }
  foreignKey(e) {
    return (this.foreignKeys.push(e), this);
  }
}
class ue {
  constructor(e) {
    this.provider = e;
  }
  async listTables() {
    return (
      await this.provider.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
    ).map((e) => e.name);
  }
  async getTableInfo(e) {
    return { name: e, columns: await this.provider.executeQuery(`PRAGMA table_info(${e})`) };
  }
  async getIndexes(e) {
    const t = await this.provider.executeQuery(`PRAGMA index_list(${e})`),
      r = [];
    for (const e of t) {
      const t = await this.provider.executeQuery(`PRAGMA index_info(${e.name})`),
        s = await this.provider.executeQuery(
          `SELECT sql FROM sqlite_master WHERE type='index' AND name='${e.name}'`
        ),
        i = he(s[0]?.sql || null || void 0);
      r.push({
        name: e.name,
        columns: t.map((e) => e.name),
        unique: !!e.unique,
        where: i || void 0
      });
    }
    return r;
  }
}
function he(e) {
  if (!e) return null;
  const t = /\sWHERE\s+(.+)$/i.exec(e.trim());
  return t ? t[1] : null;
}
class de {
  constructor(e) {
    this.provider = e;
  }
  async listTables() {
    return (
      await this.provider.executeQuery(
        "SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY tablename"
      )
    ).map((e) => e.tablename);
  }
  async getIndexes(e) {
    const t = await this.provider.executeQuery(
        'SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1',
        [e]
      ),
      r = [];
    for (const e of t) {
      const t = e.indexdef || '',
        s = /^CREATE\s+UNIQUE\s+INDEX/i.test(t),
        i = /ON\s+[^()]+\((.+?)\)(?:\s+WHERE\s+(.+))?$/i.exec(t),
        n = i?.[1] || '',
        a = i?.[2] || void 0,
        o = n.split(',').map((e) => e.trim()),
        l = [];
      for (const e of o) {
        if (e.startsWith('(')) continue;
        const t = e.replace(/^"|"$/g, '').replace(/\s+(ASC|DESC)$/i, '');
        l.push(t);
      }
      r.push({ name: e.indexname, columns: l, unique: s, where: a });
    }
    return r;
  }
}
class pe {
  constructor(e) {
    this.provider = e;
  }
  async listTables() {
    return (
      await this.provider.executeQuery(
        "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
      )
    ).map((e) => e.TABLE_NAME);
  }
  async getIndexes(e) {
    const t = await this.provider.executeQuery(
        'SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, COLLATION, EXPRESSION FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX',
        [e]
      ),
      r = new Map();
    for (const e of t) {
      const t = e.INDEX_NAME;
      r.has(t) || r.set(t, { name: t, columns: [], unique: 0 === e.NON_UNIQUE, _parts: [] });
      const s = r.get(t);
      e.COLUMN_NAME
        ? s._parts.push({ col: e.COLUMN_NAME })
        : e.EXPRESSION && s._parts.push({ expr: e.EXPRESSION });
    }
    const s = [];
    for (const e of r.values()) {
      const t = e._parts.filter((e) => e.col).map((e) => e.col);
      s.push({ name: e.name, columns: t, unique: e.unique });
    }
    return s;
  }
}
class me {
  constructor(e) {
    this.provider = e;
  }
  async listTables() {
    return (await this.provider.executeQuery('SELECT name FROM sys.tables ORDER BY name')).map(
      (e) => e.name
    );
  }
  async getIndexes(e) {
    const t = await this.provider.executeQuery(
        'SELECT i.name, i.is_unique, i.filter_definition FROM sys.indexes i WHERE i.object_id = OBJECT_ID(@p1) AND i.is_hypothetical = 0 AND i.name IS NOT NULL',
        [e]
      ),
      r = await this.provider.executeQuery(
        'SELECT i.name as index_name, c.name as column_name, ic.key_ordinal, ic.is_descending_key FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=i.object_id AND c.column_id=ic.column_id WHERE i.object_id = OBJECT_ID(@p1) ORDER BY i.name, ic.key_ordinal',
        [e]
      ),
      s = new Map();
    for (const e of t)
      s.set(e.name, {
        name: e.name,
        columns: [],
        unique: 1 === e.is_unique,
        where: e.filter_definition || void 0,
        _cols: []
      });
    for (const e of r) {
      const t = s.get(e.index_name);
      t && t._cols.push(e.column_name);
    }
    const i = [];
    for (const e of s.values())
      i.push({ name: e.name, columns: e._cols, unique: e.unique, where: e.where });
    return i;
  }
}
class ye {
  constructor(e) {
    this.provider = e;
  }
  buildExpectedFromMetadata() {
    return {
      tables: c.getEntities().map((e) => {
        const t = e.columns.map((t) => ({
            name: t.columnName,
            type: this.mapPortableType(t.type),
            nullable: t.nullable,
            defaultValue: t.defaultValue,
            defaultExpression: t.defaultExpression,
            isPrimaryKey: e.primaryKeys.includes(t.propertyName),
            isComputed: t.isComputed,
            computedExpression: t.computedExpression,
            computedStorage: t.computedStorage
          })),
          r = e.primaryKeys.map(
            (t) => e.columns.find((e) => e.propertyName === t)?.columnName || t
          ),
          s = (e.indexes || []).map((e) => ({
            name: e.name,
            columns: e.columns,
            unique: !!e.unique,
            where: e.where,
            orders: e.orders,
            collations: e.collations,
            nulls: e.nulls,
            expressions: e.expressions,
            using: e.using,
            concurrently: e.concurrently,
            withParams: e.withParams,
            mysqlVisibility: e.mysqlVisibility,
            include: e.include
          }));
        return { name: e.tableName, columns: t, primaryKeys: r, indexes: s, foreignKeys: [] };
      })
    };
  }
  async buildActualFromProvider(e) {
    if (!this.provider)
      throw new Error('SchemaSnapshotBuilder requires a provider for actual schema');
    const t = this.provider.providerLabel || 'sqlite';
    if ('sqlite' === t) {
      const e = new ue(this.provider),
        t = await e.listTables(),
        r = [];
      for (const s of t) {
        const t = await e.getTableInfo(s),
          i = await e.getIndexes(s);
        r.push({
          name: s,
          columns: t.columns.map((e) => ({
            name: e.name,
            type: this.normalizePortableType(e.type),
            nullable: !e.notnull
          })),
          primaryKeys: t.columns.filter((e) => e.pk > 0).map((e) => e.name),
          indexes: i.map((e) => ({
            name: e.name,
            columns: e.columns,
            unique: e.unique,
            where: e.where
          })),
          foreignKeys: []
        });
      }
      return { tables: r };
    }
    const r = async (e) => {
        if ('postgresql' === t) {
          const t = new de(this.provider);
          return (await t.getIndexes(e)).map((e) => ({
            name: e.name,
            columns: e.columns,
            unique: e.unique,
            where: e.where
          }));
        }
        if ('mysql' === t) {
          const t = new pe(this.provider);
          return (await t.getIndexes(e)).map((e) => ({
            name: e.name,
            columns: e.columns,
            unique: e.unique
          }));
        }
        if ('mssql' === t) {
          const t = new me(this.provider);
          return (await t.getIndexes(e)).map((e) => ({
            name: e.name,
            columns: e.columns,
            unique: e.unique,
            where: e.where
          }));
        }
        return [];
      },
      s = [],
      i = e?.tables || [];
    for (const e of i) {
      const t = await r(e.name);
      s.push({
        name: e.name,
        columns: e.columns.map((e) => ({ name: e.name, type: e.type, nullable: e.nullable })),
        primaryKeys: e.primaryKeys.slice(),
        indexes: t,
        foreignKeys: []
      });
    }
    return { tables: s };
  }
  mapPortableType(e) {
    switch (String(e || '').toUpperCase()) {
      case 'INTEGER':
      case 'NUMBER':
      case 'BOOLEAN':
        return 'INTEGER';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'REAL';
      case 'DATETIME':
      case 'DATE':
      default:
        return 'TEXT';
      case 'BLOB':
        return 'BLOB';
    }
  }
  normalizePortableType(e) {
    return this.mapPortableType(e);
  }
}
var fe;
!(function (e) {
  ((e.String = 'string'), (e.Number = 'number'), (e.Boolean = 'boolean'), (e.Object = 'object'));
})(fe || (fe = {}));
class ge {
  static buildWhereClause(e) {
    const t = [],
      r = [];
    for (const [s, i] of Object.entries(e))
      if (null == i) t.push(`${s} IS NULL`);
      else if (Array.isArray(i)) {
        const e = i.map(() => '?').join(', ');
        t.push(`${s} IN (${e})`);
        for (const e of i) r.push(ge.ensureSqlParameter(e));
      } else (t.push(`${s} = ?`), r.push(ge.ensureSqlParameter(i)));
    return { whereClause: t.join(' AND '), params: r };
  }
  static ensureSqlParameter(e) {
    if (
      null === e ||
      'string' == typeof e ||
      'number' == typeof e ||
      'boolean' == typeof e ||
      e instanceof Date ||
      e instanceof Uint8Array
    )
      return e;
    try {
      return JSON.stringify(e ?? null);
    } catch {
      return String(e);
    }
  }
  static formatValue(e) {
    return null == e
      ? 'NULL'
      : typeof e === fe.String
        ? `'${e.replace(/'/g, "''")}'`
        : typeof e === fe.Boolean
          ? e
            ? '1'
            : '0'
          : e instanceof Date
            ? `'${e.toISOString()}'`
            : String(e);
  }
  static escapeIdentifier(e) {
    return `"${e.replace(/"/g, '""')}"`;
  }
  static buildOrderByClause(e) {
    if (0 === e.length) return '';
    return `ORDER BY ${e.map((e) => `${e.column} ${e.direction}`).join(', ')}`;
  }
  static buildLimitClause(e, t) {
    const r = 'number' == typeof e && e > 0,
      s = 'number' == typeof t && t >= 0;
    if (!r && !s) return '';
    let i = '';
    return (r && (i += `LIMIT ${e}`), s && (i += (i ? ' ' : '') + `OFFSET ${t}`), i.trim());
  }
}
var _e = Object.freeze({
  __proto__: null,
  get EntityState() {
    return t;
  },
  get LoadingStrategy() {
    return r;
  },
  get JoinType() {
    return s;
  },
  ok: i,
  err: n,
  DatabaseError: a,
  UniqueConstraintError: class extends a {
    constructor(e, t) {
      (super(e, t), (this.name = 'UniqueConstraintError'));
    }
  },
  ForeignKeyConstraintError: class extends a {
    constructor(e, t) {
      (super(e, t), (this.name = 'ForeignKeyConstraintError'));
    }
  },
  ValidationError: o,
  OptimisticConcurrencyError: class extends a {
    constructor(e = 'Optimistic concurrency check failed', t) {
      (super(e, t), (this.name = 'OptimisticConcurrencyError'));
    }
  },
  unbrandId: function (e) {
    return e;
  },
  brandId: function (e) {
    return e;
  },
  isBrandedId: function (e) {
    return 'string' == typeof e || 'number' == typeof e;
  },
  Entity: function (e = {}) {
    return function (t, r) {
      const s = e?.name || t.name;
      if ((i = r) && 'object' == typeof i && 'class' === i.kind)
        return (
          c.addEntity(t, s),
          void r.addInitializer?.(function () {
            const e = t;
            try {
              const t = Reflect.getOwnMetadata('orm:columns', e) || [];
              for (const r of t) c.addColumn(e, r);
              const r = Reflect.getOwnMetadata('orm:primaryKeys', e) || [];
              for (const t of r) c.addPrimaryKey(e, t);
              const s = Reflect.getOwnMetadata('orm:relationships', e) || [];
              for (const t of s) {
                const r = t.targetEntity,
                  s = 'function' == typeof r && r.prototype ? r : r();
                c.addRelationship(e, { ...t, targetEntity: s });
              }
              const i = Reflect.getOwnMetadata('orm:indexes', e) || [];
              for (const t of i) c.addIndex(e, t);
            } catch {}
          })
        );
      var i;
      (Reflect.defineMetadata('orm:tableName', s, t), c.addEntity(t, s));
      const n = class extends t {
        constructor(...e) {
          if ((super(...e), !c.getEntity(t))) {
            const e = Reflect.getOwnMetadata('orm:tableName', t) || s;
            c.addEntity(t, e);
            const r = Reflect.getOwnMetadata('orm:columns', t) || [];
            for (const e of r) c.addColumn(t, e);
            const i = Reflect.getOwnMetadata('orm:primaryKeys', t) || [];
            for (const e of i) c.addPrimaryKey(t, e);
            const n = Reflect.getOwnMetadata('orm:relationships', t) || [];
            for (const e of n) {
              const r = e.targetEntity,
                s = 'function' == typeof r && r.prototype ? r : r();
              c.addRelationship(t, { ...e, targetEntity: s });
            }
          }
        }
      };
      return (Reflect.defineMetadata('orm:original', t, n), n);
    };
  },
  Column: function (e = {}) {
    return function (t, r) {
      if (!(s = r) || 'object' != typeof s || 'field' !== s.kind || !('name' in s))
        throw new Error('@Column requires TS5 Stage-3 decorators');
      var s;
      const i = r,
        n = i.name.toString();
      i.addInitializer?.(function () {
        const t = this?.constructor;
        if (!t) return;
        const r = Reflect.getMetadata('design:type', t.prototype, n),
          s = {
            propertyName: n,
            columnName: e?.name || n,
            type: e?.type || u(r),
            nullable: !1 !== e?.nullable,
            defaultValue: e?.defaultValue,
            length: e?.length,
            precision: e?.precision,
            scale: e?.scale,
            isGenerated: e?.generated || !1,
            isVersion: e?.version || !1
          };
        c.addColumn(t, s);
        const i = Reflect.getOwnMetadata('orm:columns', t) || [];
        (i.push(s), Reflect.defineMetadata('orm:columns', i, t));
      });
    };
  },
  PrimaryKey: function (e = {}) {
    return function (t, r) {
      if (!(s = r) || 'object' != typeof s || 'field' !== s.kind || !('name' in s))
        throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
      var s;
      const i = r,
        n = i.name.toString();
      i.addInitializer?.(function () {
        const t = this?.constructor;
        if (!t) return;
        const r = {
          propertyName: n,
          columnName: e?.name || n,
          type: e?.type || 'INTEGER',
          nullable: !1,
          isGenerated: !!e?.autoIncrement,
          isVersion: !!e?.version
        };
        c.addColumn(t, r);
        const s = Reflect.getOwnMetadata('orm:columns', t) || [];
        if (
          (s.push(r), Reflect.defineMetadata('orm:columns', s, t), c.addPrimaryKey(t, n), e.branded)
        ) {
          const e = c.getEntity(t),
            r = e?.columns.find((e) => e.propertyName === n);
          r && ((r.isBranded = !0), (r.brand = t.name));
        }
        const i = Reflect.getOwnMetadata('orm:primaryKeys', t) || [];
        (i.includes(n) || i.push(n), Reflect.defineMetadata('orm:primaryKeys', i, t));
      });
    };
  },
  OneToMany: function (e, t = {}) {
    return function (r, s) {
      return h('one-to-many', e, t, r, s);
    };
  },
  ManyToOne: function (e, t = {}) {
    return function (r, s) {
      return h('many-to-one', e, t, r, s);
    };
  },
  OneToOne: function (e, t = {}) {
    return function (r, s) {
      return h('one-to-one', e, t, r, s);
    };
  },
  ManyToMany: function (e, t = {}) {
    return function (r, s) {
      return h('many-to-many', e, t, r, s);
    };
  },
  ValidIf: p,
  ValidIfOf: function (e, t) {
    return p(e, t);
  },
  RequiredIfOf: function (e, t) {
    return function (r, s) {
      if (!d(s)) throw new Error('@RequiredIfOf requires TS5 Stage-3 decorators');
      const i = s,
        n = i.name.toString();
      i.addInitializer?.(function () {
        const r = this?.constructor;
        if (!r) return;
        const s = Reflect.getOwnMetadata('orm:validations', r) || [];
        (s.push({
          propertyName: n,
          predicate: (t) => {
            const r = t;
            if (!e(r)) return !0;
            const s = r[n];
            return (
              null != s &&
              ('string' == typeof s ? s.trim().length > 0 : !Array.isArray(s) || s.length > 0)
            );
          },
          message: t || `${n} is required`
        }),
          Reflect.defineMetadata('orm:validations', s, r));
      });
    };
  },
  MinLengthOf: function (e, t) {
    return function (r, s) {
      if (!d(s)) throw new Error('@MinLengthOf requires TS5 Stage-3 decorators');
      const i = s,
        n = i.name.toString();
      i.addInitializer?.(function () {
        const r = this?.constructor;
        if (!r) return;
        const s = Reflect.getOwnMetadata('orm:validations', r) || [];
        (s.push({
          propertyName: n,
          predicate: (t) => {
            const r = t[n];
            return null == r || 'string' != typeof r || r.length >= e;
          },
          message: t || `Length must be >= ${e}`
        }),
          Reflect.defineMetadata('orm:validations', s, r));
      });
    };
  },
  MaxLengthOf: function (e, t) {
    return function (r, s) {
      if (!d(s)) throw new Error('@MaxLengthOf requires TS5 Stage-3 decorators');
      const i = s,
        n = i.name.toString();
      i.addInitializer?.(function () {
        const r = this?.constructor;
        if (!r) return;
        const s = Reflect.getOwnMetadata('orm:validations', r) || [];
        (s.push({
          propertyName: n,
          predicate: (t) => {
            const r = t[n];
            return null == r || 'string' != typeof r || r.length <= e;
          },
          message: t || `Length must be <= ${e}`
        }),
          Reflect.defineMetadata('orm:validations', s, r));
      });
    };
  },
  PatternOf: function (e, t) {
    return function (r, s) {
      if (!d(s)) throw new Error('@PatternOf requires TS5 Stage-3 decorators');
      const i = s,
        n = i.name.toString();
      i.addInitializer?.(function () {
        const r = this?.constructor;
        if (!r) return;
        const s = Reflect.getOwnMetadata('orm:validations', r) || [];
        (s.push({
          propertyName: n,
          predicate: (t) => {
            const r = t[n];
            return null == r || 'string' != typeof r || e.test(r);
          },
          message: t || 'Invalid format'
        }),
          Reflect.defineMetadata('orm:validations', s, r));
      });
    };
  },
  RangeOf: function (e, t, r) {
    return function (s, i) {
      if (!d(i)) throw new Error('@RangeOf requires TS5 Stage-3 decorators');
      const n = i,
        a = n.name.toString();
      n.addInitializer?.(function () {
        const s = this?.constructor;
        if (!s) return;
        const i = Reflect.getOwnMetadata('orm:validations', s) || [];
        (i.push({
          propertyName: a,
          predicate: (r) => {
            const s = r[a];
            if (null == s) return !0;
            if ('number' == typeof s) {
              if ('number' == typeof e && s < e) return !1;
              if ('number' == typeof t && s > t) return !1;
            }
            return !0;
          },
          message: r || 'Out of range'
        }),
          Reflect.defineMetadata('orm:validations', i, s));
      });
    };
  },
  MetadataStorage: c,
  EntityMetadataBuilder: l,
  ChangeTracker: m,
  DbContext: class {
    constructor(e) {
      ((this._dbSets = new Map()),
        (this._defaultLoadingStrategy = r.Eager),
        (this._loadingDefaults = {}),
        (this._validationRulesCache = new WeakMap()),
        (this._provider = e.provider),
        (this._softDelete = e.softDelete),
        (this._audit = e.audit),
        (this._globalFilters = e.globalFilters),
        (this._validationOptions = e.validation),
        (this._changeTracker = new m()),
        (this._entityLoader = new w(this._provider)),
        e.performance?.enableEntityCache &&
          (this._entityCache = new B(
            e.performance.entityCacheSize ?? 1e4,
            this._provider.loggerRef,
            this._provider.providerLabel
          )),
        (this._performanceOptions = e.performance),
        (this._loadingDefaults = e.loading || {}),
        this._loadingDefaults.strategy
          ? ((this._defaultLoadingStrategy = this._loadingDefaults.strategy),
            this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy))
          : this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy),
        this.initializeDbSets());
    }
    set(e) {
      const t = Reflect.getOwnMetadata,
        r = t?.('orm:original', e),
        s = 'function' == typeof r ? r : e;
      if (!this._dbSets.has(s)) throw new Error(`DbSet for ${e.name} is not configured`);
      const i = this._dbSets.get(s);
      return ((i._entityClass = e), i);
    }
    async ensureCreated() {
      await this._provider.connect();
      const e = c.getEntities();
      for (const t of e)
        try {
          new (k(t.target))();
        } catch {}
      const t = c.getEntities();
      for (const e of t) await this._provider.createTable(e);
    }
    async saveChanges() {
      const e = this._changeTracker.getChanges();
      for (const t of e)
        if ('added' === t.state) {
          const e = c.getEntity(t.entityClass);
          if (e)
            for (const r of e.columns)
              void 0 === t.entity[r.propertyName] &&
                void 0 !== r.defaultValue &&
                (t.entity[r.propertyName] = r.defaultValue);
        }
      this.validateChanges(e);
      let t = 0;
      for (const r of e) {
        if (this._audit?.enabled) {
          const e = c.getEntity(r.entityClass);
          if (e) {
            const t = (this._audit.clock ?? (() => new Date()))(),
              s = this._audit.timeColumns?.createdAt ?? 'createdAt',
              i = this._audit.timeColumns?.updatedAt ?? 'updatedAt',
              n = this._audit.userColumns?.createdBy ?? 'createdBy',
              a = this._audit.userColumns?.updatedBy ?? 'updatedBy',
              o = this._audit.getCurrentUserId?.();
            ('added' === r.state &&
              (e.columns.some((e) => e.propertyName === s) && (r.entity[s] = t),
              e.columns.some((e) => e.propertyName === n) && void 0 !== o && (r.entity[n] = o)),
              ('added' !== r.state && 'modified' !== r.state) ||
                (e.columns.some((e) => e.propertyName === i) && (r.entity[i] = t),
                e.columns.some((e) => e.propertyName === a) && void 0 !== o && (r.entity[a] = o)));
          }
        }
        switch (r.state) {
          case 'added':
            if ((await this._provider.insert(r.entity, r.entityClass), this._entityCache)) {
              const e = c.getEntity(r.entityClass),
                t = e?.primaryKeys[0];
              t && this._entityCache.set(r.entityClass, r.entity[t], r.entity);
            }
            t++;
            break;
          case 'modified':
            if ((await this._provider.update(r.entity, r.entityClass), this._entityCache)) {
              const e = c.getEntity(r.entityClass),
                t = e?.primaryKeys[0];
              t && this._entityCache.set(r.entityClass, r.entity[t], r.entity);
            }
            t++;
            break;
          case 'deleted':
            if (this._softDelete?.enabled) {
              const e = c.getEntity(r.entityClass),
                s = this._softDelete.column ?? 'isDeleted',
                i = this._softDelete.deletedAtColumn ?? 'deletedAt';
              if (e && e.columns.some((e) => e.propertyName === s || e.columnName === s)) {
                if (
                  ((r.entity[s] = !0),
                  e.columns.some((e) => e.propertyName === i || e.columnName === i) &&
                    (r.entity[i] = new Date()),
                  await this._provider.update(r.entity, r.entityClass),
                  this._entityCache)
                ) {
                  const t = e.primaryKeys[0];
                  this._entityCache.set(r.entityClass, r.entity[t], r.entity);
                }
                t++;
                break;
              }
            }
            if ((await this._provider.delete(r.entity, r.entityClass), this._entityCache)) {
              const e = c.getEntity(r.entityClass),
                t = e?.primaryKeys[0];
              t && this._entityCache.remove(r.entityClass, r.entity[t]);
            }
            t++;
        }
      }
      return (this._changeTracker.acceptAllChanges(), t);
    }
    async trySaveChanges() {
      try {
        const e = await this.saveChanges();
        return i(e);
      } catch (e) {
        return n(e);
      }
    }
    async beginTransaction() {
      await this._provider.beginTransaction();
    }
    async commitTransaction() {
      await this._provider.commitTransaction();
      try {
        if ((require('../query/Queryable').Queryable.clearCountCache(), this._entityCache)) {
          const { safeCacheSize: e } = require('../utils/MetricsSafe');
          e(this._provider.loggerRef, {
            cache: 'entityL2',
            size: this._entityCache.size?.() ?? -1,
            provider: this._provider.providerLabel
          });
        }
      } catch {}
    }
    async rollbackTransaction() {
      if ((await this._provider.rollbackTransaction(), this._entityCache))
        try {
          this._entityCache.clear();
          const { safeCacheSize: e } = require('../utils/MetricsSafe');
          e(this._provider.loggerRef, {
            cache: 'entityL2',
            size: this._entityCache.size?.() ?? 0,
            provider: this._provider.providerLabel
          });
        } catch {}
      try {
        require('../query/Queryable').Queryable.clearCountCache();
      } catch {}
    }
    async dispose() {
      await this._provider.disconnect();
    }
    get provider() {
      return this._provider;
    }
    get changeTracker() {
      return this._changeTracker;
    }
    get entityLoader() {
      return this._entityLoader;
    }
    setLoadingStrategy(e) {
      ((this._defaultLoadingStrategy = e), this._entityLoader.setDefaultStrategy(e));
    }
    async find(e, t, r) {
      const s = {
        strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
        depth: this._loadingDefaults.depth ?? r?.depth,
        ...(r || {})
      };
      return await this._entityLoader.loadEntity(e, t, s);
    }
    async findAll(e, t) {
      const r = {
        strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
        depth: this._loadingDefaults.depth ?? t?.depth,
        ...(t || {})
      };
      return await this._entityLoader.loadEntities(e, r);
    }
    async include(e, t, ...s) {
      E.isLazyProxy(e)
        ? await E.preloadRelationships([e], t, s, this._provider)
        : await this._entityLoader.populateRelationships(e, t, { strategy: r.Eager, includes: s });
    }
    isLoaded(e, t) {
      return E.isLazyProxy(e) ? E.isRelationshipLoaded(e, t) : void 0 !== e[t] && null !== e[t];
    }
    initializeDbSets() {
      const e = c.getEntities();
      for (const t of e) {
        const e = k(t.target),
          r = new I(
            e,
            this._provider,
            this._changeTracker,
            this._entityLoader,
            this._entityCache,
            this._performanceOptions,
            this._globalFilters
          );
        this._dbSets.set(e, r);
        const s = e.name.toLowerCase(),
          i = s.endsWith('y') ? s.slice(0, -1) + 'ies' : s + 's';
        Object.defineProperty(this, i, { get: () => r, enumerable: !0, configurable: !1 });
      }
    }
    validateChanges(e) {
      const t = [];
      for (const r of e) {
        if ('added' !== r.state && 'modified' !== r.state) continue;
        const e = c.getEntity(r.entityClass);
        if (!e) continue;
        const s = this._audit?.enabled ? this._audit : void 0,
          i = s
            ? {
                createdAt: s.timeColumns?.createdAt ?? 'createdAt',
                updatedAt: s.timeColumns?.updatedAt ?? 'updatedAt',
                createdBy: s.userColumns?.createdBy ?? 'createdBy',
                updatedBy: s.userColumns?.updatedBy ?? 'updatedBy'
              }
            : void 0;
        for (const n of e.columns) {
          const a = r.entity[n.propertyName];
          if (n.isComputed)
            if ('added' === r.state)
              void 0 !== a &&
                t.push(
                  this.buildValidationDetail(
                    e,
                    n.propertyName,
                    'Computed column is read-only and cannot be set on insert'
                  )
                );
            else if ('modified' === r.state && r.originalValues) {
              a !== r.originalValues[n.propertyName] &&
                t.push(
                  this.buildValidationDetail(
                    e,
                    n.propertyName,
                    'Computed column is read-only and cannot be updated'
                  )
                );
            }
          const o = e.primaryKeys.includes(n.propertyName) && n.isGenerated && 'added' === r.state,
            l = void 0 !== n.defaultValue && 'added' === r.state,
            c = !(
              !s ||
              (('added' !== r.state ||
                (n.propertyName !== i.createdAt && n.propertyName !== i.createdBy) ||
                (n.propertyName !== i.createdAt && void 0 === s.getCurrentUserId)) &&
                (('added' !== r.state && 'modified' !== r.state) ||
                  (n.propertyName !== i.updatedAt && n.propertyName !== i.updatedBy) ||
                  (n.propertyName !== i.updatedAt && void 0 === s.getCurrentUserId)))
            );
          (n.nullable ||
            null != a ||
            o ||
            l ||
            c ||
            t.push(this.buildValidationDetail(e, n.propertyName, 'Value cannot be null')),
            n.length &&
              'string' == typeof a &&
              a.length > n.length &&
              t.push(this.buildValidationDetail(e, n.propertyName, `Length exceeds ${n.length}`)));
        }
        try {
          const s = this.getValidationRules(r.entityClass);
          for (const i of s) {
            const s = i.phase || 'always';
            if ('onCreate' === s && 'added' !== r.state) continue;
            if ('onUpdate' === s && 'modified' !== r.state) continue;
            if (!!!i.predicate(r.entity)) {
              const r = i.messageKey,
                s = i.messageParams,
                n =
                  (r && this._validationOptions?.translate
                    ? this._validationOptions.translate(r, s)
                    : void 0) ||
                  i.message ||
                  'Validation rule failed';
              t.push(this.buildValidationDetail(e, i.propertyName, n));
            }
          }
        } catch {}
      }
      if (t.length > 0) throw new o('Model validation failed', t);
    }
    getValidationRules(e) {
      const t = this._validationRulesCache.get(e);
      if (t) return t;
      const r = (Reflect.getOwnMetadata('orm:validations', e) || []).slice();
      return (this._validationRulesCache.set(e, r), r);
    }
    buildValidationDetail(e, t, r) {
      const s = e?.tableName || 'unknown_table',
        i = e?.target?.name || 'UnknownEntity',
        n = e?.columns.find((e) => e.propertyName === t)?.columnName || t;
      return {
        entity: s,
        property: t,
        message: r,
        entityClass: i,
        table: s,
        column: n,
        fullMessage: `${i}.${t} (${s}.${n}): ${r}`
      };
    }
  },
  DbSet: I,
  Queryable: D,
  TypedQueryable: q,
  typed: function (e) {
    return q.from(e);
  },
  QueryBuilder: S,
  InMemorySqlCache: class {
    constructor(e = 1e3) {
      ((this.maxSize = e), (this.store = new Map()));
    }
    get(e) {
      return this.store.get(e);
    }
    set(e, t) {
      if (this.store.size >= this.maxSize) {
        const e = this.store.keys().next().value;
        void 0 !== e && this.store.delete(e);
      }
      this.store.set(e, { query: t.query, parameters: [...t.parameters] });
    }
    clear() {
      this.store.clear();
    }
    size() {
      return this.store.size;
    }
  },
  EnhancedSqlCache: v,
  InMemoryCountCache: class {
    constructor(e = 1e4, t = 2e3) {
      ((this.ttlMs = e), (this.maxSize = t), (this.store = new Map()));
    }
    get(e) {
      const t = this.store.get(e);
      if (t) {
        if (!(this.ttlMs > 0 && Date.now() - t.ts > this.ttlMs)) return t;
        this.store.delete(e);
      }
    }
    set(e, t) {
      if (this.store.size >= this.maxSize) {
        const e = this.store.keys().next().value;
        void 0 !== e && this.store.delete(e);
      }
      this.store.set(e, t);
    }
    clear() {
      this.store.clear();
    }
  },
  GlobalFilterApplier: $,
  JoinPredicateParser: x,
  PredicateParser: L,
  QueryModel: O,
  get LogicalOperator() {
    return A;
  },
  get ComparisonOperator() {
    return R;
  },
  SqlVisitor: M,
  CompositeSpecification: P,
  PredicateSpecification: class {
    constructor(e, t) {
      ((this.predicate = e), (this.expression = t));
    }
    toExpression() {
      return this.expression;
    }
    test(e) {
      return this.predicate(e);
    }
  },
  Specs: K,
  sql: G,
  DatabaseProvider: class {
    constructor(e, t, r, s, i) {
      ((this.isConnected = !1),
        (this.inTransaction = !1),
        (this.providerName = 'unknown'),
        (this.connectionString = e),
        (this.logger = t),
        (this.middlewares = r),
        (this.softDelete = s),
        (this.retryPolicy = i));
    }
    async insertMany(e, t) {
      if (0 === e.length) return e;
      await this.beginTransaction();
      try {
        for (const r of e) await this.insert(r, t);
        return (await this.commitTransaction(), e);
      } catch (e) {
        throw (await this.rollbackTransaction(), e);
      }
    }
    async updateMany(e, t) {
      if (0 === e.length) return e;
      await this.beginTransaction();
      try {
        for (const r of e) await this.update(r, t);
        return (await this.commitTransaction(), e);
      } catch (e) {
        throw (await this.rollbackTransaction(), e);
      }
    }
    async upsert(e, t) {
      try {
        return await this.update(e, t);
      } catch {
        return await this.insert(e, t);
      }
    }
    async upsertMany(e, t) {
      if (0 === e.length) return e;
      await this.beginTransaction();
      try {
        for (const r of e) await this.upsert(r, t);
        return (await this.commitTransaction(), e);
      } catch (e) {
        throw (await this.rollbackTransaction(), e);
      }
    }
    async executeQuery(e, t = []) {
      return await this.executeWithRetry(() => this.doExecuteQuery(e, t), e, t);
    }
    async executeNonQuery(e, t = []) {
      return await this.executeWithRetry(() => this.doExecuteNonQuery(e, t), e, t);
    }
    async executeWithRetry(e, t, r) {
      const s = Date.now();
      (this.logger?.queryStart?.({
        sql: t,
        params: r,
        traceId: this.currentTraceId,
        provider: this.providerName
      }),
        (this.lastExecuteStartedAt = s),
        await this.beforeExecute(t, r));
      let i = 0;
      const n = !this.inTransaction;
      for (;;)
        try {
          const i = await e(),
            n = Date.now() - s;
          return (
            this.logger?.queryEnd?.({
              sql: t,
              params: r,
              durationMs: n,
              traceId: this.currentTraceId,
              rows: Array.isArray(i) ? i.length : 'number' == typeof i ? i : void 0,
              provider: this.providerName
            }),
            await this.afterExecute(t, r, i),
            i
          );
        } catch (e) {
          i++;
          const a = Date.now() - s;
          this.logger?.queryEnd?.({
            sql: t,
            params: r,
            durationMs: a,
            traceId: this.currentTraceId,
            error: e,
            provider: this.providerName
          });
          const o = this.isTransientError(e),
            l = this.retryPolicy
              ? (this.retryPolicy.shouldRetryEx?.({
                  error: e,
                  attempt: i,
                  inTransaction: this.inTransaction,
                  sql: t,
                  params: r,
                  provider: this.providerName
                }) ?? this.retryPolicy.shouldRetry(e, i, this.inTransaction))
              : o;
          if (!n || !l || i >= 3) throw e;
          const c = Math.floor(25 * Math.random()),
            u = 50 * Math.pow(2, i - 1) + c,
            h = this.retryPolicy ? this.retryPolicy.getDelayMs(i) : u;
          (this.logger?.retry?.({
            sql: t,
            params: r,
            attempt: i,
            traceId: this.currentTraceId,
            provider: this.providerName
          }),
            await new Promise((e) => setTimeout(e, h)));
        }
    }
    isTransientError(e) {
      const t = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
      return (
        t.includes('deadlock') ||
        t.includes('timeout') ||
        t.includes('connection') ||
        t.includes('too many connections') ||
        t.includes('econnreset')
      );
    }
    async beforeExecute(e, t) {
      if (!this.middlewares || 0 === this.middlewares.length) return;
      const r = { sql: e, params: t, traceId: this.currentTraceId };
      for (const e of this.middlewares)
        try {
          await e.beforeExecute?.(r);
        } catch {}
    }
    async afterExecute(e, t, r) {
      if (!this.middlewares || 0 === this.middlewares.length) return;
      const s = Array.isArray(r) ? r.length : 'number' == typeof r ? r : void 0,
        i = {
          sql: e,
          params: t,
          durationMs: this.lastExecuteStartedAt ? Date.now() - this.lastExecuteStartedAt : 0,
          traceId: this.currentTraceId,
          rows: s
        };
      for (const e of this.middlewares)
        try {
          await e.afterExecute?.(i);
        } catch {}
    }
    async notifyEntityMaterialized(e, t) {
      if (!this.middlewares || 0 === this.middlewares.length) return;
      const r = { entity: e, metadata: t };
      for (const e of this.middlewares)
        try {
          await e.entityMaterialized?.(r);
        } catch {}
    }
    get connected() {
      return this.isConnected;
    }
    get inTransactionState() {
      return this.inTransaction;
    }
    get softDeleteOptions() {
      return this.softDelete;
    }
    get providerLabel() {
      return this.providerName;
    }
    get loggerRef() {
      return this.logger;
    }
  },
  DdlBuilder: class {
    constructor(e) {
      this.strategy = e;
    }
    buildCreateTableSql(e) {
      return this.strategy.generateCreateTableSql(e);
    }
    buildCreateIndexesSql(e) {
      const t = [];
      for (const r of e.indexes || [])
        t.push(
          this.strategy.generateCreateIndexSql(e.tableName, {
            name: r.name,
            columns: r.columns,
            unique: r.unique
          })
        );
      return t;
    }
    buildAll(e) {
      return { tableSql: this.buildCreateTableSql(e), indexSqls: this.buildCreateIndexesSql(e) };
    }
  },
  EntityLoader: w,
  Migration: X,
  MigrationRunner: class {
    constructor(e) {
      ((this._migrations = []), (this._provider = e));
    }
    addMigration(e) {
      (this._migrations.push(e),
        this._migrations.sort((e, t) => e.getVersion().localeCompare(t.getVersion())));
    }
    async ensureMigrationTableExists() {
      await this._provider.executeNonQuery(
        '\n            CREATE TABLE IF NOT EXISTS __migrations (\n                version TEXT PRIMARY KEY,\n                name TEXT NOT NULL,\n                applied_at TEXT NOT NULL\n            )\n        '
      );
    }
    async getAppliedMigrations() {
      try {
        return (
          await this._provider.executeQuery(
            'SELECT version, name, applied_at FROM __migrations ORDER BY version'
          )
        ).map((e) => ({ version: e.version, name: e.name, appliedAt: new Date(e.applied_at) }));
      } catch (e) {
        return [];
      }
    }
    async migrate() {
      await this.ensureMigrationTableExists();
      const e = await this.getAppliedMigrations(),
        t = new Set(e.map((e) => e.version));
      for (const e of this._migrations)
        if (!t.has(e.getVersion())) {
          console.log(`Applying migration: ${e.getName()}`);
          try {
            (await this._provider.beginTransaction(),
              await e.up(),
              await this._provider.executeNonQuery(
                'INSERT INTO __migrations (version, name, applied_at) VALUES (?, ?, ?)',
                [e.getVersion(), e.getName(), new Date().toISOString()]
              ),
              await this._provider.commitTransaction(),
              console.log(`Migration ${e.getName()} applied successfully`));
          } catch (t) {
            throw (
              await this._provider.rollbackTransaction(),
              new Error(`Failed to apply migration ${e.getName()}: ${t}`)
            );
          }
        }
    }
    async rollback(e) {
      await this.ensureMigrationTableExists();
      const t = await this.getAppliedMigrations();
      t.reverse();
      for (const r of t) {
        if (e && r.version <= e) break;
        const t = this._migrations.find((e) => e.getVersion() === r.version);
        if (t) {
          console.log(`Rolling back migration: ${t.getName()}`);
          try {
            (await this._provider.beginTransaction(),
              await t.down(),
              await this._provider.executeNonQuery('DELETE FROM __migrations WHERE version = ?', [
                t.getVersion()
              ]),
              await this._provider.commitTransaction(),
              console.log(`Migration ${t.getName()} rolled back successfully`));
          } catch (e) {
            throw (
              await this._provider.rollbackTransaction(),
              new Error(`Failed to rollback migration ${t.getName()}: ${e}`)
            );
          }
        }
      }
    }
  },
  compareSchemas: Q,
  generateMigrationFromDiff: Y,
  MigrationBuilder: class {
    constructor() {
      ((this.creates = new Map()),
        (this.drops = new Set()),
        (this.columnAdds = []),
        (this.columnAlters = []),
        (this.columnDrops = []),
        (this.indexCreates = []),
        (this.indexDrops = []),
        (this.fkCreates = []),
        (this.fkDrops = []),
        (this.tableRenames = []),
        (this.columnRenames = []));
    }
    createTable(e, t) {
      const r = new ce(e);
      return (t(r), this.creates.set(e, r), this);
    }
    dropTable(e) {
      return (this.drops.add(e), this);
    }
    alterTable(e, t) {
      return (
        t({
          addColumn: (t, r, s) => {
            this.columnAdds.push({
              table: e,
              col: {
                name: t,
                type: r,
                nullable: s?.nullable ?? !0,
                defaultValue: s?.defaultValue,
                defaultExpression: s?.defaultExpression
              }
            });
          },
          alterColumn: (t, r, s) => {
            const i = {
                name: t,
                type: r ?? 'TEXT',
                nullable: s?.nullable ?? !0,
                defaultValue: s?.defaultValue,
                defaultExpression: s?.defaultExpression
              },
              n = {
                name: t,
                type: r ? '__DIFF_FORCE__' : i.type,
                nullable: 'boolean' == typeof s?.nullable ? !s.nullable : i.nullable,
                defaultExpression: i.defaultExpression ? '__DIFF_FORCE__' : void 0
              };
            this.columnAlters.push({ table: e, col: i, prev: n });
          },
          dropColumn: (t) => {
            this.columnDrops.push({ table: e, name: t });
          }
        }),
        this
      );
    }
    createIndex(e, t, r, s = !1) {
      return (
        this.indexCreates.push({ table: e, index: { name: t, columns: r, unique: s } }),
        this
      );
    }
    dropIndex(e, t) {
      return (this.indexDrops.push({ table: e, name: t }), this);
    }
    addForeignKey(e, t) {
      return (this.fkCreates.push({ table: e, fk: t }), this);
    }
    dropForeignKey(e, t) {
      return (this.fkDrops.push({ table: e, name: t }), this);
    }
    renameTable(e, t) {
      return (this.tableRenames.push({ from: e, to: t }), this);
    }
    renameColumn(e, t, r) {
      return (this.columnRenames.push({ table: e, from: t, to: r }), this);
    }
    toDiff() {
      const e = [];
      for (const [t, r] of this.creates)
        e.push({
          table: t,
          create: {
            name: t,
            columns: r.columns.map((e) => ({
              name: e.name,
              columnName: e.name,
              type: e.type,
              nullable: e.nullable ?? !0,
              defaultValue: e.defaultValue
            })),
            primaryKeys: r.primaryKeys,
            indexes: r.indexes.map((e) => ({
              name: e.name,
              columns: e.columns,
              unique: !!e.unique
            })),
            foreignKeys: r.foreignKeys.map((e) => ({
              name: e.name,
              columns: e.columns,
              refTable: e.refTable,
              refColumns: e.refColumns,
              onDelete: e.onDelete,
              onUpdate: e.onUpdate
            }))
          }
        });
      for (const t of this.drops) e.push({ table: t, drop: !0 });
      const t = new Map(),
        r = (r) => {
          let s = t.get(r);
          return (s || ((s = { table: r, columnChanges: [] }), t.set(r, s), e.push(s)), s);
        };
      for (const e of this.columnAdds)
        r(e.table).columnChanges.push({
          kind: 'add',
          column: {
            name: e.col.name,
            type: e.col.type,
            nullable: e.col.nullable ?? !0,
            defaultValue: e.col.defaultValue
          }
        });
      for (const e of this.columnAlters)
        r(e.table).columnChanges.push({
          kind: 'alter',
          column: {
            name: e.col.name,
            type: e.col.type,
            nullable: e.col.nullable ?? !0,
            defaultValue: e.col.defaultValue
          },
          prev: e.prev
        });
      for (const e of this.columnDrops)
        r(e.table).columnChanges.push({
          kind: 'drop',
          column: { name: e.name, type: 'TEXT', nullable: !0 }
        });
      for (const e of this.indexCreates) {
        const t = r(e.table);
        ((t.indexCreates = t.indexCreates ?? []),
          t.indexCreates.push({
            name: e.index.name,
            columns: e.index.columns,
            unique: !!e.index.unique
          }));
      }
      for (const e of this.indexDrops) {
        const t = r(e.table);
        ((t.indexDrops = t.indexDrops ?? []), t.indexDrops.push(e.name));
      }
      for (const e of this.fkCreates) {
        const t = r(e.table);
        ((t.fkCreates = t.fkCreates ?? []), t.fkCreates.push(e.fk));
      }
      for (const e of this.fkDrops) {
        const t = r(e.table);
        ((t.fkDrops = t.fkDrops ?? []), t.fkDrops.push(e.name));
      }
      for (const e of this.tableRenames) {
        r(e.from).renameTo = e.to;
      }
      for (const e of this.columnRenames) {
        const t = r(e.table);
        ((t.columnRenames = t.columnRenames ?? []),
          t.columnRenames.push({ from: e.from, to: e.to }));
      }
      return { tables: e };
    }
    toSql(e) {
      return Y(this.toDiff(), e);
    }
  },
  DiffBasedMigration: class extends X {
    async beforeUp(e) {}
    async afterUp(e) {}
    async beforeUpStatement(e) {
      return !0;
    }
    async afterUpStatement(e) {}
    async beforeDown(e) {}
    async afterDown(e) {}
    async beforeDownStatement(e) {
      return !0;
    }
    async afterDownStatement(e) {}
    async up() {
      const e = await this.diff(),
        { up: t } = Y(e, this.dialect());
      await this.beforeUp(t);
      for (const e of t)
        (await this.beforeUpStatement(e)) &&
          (await this.provider.executeNonQuery(e), await this.afterUpStatement(e));
      await this.afterUp(t);
    }
    async down() {
      const e = await this.diff(),
        { down: t } = Y(e, this.dialect());
      await this.beforeDown(t);
      for (const e of t)
        (await this.beforeDownStatement(e)) &&
          (await this.provider.executeNonQuery(e), await this.afterDownStatement(e));
      await this.afterDown(t);
    }
  },
  MigrationFileBuilder: class {
    static build(e, t) {
      const r = `${t.version}_${t.className}.ts`,
        { up: s, down: i } = Y(e, t.dialect),
        n = (e) => e.replace(/`/g, '\\`'),
        a = s.map((e) => '        await provider.executeNonQuery(`' + n(e) + '`);').join('\n'),
        o = (i.length ? i : ['// no-op'])
          .map((e) =>
            e.startsWith('//')
              ? `        ${e}`
              : '        await provider.executeNonQuery(`' + n(e) + '`);'
          )
          .join('\n');
      return {
        filename: r,
        source: `import { Migration } from '../migrations/Migration';\nimport { DatabaseProvider } from '../providers/DatabaseProvider';\n\nexport class ${t.className} extends Migration {\n  protected get name() { return '${t.className}'; }\n  protected get version() { return '${t.version}'; }\n  constructor(private provider: DatabaseProvider) { super(); }\n  public async up(): Promise<void> {\n    const provider = this.provider;\n${a}\n  }\n  public async down(): Promise<void> {\n    const provider = this.provider;\n${o}\n  }\n}\n`
      };
    }
  },
  DiffMigrationGenerator: class {
    constructor(e) {
      this.provider = e;
    }
    async generate() {
      const e = new ye().buildExpectedFromMetadata(),
        t = this.provider.providerLabel;
      let r;
      if ('sqlite' === t) {
        const e = new ue(this.provider),
          t = await e.listTables(),
          s = [];
        for (const r of t) {
          const t = await e.getTableInfo(r),
            i = await e.getIndexes(r);
          s.push({
            name: r,
            columns: t.columns.map((e) => ({
              name: e.name,
              type: this.normalizeType(e.type),
              nullable: !e.notnull
            })),
            primaryKeys: t.columns.filter((e) => e.pk > 0).map((e) => e.name),
            indexes: i.map((e) => ({
              name: e.name,
              columns: e.columns,
              unique: e.unique,
              where: e.where
            })),
            foreignKeys: []
          });
        }
        r = { tables: s };
      } else {
        const s = async (e) => {
            if ('postgresql' === t) {
              const t = new de(this.provider);
              return (await t.getIndexes(e)).map((e) => ({
                name: e.name,
                columns: e.columns,
                unique: e.unique,
                where: e.where
              }));
            }
            if ('mysql' === t) {
              const t = new pe(this.provider);
              return (await t.getIndexes(e)).map((e) => ({
                name: e.name,
                columns: e.columns,
                unique: e.unique
              }));
            }
            if ('mssql' === t) {
              const t = new me(this.provider);
              return (await t.getIndexes(e)).map((e) => ({
                name: e.name,
                columns: e.columns,
                unique: e.unique,
                where: e.where
              }));
            }
            return [];
          },
          i = [];
        for (const t of e.tables) {
          const e = await s(t.name);
          i.push({
            name: t.name,
            columns: t.columns.map((e) => ({ name: e.name, type: e.type, nullable: e.nullable })),
            primaryKeys: t.primaryKeys.slice(),
            indexes: e,
            foreignKeys: []
          });
        }
        r = { tables: i };
      }
      return Y(Q(e, r), t).up.map((e) => ({ sql: e }));
    }
    buildCreateTableSql(e, t, r) {
      const s = t.map((e) => {
        const t = this.mapType(e.type),
          r = e.nullable ? '' : ' NOT NULL',
          s = void 0 !== e.defaultValue ? ` DEFAULT ${this.formatValue(e.defaultValue)}` : '';
        return `${e.name} ${t}${r}${s}`;
      });
      return (
        Array.isArray(r) && r.length > 0 && s.push(`PRIMARY KEY (${r.join(', ')})`),
        `CREATE TABLE IF NOT EXISTS ${e} (${s.join(', ')})`
      );
    }
    mapType(e) {
      switch (e.toUpperCase()) {
        case 'INTEGER':
        case 'NUMBER':
        case 'BOOLEAN':
          return 'INTEGER';
        case 'REAL':
        case 'FLOAT':
        case 'DOUBLE':
          return 'REAL';
        case 'DATETIME':
        case 'DATE':
        default:
          return 'TEXT';
        case 'BLOB':
          return 'BLOB';
      }
    }
    normalizeType(e) {
      return this.mapType(e);
    }
    formatValue(e) {
      return null === e
        ? 'NULL'
        : 'number' == typeof e
          ? String(e)
          : 'boolean' == typeof e
            ? e
              ? '1'
              : '0'
            : e instanceof Date
              ? `'${e.toISOString()}'`
              : `'${String(e).replace(/'/g, "''")}'`;
    }
  },
  SchemaSnapshotBuilder: ye,
  SchemaSnapshotSerializer: class {
    serialize(e) {
      return JSON.stringify(e, null, 2);
    }
    deserialize(e) {
      const t = JSON.parse(e);
      return (this.assertValid(t), t);
    }
    assertValid(e) {
      if (!e || 'object' != typeof e || !Array.isArray(e.tables))
        throw new Error('Invalid SchemaSnapshot JSON');
    }
  },
  SqlHelper: ge,
  ExponentialBackoffRetryPolicy: class {
    constructor(e) {
      ((this.baseDelayMs = e?.baseDelayMs ?? 50),
        (this.factor = e?.factor ?? 2),
        (this.maxDelayMs = e?.maxDelayMs ?? 2e3));
    }
    shouldRetry(e, t, r) {
      return !r;
    }
    getDelayMs(e) {
      const t = Math.floor(Math.random() * Math.min(25, this.baseDelayMs)),
        r = this.baseDelayMs * Math.pow(this.factor, Math.max(0, e - 1)) + t;
      return Math.min(this.maxDelayMs, r);
    }
  },
  NoRetryPolicy: class {
    shouldRetry() {
      return !1;
    }
    getDelayMs() {
      return 0;
    }
  },
  FixedIntervalRetryPolicy: class {
    constructor(e, t = !1) {
      ((this.delayMs = Math.max(0, e)), (this.allowInTx = t));
    }
    shouldRetry(e, t, r) {
      return !!this.allowInTx || !r;
    }
    getDelayMs() {
      return this.delayMs;
    }
  },
  EntityCache: B
});
const Ee = _e;
export { Ee as everything };
