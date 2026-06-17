import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { Column, Entity, ManyToOne, OneToMany, PrimaryKey } from '@ts-linq/metadata';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import { type GraphStatePort, GraphTracker } from '../../src/changetracker/GraphTracker';

@Entity()
class Author {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @OneToMany(() => Book, { inverseSide: 'author' })
  books?: Book[];
}

@Entity()
class Book {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  title!: string;

  @ManyToOne(() => Author, { foreignKey: 'authorId' })
  author?: Author;
}

/** Records setState calls and reports everything Unchanged. */
class RecordingPort implements GraphStatePort {
  readonly setCalls: Array<{ entity: object; state: EntityState }> = [];
  getEntityState(): EntityState {
    return EntityState.Unchanged;
  }
  setState(entity: object, _entityClass: EntityCtorRef, state: EntityState): void {
    this.setCalls.push({ entity, state });
  }
}

describe('GraphTracker', () => {
  it('visits root and all reachable children exactly once', () => {
    const tracker = new GraphTracker(MetadataStorage.getInstance(), new RecordingPort());
    const b1 = Object.assign(new Book(), { id: 1, title: 'A' });
    const b2 = Object.assign(new Book(), { id: 2, title: 'B' });
    const author = Object.assign(new Author(), { id: 10, books: [b1, b2] });

    const visited: object[] = [];
    tracker.trackGraph(author, Author, (node) => visited.push(node.entry.entity as object));

    expect(visited).toHaveLength(3);
    expect(visited).toEqual(expect.arrayContaining([author, b1, b2]));
  });

  it('is cycle-safe with back-references', () => {
    const tracker = new GraphTracker(MetadataStorage.getInstance(), new RecordingPort());
    const author = Object.assign(new Author(), { id: 10 });
    const book = Object.assign(new Book(), { id: 1, title: 'A', author });
    author.books = [book];
    book.author = author; // cycle

    const visited: object[] = [];
    tracker.trackGraph(author, Author, (node) => visited.push(node.entry.entity as object));

    expect(visited).toHaveLength(2);
  });

  it('routes entry.state writes through the injected port', () => {
    const port = new RecordingPort();
    const tracker = new GraphTracker(MetadataStorage.getInstance(), port);
    const author = Object.assign(new Author(), { id: 5 });

    tracker.trackGraph(author, Author, (node) => {
      node.entry.state = EntityState.Modified;
    });

    expect(port.setCalls).toEqual([{ entity: author, state: EntityState.Modified }]);
  });

  it('exposes isKeySet on the node entry', () => {
    const tracker = new GraphTracker(MetadataStorage.getInstance(), new RecordingPort());
    const withKey = Object.assign(new Author(), { id: 5 });
    const noKey = Object.assign(new Author(), { id: 0 });

    const flags: boolean[] = [];
    tracker.trackGraph(withKey, Author, (node) => flags.push(node.entry.isKeySet));
    tracker.trackGraph(noKey, Author, (node) => flags.push(node.entry.isKeySet));

    expect(flags).toEqual([true, false]);
  });
});
