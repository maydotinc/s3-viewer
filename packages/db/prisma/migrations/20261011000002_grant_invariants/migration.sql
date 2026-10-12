-- CHECK cannot hold a subquery, so the per-element rule lives in an immutable
-- function. It mirrors grantFolderSchema in packages/types: every folder ends
-- with "/", never starts with "/", and has no "//" or "." / ".." segment (split on
-- either slash, as hasDotSegment does).
CREATE FUNCTION "grant_folders_valid"(folders text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(folders) AS f
    WHERE f !~ '/$'
       OR f ~ '^/'
       OR f ~ '//'
       OR f ~ '(^|[/\\])\.{1,2}([/\\]|$)'
  )
$$;

ALTER TABLE "bucket_access"
  ADD CONSTRAINT "bucket_access_folders_shape"
    CHECK ("grant_folders_valid"("allowedFolders"));

ALTER TABLE "invitation_bucket_access"
  ADD CONSTRAINT "invitation_bucket_access_folders_shape"
    CHECK ("grant_folders_valid"("allowedFolders"));
