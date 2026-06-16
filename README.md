# Dashboard

A self-hosted, single-container [Nuxt 3](https://nuxt.com) dashboard for an
always-on screen. It pulls together everyday information into one view: weather,
calendars, public transport, household presence, Sonos, Netatmo climate, a solar
inverter, and app metrics.

- **Server-rendered UI** — widgets live in `components/widgets/` and are arranged
  into screen regions by `app.vue`.
- **Built-in API** — each data source is a Nitro server route in `server/api/`
  (responses cached via `defineCachedEventHandler`). Served same-origin, so no CORS.
- **Runtime configuration** — every setting (secrets, location, layout) lives in
  `runtimeConfig` (`nuxt.config.ts`) and is overridable at container start via
  `NUXT_*` / `NUXT_PUBLIC_*` env vars. Nothing is baked into the image. See
  [`.env.example`](./.env.example).

## Develop

```bash
npm install

# offline dev with built-in mock data (no external services needed)
NUXT_PUBLIC_USE_MOCK_DATA=true npm run dev

# against real services — copy .env.example to .env, fill it in, then:
npm run dev
```

> The `dev` script sets `TMPDIR=/tmp`. macOS's default `$TMPDIR` is long enough to
> push Nuxt's vite-node unix socket path past the 104-char limit, which breaks
> `nuxt dev` ("Failed to restrict vite-node socket permissions"). `/tmp` is short.

## Build & run

```bash
npm run build
node .output/server/index.mjs        # serves on :3000
```

## Docker

A multi-stage `Dockerfile` produces a small runtime image. On every push to
`main`, GitHub Actions builds and publishes it to Docker Hub as
[`philippspinnler/dashboard`](https://hub.docker.com/r/philippspinnler/dashboard)
(`latest` plus a commit-sha tag).

```bash
# run the published image
docker run -p 3000:3000 --env-file .env philippspinnler/dashboard

# or build locally
docker build -t dashboard .
docker run -p 3000:3000 --env-file .env dashboard
```

Because config is read at runtime, the same image runs anywhere — set the
`NUXT_*` env vars (layout, secrets, location, mock toggle) without rebuilding.

## Layout

Widgets are placed into five regions via comma-separated id lists:
`NUXT_PUBLIC_WIDGETS_TOP_LEFT`, `_TOP_RIGHT`, `_LEFT`, `_RIGHT`, `_BOTTOM`.

Available ids: `clock`, `calendar`, `presence`, `internet`, `netatmo`,
`public-transportation`, `eo-guide`, `weather`, `cars`, `inverter`.

Sonos is not a grid widget — it shows as a now-playing card overlaid in a
configurable corner only while a speaker is playing (`NUXT_PUBLIC_SONOS_OVERLAY_*`,
`NUXT_SONOS_MEDIA_PLAYERS`).

## Notes

- `presence`, `cars` and `inverter` currently have no dedicated data source: their
  routes serve mocks in mock mode and empty payloads otherwise. Wire them to real
  sources (e.g. Home Assistant) in `server/api/{presence,cars,inverter}.get.ts`.
- `sonos` reads Home Assistant `media_player.*` entities (`NUXT_SONOS_MEDIA_PLAYERS`)
  and renders as a corner overlay; the first entity in the `playing` state is shown.
- Drop a `public/tv.jpg` to supply the Sonos "TV playing" artwork (referenced as `/tv.jpg`).
