# photo-lab

Electron + React desktop shell with a NestJS authentication API, Prisma, and PostgreSQL.

The current product scope is intentionally small: every account uses the same capabilities, and
registration requires only an email, username, and password. Invite codes, roles, and administrator
permissions are not part of the current system.

## Stack

- Desktop: Electron, React, React Router, Mantine, TanStack Query, Zustand
- API: NestJS, Prisma, PostgreSQL, JWT access tokens, hashed refresh tokens
- Optional local infrastructure: Redis and MinIO are reserved for later image-processing work
- Deployment target: company Mac mini, reachable over a controlled Tailscale/HTTPS entry point

## Environment

Copy `.env.example` to `.env` for local development and replace the example secrets.

| Variable                      | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                | Prisma PostgreSQL connection string                                  |
| `JWT_ACCESS_SECRET`           | Secret for short-lived access tokens; minimum 16 characters          |
| `JWT_REFRESH_SECRET`          | Secret mixed into stored refresh-token hashes; minimum 16 characters |
| `ACCESS_TOKEN_TTL`            | Access-token lifetime, default `15m`, maximum `24h`                  |
| `REFRESH_TOKEN_TTL`           | Refresh-token lifetime, default `30d`, maximum `366d`                |
| `CORS_ORIGINS`                | Comma-separated allowed renderer origins; required in production     |
| `THROTTLE_LIMIT`              | Default request limit per rate-limit window                          |
| `THROTTLE_TTL_MS`             | Default rate-limit window in milliseconds                            |
| `VITE_API_BASE_URL`           | Desktop build-time API base URL                                      |
| `VITE_ENABLE_QUERY_DEVTOOLS`  | Enables TanStack Query Devtools in local builds                      |
| `NOTIFICATION_PUBLISH_SECRET` | Protects the internal command-line notification publish endpoint     |

## Local Development

```bash
pnpm install
cp .env.example .env
pnpm docker:infra
pnpm db:migrate
pnpm dev:api
pnpm dev:desktop
```

Every user registers through the same flow. There is no seed administrator or default account.

## Production Compose

`docker-compose.yml` is for local development only. Production uses the standalone
`compose.production.yml`, which has no development secret fallbacks, does not publish PostgreSQL,
runs `prisma migrate deploy` before the API, and binds the API to host loopback.

Provide at least these variables through the deployment environment or secret manager:

```bash
POSTGRES_PASSWORD='...'
DATABASE_URL='postgresql://photo_lab:<url-encoded-password>@postgres:5432/photo_lab?schema=public'
JWT_ACCESS_SECRET='...'
JWT_REFRESH_SECRET='...'
CORS_ORIGINS='https://your-controlled-origin.example'
docker compose -f compose.production.yml up -d --build
```

Because the API binds to `127.0.0.1`, expose it through a controlled HTTPS reverse proxy or
Tailscale Serve configuration. Do not point production desktop builds at plain public HTTP.

## Quality Gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:validate
pnpm api:client:check
```

Use `pnpm db:migrate:deploy` rather than `migrate dev` in production or shared test environments.

## Publishing Notifications

With the API running, publish a system or version-upgrade notification from the command line:

- Types: `SYSTEM`, `VERSION_UPGRADE`
- Levels: `INFO`, `WARNING`, `CRITICAL`

```bash
pnpm notification:publish -- \
  --type VERSION_UPGRADE \
  --level WARNING \
  --title "发现新版本 0.2.0" \
  --summary "建议升级以获得最新功能" \
  --content "Photo Lab 0.2.0 已发布，请安排升级。"
```

For example, publish a planned-maintenance system notification:

```bash
pnpm notification:publish -- \
  --type SYSTEM \
  --level WARNING \
  --title "今晚服务维护" \
  --summary "22:00 至 22:30 期间部分功能可能暂时不可用" \
  --content "维护期间请提前保存当前工作，服务恢复后无需重新登录。"
```

Use `--content-file ./release-notes/0.2.0.md` instead of `--content` for longer details. Optional
`--published-at` and `--expires-at` values use ISO 8601 timestamps. The command calls the running API
so the persisted notification and the real-time SSE event are emitted together.

## Project Structure

- Backend module rules: [`docs/backend-architecture.md`](docs/backend-architecture.md)
- Desktop runtime and security rules: [`docs/frontend-architecture.md`](docs/frontend-architecture.md)
- Chinese project guide: [`docs/project-backend-guide.zh-CN.md`](docs/project-backend-guide.zh-CN.md)
