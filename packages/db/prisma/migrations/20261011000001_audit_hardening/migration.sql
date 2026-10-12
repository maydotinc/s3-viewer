-- CreateIndex
CREATE INDEX "audit_log_serverId_action_createdAt_id_idx" ON "audit_log"("serverId", "action", "createdAt" DESC, "id" DESC);
