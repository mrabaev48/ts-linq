#!/bin/bash
# Script to migrate all test files to Stage-3 decorators
# Removes reflect-metadata imports from all test files

set -e

echo "🚀 Migrating test files to Stage-3 decorators..."

# Find all test files with reflect-metadata import
TEST_FILES=$(find packages -name "*.test.ts" -type f -exec grep -l "import 'reflect-metadata'" {} \;)

COUNT=0
for file in $TEST_FILES; do
  echo "  ✓ Removing reflect-metadata from: $file"
  # Remove the import line
  sed -i "/import 'reflect-metadata';/d" "$file"
  ((COUNT++))
done

echo "✅ Migrated $COUNT test files"
echo ""
echo "⚠️  Note: You may need to manually add explicit types to decorators:"
echo "   @Column() -> @Column({ type: 'TEXT' })"
echo "   @PrimaryKey() -> @PrimaryKey({ type: 'INTEGER' })"
