# Contributing

1. Fork, then create a branch: `feat/...`, `fix/...` or `docs/...`.
2. `npm ci`, copy `.env.example` to `.env`, start PocketBase (`docker compose -f pocketbase/docker-compose.yml up -d`).
3. Before opening a PR run `npm run typecheck`. When you add UI text, add the key to **every** file in `locales/`.
4. Use Conventional Commits (`feat:`, `fix:`, `docs:`). One PR = one change; add screenshots for UI changes.
5. Never commit secrets, personal data or real photos.

Report bugs and ideas through [Issues](../../issues/new/choose). Security issues: see [SECURITY.md](SECURITY.md).
