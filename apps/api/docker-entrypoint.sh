#!/bin/sh
set -e

# started as root (a platform that runs containers as uid 0, --user 0, a root-owned bind mount): own the data dir, then drop to node.
if [ "$(id -u)" = 0 ]; then
   data="${DATA_DIR:-/data}"
   mkdir -p "$data"
   chown -R node:node "$data"
   exec su-exec node "$0" "$@"
fi

if [ -z "$DATABASE_URL" ]; then
   echo "DATABASE_URL is not set. Point it at a PostgreSQL 14+ database." >&2
   exit 1
fi

# PID 1 needs a trap to stop children while waiting for PostgreSQL or migrations.
child=""

stop() {
   if [ -n "$child" ]; then
      kill -TERM "$child" 2>/dev/null || true
   fi
   exit 143
}

trap stop TERM INT

# backgrounding lets the signal trap interrupt wait.
run() {
   "$@" &
   child=$!
   wait "$child"
   status=$?
   child=""
   return "$status"
}

# `new URL()` gives an IPv6 host back in brackets ("[::1]"), which nc rejects.
host=$(node -p 'new URL(process.env.DATABASE_URL).hostname.replace(/^\[|\]$/g, "")' 2>/dev/null || true)
port=$(node -p 'new URL(process.env.DATABASE_URL).port || "5432"' 2>/dev/null || true)

if [ -n "$host" ]; then
   echo "Waiting for postgres at $host:$port ..."
   i=0
   until run nc -z "$host" "$port" 2>/dev/null; do
      i=$((i + 1))
      if [ "$i" -ge 120 ]; then
         echo "Gave up waiting for postgres at $host:$port after 120s." >&2
         exit 1
      fi
      run sleep 1
   done
else
   case "$DATABASE_URL" in
      postgres://* | postgresql://*)
         echo "Skipping the TCP wait: DATABASE_URL names no host."
         ;;
      *)
         echo "DATABASE_URL is not a valid URL (expected postgresql://user:pass@host:5432/db)." >&2
         exit 1
         ;;
   esac
fi

if [ "$RUN_MIGRATIONS" = "false" ]; then
   echo "RUN_MIGRATIONS=false: skipping migrate deploy."
else
   echo "Applying database migrations ..."
   run node /app/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma
fi

exec node /app/dist/server.js
