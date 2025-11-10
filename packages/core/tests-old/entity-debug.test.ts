import 'reflect-metadata';
import { MetadataStorage } from '../dist/metadata/MetadataStorage';
import { Entity } from '../dist/decorators/Entity';

// Clear first
MetadataStorage.getInstance().clear();

// Define entity with custom name
@Entity({ name: 'custom_related_table' })
class MetadataRelatedEntity {
  id!: number;
  title!: string;
}

console.log('1. After decorator (before instance):');
console.log('   Metadata:', MetadataStorage.getEntity(MetadataRelatedEntity));

// Create instance (triggers initializer)
console.log('\n2. Creating instance...');
new MetadataRelatedEntity();

console.log('\n3. After instance:');
const meta = MetadataStorage.getEntity(MetadataRelatedEntity);
console.log('   Metadata:', meta);
console.log('   tableName:', meta?.tableName);

// Now simulate test: clear and create again
console.log('\n4. Simulating test clear...');
MetadataStorage.getInstance().clear();

console.log('\n5. After clear:');
console.log('   Metadata:', MetadataStorage.getEntity(MetadataRelatedEntity));

console.log('\n6. Creating instance again...');
new MetadataRelatedEntity();

console.log('\n7. Final:');
const finalMeta = MetadataStorage.getEntity(MetadataRelatedEntity);
console.log('   Metadata:', finalMeta);
console.log('   tableName:', finalMeta?.tableName);
console.log('   Expected: custom_related_table');
console.log('   Actual:  ', finalMeta?.tableName);
console.log('   Match:', finalMeta?.tableName === 'custom_related_table');
