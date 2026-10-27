import express from "express";

const MAX_AUTH_BODY_BYTES = 64 * 1024;

// Better Call accepts consumed bodies as raw JSON strings; bound them before its parser runs.
const authBodyLimit = express.text({
   type: () => true,
   limit: MAX_AUTH_BODY_BYTES,
   inflate: false,
});

export { authBodyLimit };
