---
name: verify
description: Build/launch/drive recipe for verifying dashboard changes end-to-end
---

# Verifying the dashboard

## Launch

```bash
rm -rf .nuxt/cache/nitro/handlers   # ALWAYS first: dev serves stale cached API responses otherwise
npm run dev                          # background; ready when :3000 answers (~20s)
```

`.env` at the repo root is picked up automatically. `NUXT_PUBLIC_USE_MOCK_DATA=false` there means real mode (live iCal/HA/etc. upstreams).

## Drive

- API widgets: `curl -s http://localhost:3000/api/<name> | python3 -m json.tool` — e.g. `calendar`, `weather`, `warnings`. Responses are Nitro-cached per-handler (calendar: 900s), so restart or clear the cache dir between code edits.
- Full page: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` for a smoke check; real rendering happens client-side in widget components under `components/widgets/`.

## Gotchas

- Pure logic for server handlers lives in `lib/*.js` (plain ESM) — importable directly with `node --input-type=module` from the repo root for isolated repros; `server/api/*.ts` files use Nitro auto-imports and cannot be imported outside the server.
- `rrule` is CJS-only: use default-import interop in `lib/` files so they run both bundled and in plain Node.
