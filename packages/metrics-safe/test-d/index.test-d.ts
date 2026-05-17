import { expectType } from 'tsd';
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
function getUserById(id: UserId): User | null {
  return null;
}
function getOrderById(id: OrderId): Order | null {
  return null;
}

getUserById(uid);
getOrderById(oid);
// @ts-expect-error
getUserById(oid);
// @ts-expect-error
getOrderById(uid);

// Branded ids remain compatible with primitive constraints in generics
function identity<T extends string | number>(x: T): T {
  return x;
}
const uid2 = identity(uid);
expectType<UserId>(uid2);

// PrimaryKeyOf infers branded id type by convention `id`
type UserPk = PrimaryKeyOf<User>;
expectType<UserId>({} as UserPk);
// @ts-expect-error - OrderId is not assignable to UserPk
const wrongPk: UserPk = {} as OrderId;

// DbSet exposes query methods directly — no .query() needed
declare const users: DbSet<User>;
expectType<Queryable<User>>(users.orderBy('name'));
expectType<Queryable<User>>(users.whereIn('name', ['Alice']));

// Chaining starts from DbSet directly (EF Core style)
const usersQuery = users.orderBy('name');
expectType<Queryable<User>>(usersQuery);

// TypedQueryable: orderBy/thenBy only accept entity keys
type U_Order = { id: number; name: string; age: number; createdAt: Date };
declare const qOrder: Queryable<U_Order>;
const tqOrder = new TypedQueryable(qOrder);
// valid
tqOrder.orderBy('name');
tqOrder.orderBy('age', 'DESC');
tqOrder.thenBy('createdAt');
tqOrder.thenByDescending('id');
// invalid: non-existent key
// @ts-expect-error
tqOrder.orderBy('nonExistent');

// TypedQueryable: include only allows relationship properties
type Order_Rel = { id: number; userId: number };
type UserEx_Rel = { id: number; name: string; orders: Order_Rel[]; manager?: UserEx_Rel | null };
declare const qRel: Queryable<UserEx_Rel>;
const tqRel = new TypedQueryable(qRel);
// valid relationship
tqRel.include('orders');
// invalid: 'name' is a primitive, not a relationship
// @ts-expect-error
tqRel.include('name');


// TypedQueryable: select() throws at runtime (transformer required), type still inferred
type U_Select = { id: number; name: string; age: number };
declare const qSel: Queryable<U_Select>;
const tqSel = new TypedQueryable(qSel);
const selected = tqSel.select((u) => ({ id: u.id, name: u.name }));
// Chaining to ensure it remains typed
const _x2 = selected.take(1);
