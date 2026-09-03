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
  90 days, and we will credit you in the release notes unless you prefer otherwise.

## Known limitations

- Storage endpoints are checked when a server is connected: the hostname must
  be public and every DNS answer must resolve to a public address. The name is
  resolved once at that moment; a host whose DNS later changes to a private
  address (DNS rebinding) is not re-checked. Self-hosters on a private network
  should run the API in a segment that cannot reach internal services.

## Supported versions

Only the latest `main` is supported. There are no backports.
