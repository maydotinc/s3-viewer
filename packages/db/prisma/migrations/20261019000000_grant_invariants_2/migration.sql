-- a grant without its membership is inert for storage but would be merged back on a later
-- invite accept, so any left over from before the foreign key are dropped first.
DELETE FROM "bucket_access" b
WHERE NOT EXISTS (
  SELECT 1 FROM "server_access" a
  WHERE a."userId" = b."userId" AND a."serverId" = b."serverId"
);

ALTER TABLE "bucket_access" ADD CONSTRAINT "bucket_access_userId_serverId_fkey" FOREIGN KEY ("userId", "serverId") REFERENCES "server_access"("userId", "serverId") ON DELETE CASCADE ON UPDATE CASCADE;

-- credential replacement authorizes by server.ownerId while everything else reads this row's
-- role, so a server has exactly one owner row. prisma cannot express a partial index.
CREATE UNIQUE INDEX "server_access_one_owner" ON "server_access"("serverId") WHERE "role" = 'OWNER';

-- owners reach every bucket implicitly; an OWNER grant or invite would read as bucket admin.
ALTER TABLE "bucket_access"
  ADD CONSTRAINT "bucket_access_role_not_owner" CHECK ("role" <> 'OWNER');

ALTER TABLE "invitation_bucket_access"
  ADD CONSTRAINT "invitation_bucket_access_role_not_owner" CHECK ("role" <> 'OWNER');

ALTER TABLE "pending_invitation"
  ADD CONSTRAINT "pending_invitation_role_not_owner" CHECK ("role" <> 'OWNER');
