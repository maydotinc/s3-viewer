-- Better Auth 1.7 keys every account by (issuer, accountId). Existing rows are
-- backfilled with the synthetic issuers it uses for providers without one:
-- `local:credential` for password accounts, `local:oauth:<providerId>` for
-- OAuth providers such as GitHub.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

UPDATE "account"
SET "issuer" = CASE
   WHEN "providerId" = 'credential' THEN 'local:credential'
   ELSE 'local:oauth:' || "providerId"
END
WHERE "issuer" IS NULL;

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
