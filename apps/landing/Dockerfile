FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV npm_config_node_linker=hoisted
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.10.12 prune landing --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Optional: an absolute origin the browser should fetch this site's assets from.
# Unset means they are served under /landing-assets and proxied by the web app.
ARG NEXT_PUBLIC_ASSET_PREFIX=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_ASSET_PREFIX=$NEXT_PUBLIC_ASSET_PREFIX
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter landing build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder --chown=node:node /app/apps/landing/public ./apps/landing/public

USER node
EXPOSE 3001
CMD ["node", "apps/landing/server.js"]
