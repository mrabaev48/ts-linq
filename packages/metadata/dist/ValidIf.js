"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidIf = ValidIf;
exports.ValidIfOf = ValidIfOf;
exports.RequiredIfOf = RequiredIfOf;
exports.MinLengthOf = MinLengthOf;
exports.MaxLengthOf = MaxLengthOf;
exports.PatternOf = PatternOf;
exports.RangeOf = RangeOf;
const MetadataStorage_1 = require("./MetadataStorage");
function ValidIf(predicate, message, options) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        MetadataStorage_1.MetadataStorage.addValidationRule(ctor, {
            propertyName: name,
            predicate,
            message: message || '',
            phase: options?.phase,
            messageKey: options?.messageKey,
            messageParams: options?.messageParams
        });
    };
}
/** Type-safe form: requires explicit entity type. */
function ValidIfOf(predicate, message) {
    return ValidIf(predicate, message);
}
/** Requires non-empty property value when condition holds. */
function RequiredIfOf(condition, message) {
    return function (target, propertyKey) {
        const propName = propertyKey.toString();
        const ctor = target.constructor;
        const predicate = (entity) => {
            const e = entity;
            if (!condition(e))
                return true;
            const v = e[propName];
            if (v === null || v === undefined)
                return false;
            if (typeof v === 'string')
                return v.trim().length > 0;
            if (Array.isArray(v))
                return v.length > 0;
            return true;
        };
        MetadataStorage_1.MetadataStorage.addValidationRule(ctor, {
            propertyName: propName,
            predicate,
            message: message || `${propName} is required`
        });
    };
}
/** Minimum string length constraint for a property. */
function MinLengthOf(min, message) {
    return function (target, propertyKey) {
        const propName = propertyKey.toString();
        const ctor = target.constructor;
        const predicate = (entity) => {
            const v = entity[propName];
            if (v === null || v === undefined)
                return true;
            if (typeof v === 'string')
                return v.length >= min;
            return true;
        };
        MetadataStorage_1.MetadataStorage.addValidationRule(ctor, {
            propertyName: propName,
            predicate,
            message: message || `Length must be >= ${min}`
        });
    };
}
/** Maximum string length constraint for a property. */
function MaxLengthOf(max, message) {
    return function (target, propertyKey) {
        const propName = propertyKey.toString();
        const ctor = target.constructor;
        const predicate = (entity) => {
            const v = entity[propName];
            if (v === null || v === undefined)
                return true;
            if (typeof v === 'string')
                return v.length <= max;
            return true;
        };
        MetadataStorage_1.MetadataStorage.addValidationRule(ctor, {
            propertyName: propName,
            predicate,
            message: message || `Length must be <= ${max}`
        });
    };
}
/** Regex pattern match for a string property. */
function PatternOf(regex, message) {
    return function (target, propertyKey) {
        const propName = propertyKey.toString();
        const ctor = target.constructor;
        const predicate = (entity) => {
            const v = entity[propName];
            if (v === null || v === undefined)
                return true;
            if (typeof v === 'string')
                return regex.test(v);
            return true;
        };
        MetadataStorage_1.MetadataStorage.addValidationRule(ctor, {
            propertyName: propName,
            predicate,
            message: message || `Invalid format`
        });
    };
}
/** Numeric range constraint for a property (when value is a number). */
function RangeOf(min, max, message) {
    return function (target, propertyKey) {
        const propName = propertyKey.toString();
        const ctor = target.constructor;
        const predicate = (entity) => {
            const v = entity[propName];
            if (v === null || v === undefined)
                return true;
            if (typeof v === 'number') {
                if (typeof min === 'number' && v < min)
                    return false;
                if (typeof max === 'number' && v > max)
                    return false;
            }
            return true;
        };
        MetadataStorage_1.MetadataStorage.addValidationRule(ctor, {
            propertyName: propName,
            predicate,
            message: message || `Out of range`
        });
    };
}
//# sourceMappingURL=ValidIf.js.map