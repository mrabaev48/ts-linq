"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LazyLoadingProxy = exports.LAZY_LOADING_STATE = exports.LAZY_LOADING_PROXY = exports.LAZY_LOADING_PROVIDER = exports.LAZY_LOADING_TARGET = void 0;
exports.isLazyProxy = isLazyProxy;
exports.getLazyTarget = getLazyTarget;
exports.awaitLazyLoad = awaitLazyLoad;
const MetadataStorage_1 = require("@ts-linq/core/dist/metadata/MetadataStorage");
exports.LAZY_LOADING_TARGET = Symbol('lazyLoadingTarget');
exports.LAZY_LOADING_PROVIDER = Symbol('lazyLoadingProvider');
exports.LAZY_LOADING_PROXY = Symbol('lazyLoadingProxy');
exports.LAZY_LOADING_STATE = Symbol('lazyLoadingState');
class LazyLoadingProxy {
    static setLogger(logger) {
        this._logger = logger;
    }
    static getOrInitStateEntry(state, propName) {
        state[propName] || (state[propName] = { isLoaded: false, isLoading: false });
        return state[propName];
    }
    static markLoading(state, propName, promise) {
        const s = this.getOrInitStateEntry(state, propName);
        s.isLoading = true;
        s.loadingPromise = promise;
    }
    static markLoaded(state, propName) {
        const s = this.getOrInitStateEntry(state, propName);
        s.isLoaded = true;
        s.isLoading = false;
        delete s.loadingPromise;
    }
    static resetLoading(state, propName) {
        const s = this.getOrInitStateEntry(state, propName);
        s.isLoading = false;
        delete s.loadingPromise;
    }
    static defaultValueFor(relationship) {
        return relationship.type === 'one-to-many' || relationship.type === 'many-to-many' ? [] : null;
    }
    static getLogger() {
        if (this._logger)
            return this._logger;
        return { warn: (message, error) => console.warn(message, error) };
    }
    static create(entity, entityClass, provider) {
        if (this.isLazyProxy(entity))
            return entity;
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata || metadata.relationships.length === 0)
            return entity;
        const state = {};
        for (const relationship of metadata.relationships) {
            state[relationship.propertyName] = { isLoaded: false, isLoading: false };
            const currentValue = entity[relationship.propertyName];
            if (currentValue !== undefined && currentValue !== null)
                state[relationship.propertyName].isLoaded = true;
        }
        return new Proxy(entity, {
            get: (target, prop, receiver) => LazyLoadingProxy.proxyGet(target, prop, receiver, provider, entityClass, metadata, state),
            set: (target, prop, value, receiver) => LazyLoadingProxy.proxySet(target, prop, value, receiver, metadata, state),
            has: (target, prop) => LazyLoadingProxy.proxyHas(target, prop),
            ownKeys: (target) => LazyLoadingProxy.proxyOwnKeys(target),
            getOwnPropertyDescriptor: (target, prop) => LazyLoadingProxy.proxyGetOwnPropertyDescriptor(target, prop)
        });
    }
    static proxyGet(target, prop, receiver, provider, entityClass, metadata, state) {
        if (prop === exports.LAZY_LOADING_TARGET)
            return target;
        if (prop === exports.LAZY_LOADING_PROVIDER)
            return provider;
        if (prop === exports.LAZY_LOADING_PROXY)
            return true;
        if (prop === exports.LAZY_LOADING_STATE)
            return state;
        const propName = String(prop);
        const relationship = metadata.relationships.find((r) => r.propertyName === propName);
        if (relationship) {
            const s = this.getOrInitStateEntry(state, propName);
            if (!s.isLoaded && !s.isLoading) {
                const promise = LazyLoadingProxy.loadRelationship(target, entityClass, relationship, provider)
                    .then((result) => {
                    target[propName] = result;
                    this.markLoaded(state, propName);
                    return result;
                })
                    .catch((error) => {
                    LazyLoadingProxy.getLogger().warn(`Failed to lazy load ${propName}:`, error);
                    this.resetLoading(state, propName);
                    return this.defaultValueFor(relationship);
                });
                this.markLoading(state, propName, promise);
                return promise;
            }
            if (s.isLoading)
                return s.loadingPromise;
        }
        return Reflect.get(target, prop, receiver);
    }
    static proxySet(target, prop, value, receiver, metadata, state) {
        const propName = String(prop);
        const relationship = metadata.relationships.find((r) => r.propertyName === propName);
        if (relationship)
            this.markLoaded(state, propName);
        return Reflect.set(target, prop, value, receiver);
    }
    static proxyHas(target, prop) {
        if (prop === exports.LAZY_LOADING_PROXY ||
            prop === exports.LAZY_LOADING_TARGET ||
            prop === exports.LAZY_LOADING_PROVIDER ||
            prop === exports.LAZY_LOADING_STATE) {
            return true;
        }
        return Reflect.has(target, prop);
    }
    static proxyOwnKeys(target) {
        const keys = Reflect.ownKeys(target);
        return keys.filter((key) => key !== exports.LAZY_LOADING_TARGET &&
            key !== exports.LAZY_LOADING_PROVIDER &&
            key !== exports.LAZY_LOADING_PROXY &&
            key !== exports.LAZY_LOADING_STATE);
    }
    static proxyGetOwnPropertyDescriptor(target, prop) {
        if (prop === exports.LAZY_LOADING_PROXY ||
            prop === exports.LAZY_LOADING_TARGET ||
            prop === exports.LAZY_LOADING_PROVIDER ||
            prop === exports.LAZY_LOADING_STATE) {
            return { configurable: true, enumerable: false, writable: false, value: true };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
    }
    static async loadRelationship(entity, entityClass, relationship, provider) {
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return null;
        const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
        switch (relationship.type) {
            case 'many-to-one':
            case 'one-to-one': {
                const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
                const foreignKeyValue = entity[foreignKeyName];
                if (foreignKeyValue === undefined || foreignKeyValue === null)
                    return null;
                const relatedEntity = await provider.findById(foreignKeyValue, targetCtor);
                return relatedEntity ? this.create(relatedEntity, targetCtor, provider) : null;
            }
            case 'one-to-many': {
                const parentPkProperty = metadata.primaryKeys[0];
                if (!parentPkProperty)
                    return [];
                const parentPkValue = entity[parentPkProperty];
                if (parentPkValue === undefined || parentPkValue === null)
                    return [];
                const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
                const relatedEntities = await provider.findWhere(targetCtor, { [foreignKeyName]: parentPkValue });
                return this.createMany(relatedEntities, targetCtor, provider);
            }
            default:
                return null;
        }
    }
    static resolveTargetEntity(target) {
        const maybeCtor = target;
        if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype)
            return maybeCtor;
        return target();
    }
    static defaultForeignKeyFor(type) {
        const name = type.name || 'id';
        const camel = name.charAt(0).toLowerCase() + name.slice(1);
        return `${camel}Id`;
    }
    static createMany(entities, entityClass, provider) {
        return entities.map((entity) => this.create(entity, entityClass, provider));
    }
    static isLazyProxy(entity) {
        return !!entity?.[exports.LAZY_LOADING_PROXY];
    }
    static getTarget(entity) {
        if (this.isLazyProxy(entity)) {
            return entity[exports.LAZY_LOADING_TARGET];
        }
        return entity;
    }
    static getLoadingState(entity) {
        if (this.isLazyProxy(entity)) {
            return entity[exports.LAZY_LOADING_STATE];
        }
        return null;
    }
    static isRelationshipLoaded(entity, propertyName) {
        const state = this.getLoadingState(entity);
        return state?.[propertyName]?.isLoaded ?? false;
    }
}
exports.LazyLoadingProxy = LazyLoadingProxy;
function isLazyProxy(entity) {
    return LazyLoadingProxy.isLazyProxy(entity);
}
function getLazyTarget(entity) {
    return LazyLoadingProxy.getTarget(entity);
}
async function awaitLazyLoad(propertyValue) {
    if (propertyValue instanceof Promise)
        return await propertyValue;
    return propertyValue;
}
//# sourceMappingURL=LazyLoadingProxy.js.map