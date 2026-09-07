FROM node:26-alpine AS base
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
# generated against that exact node_modules. dist inlines every @s3-viewer/*
# package, so none of them is imported at runtime; the email stack they reach
# for (react, react-dom, @react-email/*) stays external and is declared in
# apps/api/package.json, so the walk below finds it from api's own manifest.
RUN pnpm deploy --filter api --prod --legacy /out \
   && cp -R /app/packages/db/prisma /out/prisma \
   && node /out/node_modules/prisma/build/index.js generate --schema=/out/prisma/schema.prisma \
   && rm -rf /out/node_modules/@s3-viewer

# `pnpm deploy` copies the store as the workspace resolved it, which includes
# every optional peer someone in the closure declares — next, typescript,
# vitest and the esbuild/rollup/lightningcss binaries behind it. Keep only what
# the top-level packages actually depend on. Required peers count as
# dependencies (@react-email/render cannot render without react-dom); optional
# ones do not, or better-auth alone would drag next and vitest back in — an
# optional peer that is genuinely used, like resend's @react-email/render, is
# declared in apps/api/package.json instead.
RUN node <<'JS'
const { readdirSync, readFileSync, realpathSync, rmSync } = require("node:fs");
const root = "/out/node_modules";
const store = `${root}/.pnpm`;
const keep = new Set();
const seen = new Set();
const resolve = (from, name) => {
   for (const dir of [from, `${store}/node_modules`, root]) {
      try {
         return realpathSync(`${dir}/${name}`);
      } catch {}
   }
};
const entries = (dir) =>
   readdirSync(dir).flatMap((name) =>
      name.startsWith("@") ? readdirSync(`${dir}/${name}`).map((n) => `${name}/${n}`) : name.startsWith(".") ? [] : [name]
   );
const visit = (dir) => {
   if (!dir || seen.has(dir)) return;
   seen.add(dir);
   if (dir.startsWith(`${store}/`)) keep.add(dir.slice(store.length + 1).split("/")[0]);
   let manifest;
   try {
      manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
   } catch {
      return;
   }
   const siblings = dir.replace(/\/(@[^/]+\/)?[^/]+$/, "");
   const meta = manifest.peerDependenciesMeta ?? {};
   const peers = Object.keys(manifest.peerDependencies ?? {}).filter((name) => !meta[name]?.optional);
   for (const name of [...Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies }), ...peers]) {
      visit(resolve(siblings, name));
   }
};
for (const name of entries(root)) visit(resolve(root, name));
for (const id of readdirSync(store)) {
   if (id !== "node_modules" && !keep.has(id)) rmSync(`${store}/${id}`, { recursive: true, force: true });
}
for (const name of entries(`${store}/node_modules`)) {
   try {
      realpathSync(`${store}/node_modules/${name}`);
   } catch {
      rmSync(`${store}/node_modules/${name}`, { force: true });
   }
}
JS

# Prisma ships the query engine three times over (the CLI, @prisma/engines and
# the generated client) and a wasm engine per database on top; the client loads
# the one next to itself and `migrate deploy` only ever runs the schema engine.
RUN <<'SH'
set -e
rm -f /out/node_modules/.pnpm/*/node_modules/@prisma/client/runtime/*.wasm
find /out/node_modules -name 'libquery_engine-*' -not -path '*/.prisma/client/*' -delete
find /out/node_modules \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.md' \) -delete
rm -f /out/dist/*.map
SH

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5001
ENV DATA_DIR=/data
# the entrypoint runs the prisma CLI on every boot; without these it phones
# home and prints an upgrade box in front of the API's own startup logs.
ENV CHECKPOINT_DISABLE=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

COPY --from=builder --chown=node:node /out ./
COPY --chown=node:node apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data

USER node
VOLUME /data
EXPOSE 5001

# travels with the image, so `docker run`, Coolify and Portainer get the same
# health signal compose does. node's fetch keeps curl/wget out of the runtime,
# and the start period has to cover a first boot on a slow host: waiting for
# postgres, then `migrate deploy`.
HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=5 CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT||5001}/health`).then(r=>process.exit(r.ok?0:1)).catch(e=>{console.error(e.message,e.cause?.message??\"\");process.exit(1)})"]

ENTRYPOINT ["docker-entrypoint.sh"]
