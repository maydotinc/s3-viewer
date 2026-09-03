ALTER TABLE "invitation_bucket_access" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "invitation_bucket_access" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "pending_invitation" DROP CONSTRAINT "pending_invitation_invitedById_fkey";

ALTER TABLE "pending_invitation" ADD CONSTRAINT "pending_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "session_userId_idx" ON "session"("userId");

CREATE INDEX "account_userId_idx" ON "account"("userId");

CREATE INDEX "account_providerId_accountId_idx" ON "account"("providerId", "accountId");

CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

CREATE INDEX "verification_expiresAt_idx" ON "verification"("expiresAt");

CREATE INDEX "pending_invitation_serverId_idx" ON "pending_invitation"("serverId");
