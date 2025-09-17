import {expectType} from 'tsd';
import { type EntityId, brandId, unbrandId, type PrimaryKeyOf } from '..';

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
