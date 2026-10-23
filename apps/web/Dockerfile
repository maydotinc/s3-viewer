ARG TURBO_VERSION=2.10.12

FROM node:26.12.0-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV npm_config_node_linker=hoisted
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
ARG TURBO_VERSION
RUN pnpm dlx turbo@${TURBO_VERSION} prune web --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter web build

FROM node:26.12.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT||3000}/api/health`).then(r=>process.exit(r.ok?0:1)).catch(e=>{console.error(e.message,e.cause?.message??\"\");process.exit(1)})"]

CMD ["node", "apps/web/server.js"]
