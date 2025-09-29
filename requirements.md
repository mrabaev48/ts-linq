# Requirements

## Language & Standards
- **TypeScript ≥ 5.x**
- Use **only TC39 Stage 3 decorators** (new TS5 model).
- `experimentalDecorators` and all legacy decorators are strictly forbidden.

## Typing
- Strict typing enabled (`"strict": true` in tsconfig).
- Absolute prohibition of `any`.
- If needed, use `unknown` with proper type narrowing.
- All public APIs must be fully generic-typed.

## Design Principles
- Code must follow **SOLID** principles.
- Apply **OOP concepts**: encapsulation, inheritance, polymorphism, abstraction.
- Required design patterns:
    - **Strategy** (database dialects)
    - **Visitor** (AST → SQL)
    - **Specification** (reusable filters)
    - **Unit of Work** (`DbContext`)
    - **Repository** (`DbSet<T>`)
    - **Factory/Builder** (object creation, QueryBuilder)
    - **Adapter** (database drivers)
    - **Decorator (TS Stage 3)** for entity metadata.

## Code Quality
- Clean and modular code.
- Mandatory type and parameter documentation (JSDoc / Typedoc).
- ESLint rule `@typescript-eslint/no-explicit-any` must be set to `error`.
- Unit and integration tests are required.