# Backend Architecture

The API is a small NestJS modular monolith. Keep feature boundaries explicit and add abstraction only
when a second real use case requires it.

## Directory Roles

```text
src/
  app.module.ts          # Root composition only
  main.ts                # HTTP bootstrap, security headers, CORS, validation
  config/                # Startup environment validation
  common/                # Shared Nest filters, guards, decorators, DTOs, and errors
  prisma/                # Injectable Prisma client and lifecycle hooks
  modules/
    auth/                # Register, login, refresh, logout, current user
    health/              # Process liveness
    users/               # Public user mapping/query used by auth
```

## Module Rules

1. Add product capabilities under `src/modules/<feature>`.
2. Controllers own HTTP metadata and call services; they do not query Prisma directly.
3. Services own business rules and database operations.
4. Import `PrismaModule` and `SecurityModule` explicitly where required.
5. Export only providers that are an intentional module API.
6. Keep interactive database transactions short; CPU-heavy work stays outside them.
7. Validate environment values during startup, not on the first user request.
8. Add roles or permissions only when the product has a concrete authorization requirement.

## Current Dependency Shape

```text
AppModule
  ├─ ConfigModule
  ├─ ThrottlerModule
  ├─ APP_FILTER: HttpExceptionFilter
  ├─ APP_GUARD: ThrottlerGuard
  ├─ AuthModule
  │   ├─ PrismaModule
  │   ├─ SecurityModule
  │   └─ UsersModule
  └─ HealthModule
```

## Authentication Model

- All accounts have the same application capabilities.
- Access tokens contain only the user ID (`sub`) and are kept in renderer memory.
- Refresh tokens are random opaque values; PostgreSQL stores only their hashes.
- Login revokes the account's previous refresh-token chain.
- Refresh rotates a token exactly once through a conditional database update.
- Passwords use Argon2id; password hashing happens before opening the registration transaction.

## Adding Authorization Later

Do not reintroduce a role column preemptively. First define the protected capability, actors, default
deny behavior, audit requirements, and migration path. Then add the smallest authorization model that
expresses those rules and test it through HTTP and a real PostgreSQL database.
