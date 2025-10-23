# Аудит зависимостей всех пакетов

## Цель: Убедиться что в каждом пакете только нужные зависимости

## ast

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/types": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## cache-memcached

**dependencies:**
    "@ts-linq/core": "workspace:*"
    "@types/node": "^24.3.0"

**peerDependencies:**
  "peerDependencies": {
    "memjs": ">=1.3.0",
    "typescript": ">=4.9.0"
  "peerDependenciesMeta": {
    "memjs": { "optional": true }

---

## cache

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*",
    "@ts-linq/types": "workspace:*"
  "devDependencies": {"typescript": "^5.4.5"},
  "scripts": {"build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"}

---

## cache-redis

**dependencies:**
    "@ts-linq/core": "workspace:*"
    "@types/node": "^24.3.0"

**peerDependencies:**
  "peerDependencies": {
    "ioredis": ">=5.0.0",
    "redis": ">=4.0.0",
    "typescript": ">=4.9.0"
  "peerDependenciesMeta": {
    "ioredis": { "optional": true },
    "redis": { "optional": true }

---

## cli

**dependencies:**
    "@ts-linq/core": "workspace:*",
    "@ts-linq/sqlite": "workspace:*"
    "@types/node": "^24.3.0"

**peerDependencies:**
  "peerDependencies": {
    "typescript": ">=4.9.0"

---

## composite-sql-logger

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## concurrency

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/types": "workspace:*"
  "devDependencies": {"typescript": "^5.4.5"},
  "scripts": {"build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"}

---

## config

**dependencies:**
    "@ts-linq/types": "workspace:*"
    "@types/node": "^20.0.0",

---

## core

**dependencies:**
    "@ts-linq/types": "workspace:*",
    "@ts-linq/metadata": "workspace:*",
    "@ts-linq/query": "workspace:*",
    "@ts-linq/metrics-safe": "workspace:*",
    "@ts-linq/ast": "workspace:*"
    "@types/node": "^24.3.0"

**peerDependencies:**
  "peerDependencies": {
    "typescript": ">=4.9.0"
  "scripts": {
    "build": "npm run build:cjs && npm run build:esm && npm run gen:esm-entry",
    "build:cjs": "tsc -p tsconfig.json",
    "build:esm": "tsc -p tsconfig.esm.json",
    "gen:esm-entry": "echo '{\"type\":\"module\"}' > dist/esm/package.json"

---

## dialect-mssql

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## dialect-mysql

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## dialect-postgres

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## dialect-sqlite

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## e2e-tests

**dependencies:**
    "@ts-linq/core": "workspace:*",
    "@ts-linq/testkits": "workspace:*",
    "@ts-linq/provider-sqlite": "workspace:*",
    "@ts-linq/provider-postgres": "workspace:*",
    "@ts-linq/provider-mysql": "workspace:*",
    "@ts-linq/provider-mssql": "workspace:*"
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",

---

## examples

---

## integration-nestjs

---

## metadata

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/types": "workspace:*"
  "devDependencies": {"typescript": "^5.4.5"},
  "scripts": {"build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"}

---

## metrics-safe

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## migrations

**dependencies:**
    "@ts-linq/core": "workspace:*",
    "@ts-linq/metadata": "workspace:*",
    "@ts-linq/types": "workspace:*"

---

## open-telemetry-sql-logger

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## orm

**dependencies:**
    "@ts-linq/core": "workspace:*",
    "@ts-linq/types": "workspace:*",
    "@ts-linq/metadata": "workspace:*",
    "@ts-linq/query": "workspace:*"

---

## pagination

---

## plugin-audit

---

## plugin-multi-tenant

---

## plugin-soft-delete

---

## prometheus-sql-logger

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## provider-mssql

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*",
    "@ts-linq/dialect-mssql": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"

---

## provider-mysql

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*",
    "@ts-linq/dialect-mysql": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"

---

## provider-postgres

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*",
    "@ts-linq/dialect-postgres": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"

---

## provider-sqlite

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*",
    "@ts-linq/dialect-sqlite": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"

---

## query

**dependencies:**
    "@ts-linq/types": "workspace:*",
    "@ts-linq/metrics-safe": "workspace:*",
    "@ts-linq/ast": "workspace:*"
    "@ts-linq/core": "workspace:*"
    "@types/node": "^24.3.0"

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/core": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.esm.json"

---

## sql-visitor

---

## telemetry

---

## testkits

**dependencies:**
    "@ts-linq/types": "workspace:*",
    "@ts-linq/core": "workspace:*"
    "@ts-linq/provider-sqlite": "workspace:*",
    "@ts-linq/provider-postgres": "workspace:*",
    "@ts-linq/provider-mysql": "workspace:*",
    "@ts-linq/provider-mssql": "workspace:*"
    "@types/node": "^24.3.0"

**peerDependencies:**
  "peerDependencies": {
    "@ts-linq/provider-sqlite": "workspace:*",
    "@ts-linq/provider-postgres": "workspace:*",
    "@ts-linq/provider-mysql": "workspace:*",
    "@ts-linq/provider-mssql": "workspace:*"
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^24.3.0"

---

## types

---

