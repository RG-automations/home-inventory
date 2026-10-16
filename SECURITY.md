# Security Policy

## Reporting a vulnerability
**Do not open a public issue.** Use *Security → Report a vulnerability* (GitHub Private Vulnerability Reporting) on this repository.

Include a description, reproduction steps, impact and the affected commit/version. We aim to respond within 7 days and to ship a fix within 30 days.

## Supported versions
Only the latest release from `main`.

## Scope
In scope: code in this repository, PocketBase access rules in `pocketbase/pb_migrations`, configuration in `deploy/`.
Out of scope: your own instance and its configuration.

## Notes for self-hosters
- Never put secrets in `EXPO_PUBLIC_*` variables: they are bundled into the app and visible to every user.
- Serve PocketBase over HTTPS only and protect the admin panel (`/_/`).
