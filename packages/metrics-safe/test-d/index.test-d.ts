import {expectType} from 'tsd';
import { type EntityId, brandId, unbrandId, type PrimaryKeyOf, DbSet } from '..';
import type { Queryable } from '..';
import { TypedQueryable } from '..';

// Define branded id aliases
type UserId = EntityId<number, 'User'>;
type OrderId = EntityId<number, 'Order'>;

type User = { id: UserId; name: string };

type Order = { id: OrderId; userId: UserId; total: number };

// brandId produces the correct branded type
const uid = brandId<number, 'User'>(123);
expectType<UserId>(uid);

// unbrandId removes the brand and yields the primitive
const rawUid = unbrandId(uid);
expectType<number>(rawUid);

// Different branded IDs are not assignable to each other
const oid = brandId<number, 'Order'>(1);
expectType<OrderId>(oid);
// @ts-expect-error - different brands are incompatible
const badUserId: UserId = oid;
// @ts-expect-error - different brands are incompatible
const badOrderId: OrderId = uid;

// Function signatures should enforce correct branded ids
function getUserById(id: UserId): User | null { return null; }
function getOrderById(id: OrderId): Order | null { return null; }

getUserById(uid);
getOrderById(oid);
// @ts-expect-error
getUserById(oid);
// @ts-expect-error
getOrderById(uid);

// Branded ids remain compatible with primitive constraints in generics
function identity<T extends string | number>(x: T): T { return x; }
const uid2 = identity(uid);
expectType<UserId>(uid2);

// PrimaryKeyOf infers branded id type by convention `id`
type UserPk = PrimaryKeyOf<User>;
expectType<UserId>({} as UserPk);
// @ts-expect-error - OrderId is not assignable to UserPk
const wrongPk: UserPk = {} as OrderId;

// DbSet.find must accept branded PK type
declare const users: DbSet<User>;
expectType<Promise<User | null>>(users.find(uid));
// @ts-expect-error - raw number should not be accepted if PK is branded
users.find(123);

// DbSet.findByIds must accept arrays of branded PK
expectType<Promise<User[]>>(users.findByIds([uid]));
// @ts-expect-error - raw numbers array should be rejected when PK is branded
users.findByIds([1, 2, 3]);

// DbSet.findWhereIn must be type-safe on property and values
expectType<Promise<User[]>>(users.findWhereIn('id', [uid]));
// @ts-expect-error - raw number array is invalid for branded id property
users.findWhereIn('id', [1, 2, 3]);
// Non-branded property accepts correct primitive values
expectType<Promise<User[]>>(users.findWhereIn('name', ['Alice', 'Bob']));
// @ts-expect-error - wrong value type for property
users.findWhereIn('name', [uid]);

// TypedQueryable: orderBy/thenBy only accept entity keys and value types
type U_Order = { id: number; name: string; age: number; createdAt: Date };
declare const qOrder: Queryable<U_Order>;
const tqOrder = new TypedQueryable(qOrder);
// valid
tqOrder.orderBy(u => u.name);
tqOrder.orderBy(u => u.age, 'DESC');
tqOrder.thenBy(u => u.createdAt);
tqOrder.thenByDescending(u => u.id);
// invalid: non-existent key
// @ts-expect-error
tqOrder.orderBy((u) => u.nonExistent);

// TypedQueryable: include only allows relationship properties
type Order_Rel = { id: number; userId: number };
type UserEx_Rel = { id: number; name: string; orders: Order_Rel[]; manager?: UserEx_Rel | null };
declare const qRel: Queryable<UserEx_Rel>;
const tqRel = new TypedQueryable(qRel);
// valid relationships
tqRel.include(u => u.orders);
tqRel.include(u => u.name);

// TypedQueryable: result type inference for select
type U_Select = { id: number; name: string; age: number };
declare const qSel: Queryable<U_Select>;
const tqSel = new TypedQueryable(qSel);
const selected = tqSel.select(u => ({ id: u.id, name: u.name }));
// Chaining to ensure it remains typed
const _x2 = selected.take(1);
