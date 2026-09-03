DO $$
DECLARE
   conflicting_emails TEXT;
BEGIN
   SELECT string_agg(email, ', ' ORDER BY email)
   INTO conflicting_emails
   FROM (
      SELECT DISTINCT email
      FROM "user"
      WHERE lower(trim(email)) IN (
         SELECT lower(trim(email))
         FROM "user"
         GROUP BY lower(trim(email))
         HAVING count(*) > 1
      )
   ) AS dupes;

   IF conflicting_emails IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot lowercase "user"."email": these rows collide once normalized and must be resolved manually before re-running this migration: %', conflicting_emails;
   END IF;

   UPDATE "user" SET email = lower(trim(email)) WHERE email <> lower(trim(email));
END $$;

DO $$
DECLARE
   conflicting_invitations TEXT;
BEGIN
   SELECT string_agg(email || ' (server ' || "serverId" || ')', ', ' ORDER BY email || ' (server ' || "serverId" || ')')
   INTO conflicting_invitations
   FROM (
      SELECT DISTINCT email, "serverId"
      FROM "pending_invitation"
      WHERE (lower(trim(email)), "serverId") IN (
         SELECT lower(trim(email)), "serverId"
         FROM "pending_invitation"
         GROUP BY lower(trim(email)), "serverId"
         HAVING count(*) > 1
      )
   ) AS dupes;

   IF conflicting_invitations IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot lowercase "pending_invitation"."email": these rows collide once normalized and must be resolved manually before re-running this migration: %', conflicting_invitations;
   END IF;

   UPDATE "pending_invitation" SET email = lower(trim(email)) WHERE email <> lower(trim(email));
END $$;
