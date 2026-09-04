/*
  Warnings:

  - Drops "account_dedupe_backup", the recovery copy taken by
    20260903000000_account_provider_account_unique before it removed duplicate
    "account" rows. It is not part of the Prisma schema, nothing reads it, and it
    carries "accessToken", "refreshToken", "idToken" and "password" columns, so
    leaving it in place keeps OAuth tokens in plaintext indefinitely.
  - The drop only runs when the table is empty. If it still holds rows, this
    migration fails loudly rather than destroying the only copy of a sign-in link
    that the dedupe revoked: inspect those rows, restore or discard them by hand,
    then re-run. On a database created after that migration the table is empty
    (it captures nothing on a fresh install), so this is a no-op.

*/
DO $$
DECLARE
   remaining BIGINT;
BEGIN
   IF to_regclass('public.account_dedupe_backup') IS NULL THEN
      RETURN;
   END IF;

   EXECUTE 'SELECT count(*) FROM "account_dedupe_backup"' INTO remaining;

   IF remaining > 0 THEN
      RAISE EXCEPTION
         'account_dedupe_backup still holds % row(s). These are duplicate account links removed by 20260903000000; review them, then drop the table manually and re-run.', remaining;
   END IF;

   DROP TABLE "account_dedupe_backup";
END $$;
