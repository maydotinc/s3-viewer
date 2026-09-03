/*
  Warnings:

  - Duplicate "account" rows sharing the same ("providerId", "accountId") are removed before the unique index below is created. A raced OAuth callback could previously create two such rows linked to two different users; this migration keeps the oldest row per pair and deletes the rest, which can revoke a newer user's OAuth sign-in link. Removed rows are preserved in "account_dedupe_backup" for manual recovery.

*/
-- CreateTable
CREATE TABLE "account_dedupe_backup" AS
WITH ranked AS (
    SELECT "id",
           ROW_NUMBER() OVER (
              PARTITION BY "providerId", "accountId"
              ORDER BY "createdAt" ASC, "id" ASC
           ) AS "rn"
    FROM "account"
)
SELECT "account".*
FROM "account"
JOIN ranked ON ranked."id" = "account"."id"
WHERE ranked."rn" > 1;

DELETE FROM "account"
WHERE "id" IN (SELECT "id" FROM "account_dedupe_backup");

-- DropIndex
DROP INDEX IF EXISTS "account_providerId_accountId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");
