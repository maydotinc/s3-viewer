#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
   echo "DATABASE_URL is not set. Point it at a PostgreSQL 14+ database." >&2
   exit 1
fi

# This script is pid 1 until the exec at the bottom, so without a trap a
# `docker stop` during the wait or the migration is ignored until the timeout.
child=""

stop() {
   if [ -n "$child" ]; then
      kill -TERM "$child" 2>/dev/null || true
   fi
   exit 143
}

trap stop TERM INT

# Runs a command in the background and waits on it, which is what lets the trap
# above fire while it is still running. The status is forwarded so this also
# works as a loop condition.
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
   # A unix-socket connection string carries no host to knock on, so there is
   # nothing to wait for; prisma below reports it if the socket is not there.
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

echo "Applying database migrations ..."
run node /app/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma

exec node /app/dist/server.js
