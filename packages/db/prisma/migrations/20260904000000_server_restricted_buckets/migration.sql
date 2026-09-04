/*
  Warnings:

  - "server"."restrictedBuckets" replaces the old convention where an empty "allowedBuckets" array meant "this server may reach every bucket the credentials can see". That overload made bucket scope impossible to distinguish from "no buckets are allowed yet": removing the last entry of a scoped server's allowlist silently promoted it to an unscoped server. Scope is now stored explicitly and the array only ever lists which buckets are in scope.
  - Backfill below marks every existing server that currently has a non-empty allowlist as restricted. Servers with an empty allowlist keep restrictedBuckets = false, which preserves exactly what they meant before this migration. No server changes its effective bucket scope.

*/
-- AlterTable
ALTER TABLE "server" ADD COLUMN     "restrictedBuckets" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a non-empty allowlist was the only way to express "restricted to these buckets".
UPDATE "server"
SET "restrictedBuckets" = true
WHERE cardinality("allowedBuckets") > 0;

-- Guard: a restricted server with an empty allowlist would deny every bucket, which no
-- existing row can be after the backfill above. Fail loudly rather than ship that state.
DO $$
DECLARE
   broken TEXT;
BEGIN
   SELECT string_agg("id", ', ' ORDER BY "id")
   INTO broken
   FROM "server"
   WHERE "restrictedBuckets" AND cardinality("allowedBuckets") = 0;

   IF broken IS NOT NULL THEN
      RAISE EXCEPTION 'Restricted servers must list at least one allowed bucket; these rows do not: %', broken;
   END IF;
END $$;
