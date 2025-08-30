import 'reflect-metadata';
import { DbContext, DbSet, Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '../src';

@Entity()
class Author {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column({ nullable: false })
    name!: string;

    @OneToMany(() => Book, { foreignKey: 'authorId' })
    books!: Book[];
}

@Entity()
class Book {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column({ nullable: false })
    title!: string;

    @Column()
    authorId!: number;

    @ManyToOne(() => Author, { foreignKey: 'authorId' })
    author!: Author;
}

class AppDbContext extends DbContext {
    public authors!: DbSet<Author>;
    public books!: DbSet<Book>;
}

async function main() {
    const context = new AppDbContext({ connectionString: ':memory:', provider: 'sqlite' });
    await context.ensureCreated();

    // Create an author
    const author = new Author();
    author.name = 'Jane Doe';
    context.authors.add(author);
    await context.saveChanges();
    console.log('Created author id:', author.id);

    // Create books
    const book1 = new Book();
    book1.title = 'First Book';
    book1.authorId = author.id;

    const book2 = new Book();
    book2.title = 'Second Book';
    book2.authorId = author.id;

    context.books.add(book1);
    context.books.add(book2);
    await context.saveChanges();
    console.log('Inserted books');

    // Query all authors
    const authors = await context.authors.toArray();
    console.log('Authors count:', authors.length);

    // Query with builder (order, skip/take)
    const pagedBooks = await context
        .books
        .orderBy(b => b.title)
        .skip(0)
        .take(10)
        .toArray();
    console.log('Books:', pagedBooks.map(b => b.title));

    // Eager load relationships via include
    const authorsWithBooks = await context.include(Author, 'books').toArray();
    console.log('Author[0] books:', authorsWithBooks[0].books?.length ?? 0);

    // Update
    const first = await context.books.orderBy(b => b.id).first();
    first.title = 'First Book (Updated)';
    context.books.update(first);
    await context.saveChanges();
    console.log('Updated first book title');

    // Delete
    context.books.remove(book2);
    await context.saveChanges();
    const remaining = await context.books.count();
    console.log('Remaining books:', remaining);

    await context.dispose();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});


