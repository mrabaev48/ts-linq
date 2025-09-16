// Демонстрация работы типизированного ORM - правильные примеры
import { EntityId, brandId, unbrandId, typed } from './packages/core/src/index';

// ===== 1. BRANDED TYPES DEMO =====
console.log('=== 1. Branded Types для Entity IDs ===');

// Определяем branded типы для разных сущностей
type UserId = EntityId<number, 'User'>;
type OrderId = EntityId<string, 'Order'>;  
type ProductId = EntityId<number, 'Product'>;

// Создаем branded ID
const userId: UserId = brandId<number, 'User'>(123);
const orderId: OrderId = brandId<string, 'Order'>('order-456');
const productId: ProductId = brandId<number, 'Product'>(789);

console.log('✅ Создали branded IDs:');
console.log(`   UserId: ${userId} (тип: ${typeof userId})`);
console.log(`   OrderId: ${orderId} (тип: ${typeof orderId})`);
console.log(`   ProductId: ${productId} (тип: ${typeof productId})`);

// Извлечение raw значений
const rawUserId = unbrandId(userId);
const rawOrderId = unbrandId(orderId);
console.log('\n✅ Извлекли raw значения:');
console.log(`   Raw UserId: ${rawUserId}`);
console.log(`   Raw OrderId: ${rawOrderId}`);

// Демонстрация compile-time безопасности
console.log('\n❌ Следующие операции дают COMPILE ERROR:');
console.log('   // const mixed: UserId = orderId;        // ❌ Type error!');
console.log('   // const wrong: OrderId = productId;     // ❌ Type error!');
console.log('   // function takeUserId(id: UserId) {}');
console.log('   // takeUserId(orderId);                  // ❌ Type error!');

// ===== 2. ТИПИЗИРОВАННЫЕ ENTITY ПРИМЕРЫ =====
console.log('\n=== 2. Entity Definitions с Branded IDs ===');

// Показываем, как выглядят entity с типизацией
console.log('✅ Пример User entity с branded ID:');
console.log(`
@Entity({ name: 'users' })
class User {
  @PrimaryKey({ branded: true })
  @Column({ type: 'INTEGER' })
  id!: UserId;  // <-- Branded type вместо number

  @Column({ type: 'TEXT' })
  name!: string;
  
  @Column({ type: 'INTEGER' })
  age!: number;

  orders!: Order[];
}
`);

console.log('✅ Пример Order entity с branded ID:');
console.log(`
@Entity({ name: 'orders' })  
class Order {
  @PrimaryKey({ branded: true })
  @Column({ type: 'TEXT' })
  id!: OrderId;  // <-- String-based branded ID

  @Column({ type: 'INTEGER' })
  userId!: UserId;  // <-- Foreign key тоже branded

  @Column({ type: 'REAL' })
  amount!: number;
}
`);

// ===== 3. TYPED QUERY BUILDER ПРИМЕРЫ =====
console.log('\n=== 3. TypedQueryable - Type-Safe Queries ===');

console.log('✅ Правильные запросы (компилируются):');
console.log(`
// Upgrade обычного queryable к typed
const users = typed(ctx.set(User));

// ✅ Type-safe операции
const query = users
  .where(u => u.age > 18)                    // ✅ 'age' exists
  .select(u => ({ id: u.id, name: u.name })) // ✅ valid fields  
  .orderBy(u => u.name, 'DESC')              // ✅ valid order
  .include(u => u.orders)                    // ✅ valid relationship
  .take(10)
  .skip(5);
`);

console.log('\n❌ Неправильные запросы (compile errors):');
console.log(`
// ❌ Следующие запросы не скомпилируются:
// users.where(u => u.nonExistent > 5)        // Property doesn't exist
// users.select(u => u.invalidField)           // Property doesn't exist  
// users.include(u => u.name)                  // 'name' is not a relationship
// users.orderBy(u => u.nonExistent)          // Property doesn't exist
`);

// ===== 4. QUERY RESULT TYPE INFERENCE =====
console.log('\n=== 4. Автоматический вывод типов результатов ===');

console.log('✅ TypeScript автоматически выводит типы:');
console.log(`
// Запрос с проекцией
const projectedQuery = users.select(u => ({ 
  userId: u.id,      // UserId
  userName: u.name,  // string
  userAge: u.age     // number
}));

// Тип результата автоматически выведен:
// Promise<{ userId: UserId; userName: string; userAge: number; }[]>
`);

// ===== 5. EXECUTION METHODS =====
console.log('\n=== 5. Методы выполнения с типизацией ===');

console.log('✅ Type-safe execution methods:');
console.log(`
// Различные способы получения результатов
const user = await users.first();              // Promise<User | null>
const userOrDefault = await users              // Promise<User>
  .firstOrDefault(defaultUser);
const exactlyOne = await users.single();       // Promise<User> (throws if 0 or >1)  
const allUsers = await users.toArray();        // Promise<User[]>
const userCount = await users.count();         // Promise<number>
const hasUsers = await users.any();            // Promise<boolean>
`);

// ===== 6. FLUENT API CHAINING =====
console.log('\n=== 6. Fluent API с Method Chaining ===');

console.log('✅ Все методы возвращают TypedQueryable для chaining:');
console.log(`
const complexQuery = users
  .where(u => u.age >= 21)      // TypedQueryable<User>
  .orderBy(u => u.name)         // TypedQueryable<User>
  .take(10)                     // TypedQueryable<User>
  .skip(5)                      // TypedQueryable<User>  
  .distinct()                   // TypedQueryable<User>
  .include(u => u.orders);      // TypedQueryable<User>

// Финальное выполнение
const results = await complexQuery.toArray(); // User[]
`);

// ===== 7. RELATIONSHIP VALIDATION =====
console.log('\n=== 7. Relationship Type Validation ===');

console.log('✅ Include работает только с relationships:');
console.log(`
// ✅ Правильно - orders это relationship
users.include(u => u.orders)

// ❌ Compile error - name это не relationship  
// users.include(u => u.name)
// users.include(u => u.age)
`);

// ===== 8. BACKWARD COMPATIBILITY =====
console.log('\n=== 8. Обратная совместимость ===');

console.log('✅ Полная совместимость с существующим кодом:');
console.log(`
// Обычный queryable
const regularQuery = ctx.set(User);

// Upgrade к typed
const typedQuery = typed(regularQuery);

// Downgrade обратно к обычному (если нужно)
const backToRegular = typedQuery.raw;
`);

console.log('\n=== Демонстрация завершена ===');
console.log('\n🎯 ОСНОВНЫЕ ПРЕИМУЩЕСТВА:');
console.log('   ✅ Compile-time безопасность для Entity IDs');
console.log('   ✅ Type-safe query building с валидацией полей');
console.log('   ✅ Автоматический вывод типов результатов');
console.log('   ✅ Валидация relationships в include()');
console.log('   ✅ Полная обратная совместимость');
console.log('   ✅ IntelliSense автодополнение для всех операций');