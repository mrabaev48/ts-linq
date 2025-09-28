import 'reflect-metadata';
import { createHash as t } from 'node:crypto';
var e, i, r;
(!(function (t) {
  ((t.Unchanged = 'unchanged'),
    (t.Added = 'added'),
    (t.Modified = 'modified'),
    (t.Deleted = 'deleted'));
})(e || (e = {})),
  (function (t) {
    ((t.Lazy = 'lazy'), (t.Eager = 'eager'));
  })(i || (i = {})),
  (function (t) {
    ((t.Inner = 'INNER'), (t.Left = 'LEFT'), (t.Right = 'RIGHT'), (t.Full = 'FULL'));
  })(r || (r = {})));
const s = (t) => ({ ok: !0, value: t }),
  n = (t) => ({ ok: !1, error: t });
class a extends Error {
  constructor(t, e) {
    (super(t), (this.name = 'ValidationError'), (this.details = e));
  }
}
class o {
  constructor() {
    this._trackedEntities = new Map();
  }
  add(t, i) {
    this._trackedEntities.set(t, { entity: t, entityClass: i, state: e.Added });
  }
  update(t, i) {
    const r = this._trackedEntities.get(t);
    r
      ? (r.state = e.Modified)
      : this._trackedEntities.set(t, {
          entity: t,
          entityClass: i,
          state: e.Modified,
          originalValues: this.cloneObject(t)
        });
  }
  remove(t, i) {
    const r = this._trackedEntities.get(t);
    r
      ? (r.state = e.Deleted)
      : this._trackedEntities.set(t, { entity: t, entityClass: i, state: e.Deleted });
  }
  attach(t, i) {
    this._trackedEntities.set(t, {
      entity: t,
      entityClass: i,
      state: e.Unchanged,
      originalValues: this.cloneObject(t)
    });
  }
  getChanges() {
    return Array.from(this._trackedEntities.values()).filter((t) => t.state !== e.Unchanged);
  }
  getEntityState(t) {
    const i = this._trackedEntities.get(t);
    return i ? i.state : e.Unchanged;
  }
  acceptAllChanges() {
    for (const t of this._trackedEntities.values())
      t.state === e.Deleted
        ? this._trackedEntities.delete(t.entity)
        : ((t.state = e.Unchanged), (t.originalValues = this.cloneObject(t.entity)));
  }
  clear() {
    this._trackedEntities.clear();
  }
  detectChanges() {
    for (const t of this._trackedEntities.values())
      t.state === e.Unchanged &&
        t.originalValues &&
        (this.areObjectsEqual(t.entity, t.originalValues) || (t.state = e.Modified));
  }
  cloneObject(t) {
    return JSON.parse(JSON.stringify(t));
  }
  areObjectsEqual(t, e) {
    return JSON.stringify(t) === JSON.stringify(e);
  }
}
class l {
  constructor(t) {
    this.metadata = {
      target: t,
      tableName: t.name,
      columns: [],
      primaryKeys: [],
      relationships: [],
      indexes: []
    };
  }
  setTableName(t) {
    return ((this.metadata.tableName = t), this);
  }
  addColumn(t) {
    return (
      (this.metadata.columns = this.metadata.columns || []),
      this.metadata.columns.push(t),
      this
    );
  }
  addPrimaryKey(t) {
    return (
      (this.metadata.primaryKeys = this.metadata.primaryKeys || []),
      this.metadata.primaryKeys.includes(t) || this.metadata.primaryKeys.push(t),
      this
    );
  }
  addRelationship(t) {
    return (
      (this.metadata.relationships = this.metadata.relationships || []),
      this.metadata.relationships.push(t),
      this
    );
  }
  addIndex(t) {
    return (
      (this.metadata.indexes = this.metadata.indexes || []),
      this.metadata.indexes.push(t),
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
  normalizeTarget(t) {
    const e = Reflect.getOwnMetadata,
      i = e?.('orm:original', t);
    return ('function' == typeof i ? i : void 0) ?? t;
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
  static getEntity(t) {
    const e = Reflect.getOwnMetadata,
      i = e?.('orm:original', t),
      r = 'function' == typeof i ? i : t,
      s = c.getInstance().getEntityMetadata(r);
    if (s) return r !== t ? { ...s, target: t } : s;
  }
  static addEntity(t, e) {
    c.getInstance().registerEntity(t, e);
  }
  static addColumn(t, e) {
    c.getInstance().addColumnMetadata(t, e);
  }
  static addPrimaryKey(t, e) {
    c.getInstance().addPrimaryKeyMetadata(t, e);
  }
  static addRelationship(t, e) {
    c.getInstance().addRelationshipMetadata(t, e);
  }
  static addIndex(t, e) {
    c.getInstance().addIndexMetadata(t, e);
  }
  getOrCreateBuilder(t) {
    const e = this.normalizeTarget(t);
    return (this.builders.has(e) || this.builders.set(e, new l(e)), this.builders.get(e));
  }
  registerEntity(t, e) {
    const i = this.getOrCreateBuilder(t);
    e && i.setTableName(e);
  }
  addColumnMetadata(t, e) {
    if (void 0 !== e.defaultExpression && void 0 !== e.defaultValue)
      throw new a(`Column ${e.columnName} cannot have both defaultExpression and defaultValue`);
    if (e.isComputed) {
      if (void 0 !== e.defaultValue || void 0 !== e.defaultExpression)
        throw new a(`Computed column ${e.columnName} cannot have defaultValue/defaultExpression`);
      if (e.isGenerated)
        throw new a(`Computed column ${e.columnName} cannot be marked as isGenerated`);
      if (e.isVersion) throw new a(`Computed column ${e.columnName} cannot be a version column`);
      e.isReadOnly = !0;
    }
    const i = this.normalizeTarget(t),
      r = this.entities.get(i);
    if (r)
      return void (
        r.columns.some((t) => t.propertyName === e.propertyName) || (r.columns = [...r.columns, e])
      );
    this.getOrCreateBuilder(t).addColumn(e);
  }
  addPrimaryKeyMetadata(t, e) {
    const i = this.normalizeTarget(t),
      r = this.entities.get(i);
    if (r) return void (r.primaryKeys.includes(e) || (r.primaryKeys = [...r.primaryKeys, e]));
    this.getOrCreateBuilder(t).addPrimaryKey(e);
  }
  addRelationshipMetadata(t, e) {
    this.getOrCreateBuilder(t).addRelationship(e);
  }
  addIndexMetadata(t, e) {
    const i = this.normalizeTarget(t),
      r = this.entities.get(i);
    if (r) {
      if (r.indexes.some((t) => t.name === e.name))
        throw new a(`Duplicate index name '${e.name}' on entity '${r.tableName}'`);
      const t = new Set(r.columns.map((t) => [t.columnName, t.propertyName]).flat()),
        i = e.columns.filter((e) => !t.has(e));
      if (i.length > 0)
        throw new a(
          `Index '${e.name}' on entity '${r.tableName}' references unknown columns: ${i.join(', ')}`
        );
      return void (r.indexes = [...r.indexes, e]);
    }
    const s = this.getOrCreateBuilder(t),
      n = s.build();
    if ((n.indexes || []).some((t) => t.name === e.name))
      throw new a(`Duplicate index name '${e.name}' on entity '${n.tableName}'`);
    const o = new Set((n.columns || []).map((t) => [t.columnName, t.propertyName]).flat()),
      l = e.columns.filter((t) => !o.has(t));
    if (l.length > 0)
      throw new a(
        `Index '${e.name}' on entity '${n.tableName}' references unknown columns: ${l.join(', ')}`
      );
    s.addIndex(e);
  }
  finalizeEntity(t) {
    const e = this.normalizeTarget(t);
    if (this.builders.has(e)) {
      const t = this.builders.get(e).build();
      (this.entities.set(e, t), this.builders.delete(e));
    }
  }
  getEntityMetadata(t) {
    const e = this.normalizeTarget(t);
    return (this.builders.has(e) && this.finalizeEntity(e), this.entities.get(e));
  }
  getAllEntities() {
    for (const t of this.builders.keys()) this.finalizeEntity(t);
    return Array.from(this.entities.values());
  }
  clear() {
    (this.entities.clear(), this.builders.clear());
  }
}
const h = Symbol('lazyLoadingTarget'),
  d = Symbol('lazyLoadingProvider'),
  u = Symbol('lazyLoadingProxy'),
  y = Symbol('lazyLoadingState');
class p {
  static create(t, e, i) {
    if (this.isLazyProxy(t)) return t;
    const r = c.getEntity(e);
    if (!r || 0 === r.relationships.length) return t;
    const s = {};
    for (const e of r.relationships) {
      s[e.propertyName] = { isLoaded: !1, isLoading: !1 };
      const i = t[e.propertyName];
      null != i && (s[e.propertyName].isLoaded = !0);
    }
    return new Proxy(t, {
      get(t, n, a) {
        if (n === h) return t;
        if (n === d) return i;
        if (n === u) return !0;
        if (n === y) return s;
        const o = String(n),
          l = r.relationships.find((t) => t.propertyName === o);
        return !l || s[o].isLoaded || s[o].isLoading
          ? l && s[o].isLoading
            ? s[o].loadingPromise
            : Reflect.get(t, n, a)
          : ((s[o].isLoading = !0),
            (s[o].loadingPromise = p
              .loadRelationship(t, e, l, i)
              .then(
                (e) => (
                  (t[o] = e),
                  (s[o].isLoaded = !0),
                  (s[o].isLoading = !1),
                  delete s[o].loadingPromise,
                  e
                )
              )
              .catch(
                (t) => (
                  console.warn(`Failed to lazy load ${o}:`, t),
                  (s[o].isLoading = !1),
                  delete s[o].loadingPromise,
                  'one-to-many' === l.type ? [] : null
                )
              )),
            s[o].loadingPromise);
      },
      set(t, e, i, n) {
        const a = String(e);
        return (
          r.relationships.find((t) => t.propertyName === a) &&
            ((s[a].isLoaded = !0), (s[a].isLoading = !1), delete s[a].loadingPromise),
          Reflect.set(t, e, i, n)
        );
      },
      has: (t, e) => e === u || e === h || e === d || e === y || Reflect.has(t, e),
      ownKeys: (t) => Reflect.ownKeys(t).filter((t) => t !== h && t !== d && t !== u && t !== y),
      getOwnPropertyDescriptor: (t, e) =>
        e === u || e === h || e === d || e === y
          ? { configurable: !0, enumerable: !1, writable: !1, value: !0 }
          : Reflect.getOwnPropertyDescriptor(t, e)
    });
  }
  static createMany(t, e, i) {
    return t.map((t) => this.create(t, e, i));
  }
  static isLazyProxy(t) {
    return !!t?.[u];
  }
  static getTarget(t) {
    return this.isLazyProxy(t) ? t[h] : t;
  }
  static getLoadingState(t) {
    return this.isLazyProxy(t) ? t[y] : null;
  }
  static isRelationshipLoaded(t, e) {
    const i = this.getLoadingState(t);
    return i?.[e]?.isLoaded ?? !1;
  }
  static async preloadRelationships(t, e, i, r) {
    if (0 === t.length) return;
    const s = c.getEntity(e);
    if (!s) return;
    const n = [],
      a = [];
    for (const e of t) this.isLazyProxy(e) ? n.push(e) : a.push(e);
    for (const t of i) {
      const i = s.relationships.find((e) => e.propertyName === t);
      if (!i) continue;
      const o = n.filter((e) => {
        const i = this.getLoadingState(e);
        return i && !i[t].isLoaded && !i[t].isLoading;
      });
      (o.length > 0 && (await this.batchLoadRelationship(o, e, i, r)),
        a.length > 0 && (await this.batchLoadRelationship(a, e, i, r)));
    }
  }
  static async loadRelationship(t, e, i, r) {
    const s = c.getEntity(e);
    if (!s) return null;
    const n = this.resolveTargetEntity(i.targetEntity);
    switch (i.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const e = t[i.foreignKey || this.defaultForeignKeyFor(n)];
        if (null == e) return null;
        const s = await r.findById(e, n);
        return s ? this.create(s, n, r) : null;
      }
      case 'one-to-many': {
        const a = s.primaryKeys[0];
        if (!a) return [];
        const o = t[a];
        if (null == o) return [];
        const l = i.foreignKey || this.defaultForeignKeyFor(e),
          c = await r.findWhere(n, { [l]: o });
        return this.createMany(c, n, r);
      }
      case 'many-to-many':
        return (console.warn('Many-to-many lazy loading not yet implemented'), []);
      default:
        return null;
    }
  }
  static async batchLoadRelationship(t, e, i, r) {
    if (0 === t.length) return;
    const s = c.getEntity(e);
    if (!s) return;
    const n = this.resolveTargetEntity(i.targetEntity);
    switch (i.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const e = i.foreignKey || this.defaultForeignKeyFor(n),
          a = t.map((t) => t[e]).filter((t) => null != t),
          o = Array.from(new Set(a));
        if (0 === o.length) break;
        const l = await r.findWhereIn(
            n,
            s.columns.find((t) => t.propertyName === s.primaryKeys[0])?.columnName ||
              s.primaryKeys[0],
            o
          ),
          h = this.createMany(l, n, r),
          d = new Map(),
          u = c.getEntity(n),
          y = u?.primaryKeys[0];
        if (!y) break;
        for (const t of h) {
          const e = this.getTarget(t);
          d.set(e[y], t);
        }
        for (const r of t) {
          const t = r[e];
          if (null != t) {
            r[i.propertyName] = d.get(t) || null;
            const e = this.getLoadingState(r);
            e && ((e[i.propertyName].isLoaded = !0), (e[i.propertyName].isLoading = !1));
          }
        }
        break;
      }
      case 'one-to-many': {
        const a = s.primaryKeys[0];
        if (!a) break;
        const o = t.map((t) => t[a]).filter((t) => null != t),
          l = Array.from(new Set(o));
        if (0 === l.length) break;
        const c = i.foreignKey || this.defaultForeignKeyFor(e),
          h = (await r.findWhereIn(n, c, l)) || [],
          d = this.createMany(h, n, r),
          u = new Map();
        for (const t of d) {
          const e = this.getTarget(t)[c],
            i = u.get(e) || [];
          (i.push(t), u.set(e, i));
        }
        for (const e of t) {
          const t = e[a];
          e[i.propertyName] = u.get(t) || [];
          const r = this.getLoadingState(e);
          r && ((r[i.propertyName].isLoaded = !0), (r[i.propertyName].isLoading = !1));
        }
        break;
      }
    }
  }
  static resolveTargetEntity(t) {
    const e = t;
    return 'function' == typeof e && 'prototype' in e && e.prototype ? e : t();
  }
  static defaultForeignKeyFor(t) {
    const e = t.name || 'id';
    return `${e.charAt(0).toLowerCase() + e.slice(1)}Id`;
  }
}
class m {
  constructor(t) {
    ((this._defaultStrategy = i.Lazy), (this._provider = t));
  }
  setDefaultStrategy(t) {
    this._defaultStrategy = t;
  }
  async loadEntity(t, e, r) {
    const s = await this._provider.findById(e, t);
    if (!s) return null;
    const n = { strategy: this._defaultStrategy, ...r };
    return n.strategy === i.Eager || n.includes
      ? (await this.loadRelationships(s, t, n), s)
      : n.strategy === i.Lazy
        ? p.create(s, t, this._provider)
        : s;
  }
  async loadEntities(t, e) {
    const r = await this._provider.findAll(t),
      s = { strategy: this._defaultStrategy, ...e };
    return s.strategy === i.Eager || s.includes
      ? (await this.loadRelationshipsBatched(r, t, s), r)
      : s.strategy === i.Lazy
        ? p.createMany(r, t, this._provider)
        : r;
  }
  async loadRelationships(t, e, i) {
    const r = c.getEntity(e);
    if (!r) return;
    const s = i.depth ?? 1;
    if (!(s <= 0))
      for (const n of r.relationships) {
        if (i.includes)
          for (const t of i.includes) {
            if (!r.relationships.some((e) => e.propertyName === t))
              throw new Error(`Invalid include '${t}' for ${r.target.name}`);
          }
        if (!i.includes || i.includes.includes(n.propertyName))
          try {
            const a = this.resolveTargetEntity(n.targetEntity);
            switch (n.type) {
              case 'many-to-one':
              case 'one-to-one': {
                const e = t[n.foreignKey || this.defaultForeignKeyFor(a)];
                if (null == e) break;
                const r = await this.loadEntity(a, e, { ...i, depth: s - 1 });
                r && (t[n.propertyName] = r);
                break;
              }
              case 'one-to-many': {
                const i = r.primaryKeys[0];
                if (!i) break;
                const s = t[i];
                if (null == s) break;
                const o = n.foreignKey || this.defaultForeignKeyFor(e),
                  l = await this._provider.findWhere(a, { [o]: s });
                t[n.propertyName] = l;
                break;
              }
            }
          } catch (t) {
            console.warn(`Failed to load relationship ${n.propertyName}:`, t);
          }
      }
  }
  async loadRelationshipsBatched(t, e, i) {
    if (0 === t.length) return;
    const r = c.getEntity(e);
    if (!r) return;
    const s = i.depth ?? 1;
    if (!(s <= 0))
      for (const n of r.relationships) {
        if (!(!i.includes || i.includes.includes(n.propertyName))) continue;
        const a = this.resolveTargetEntity(n.targetEntity);
        switch (n.type) {
          case 'many-to-one':
          case 'one-to-one': {
            const e = n.foreignKey || this.defaultForeignKeyFor(a),
              o = t.map((t) => t[e]).filter((t) => null != t),
              l = Array.from(new Set(o));
            if (0 === l.length) break;
            const h = await this._provider.findWhereIn(
                a,
                r.columns.find((t) => t.propertyName === r.primaryKeys[0])?.columnName ||
                  r.primaryKeys[0],
                l
              ),
              d = new Map(),
              u = c.getEntity(a),
              y = u?.primaryKeys[0];
            for (const t of h) d.set(t[y], t);
            for (const i of t) {
              const t = i[e];
              null != t && (i[n.propertyName] = d.get(t));
            }
            s - 1 > 0 &&
              (await this.loadRelationshipsBatched(Array.from(d.values()), a, {
                ...i,
                depth: s - 1
              }));
            break;
          }
          case 'one-to-many': {
            const o = r.primaryKeys[0];
            if (!o) break;
            const l = t.map((t) => t[o]).filter((t) => null != t),
              c = Array.from(new Set(l));
            if (0 === c.length) break;
            const h = n.foreignKey || this.defaultForeignKeyFor(e),
              d = await this._provider.findWhereIn(a, h, c),
              u = new Map();
            for (const t of d) {
              const e = t[h],
                i = u.get(e) || [];
              (i.push(t), u.set(e, i));
            }
            for (const e of t) {
              const t = e[o];
              e[n.propertyName] = u.get(t) || [];
            }
            s - 1 > 0 && (await this.loadRelationshipsBatched(d, a, { ...i, depth: s - 1 }));
            break;
          }
        }
      }
  }
  async populateRelationships(t, e, i) {
    await this.loadRelationships(t, e, i);
  }
  async populateRelationshipsMany(t, e, i) {
    await this.loadRelationshipsBatched(t, e, i);
  }
  resolveTargetEntity(t) {
    const e = t;
    if ('function' == typeof e && 'prototype' in e && e.prototype) return e;
    return t();
  }
  defaultForeignKeyFor(t) {
    const e = t.name || 'id';
    return `${e.charAt(0).toLowerCase() + e.slice(1)}Id`;
  }
}
function f(t, e, i) {
  try {
    const r = t?.[e];
    r?.(i);
  } catch (t) {
    if (
      (function () {
        try {
          const t = process.env,
            e = t?.TSL_METRICS_DEBUG;
          return '1' === e || 'true' === e || 'on' === e;
        } catch {
          return !1;
        }
      })()
    )
      try {
        console.warn('[ts-linq metrics]', e, t);
      } catch {}
  }
}
function _(t, e) {
  f(t, 'cache', e);
}
function g(t, e) {
  f(t, 'cacheSize', e);
}
function w(t, e) {
  f(t, 'cacheEvicted', e);
}
class C {
  constructor(t = {}) {
    ((this.store = new Map()), (this.keyMap = new Map()));
    const e =
      'undefined' != typeof process &&
      (void 0 !== process.env.JEST_WORKER_ID || 'test' === process.env.NODE_ENV);
    ((this.options = {
      maxSize: t.maxSize ?? 2e3,
      defaultTtl: t.defaultTtl ?? (e ? 0 : 3e5),
      enableLru: t.enableLru ?? !0,
      enableKeyCompression: t.enableKeyCompression ?? !0,
      compressionThreshold: t.compressionThreshold ?? 200,
      enableMetrics: t.enableMetrics ?? !0,
      warmingBatchSize: t.warmingBatchSize ?? 50
    }),
      (this.metrics = this.initializeMetrics()),
      this.options.defaultTtl > 0 && this.startPeriodicCleanup());
  }
  get(t) {
    this.options.enableMetrics && this.metrics.totalRequests++;
    const e = this.getCompressedKey(t),
      i = this.store.get(e);
    if (i)
      return this.isExpired(i)
        ? (this.store.delete(e),
          void (
            this.options.enableMetrics &&
            (this.metrics.expirations++, this.metrics.misses++, this.updateHitRatio())
          ))
        : ((i.lastAccessedAt = Date.now()),
          i.accessCount++,
          this.options.enableLru && (this.store.delete(e), this.store.set(e, i)),
          this.options.enableMetrics && (this.metrics.hits++, this.updateHitRatio()),
          { query: i.query, parameters: [...i.parameters] });
    this.options.enableMetrics && (this.metrics.misses++, this.updateHitRatio());
  }
  set(t, e, i) {
    const r = this.getCompressedKey(t),
      s = Date.now(),
      n = i ?? this.options.defaultTtl,
      a = {
        query: e.query,
        parameters: [...e.parameters],
        createdAt: s,
        lastAccessedAt: s,
        accessCount: 1,
        ttl: n
      };
    (this.ensureCapacity(),
      this.store.set(r, a),
      this.options.enableKeyCompression &&
        t.length > this.options.compressionThreshold &&
        this.keyMap.set(t, r),
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
    let t = 0;
    for (const [e, i] of this.store.entries()) this.isExpired(i) && (this.store.delete(e), t++);
    return (
      this.options.enableMetrics &&
        ((this.metrics.expirations += t), (this.metrics.currentSize = this.store.size)),
      t
    );
  }
  warm(t) {
    const e = this.chunkArray(t, this.options.warmingBatchSize);
    for (const t of e) for (const e of t) this.set(e.key, e.value, e.ttl);
  }
  getOptimizationInsights() {
    const t = this.getMetrics();
    return {
      shouldIncreaseSize: t.hitRatio < 0.7 && t.evictions > 0.1 * t.currentSize,
      shouldDecreaseTtl: t.expirations > 0.2 * t.totalRequests,
      shouldIncreaseTtl: t.hitRatio > 0.95 && t.expirations < 0.05 * t.totalRequests,
      topAccessedEntries: Array.from(this.store.entries())
        .map(([t, e]) => ({ key: t, accessCount: e.accessCount }))
        .sort((t, e) => e.accessCount - t.accessCount)
        .slice(0, 10)
    };
  }
  getCompressedKey(e) {
    if (!this.options.enableKeyCompression || e.length <= this.options.compressionThreshold)
      return e;
    const i = this.keyMap.get(e);
    if (i) return i;
    return `hash_${t('sha256').update(e).digest('hex').substring(0, 16)}`;
  }
  isExpired(t) {
    return !(t.ttl <= 0) && Date.now() - t.createdAt > t.ttl;
  }
  ensureCapacity() {
    if (this.store.size < this.options.maxSize) return;
    const t = Math.floor(0.1 * this.options.maxSize) || 1;
    let e = 0;
    if (this.options.enableLru) {
      const i = [];
      for (const [r] of this.store) if ((i.push(r), e++, e >= t)) break;
      i.forEach((t) => this.store.delete(t));
    } else {
      const i = [];
      for (const [r] of this.store) if ((i.push(r), e++, e >= t)) break;
      i.forEach((t) => this.store.delete(t));
    }
    this.options.enableMetrics && (this.metrics.evictions += e);
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
    let t = 0;
    for (const e of this.store.values())
      ((t += 2 * e.query.length), (t += 20 * e.parameters.length), (t += 64));
    this.metrics.estimatedMemoryUsage = t;
  }
  updateAverageAccessCount() {
    if (0 === this.store.size) return void (this.metrics.averageAccessCount = 0);
    const t = Array.from(this.store.values()).reduce((t, e) => t + e.accessCount, 0);
    this.metrics.averageAccessCount = t / this.store.size;
  }
  startPeriodicCleanup() {
    const t = Math.max(this.options.defaultTtl / 4, 6e4);
    ((this.cleanupInterval = setInterval(() => {
      this.expireEntries();
    }, t)),
      this.cleanupInterval?.unref?.());
  }
  chunkArray(t, e) {
    const i = [];
    for (let r = 0; r < t.length; r += e) i.push(t.slice(r, r + e));
    return i;
  }
  dispose() {
    (this.cleanupInterval && (clearInterval(this.cleanupInterval), (this.cleanupInterval = void 0)),
      this.clear());
  }
}
class b {
  constructor(t, e, i, r) {
    ((this._dialect = t),
      (this._logger = e),
      (this._providerName = i),
      (this._cache = r ?? b._defaultCache));
  }
  generateSql(t, e) {
    const i = b.buildCacheKey(t, e),
      r = this.getFromCache(i);
    if (r)
      return (
        this._logger?.cache?.({ cache: 'sqlGen', hit: !0, provider: this._providerName }),
        { query: r.query, parameters: [...r.parameters] }
      );
    const s = { ...e };
    e.select &&
      ((s.selectParams = []),
      (s.select = e.select.map((t) => {
        if ('string' == typeof t) return t;
        const e = t,
          i = e.toString(),
          r = e.getParameters?.() ?? [];
        return (s.selectParams.push(...r), i);
      })));
    const n = this._dialect.buildSelect(t, s);
    return (
      this.remember(i, n),
      this._logger?.cache?.({ cache: 'sqlGen', hit: !1, provider: this._providerName }),
      n
    );
  }
  generateFromModel(t, e) {
    const i = {
        select: e.select,
        where: e.where,
        orderBy: e.orderBy,
        groupBy: e.groupBy,
        joins: e.joins,
        limit: e.limit,
        offset: e.offset,
        distinct: e.distinct
      },
      r = this.generateSql(t, i);
    if (e.unions && e.unions.length > 0) {
      let t = `${r.query}`;
      const i = [...r.parameters];
      for (const r of e.unions) {
        const e = this.generateFromModel(r.entity, r.other);
        ((t += r.all ? ` UNION ALL ${e.query}` : ` UNION ${e.query}`), i.push(...e.parameters));
      }
      return { query: t, parameters: i };
    }
    return r;
  }
  static clearCache() {
    b._defaultCache.clear();
  }
  static disposeCache() {
    (b._defaultCache.dispose(), (b._defaultCache = new C()));
  }
  getCacheMetrics() {
    return this._cache instanceof C
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
    return this._cache instanceof C
      ? this._cache.getOptimizationInsights()
      : {
          shouldIncreaseSize: !1,
          shouldDecreaseTtl: !1,
          shouldIncreaseTtl: !1,
          topAccessedEntries: []
        };
  }
  static buildCacheKey(t, e) {
    let i = t.name;
    if (((i += '|s:' + (e.select ? e.select.join(',') : '')), e.where && e.where.length)) {
      i += '|w:';
      for (const t of e.where) i += t.condition + '(' + (t.parameters?.join('|') ?? '') + ')';
    }
    if (e.orderBy && e.orderBy.length) {
      i += '|o:';
      for (const t of e.orderBy) i += t.column + ':' + t.direction + ';';
    }
    if (
      (e.groupBy &&
        ((i += '|g:' + e.groupBy.columns.join(',')),
        e.groupBy.having &&
          (i +=
            '{' +
            e.groupBy.having.condition +
            '(' +
            (e.groupBy.having.parameters?.join('|') ?? '') +
            ')}')),
      e.joins && e.joins.length)
    ) {
      i += '|j:';
      for (const t of e.joins) i += t.type + ':' + t.table + ':' + t.on + ';';
    }
    return (
      void 0 !== e.limit && (i += '|l:' + e.limit),
      void 0 !== e.offset && (i += '|f:' + e.offset),
      e.distinct && (i += '|d:1'),
      i
    );
  }
  remember(t, e) {
    (this._cache.set(t, { query: e.query, parameters: [...e.parameters] }),
      g(this._logger, {
        cache: 'sqlGen',
        size: this._cache.size?.() ?? -1,
        provider: this._providerName
      }));
  }
  getFromCache(t) {
    return this._cache.get(t);
  }
}
var v, E;
((b._defaultCache = new C()),
  (function (t) {
    ((t.And = 'AND'), (t.Or = 'OR'));
  })(v || (v = {})),
  (function (t) {
    ((t.Eq = '='), (t.Gt = '>'), (t.Gte = '>='), (t.Lt = '<'), (t.Lte = '<='));
  })(E || (E = {})));
class S {
  parse(t) {
    const e = t.toString();
    if (e.length > S.MAX_LENGTH) return null;
    if (S.UNSUPPORTED_TOKENS.some((t) => e.includes(t))) return null;
    const i = e.indexOf('=>');
    if (-1 === i) return null;
    const r = e.slice(i + 2).trim();
    if (r.includes('&&')) {
      const t = r.split('&&').map((t) => t.trim()),
        e = [];
      for (const i of t) {
        const t = this.parseBinary(i);
        if (!t) return null;
        e.push(t);
      }
      return { type: 'LogicalExpression', operator: v.And, expressions: e };
    }
    return this.parseBinary(r);
  }
  parseBinary(t) {
    const e = [
      { re: /\w+\.(\w+)\s*===?\s*(.+)/, op: E.Eq },
      { re: /\w+\.(\w+)\s*>=\s*(.+)/, op: E.Gte },
      { re: /\w+\.(\w+)\s*<=\s*(.+)/, op: E.Lte },
      { re: /\w+\.(\w+)\s*>\s*(.+)/, op: E.Gt },
      { re: /\w+\.(\w+)\s*<\s*(.+)/, op: E.Lt }
    ];
    for (const { re: i, op: r } of e) {
      const e = t.match(i);
      if (e) {
        const t = e[1];
        if (!/^[_A-Za-z][_\w]*$/.test(t)) return null;
        const i = { type: 'Identifier', name: t },
          s = e[2].trim();
        if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(s)) return null;
        const n = this.parseLiteral(s);
        if (void 0 === n && !/^(null)$/i.test(s)) return null;
        return {
          type: 'BinaryExpression',
          left: i,
          operator: r,
          right: { type: 'Literal', value: n ?? null }
        };
      }
    }
    return null;
  }
  parseLiteral(t) {
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
      return t.slice(1, -1);
    const e = Number(t);
    return Number.isNaN(e)
      ? 'true' === t || ('false' !== t && ('null' === t.toLowerCase() ? null : void 0))
      : e;
  }
}
((S.MAX_LENGTH = 500), (S.UNSUPPORTED_TOKENS = ['function', '=> {', 'return', '||', '??']));
class N {
  toSql(t) {
    switch (t.type) {
      case 'BinaryExpression':
        return this.visitBinary(t);
      case 'LogicalExpression':
        return this.visitLogical(t);
      default:
        return { condition: '1=1', parameters: [] };
    }
  }
  visitBinary(t) {
    const e = t.left.name,
      i = t.right.value;
    return { condition: `${e} ${t.operator} ?`, parameters: [i] };
  }
  visitLogical(t) {
    const e = [],
      i = [];
    for (const r of t.expressions) {
      const t = this.toSql(r);
      (e.push(t.condition), i.push(...t.parameters));
    }
    const r = t.operator === v.And ? ' AND ' : ' OR ';
    return { condition: e.join(r), parameters: i };
  }
}
class L {
  clone() {
    const t = new L();
    return (
      (t.select = this.select ? [...this.select] : void 0),
      (t.where = this.where
        ? this.where.map((t) => ({ condition: t.condition, parameters: [...t.parameters] }))
        : void 0),
      (t.orderBy = this.orderBy ? this.orderBy.map((t) => ({ ...t })) : void 0),
      (t.groupBy = this.groupBy
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
      (t.joins = this.joins ? this.joins.map((t) => ({ ...t })) : void 0),
      (t.limit = this.limit),
      (t.offset = this.offset),
      (t.distinct = this.distinct),
      (t.from = this.from),
      (t.unions = this.unions
        ? this.unions.map((t) => ({ all: t.all, other: t.other.clone(), entity: t.entity }))
        : void 0),
      t
    );
  }
}
class M {
  static parse(t, e, i, r, s) {
    const n = t.trim(),
      a = n.match(/\((\w+)\s*,\s*(\w+)\)\s*=>\s*\1\.(\w+)\s*===?\s*\2\.(\w+)/);
    if (!a) throw new Error(`Unable to parse join predicate: ${n}`);
    const o = a[3],
      l = a[4];
    return `${e}.${r.columns.find((t) => t.propertyName === o)?.columnName || o} = ${i}.${s.columns.find((t) => t.propertyName === l)?.columnName || l}`;
  }
}
class A {
  apply(t, e, i, r) {
    const s = c.getEntity(t);
    if (s) {
      if (((e.where = e.where || []), i?.enabled)) {
        const t = i.column ?? 'isDeleted',
          r = s.columns.find((e) => e.propertyName === t || e.columnName === t);
        r && e.where.push({ condition: `${r.columnName} = 0`, parameters: [] });
      }
      if (r && r.length > 0)
        for (const t of r) {
          const i = c.getEntity(t.entity);
          i &&
            s.tableName === i.tableName &&
            e.where.push({ condition: t.where.condition, parameters: [...t.where.parameters] });
        }
    }
  }
}
class R {
  constructor(t, e, i, r, s, n) {
    ((this._model = new L()),
      (this._fallbackPredicates = []),
      (this._includes = []),
      (this._globalFilterApplier = new A()),
      (this._whereSignature = '[]'),
      (this._entityClass = t),
      (this._provider = e),
      (this._entityLoader = i),
      (this._entityCache = r),
      (this._performance = s),
      (this._globalFilters = n),
      (this._externalCountCache = s?.countCache),
      (this._sqlBuilder = new b(e.getDialect(), e.loggerRef, e.providerLabel, s?.sqlCache)));
  }
  static clearCountCache() {
    R._countCache.clear();
  }
  clone() {
    const t = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    );
    return ((t._model = this._model.clone()), (t._whereSignature = this._whereSignature), t);
  }
  innerJoin(t, e, i) {
    return (this.addJoin('INNER', t, e, i), this);
  }
  leftJoin(t, e, i) {
    return (this.addJoin('LEFT', t, e, i), this);
  }
  where(t) {
    return (this.addWhereOrFallback(t), this);
  }
  whereExists(t) {
    const e = t._sqlBuilder,
      i = t._model,
      r = t._entityClass,
      { query: s, parameters: n } = e.generateFromModel(r, i);
    this._model.where = this._model.where || [];
    const a = { condition: `EXISTS (${s})`, parameters: n };
    return (
      this._model.where.push(a),
      (this._whereSignature += `|${a.condition}:${JSON.stringify(a.parameters)}`),
      this
    );
  }
  whereInSubquery(t, e) {
    const i = e._sqlBuilder,
      r = e._model,
      s = e._entityClass,
      { query: n, parameters: a } = i.generateFromModel(s, r);
    this._model.where = this._model.where || [];
    const o = { condition: `${t} IN (${n})`, parameters: a };
    return (
      this._model.where.push(o),
      (this._whereSignature += `|${o.condition}:${JSON.stringify(o.parameters)}`),
      this
    );
  }
  withCte(t, e) {
    const { query: i } = e._sqlBuilder.generateFromModel(e._entityClass, e._model),
      r = this.clone();
    return ((r._model.from = t), (r._cte = { name: t, sql: i }), r);
  }
  select(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance
    );
    e._model = this._model.clone();
    const i = t.toString(),
      r = this.extractPropertiesFromSelector(i);
    return ((e._model.select = r), e);
  }
  orderBy(t) {
    const e = t.toString(),
      i = { column: this.extractPropertyFromKeySelector(e), direction: 'ASC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(i), this);
  }
  orderByDescending(t) {
    const e = t.toString(),
      i = { column: this.extractPropertyFromKeySelector(e), direction: 'DESC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(i), this);
  }
  thenBy(t) {
    const e = t.toString(),
      i = { column: this.extractPropertyFromKeySelector(e), direction: 'ASC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(i), this);
  }
  thenByDescending(t) {
    const e = t.toString(),
      i = { column: this.extractPropertyFromKeySelector(e), direction: 'DESC' };
    return ((this._model.orderBy = this._model.orderBy || []), this._model.orderBy.push(i), this);
  }
  take(t) {
    return ((this._model.limit = t), this);
  }
  skip(t) {
    return ((this._model.offset = t), this);
  }
  distinct() {
    return ((this._model.distinct = !0), this);
  }
  union(t) {
    return (
      (this._model.unions = this._model.unions || []),
      this._model.unions.push({ all: !1, other: t._model.clone(), entity: t._entityClass }),
      this
    );
  }
  unionAll(t) {
    return (
      (this._model.unions = this._model.unions || []),
      this._model.unions.push({ all: !0, other: t._model.clone(), entity: t._entityClass }),
      this
    );
  }
  groupBy(t) {
    const e = t.toString(),
      i = this.extractPropertiesFromSelector(e);
    return ((this._model.groupBy = { columns: i }), this);
  }
  having(t) {
    if (!this._model.groupBy) throw new Error('having() requires a preceding groupBy()');
    const e = new S().parse(t);
    if (e) {
      const t = new N(),
        { condition: i, parameters: r } = t.toSql(e);
      this._model.groupBy.having = { condition: i, parameters: r };
    } else this._model.groupBy.having = { condition: '1=1', parameters: [] };
    return this;
  }
  async paginate(t, e) {
    if (t < 1 || e < 1) throw new Error('paginate requires page >= 1 and size >= 1');
    const i = this._model.clone();
    (this.applyGlobalFiltersToModel(i), (i.limit = e), (i.offset = (t - 1) * e));
    return {
      items: await this.executeAndMaterialize(i),
      total: await this.count(),
      page: t,
      size: e
    };
  }
  async keysetPaginate(t, e, i) {
    if (i < 1) throw new Error('keysetPaginate requires size >= 1');
    const r = this._model.clone();
    r.orderBy = r.orderBy || [];
    if (
      (r.orderBy.some((e) => e.column === String(t)) ||
        r.orderBy.push({ column: String(t), direction: 'ASC' }),
      (r.limit = i),
      null != e)
    ) {
      const i = { condition: `${String(t)} > ?`, parameters: [e] };
      ((r.where = r.where || []), r.where.push(i));
    }
    this.applyGlobalFiltersToModel(r);
    const s = await this.executeAndMaterialize(r),
      n = s.length > 0 ? s[s.length - 1] : null;
    return { items: s, pageSize: i, nextAfter: n ? n[String(t)] : null };
  }
  include(t) {
    const e = this.extractIncludeProperty(t),
      i = c.getEntity(this._entityClass),
      r = i?.relationships.some((t) => t.propertyName === e);
    if (!r)
      throw new Error(
        `Invalid include '${e}' for ${this._entityClass.name}. Define relationship '${e}' via decorators or fix the name.`
      );
    return (this._includes.includes(e) || this._includes.push(e), this);
  }
  async toArray() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = this._model.clone();
    return (this.applyGlobalFiltersToModel(t), this.executeAndMaterialize(t));
  }
  async first() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = this._model.clone();
    ((t.limit = 1), this.applyGlobalFiltersToModel(t));
    const e = await this.executeAndMaterialize(t);
    if (!e.length) throw new Error('Sequence contains no elements');
    return e[0];
  }
  async tryFirst() {
    try {
      const t = await this.first();
      return s(t);
    } catch (t) {
      return n(t);
    }
  }
  async firstOrDefault() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = this._model.clone();
    ((t.limit = 1), this.applyGlobalFiltersToModel(t));
    return (await this.executeAndMaterialize(t))[0] ?? null;
  }
  async single() {
    const t = await this.toArray();
    if (0 === t.length) throw new Error('Sequence contains no elements');
    if (t.length > 1) throw new Error('Sequence contains more than one element');
    return t[0];
  }
  async trySingle() {
    try {
      const t = await this.single();
      return s(t);
    } catch (t) {
      return n(t);
    }
  }
  async singleOrDefault() {
    const t = await this.toArray();
    if (t.length > 1) throw new Error('Sequence contains more than one element');
    return t[0] ?? null;
  }
  async count() {
    const t = c.getEntity(this._entityClass);
    if (!t) throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
    if (this._performance?.enableCountCache) {
      const e = this.buildCountCacheKey(t.tableName),
        i = this._performance.countCacheTtlMs ?? 0,
        r = this._externalCountCache?.get(e) ?? R._countCache.get(e);
      if (r && (i <= 0 || Date.now() - r.ts <= i))
        return (
          this._externalCountCache || (R._countCache.delete(e), R._countCache.set(e, r)),
          _(this._provider.loggerRef, {
            cache: 'count',
            hit: !0,
            provider: this._provider.providerLabel,
            ttl: i > 0
          }),
          r.value
        );
      const s = await this.executeCountQuery(t.tableName),
        n = { value: s, ts: Date.now() };
      if (this._externalCountCache) this._externalCountCache.set(e, n);
      else {
        if (R._countCache.size >= R._COUNT_CACHE_MAX) {
          const t = R._countCache.keys().next().value;
          void 0 !== t &&
            (R._countCache.delete(t),
            w(this._provider.loggerRef, {
              cache: 'count',
              provider: this._provider.providerLabel
            }));
        }
        R._countCache.set(e, n);
      }
      return (
        g(this._provider.loggerRef, {
          cache: 'count',
          size: this._externalCountCache ? -1 : R._countCache.size,
          provider: this._provider.providerLabel
        }),
        _(this._provider.loggerRef, {
          cache: 'count',
          hit: !1,
          provider: this._provider.providerLabel
        }),
        s
      );
    }
    return this.executeCountQuery(t.tableName);
  }
  buildCountCacheKey(t) {
    return `${this._entityClass.name}|count|${t}|${this._whereSignature}`;
  }
  async executeCountQuery(t) {
    let e = `SELECT COUNT(*) as count FROM ${t}`;
    const i = [],
      r = this._model.clone();
    if ((this.applyGlobalFiltersToModel(r), r.where && r.where.length > 0)) {
      let t = !0;
      e += ' WHERE ';
      for (const s of r.where) {
        (t || (e += ' AND '), (t = !1), (e += s.condition));
        const r = s.parameters;
        for (let t = 0; t < r.length; t++) i.push(r[t]);
      }
    }
    const s = await this._provider.executeQuery(e, i);
    return s[0]?.count ?? 0;
  }
  async any() {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const t = this._model.clone();
    ((t.limit = 1), this.applyGlobalFiltersToModel(t));
    return (await this.executeAndMaterialize(t)).length > 0;
  }
  addWhereOrFallback(t) {
    const e = t.toString(),
      i = R._predicateSqlCache.get(e);
    if (i)
      return (
        (this._model.where = this._model.where || []),
        this._model.where.push({ condition: i.condition, parameters: [...i.parameters] }),
        void (this._whereSignature += `|${i.condition}:${JSON.stringify(i.parameters)}`)
      );
    const r = new S().parse(t);
    if (!r) return void this._fallbackPredicates.push(t);
    const s = new N(),
      { condition: n, parameters: a } = s.toSql(r),
      o = { condition: n, parameters: a };
    if (
      ((this._model.where = this._model.where || []),
      this._model.where.push(o),
      (this._whereSignature += `|${o.condition}:${JSON.stringify(o.parameters)}`),
      R._predicateSqlCache.size >= R.PREDICATE_CACHE_MAX)
    ) {
      const t = R._predicateSqlCache.keys().next().value;
      void 0 !== t && R._predicateSqlCache.delete(t);
    }
    R._predicateSqlCache.set(e, { condition: o.condition, parameters: [...o.parameters] });
  }
  applyFallbackPredicates(t) {
    if (0 === this._fallbackPredicates.length) return t;
    let e = t;
    for (const t of this._fallbackPredicates)
      e = e.filter((e) => {
        try {
          return t(e);
        } catch {
          return !1;
        }
      });
    return e;
  }
  async executeAndMaterialize(t) {
    this._cte && (t.cte = this._cte);
    const e = this._sqlBuilder.generateFromModel(this._entityClass, t);
    let r = (await this._provider.executeQuery(e.query, e.parameters)).map((t) =>
      this.mapRowToEntity(t)
    );
    return (
      (r = this.applyFallbackPredicates(r)),
      this._entityLoader &&
        this._includes.length > 0 &&
        1 !== t.limit &&
        (await this._entityLoader.populateRelationshipsMany(r, this._entityClass, {
          strategy: i.Eager,
          includes: this._includes,
          depth: 1
        })),
      r
    );
  }
  extractIncludeProperty(t) {
    const e = t.toString(),
      i = R._includePropCache.get(e);
    if (i) return i;
    const r = e.match(R.REGEX_SINGLE_PROP);
    if (r && r[1]) return (R._includePropCache.set(e, r[1]), r[1]);
    throw new Error(`Unable to parse include selector: ${e}`);
  }
  extractPropertiesFromSelector(t) {
    const e = R._selectorPropsCache.get(t);
    if (e) return [...e];
    const i = t.match(R.REGEX_SINGLE_PROP);
    if (i) return [i[1]];
    const r = t.match(R.REGEX_OBJECT);
    if (r) {
      const e = r[1].split(',').map((t) => {
        const e = t.match(R.REGEX_PROP_IN_OBJECT);
        return e ? e[1] : t.trim();
      });
      return (R._selectorPropsCache.set(t, [...e]), e);
    }
    const s = t.match(R.REGEX_SIMPLE_OBJECT);
    if (s) {
      const e = s[1].split(',').map((t) => {
        const e = t.match(R.REGEX_PROP_IN_OBJECT) || t.match(R.REGEX_ANY_PROP);
        return e ? e[1] : t.trim();
      });
      return (R._selectorPropsCache.set(t, [...e]), e);
    }
    return ['*'];
  }
  extractPropertyFromKeySelector(t) {
    const e = R._keySelectorCache.get(t);
    if (e) return e;
    const i = t.match(R.REGEX_SINGLE_PROP);
    if (i) return (R._keySelectorCache.set(t, i[1]), i[1]);
    throw new Error(`Unable to parse key selector: ${t}`);
  }
  mapRowToEntity(t) {
    const e = c.getEntity(this._entityClass);
    if (
      this._performance?.enableEntityCache &&
      this._entityCache &&
      e &&
      e.primaryKeys.length > 0
    ) {
      const i = e.primaryKeys[0],
        r = e.columns.find((t) => t.propertyName === i),
        s = r ? t[r.columnName] : t[i],
        n = this._entityCache.get(this._entityClass, s);
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
      for (const i of e.columns)
        t.hasOwnProperty(i.columnName) &&
          (a[i.propertyName] = this.convertValue(t[i.columnName], i.type));
      (this._entityCache.set(this._entityClass, s, a),
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
      } catch (t) {
        try {
          const { warnIfLoggerDebug: e } = require('../utils/MetricsSafe');
          e('notify:entityMaterialized', t);
        } catch {}
      }
      try {
        this._provider.notifyEntityMaterialized?.(a, e);
      } catch (t) {
        try {
          const { warnIfLoggerDebug: e } = require('../utils/MetricsSafe');
          e('notify:entityMaterialized', t);
        } catch {}
      }
      return a;
    }
    const i = new this._entityClass();
    if (e)
      for (const r of e.columns)
        t.hasOwnProperty(r.columnName) &&
          (i[r.propertyName] = this.convertValue(t[r.columnName], r.type));
    else Object.assign(i, t);
    try {
      e && this._provider.notifyEntityMaterialized?.(i, e);
    } catch (t) {
      try {
        const { warnIfLoggerDebug: e } = require('../utils/MetricsSafe');
        e('notify:entityMaterialized', t);
      } catch {}
    }
    return i;
  }
  convertValue(t, e) {
    if (null == t) return t;
    switch (e.toUpperCase()) {
      case 'BOOLEAN':
        return Boolean(t);
      case 'INTEGER':
      case 'NUMBER':
        return Number(t);
      case 'DATETIME':
      case 'DATE':
        return new Date(t);
      default:
        return t;
    }
  }
  withAbort(t) {
    return ((this._abortSignal = t), this);
  }
  async all(t) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    return null === (await this.where((e) => !t(e)).firstOrDefault());
  }
  async average(t) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = await this.toArray();
    if (0 === e.length) throw new Error('Sequence contains no elements');
    const i = e.map((e) => {
      const i = t(e);
      return 'number' == typeof i ? i : Number(i) || 0;
    });
    return i.reduce((t, e) => t + e, 0) / i.length;
  }
  async sum(t) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    return (await this.toArray())
      .map((e) => {
        const i = t(e);
        return 'number' == typeof i ? i : Number(i) || 0;
      })
      .reduce((t, e) => t + e, 0);
  }
  async min(t) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = await this.toArray();
    if (0 === e.length) throw new Error('Sequence contains no elements');
    let i = t(e[0]);
    for (let r = 1; r < e.length; r++) {
      const s = t(e[r]);
      s < i && (i = s);
    }
    return i;
  }
  async max(t) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = await this.toArray();
    if (0 === e.length) throw new Error('Sequence contains no elements');
    let i = t(e[0]);
    for (let r = 1; r < e.length; r++) {
      const s = t(e[r]);
      s > i && (i = s);
    }
    return i;
  }
  async contains(t) {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const e = c.getEntity(this._entityClass);
    if (e && e.primaryKeys.length > 0) {
      const i = e.primaryKeys[0],
        r = t[i];
      if (null != r) {
        return (await this.toArray()).some((t) => t[i] === r);
      }
    }
    const i = await this.toArray(),
      r = JSON.stringify(t);
    return i.some((t) => JSON.stringify(t) === r);
  }
  except(t) {
    const e = this.clone(),
      i = e.toArray;
    return (
      (e.toArray = async function () {
        const e = await i.call(this),
          r = await t.toArray(),
          s = new Set(r.map((t) => JSON.stringify(t)));
        return e.filter((t) => !s.has(JSON.stringify(t)));
      }.bind(e)),
      e
    );
  }
  intersect(t) {
    const e = this.clone(),
      i = e.toArray;
    return (
      (e.toArray = async function () {
        const e = await i.call(this),
          r = await t.toArray(),
          s = new Set(r.map((t) => JSON.stringify(t)));
        return e.filter((t) => s.has(JSON.stringify(t)));
      }.bind(e)),
      e
    );
  }
  concat(t) {
    const e = this.clone(),
      i = e.toArray;
    return (
      (e.toArray = async function () {
        return [...(await i.call(this)), ...(await t.toArray())];
      }.bind(e)),
      e
    );
  }
  addJoin(t, e, i, r) {
    const s = c.getEntity(this._entityClass),
      n = c.getEntity(e);
    if (!s || !n) throw new Error('Entity metadata not found for join');
    const a = this.parseJoinPredicate(i.toString(), s.tableName, n.tableName, s, n);
    ((this._model.joins = this._model.joins || []),
      this._model.joins.push({ type: t, table: n.tableName, on: a, alias: r }));
  }
  parseJoinPredicate(t, e, i, r, s) {
    return M.parse(t, e, i, r, s);
  }
  applyGlobalFiltersToModel(t) {
    this._globalFilterApplier.apply(
      this._entityClass,
      t,
      this._provider.softDeleteOptions,
      this._globalFilters
    );
  }
}
((R._countCache = new Map()),
  (R._COUNT_CACHE_MAX = 2e3),
  (R.REGEX_SINGLE_PROP = /=>\s*\w+\.(\w+)/),
  (R.REGEX_OBJECT = /=>\s*\(\s*\{([^}]+)\}\s*\)/),
  (R.REGEX_SIMPLE_OBJECT = /=>\s*\{([^}]+)\}/),
  (R.REGEX_PROP_IN_OBJECT = /\w+:\s*\w+\.(\w+)/),
  (R.REGEX_ANY_PROP = /(\w+)/),
  (R.PREDICATE_CACHE_MAX = 1e3),
  (R._predicateSqlCache = new Map()),
  (R.SELECTOR_CACHE_MAX = 1e3),
  (R._selectorPropsCache = new Map()),
  (R._keySelectorCache = new Map()),
  (R._includePropCache = new Map()));
class B {
  constructor(t) {
    this._queryable = t;
  }
  static from(t) {
    return new B(t);
  }
  select(t) {
    const e = this._queryable.select(t);
    return new B(e);
  }
  where(t) {
    const e = this._queryable.where(t);
    return new B(e);
  }
  orderBy(t, e = 'ASC') {
    const i = 'DESC' === e ? this._queryable.orderByDescending(t) : this._queryable.orderBy(t);
    return new B(i);
  }
  include(t) {
    const e = this._queryable.include(t);
    return new B(e);
  }
  take(t) {
    const e = this._queryable.take(t);
    return new B(e);
  }
  skip(t) {
    const e = this._queryable.skip(t);
    return new B(e);
  }
  distinct() {
    const t = this._queryable.distinct();
    return new B(t);
  }
  thenBy(t) {
    const e = this._queryable.thenBy(t);
    return new B(e);
  }
  thenByDescending(t) {
    const e = this._queryable.thenByDescending(t);
    return new B(e);
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
  async all(t) {
    return (await this.toArray()).every((e) => t(e));
  }
  async average(t) {
    return await this._queryable.average(t);
  }
  async sum(t) {
    return await this._queryable.sum(t);
  }
  async min(t) {
    return await this._queryable.min(t);
  }
  async max(t) {
    return await this._queryable.max(t);
  }
  async contains(t) {
    return await this._queryable.contains(t);
  }
  except(t) {
    const e = this._queryable.except(t._queryable);
    return B.from(e);
  }
  intersect(t) {
    const e = this._queryable.intersect(t._queryable);
    return B.from(e);
  }
  concat(t) {
    const e = this._queryable.concat(t._queryable);
    return B.from(e);
  }
  get raw() {
    return this._queryable;
  }
}
class q {
  constructor(t, e, i, r, s, n, a) {
    ((this._entityClass = t),
      (this._provider = e),
      (this._changeTracker = i),
      (this._entityLoader = r),
      (this._entityCache = s),
      (this._performance = n),
      (this._globalFilters = a));
  }
  add(t) {
    return (this._changeTracker.add(t, this._entityClass), t);
  }
  update(t) {
    return (this._changeTracker.update(t, this._entityClass), t);
  }
  remove(t) {
    return (this._changeTracker.remove(t, this._entityClass), t);
  }
  addRange(t) {
    for (const e of t) this._changeTracker.add(e, this._entityClass);
    return t;
  }
  updateRange(t) {
    for (const e of t) this._changeTracker.update(e, this._entityClass);
    return t;
  }
  removeRange(t) {
    for (const e of t) this._changeTracker.remove(e, this._entityClass);
    return t;
  }
  async find(t, e) {
    if (this._entityLoader && e)
      return await this._entityLoader.loadEntity(this._entityClass, t, e);
    const i = c.getEntity(this._entityClass);
    if (!i || 0 === i.primaryKeys.length)
      return await this._provider.findById(t, this._entityClass);
    const r = i.primaryKeys[0];
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    )
      .where((e) => e[r] === t)
      .firstOrDefault();
  }
  async toArray(t) {
    return this._entityLoader && t
      ? await this._entityLoader.loadEntities(this._entityClass, t)
      : await new R(
          this._entityClass,
          this._provider,
          this._entityLoader,
          this._entityCache,
          this._performance,
          this._globalFilters
        ).toArray();
  }
  async findByIds(t) {
    if (!t || 0 === t.length) return [];
    const e = c.getEntity(this._entityClass);
    if (!e || 0 === e.primaryKeys.length) {
      const e = [];
      for (const i of t) {
        const t = await this.find(i);
        t && e.push(t);
      }
      return e;
    }
    const i = e.primaryKeys[0],
      r = e.columns.find((t) => t.propertyName === i)?.columnName || i;
    return await this._provider.findWhereIn(this._entityClass, r, t);
  }
  async findWhereIn(t, e) {
    if (!e || 0 === e.length) return [];
    const i = c.getEntity(this._entityClass),
      r =
        (i && i.columns.find((e) => e.propertyName === t || e.columnName === t)?.columnName) ||
        String(t);
    return await this._provider.findWhereIn(this._entityClass, r, e);
  }
  where(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).where(t);
    return B.from(e);
  }
  whereExists(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).whereExists(t);
    return B.from(e);
  }
  whereInSubquery(t, e) {
    const i = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).whereInSubquery(t, e);
    return B.from(i);
  }
  select(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).select(t);
    return B.from(e);
  }
  orderBy(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderBy(t);
    return B.from(e);
  }
  orderByDescending(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).orderByDescending(t);
    return B.from(e);
  }
  take(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).take(t);
    return B.from(e);
  }
  skip(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).skip(t);
    return B.from(e);
  }
  distinct() {
    const t = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).distinct();
    return B.from(t);
  }
  union(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).union(t);
    return B.from(e);
  }
  unionAll(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).unionAll(t);
    return B.from(e);
  }
  async first() {
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).first();
  }
  async firstOrDefault() {
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).firstOrDefault();
  }
  async single() {
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).single();
  }
  async singleOrDefault() {
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).singleOrDefault();
  }
  async count() {
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).count();
  }
  async any() {
    return await new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).any();
  }
  include(t) {
    const e = new R(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    ).include(t);
    return B.from(e);
  }
  async insertMany(t) {
    return await this._provider.insertMany(t, this._entityClass);
  }
  async updateMany(t) {
    return await this._provider.updateMany(t, this._entityClass);
  }
  async upsert(t) {
    const e = c.getEntity(this._entityClass);
    if (!e || 0 === e.primaryKeys.length)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const i = t[e.primaryKeys[0]];
    if (null == i) return (this.add(t), t);
    return (
      (await this._provider.findById(i, this._entityClass)) ? this.update(t) : this.add(t),
      t
    );
  }
  async upsertMany(t) {
    const e = c.getEntity(this._entityClass);
    if (!e || 0 === e.primaryKeys.length)
      throw new Error(`No primary key defined for ${this._entityClass.name}`);
    const i = e.primaryKeys[0],
      r = t.map((t) => ({ entity: t, id: t[i] })),
      s = r.filter((t) => void 0 !== t.id && null !== t.id).map((t) => t.id);
    if (s.length > 0) {
      const t = e.columns.find((t) => t.propertyName === i),
        n = await this._provider.findWhereIn(this._entityClass, t ? t.propertyName : i, s),
        a = new Set(n.map((t) => t[i]));
      for (const { entity: t, id: e } of r) null != e && a.has(e) ? this.update(t) : this.add(t);
    } else this.addRange(t);
    return t;
  }
}
class O {
  constructor(t = 1e4, e, i) {
    ((this._store = new Map()), (this._maxSize = t), (this._logger = e), (this._providerLabel = i));
  }
  buildKey(t, e) {
    return `${t.name}|${String(e)}`;
  }
  get(t, e) {
    if (null == e) return;
    const i = this.buildKey(t, e);
    return this._store.get(i);
  }
  set(t, e, i) {
    if (null == e) return;
    if (this._store.size >= this._maxSize) {
      const t = this._store.keys().next().value;
      if (void 0 !== t) {
        this._store.delete(t);
        try {
          w(this._logger, { cache: 'entityL2', provider: this._providerLabel });
        } catch {}
      }
    }
    const r = this.buildKey(t, e);
    this._store.set(r, i);
  }
  remove(t, e) {
    if (null == e) return;
    const i = this.buildKey(t, e);
    this._store.delete(i);
  }
  clear() {
    this._store.clear();
  }
  size() {
    return this._store.size;
  }
}
function x(t) {
  try {
    const e = Reflect.getOwnMetadata;
    return e?.('orm:original', t) || t;
  } catch {
    return t;
  }
}
class z {
  constructor(t) {
    ((this._dbSets = new Map()),
      (this._defaultLoadingStrategy = i.Eager),
      (this._loadingDefaults = {}),
      (this._validationRulesCache = new WeakMap()),
      (this._provider = t.provider),
      (this._softDelete = t.softDelete),
      (this._audit = t.audit),
      (this._globalFilters = t.globalFilters),
      (this._validationOptions = t.validation),
      (this._changeTracker = new o()),
      (this._entityLoader = new m(this._provider)),
      t.performance?.enableEntityCache &&
        (this._entityCache = new O(
          t.performance.entityCacheSize ?? 1e4,
          this._provider.loggerRef,
          this._provider.providerLabel
        )),
      (this._performanceOptions = t.performance),
      (this._loadingDefaults = t.loading || {}),
      this._loadingDefaults.strategy
        ? ((this._defaultLoadingStrategy = this._loadingDefaults.strategy),
          this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy))
        : this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy),
      this.initializeDbSets());
  }
  set(t) {
    const e = Reflect.getOwnMetadata,
      i = e?.('orm:original', t),
      r = 'function' == typeof i ? i : t;
    if (!this._dbSets.has(r)) throw new Error(`DbSet for ${t.name} is not configured`);
    const s = this._dbSets.get(r);
    return ((s._entityClass = t), s);
  }
  async ensureCreated() {
    await this._provider.connect();
    const t = c.getEntities();
    for (const e of t)
      try {
        new (x(e.target))();
      } catch {}
    const e = c.getEntities();
    for (const t of e) await this._provider.createTable(t);
  }
  async saveChanges() {
    const t = this._changeTracker.getChanges();
    for (const e of t)
      if ('added' === e.state) {
        const t = c.getEntity(e.entityClass);
        if (t)
          for (const i of t.columns)
            void 0 === e.entity[i.propertyName] &&
              void 0 !== i.defaultValue &&
              (e.entity[i.propertyName] = i.defaultValue);
      }
    this.validateChanges(t);
    let e = 0;
    for (const i of t) {
      if (this._audit?.enabled) {
        const t = c.getEntity(i.entityClass);
        if (t) {
          const e = (this._audit.clock ?? (() => new Date()))(),
            r = this._audit.timeColumns?.createdAt ?? 'createdAt',
            s = this._audit.timeColumns?.updatedAt ?? 'updatedAt',
            n = this._audit.userColumns?.createdBy ?? 'createdBy',
            a = this._audit.userColumns?.updatedBy ?? 'updatedBy',
            o = this._audit.getCurrentUserId?.();
          ('added' === i.state &&
            (t.columns.some((t) => t.propertyName === r) && (i.entity[r] = e),
            t.columns.some((t) => t.propertyName === n) && void 0 !== o && (i.entity[n] = o)),
            ('added' !== i.state && 'modified' !== i.state) ||
              (t.columns.some((t) => t.propertyName === s) && (i.entity[s] = e),
              t.columns.some((t) => t.propertyName === a) && void 0 !== o && (i.entity[a] = o)));
        }
      }
      switch (i.state) {
        case 'added':
          if ((await this._provider.insert(i.entity, i.entityClass), this._entityCache)) {
            const t = c.getEntity(i.entityClass),
              e = t?.primaryKeys[0];
            e && this._entityCache.set(i.entityClass, i.entity[e], i.entity);
          }
          e++;
          break;
        case 'modified':
          if ((await this._provider.update(i.entity, i.entityClass), this._entityCache)) {
            const t = c.getEntity(i.entityClass),
              e = t?.primaryKeys[0];
            e && this._entityCache.set(i.entityClass, i.entity[e], i.entity);
          }
          e++;
          break;
        case 'deleted':
          if (this._softDelete?.enabled) {
            const t = c.getEntity(i.entityClass),
              r = this._softDelete.column ?? 'isDeleted',
              s = this._softDelete.deletedAtColumn ?? 'deletedAt';
            if (t && t.columns.some((t) => t.propertyName === r || t.columnName === r)) {
              if (
                ((i.entity[r] = !0),
                t.columns.some((t) => t.propertyName === s || t.columnName === s) &&
                  (i.entity[s] = new Date()),
                await this._provider.update(i.entity, i.entityClass),
                this._entityCache)
              ) {
                const e = t.primaryKeys[0];
                this._entityCache.set(i.entityClass, i.entity[e], i.entity);
              }
              e++;
              break;
            }
          }
          if ((await this._provider.delete(i.entity, i.entityClass), this._entityCache)) {
            const t = c.getEntity(i.entityClass),
              e = t?.primaryKeys[0];
            e && this._entityCache.remove(i.entityClass, i.entity[e]);
          }
          e++;
      }
    }
    return (this._changeTracker.acceptAllChanges(), e);
  }
  async trySaveChanges() {
    try {
      const t = await this.saveChanges();
      return s(t);
    } catch (t) {
      return n(t);
    }
  }
  async beginTransaction() {
    await this._provider.beginTransaction();
  }
  async commitTransaction() {
    await this._provider.commitTransaction();
    try {
      if ((require('../query/Queryable').Queryable.clearCountCache(), this._entityCache)) {
        const { safeCacheSize: t } = require('../utils/MetricsSafe');
        t(this._provider.loggerRef, {
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
        const { safeCacheSize: t } = require('../utils/MetricsSafe');
        t(this._provider.loggerRef, {
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
  setLoadingStrategy(t) {
    ((this._defaultLoadingStrategy = t), this._entityLoader.setDefaultStrategy(t));
  }
  async find(t, e, i) {
    const r = {
      strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
      depth: this._loadingDefaults.depth ?? i?.depth,
      ...(i || {})
    };
    return await this._entityLoader.loadEntity(t, e, r);
  }
  async findAll(t, e) {
    const i = {
      strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
      depth: this._loadingDefaults.depth ?? e?.depth,
      ...(e || {})
    };
    return await this._entityLoader.loadEntities(t, i);
  }
  async include(t, e, ...r) {
    p.isLazyProxy(t)
      ? await p.preloadRelationships([t], e, r, this._provider)
      : await this._entityLoader.populateRelationships(t, e, { strategy: i.Eager, includes: r });
  }
  isLoaded(t, e) {
    return p.isLazyProxy(t) ? p.isRelationshipLoaded(t, e) : void 0 !== t[e] && null !== t[e];
  }
  initializeDbSets() {
    const t = c.getEntities();
    for (const e of t) {
      const t = x(e.target),
        i = new q(
          t,
          this._provider,
          this._changeTracker,
          this._entityLoader,
          this._entityCache,
          this._performanceOptions,
          this._globalFilters
        );
      this._dbSets.set(t, i);
      const r = t.name.toLowerCase(),
        s = r.endsWith('y') ? r.slice(0, -1) + 'ies' : r + 's';
      Object.defineProperty(this, s, { get: () => i, enumerable: !0, configurable: !1 });
    }
  }
  validateChanges(t) {
    const e = [];
    for (const i of t) {
      if ('added' !== i.state && 'modified' !== i.state) continue;
      const t = c.getEntity(i.entityClass);
      if (!t) continue;
      const r = this._audit?.enabled ? this._audit : void 0,
        s = r
          ? {
              createdAt: r.timeColumns?.createdAt ?? 'createdAt',
              updatedAt: r.timeColumns?.updatedAt ?? 'updatedAt',
              createdBy: r.userColumns?.createdBy ?? 'createdBy',
              updatedBy: r.userColumns?.updatedBy ?? 'updatedBy'
            }
          : void 0;
      for (const n of t.columns) {
        const a = i.entity[n.propertyName];
        if (n.isComputed)
          if ('added' === i.state)
            void 0 !== a &&
              e.push(
                this.buildValidationDetail(
                  t,
                  n.propertyName,
                  'Computed column is read-only and cannot be set on insert'
                )
              );
          else if ('modified' === i.state && i.originalValues) {
            a !== i.originalValues[n.propertyName] &&
              e.push(
                this.buildValidationDetail(
                  t,
                  n.propertyName,
                  'Computed column is read-only and cannot be updated'
                )
              );
          }
        const o = t.primaryKeys.includes(n.propertyName) && n.isGenerated && 'added' === i.state,
          l = void 0 !== n.defaultValue && 'added' === i.state,
          c = !(
            !r ||
            (('added' !== i.state ||
              (n.propertyName !== s.createdAt && n.propertyName !== s.createdBy) ||
              (n.propertyName !== s.createdAt && void 0 === r.getCurrentUserId)) &&
              (('added' !== i.state && 'modified' !== i.state) ||
                (n.propertyName !== s.updatedAt && n.propertyName !== s.updatedBy) ||
                (n.propertyName !== s.updatedAt && void 0 === r.getCurrentUserId)))
          );
        (n.nullable ||
          null != a ||
          o ||
          l ||
          c ||
          e.push(this.buildValidationDetail(t, n.propertyName, 'Value cannot be null')),
          n.length &&
            'string' == typeof a &&
            a.length > n.length &&
            e.push(this.buildValidationDetail(t, n.propertyName, `Length exceeds ${n.length}`)));
      }
      try {
        const r = this.getValidationRules(i.entityClass);
        for (const s of r) {
          const r = s.phase || 'always';
          if ('onCreate' === r && 'added' !== i.state) continue;
          if ('onUpdate' === r && 'modified' !== i.state) continue;
          if (!!!s.predicate(i.entity)) {
            const i = s.messageKey,
              r = s.messageParams,
              n =
                (i && this._validationOptions?.translate
                  ? this._validationOptions.translate(i, r)
                  : void 0) ||
                s.message ||
                'Validation rule failed';
            e.push(this.buildValidationDetail(t, s.propertyName, n));
          }
        }
      } catch {}
    }
    if (e.length > 0) throw new a('Model validation failed', e);
  }
  getValidationRules(t) {
    const e = this._validationRulesCache.get(t);
    if (e) return e;
    const i = (Reflect.getOwnMetadata('orm:validations', t) || []).slice();
    return (this._validationRulesCache.set(t, i), i);
  }
  buildValidationDetail(t, e, i) {
    const r = t?.tableName || 'unknown_table',
      s = t?.target?.name || 'UnknownEntity',
      n = t?.columns.find((t) => t.propertyName === e)?.columnName || e;
    return {
      entity: r,
      property: e,
      message: i,
      entityClass: s,
      table: r,
      column: n,
      fullMessage: `${s}.${e} (${r}.${n}): ${i}`
    };
  }
}
function k() {
  return new z({ provider: 'sqlite' });
}
function T() {
  return new b();
}
export { k as makeCtx, T as qb };
