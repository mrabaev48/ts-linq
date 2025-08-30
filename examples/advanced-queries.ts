import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';

@Entity()
class Product {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @Column()
    price!: number;

    @Column()
    categoryId!: number;

    @Column()
    stock!: number;
}

@Entity()
class Category {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;
}

class ShopDbContext extends DbContext {
    public products!: DbSet<Product>;
    public categories!: DbSet<Category>;
}

async function advancedQueriesExample() {
    const context = new ShopDbContext({
        connectionString: './shop.db',
        provider: 'sqlite'
    });

    try {
        await context.ensureCreated();

        // Create sample data
        const electronics = new Category();
        electronics.name = 'Electronics';
        context.categories.add(electronics);

        const books = new Category();
        books.name = 'Books';
        context.categories.add(books);

        await context.saveChanges();

        // Create products
        const products = [
            { name: 'Laptop', price: 999.99, categoryId: electronics.id, stock: 10 },
            { name: 'Mouse', price: 29.99, categoryId: electronics.id, stock: 50 },
            { name: 'Keyboard', price: 79.99, categoryId: electronics.id, stock: 25 },
            { name: 'Novel', price: 14.99, categoryId: books.id, stock: 100 },
            { name: 'Programming Book', price: 49.99, categoryId: books.id, stock: 30 }
        ];

        for (const productData of products) {
            const product = new Product();
            Object.assign(product, productData);
            context.products.add(product);
        }

        await context.saveChanges();

        console.log('=== Advanced Query Examples ===\n');

        // 1. Filter with complex conditions
        console.log('1. Expensive electronics (price > 50):');
        const expensiveElectronics = await context.products
            .where(p => p.categoryId === electronics.id && p.price > 50)
            .orderBy(p => p.price)
            .toArray();
        expensiveElectronics.forEach(p => console.log(`- ${p.name}: $${p.price}`));

        // 2. Pagination
        console.log('\n2. Products page 2 (skip 2, take 2):');
        const pagedProducts = await context.products
            .orderBy(p => p.name)
            .skip(2)
            .take(2)
            .toArray();
        pagedProducts.forEach(p => console.log(`- ${p.name}`));

        // 3. Aggregations
        console.log('\n3. Product statistics:');
        const totalProducts = await context.products.count();
        console.log(`Total products: ${totalProducts}`);

        const hasExpensiveProducts = await context.products
            .where(p => p.price > 100)
            .any();
        console.log(`Has expensive products (>$100): ${hasExpensiveProducts}`);

        // 4. Single and First operations
        console.log('\n4. Single/First operations:');
        
        const firstProduct = await context.products
            .orderBy(p => p.price)
            .first();
        console.log(`Cheapest product: ${firstProduct.name} - $${firstProduct.price}`);

        const mostExpensive = await context.products
            .orderByDescending(p => p.price)
            .first();
        console.log(`Most expensive product: ${mostExpensive.name} - $${mostExpensive.price}`);

        // 5. Distinct values (simplified example)
        console.log('\n5. All products (distinct):');
        const distinctProducts = await context.products
            .distinct()
            .take(3)
            .toArray();
        distinctProducts.forEach(p => console.log(`- ${p.name}`));

        // 6. Complex filtering and sorting
        console.log('\n6. Low stock products (< 30), sorted by stock:');
        const lowStockProducts = await context.products
            .where(p => p.stock < 30)
            .orderBy(p => p.stock)
            .toArray();
        lowStockProducts.forEach(p => console.log(`- ${p.name}: ${p.stock} in stock`));

        // 7. Using firstOrDefault vs first
        console.log('\n7. First vs FirstOrDefault:');
        
        const veryExpensiveProduct = await context.products
            .where(p => p.price > 2000)
            .firstOrDefault();
        
        if (veryExpensiveProduct) {
            console.log(`Found very expensive product: ${veryExpensiveProduct.name}`);
        } else {
            console.log('No very expensive products found (>$2000)');
        }

        // 8. Single operations with error handling
        console.log('\n8. Single operations:');
        
        try {
            const singleElectronicsItem = await context.products
                .where(p => p.categoryId === electronics.id)
                .single(); // This will throw because there are multiple electronics
        } catch (error: any) {
            console.log(`Single operation failed as expected: ${error.message}`);
        }

        const singleExpensiveProduct = await context.products
            .where(p => p.price > 999)
            .singleOrDefault();
        
        if (singleExpensiveProduct) {
            console.log(`Single expensive product: ${singleExpensiveProduct.name}`);
        }

    } finally {
        await context.dispose();
    }
}

// Run the example
advancedQueriesExample().catch(console.error);
