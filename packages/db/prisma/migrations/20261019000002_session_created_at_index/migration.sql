-- the session sweep also deletes by age, which without this index scans the whole table.
CREATE INDEX "session_createdAt_idx" ON "session"("createdAt");
