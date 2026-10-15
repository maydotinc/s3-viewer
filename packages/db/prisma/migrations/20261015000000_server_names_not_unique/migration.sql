-- server names are display-only, and the per-owner unique index let any admin learn the
-- owner's other server names from rename collisions.
DROP INDEX "server_ownerId_name_key";

-- owner lookups (server count, account deletion, the orphan sweep) used that index's leading column.
CREATE INDEX "server_ownerId_idx" ON "server"("ownerId");
