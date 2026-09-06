import express from "express";

export const MAX_AUTH_BODY_BYTES = 64 * 1024;

// Better Call 1.4 accepts an already-consumed body as a string. Keep the
// original JSON text for its own validation, but bound every content type
// (and chunked requests) before it can buffer anything. Compressed auth
// bodies are rejected rather than expanded before the limit is applied.
export const authBodyLimit = express.text({
   type: () => true,
   limit: MAX_AUTH_BODY_BYTES,
   inflate: false,
});
