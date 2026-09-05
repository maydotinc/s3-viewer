# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email [info@may.inc](mailto:info@may.inc?subject=S3%20Viewer%20security) with:

- "S3 Viewer" in the subject line,
- a description of the issue and its impact,
- steps to reproduce (a proof of concept helps),
- any suggested fix.

## What to expect

- Acknowledgement within 3 business days.
- A fix or a mitigation plan within 90 days of the report.
- Coordinated disclosure: we ask that you keep the report private for up to
  90 days, and we will credit you in the fix unless you prefer otherwise.

## Known limitations

- Storage endpoints are re-checked on every connection, not just once:
  besides the up-front check when a server is connected, its credentials
  change, or its cached S3 client is rebuilt, the same public/private
  address rules run as a custom `dns.lookup` on the shared http/https agents
  every S3 client connects through (`apps/api/lib/s3/client-cache.ts`), so a
  hostname whose DNS answer changes to a private address after the initial
  check (DNS rebinding) is still rejected when a socket actually connects.
  This protects against DNS-based SSRF specifically, not against every route
  a misconfigured or malicious endpoint could reach — self-hosters on a
  private network should still run the API in a segment that cannot reach
  internal services, as defense in depth.

## Supported versions

Only the latest `main` is supported. There are no backports.
