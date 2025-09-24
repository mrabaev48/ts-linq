NestJS Integration — ts-linq

This guide shows how to integrate ts‑linq with NestJS, including configuration via ConfigModule, request‑scoped DbContext, and automatic dispose at the end of the request.

Prerequisites

- @nestjs/common, @nestjs/core, @nestjs/config
- A ts‑linq provider package (e.g., @ts-linq/postgres)

Design

- Provide DbContext through a NestJS provider token (e.g., DB_CONTEXT)
- Use an async factory to configure provider/connection from env
- Use request scope so each HTTP request gets its own DbContext
- Dispose context on response finish

Tokens & Decorators

```ts
// database.tokens.ts
export const DB_CONTEXT = 'DB_CONTEXT';

// database.decorators.ts
import { Inject } from '@nestjs/common';
export const InjectDbContext = () => Inject(DB_CONTEXT);
```

Context Factory (request‑scoped)

```ts
// database.factory.ts
import { Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppDbContext } from './app-db-context';
import { PostgresProvider } from '@ts-linq/postgres';

export const dbContextProvider = {
  provide: 'DB_CONTEXT',
  scope: Scope.REQUEST,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const url = config.get<string>('POSTGRES_URL')!;
    const provider = new PostgresProvider(url);
    // connect lazily inside ensureCreated() or here if you prefer
    const ctx = new AppDbContext({ provider });
    return ctx;
  },
};
```

Module & Middleware for Auto‑Dispose

```ts
// database.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dbContextProvider } from './database.factory';
import { DB_CONTEXT } from './database.tokens';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [dbContextProvider],
  exports: [dbContextProvider],
})
export class DatabaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(async (req: any, res: any, next: () => void) => {
      // On response finish, try disposing request DbContext if present
      res.on('finish', async () => {
        const ctx: { dispose?: () => Promise<void> } | undefined = req[DB_CONTEXT];
        if (ctx?.dispose) {
          try { await ctx.dispose(); } catch { /* ignore */ }
        }
      });
      next();
    }).forRoutes('*');
  }
}
```

Binding request DbContext on demand

If you need the context on req for later cleanup, set it in an interceptor or guard:

```ts
// dbcontext.interceptor.ts
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DB_CONTEXT } from './database.tokens';

@Injectable()
export class DbContextInterceptor implements NestInterceptor {
  constructor(@Inject(DB_CONTEXT) private readonly ctx: any) {}
  intercept(ctxExec: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctxExec.switchToHttp().getRequest();
    req[DB_CONTEXT] = this.ctx; // attach for middleware cleanup if needed
    return next.handle().pipe(tap());
  }
}
```

Usage in a Service & Controller

```ts
// user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDbContext } from './database.decorators';
import { AppDbContext } from './app-db-context';

@Injectable()
export class UserService {
  constructor(@InjectDbContext() private readonly ctx: AppDbContext) {}

  async listUsers() {
    return await this.ctx.users.toArray();
  }
}

// user.controller.ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { DbContextInterceptor } from './dbcontext.interceptor';

@Controller('users')
@UseInterceptors(DbContextInterceptor)
export class UserController {
  constructor(private readonly users: UserService) {}
  @Get()
  async list() { return await this.users.listUsers(); }
}
```

App Module

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UserService],
})
export class AppModule {}
```

Testing Tips

- Use ConfigModule with a test `.env`
- For unit tests, mock `DB_CONTEXT` provider with an in‑memory provider (e.g., SQLite)
- Ensure interceptor/middleware attach/cleanup logic does not leak contexts

Notes

- Scope.REQUEST provides isolation per request. For background jobs, register a separate module using Scope.DEFAULT (singleton) or create/dispose contexts within the job handler.
- Consider adding a health check that validates DB connectivity via `ctx.provider.connect()`.


