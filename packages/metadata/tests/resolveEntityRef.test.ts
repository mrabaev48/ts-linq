import { EntityRefResolutionError, resolveEntityRef } from '../src/resolveEntityRef';

describe('resolveEntityRef', () => {
  describe('direct constructor (class)', () => {
    it('returns the constructor when given a class', () => {
      class User {}
      const result = resolveEntityRef(User);
      expect(result).toBe(User);
    });

    it('returns the constructor for a class with explicit prototype', () => {
      class Post {
        id = 0;
      }
      const result = resolveEntityRef(Post);
      expect(result).toBe(Post);
    });
  });

  describe('thunk (() => Function)', () => {
    it('resolves and returns the constructor from a thunk', () => {
      class Comment {}
      const thunk = () => Comment;
      const result = resolveEntityRef(thunk as unknown as () => Function);
      expect(result).toBe(Comment);
    });

    it('returns null when the thunk throws a ReferenceError (TDZ)', () => {
      const thunk = () => {
        throw new ReferenceError('Cannot access before initialization');
      };
      const result = resolveEntityRef(thunk as unknown as () => Function);
      expect(result).toBeNull();
    });

    it('throws EntityRefResolutionError when thunk returns an arrow function (non-newable)', () => {
      const thunk = () => () => 'not a class';
      expect(() => resolveEntityRef(thunk as unknown as () => Function)).toThrow(
        EntityRefResolutionError
      );
    });

    it('throws EntityRefResolutionError when thunk returns a primitive', () => {
      const thunk = () => null;
      expect(() => resolveEntityRef(thunk as unknown as () => Function)).toThrow(
        EntityRefResolutionError
      );
    });

    it('throws EntityRefResolutionError wrapping the original cause when thunk throws TypeError', () => {
      const inner = new TypeError('boom');
      const thunk = () => {
        throw inner;
      };
      let thrown: unknown;
      try {
        resolveEntityRef(thunk as unknown as () => Function);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(EntityRefResolutionError);
      expect((thrown as EntityRefResolutionError).cause).toBe(inner);
    });

    it('re-throws EntityRefResolutionError thrown by the thunk unchanged', () => {
      const original = new EntityRefResolutionError('already typed');
      const thunk = () => {
        throw original;
      };
      expect(() => resolveEntityRef(thunk as unknown as () => Function)).toThrow(original);
    });
  });

  describe('string reference', () => {
    it('throws EntityRefResolutionError for a string target', () => {
      expect(() => resolveEntityRef('User')).toThrow(EntityRefResolutionError);
    });

    it('includes the string value in the error message', () => {
      let thrown: unknown;
      try {
        resolveEntityRef('SomeEntity');
      } catch (e) {
        thrown = e;
      }
      expect((thrown as EntityRefResolutionError).message).toContain('SomeEntity');
    });
  });

  describe('EntityRefResolutionError', () => {
    it('has the correct name property', () => {
      const err = new EntityRefResolutionError('test');
      expect(err.name).toBe('EntityRefResolutionError');
    });

    it('stores cause when provided', () => {
      const cause = new Error('root');
      const err = new EntityRefResolutionError('wrapper', cause);
      expect(err.cause).toBe(cause);
    });

    it('is an instance of Error', () => {
      expect(new EntityRefResolutionError('x')).toBeInstanceOf(Error);
    });
  });
});
