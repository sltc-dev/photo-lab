FROM node:22-alpine AS build

WORKDIR /app
ENV COREPACK_HOME=/corepack
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter api... --frozen-lockfile

COPY . .
RUN DATABASE_URL="postgresql://photo_lab:photo_lab@postgres:5432/photo_lab?schema=public" pnpm --filter api prisma generate
RUN pnpm --filter api build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_HOME=/corepack
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

EXPOSE 3000
USER node
CMD ["pnpm", "--filter", "api", "start"]
