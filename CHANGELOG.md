# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Pre-release. Nothing has shipped under a version tag yet; changes accumulate
here until the first release.

### Security

- Storage endpoints written as IPv4-mapped or IPv4-compatible IPv6 literals
  (`[::ffff:a9fe:a9fe]`, `[::7f00:1]`) are now rejected. They previously slipped
  past the private-address filter and could reach loopback and cloud metadata.
- A stored endpoint is re-checked whenever its S3 client is built, so servers
  created before this release are covered too.
- `http://` endpoints are accepted only when `NODE_ENV` is explicitly
  `development` or `test`; an unset `NODE_ENV` no longer opts into cleartext.
- Bucket scope is stored explicitly instead of being inferred from an empty
  allow-list, so removing the last allowed bucket can no longer silently widen a
  server to every bucket its credentials can reach.
- Granting bucket access now requires the granting member to hold that access
  themselves, and creating a bucket that already exists no longer grants a
  non-owner access to it.
- Demoting a member clamps their existing per-bucket grants to the new role.
- Sending invitations requires a verified email address, and servers per user
  are capped.
- Object previews of PDFs are sandboxed, matching the text preview.
- Sessions expire 90 days after creation regardless of use.
- OAuth access, refresh and id tokens are no longer stored; nothing read them.
- `better-auth` 1.2.8 → 1.7.2 and `next` 15.4.8 → 15.5.21, both of which carried
  published advisories, plus transitive updates that clear the remaining
  high-severity advisories.

### Removed

- One-time codes and magic links. Email now carries only verification and
  password-reset links, and `POST /auth-flow/start` is gone.

### Added

- Email and password sign-in. Sign-in and sign-up are one flow (a matching
  password signs in, a new address is created with it). Forgot password
  sends a one-hour link; Settings has a Password card to set or change one;
  a verification link goes out on sign-up and can be resent from Settings or
  the invite callouts. Per-address throttles cover password attempts and
  outbound links, and account creation is capped per IP. Connecting a
  server now needs a verified address, setting a first password needs a
  session younger than 24 hours, and a production deploy without a mail
  transport drops messages instead of logging their links.
- An audit log of administrative and destructive actions. See "Data we store" in
  the README for its retention and erasure implications — it is never pruned
  automatically.
- `GET /health`, an `X-Request-Id` header echoed on every response and recorded
  with server errors, and CodeQL and dependency-review workflows.

### Changed

- `MAX_UPLOAD_BYTES` defaults to 5 GiB instead of unlimited, and a declared
  `Content-Length` can no longer push the multipart part size past 64 MiB.
- `EMAIL_FROM` is required in production; there is no default sender.
- `GET /objects/metadata` was removed. `GET /objects/preview-url` returns the
  same fields, halving the S3 calls made when opening an object.
- `POST /objects/exists` answers large batches from listings rather than one
  `HeadObject` per key.

[Unreleased]: https://github.com/maydotinc/s3-viewer/commits/main
