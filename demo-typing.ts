// Демонстрация работы типизированного ORM
import 'reflect-metadata';
import { Entity, Column, PrimaryKey, OneToMany, EntityId, brandId, typed } from './packages/core/src/index';
import { DbContext } from './packages/core/src/context/DbContext';
import { SQLiteProvider } from './packages/sqlite/src/index';

// 1. BRANDED TYPES - compile-time безопасность для ID
type UserId = EntityId<number, 'User'>;
type OrderId = EntityId<string, 'Order'>;
type ProductId = EntityId<number, 'Product'>;

@Entity({ tableName: 'users' })
class User {
  @PrimaryKey({ branded: true })
  @Column({ type: 'INTEGER' })
  id!: UserId;

  @Column({ type: 'TEXT' })
  name!: string;

  @Column({ type: 'INTEGER' })
  age!: number;

  @OneToMany({ targetEntity: () => Order, inverseSide: 'user' })
  orders!: Order[];
}

@Entity({ tableName: 'orders' })
class Order {
  @PrimaryKey({ branded: true })
  @Column({ type: 'TEXT' })
  id!: OrderId;

  @Column({ type: 'REAL' })
  amount!: number;

  @Column({ type: 'INTEGER' })
  userId!: UserId;

  user!: User;
}

@Entity({ tableName: 'products' })
class Product {
  @PrimaryKey({ branded: true })
  @Column({ type: 'INTEGER' })
  id!: ProductId;

  @Column({ type: 'TEXT' })
  name!: string;

  @Column({ type: 'REAL' })
  price!: number;
}

async function demonstrateTyping() {
  console.log('=== Демонстрация типизированного ORM ===\n');

  // Настройка контекста
  const provider = new SQLiteProvider(':memory:');
  const ctx = new DbContext({ provider });

  // 1. ДЕМОНСТРАЦИЯ BRANDED TYPES
  console.log('1. Branded Types - предотвращение смешивания ID:');
  
  const userId: UserId = brandId<number, 'User'>(123);
  const orderId: OrderId = brandId<string, 'Order'>('order-456');
  const productId: ProductId = brandId<number, 'Product'>(789);

  console.log('   ✅ UserId:', userId, '(type: UserId)');
  console.log('   ✅ OrderId:', orderId, '(type: OrderId)');  
  console.log('   ✅ ProductId:', productId, '(type: ProductId)');

  // В TypeScript компиляторе следующие строки дали бы ошибки:
  // ❌ const mixedId: UserId = orderId;        // Type error!
  // ❌ const wrongType: OrderId = userId;      // Type error!

  console.log('   ℹ️  Mixing IDs prevented at compile-time!\n');

  // 2. ДЕМОНСТРАЦИЯ TYPED QUERYABLE
  console.log('2. TypedQueryable - compile-time валидация запросов:');

  // ✅ Правильные запросы компилируются
  console.log('   ✅ Valid queries:');
  
  // Создаем типизированные queryables
  const users = typed(ctx.set(User));
  const orders = typed(ctx.set(Order));

  // Демонстрируем fluent API с типизацией
  const query1 = users
    .where(u => u.age > 18)                    // ✅ age exists
    .select(u => ({ id: u.id, name: u.name })) // ✅ valid selection
    .orderBy(u => u.name, 'DESC')              // ✅ valid order
    .include(u => u.orders);                   // ✅ valid relationship

  console.log('      users.where(u => u.age > 18)');
  console.log('           .select(u => ({ id: u.id, name: u.name }))');
  console.log('           .orderBy(u => u.name, "DESC")');
  console.log('           .include(u => u.orders)');

  // В TypeScript следующие запросы дали бы compile errors:
  console.log('\n   ❌ Invalid queries (compile errors):');
  console.log('      // users.where(u => u.nonExistent > 5)        // Property does not exist');
  console.log('      // users.select(u => u.invalidField)           // Property does not exist');  
  console.log('      // users.include(u => u.name)                  // Not a relationship');
  console.log('      // users.orderBy(u => u.nonExistent)          // Property does not exist');

  // 3. ДЕМОНСТРАЦИЯ РЕЗУЛЬТАТОВ ЗАПРОСОВ
  console.log('\n3. Query Result Type Inference:');

  // Тип результата автоматически выводится
  const projectedQuery = users.select(u => ({ 
    userId: u.id, 
    userName: u.name,
    userAge: u.age 
  }));

  console.log('   Query: users.select(u => ({ userId: u.id, userName: u.name, userAge: u.age }))');
  console.log('   Result type: { userId: UserId; userName: string; userAge: number; }[]');

  // 4. ДЕМОНСТРАЦИЯ МЕТОДОВ ВЫПОЛНЕНИЯ
  console.log('\n4. Execution Methods with Type Safety:');
  
  // Различные способы получения результатов
  console.log('   Available methods:');
  console.log('   • first() -> User | null');
  console.log('   • firstOrDefault(defaultUser) -> User');  
  console.log('   • single() -> User (throws if 0 or >1)');
  console.log('   • toArray() -> User[]');
  console.log('   • count() -> number');
  console.log('   • any() -> boolean');

  // 5. ДЕМОНСТРАЦИЯ CHAINING
  console.log('\n5. Method Chaining:');
  
  const chainedQuery = users
    .where(u => u.age >= 21)
    .orderBy(u => u.name)
    .take(10)
    .skip(5)
    .distinct();

  console.log('   Fluent API: users.where(u => u.age >= 21)');
  console.log('                    .orderBy(u => u.name)');
  console.log('                    .take(10)');
  console.log('                    .skip(5)');
  console.log('                    .distinct()');

  // 6. BACKWARD COMPATIBILITY
  console.log('\n6. Backward Compatibility:');
  console.log('   ✅ Regular Queryable still works');
  console.log('   ✅ Can upgrade: typed(regularQueryable)');
  console.log('   ✅ Can downgrade: typedQueryable.raw');
  
  const regularQueryable = ctx.set(User);
  const upgradedQueryable = typed(regularQueryable);
  const downgradedQueryable = upgradedQueryable.raw;
  
  console.log('   • Regular -> Typed: ✓');
  console.log('   • Typed -> Regular: ✓');

  console.log('\n=== Демонстрация завершена ===');
}

// Запуск демонстрации
demonstrateTyping().catch(console.error);