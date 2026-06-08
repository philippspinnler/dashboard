# dashboard-nuxt

Single-container [Nuxt 3](https://nuxt.com) app that consolidates the former
`dashboard-api` (FastAPI) and `dashboard-ui` (Vue 3 + Vite) into one codebase.

- **UI** — SSR-rendered dashboard widgets in `components/widgets/`, laid out by `app.vue`.
- **API** — the former FastAPI endpoints, now Nitro server routes in `server/api/`
  (same cache TTLs via `defineCachedEventHandler`). Same-origin, so no CORS.
- **Config** — everything lives in `runtimeConfig` (`nuxt.config.ts`) and is
  overridable at container runtime via `NUXT_*` / `NUXT_PUBLIC_*` env vars.
  See `.env.example`.

> The original `dashboard-api/` and `dashboard-ui/` remain as a working fallback
> and are unaffected by this app.

## Develop

```bash
npm install

# offline dev with built-in mock data (no external services needed)
NUXT_PUBLIC_USE_MOCK_DATA=true npm run dev

# against real services — copy .env.example to .env and fill in, then:
npm run dev
```

> The `dev` script sets `TMPDIR=/tmp` — macOS's default `$TMPDIR` is long enough
> to push Nuxt's vite-node unix socket path past the 104-char limit, which breaks
> `nuxt dev` ("Failed to restrict vite-node socket permissions"). `/tmp` is short.

## Build & run

```bash
npm run build
node .output/server/index.mjs        # serves on :3000
```

## Docker

```bash
docker build -t dashboard-nuxt .
docker run -p 3000:3000 --env-file .env dashboard-nuxt
```

Because config is read at runtime, the same image works anywhere — set
`NUXT_*` env vars (layout, secrets, mock toggle) without rebuilding.

## Layout

Widgets are placed into five regions via comma-separated id lists:
`NUXT_PUBLIC_WIDGETS_TOP_LEFT`, `_TOP_RIGHT`, `_LEFT`, `_RIGHT`, `_BOTTOM`.
Available ids: `clock, calendar, sonos, presence, internet, netatmo,
public-transportation, eo-guide, weather, cars, inverter`.

## Notes / parity caveats

- `presence`, `cars`, `inverter` had no backend in the old API (mock-only). Their
  routes serve mocks in mock mode and empty payloads otherwise — wire to real
  sources (e.g. Home Assistant) when ready (`server/api/{presence,cars,inverter}.get.ts`).
- `sonos` uses `@svrooij/sonos` SSDP discovery; verify on the LAN where it runs.
- Drop a `public/tv.jpg` for the Sonos "TV playing" artwork (referenced as `/tv.jpg`).
