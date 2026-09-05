FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.10.12 prune api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter api build

# /out is the runtime tree: api's production closure — which carries the prisma
# CLI, since apps/api depends on it — plus the migrations and a client
# generated against that exact node_modules. next is dropped because it only
# arrives as an auto-installed optional peer of better-auth — 300MB the API
# never imports.
RUN pnpm deploy --filter api --prod --legacy /out \
   && rm -rf /out/node_modules/.pnpm/next@* /out/node_modules/.pnpm/@next+* \
      /out/node_modules/.pnpm/@img+* \
   && cp -R /app/packages/db/prisma /out/prisma \
   && node /out/node_modules/prisma/build/index.js generate --schema=/out/prisma/schema.prisma

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5001
ENV DATA_DIR=/data

COPY --from=builder --chown=node:node /out ./
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data

USER node
VOLUME /data
EXPOSE 5001
ENTRYPOINT ["docker-entrypoint.sh"]
