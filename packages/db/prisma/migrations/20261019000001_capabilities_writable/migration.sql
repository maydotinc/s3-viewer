-- the four per-operation flags were always written with one value, so rows keep a single writable flag.
UPDATE "server"
SET "capabilities" = jsonb_build_object(
  'writable', COALESCE(("capabilities"->>'upload')::boolean, false),
  'deleteProtection', "capabilities"->'deleteProtection',
  'notice', "capabilities"->'notice'
)
WHERE "capabilities" ? 'upload';
