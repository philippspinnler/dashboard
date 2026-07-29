# E-ink Dashboard Companion — Design

**Date:** 2026-07-29
**Status:** Approved

## Goal

Replicate a subset of the dashboard (clock, calendar, inverter) on a Waveshare
7.5" e-Paper display driven by the Waveshare e-Paper ESP8266 Driver Board. The
panel is the 7.5" **V2 black/white, 800×480** (flex marking FPC-C001, UC8179
controller). The board is USB-powered and refreshes roughly once per minute.

## Architecture

Server-rendered image. The existing Nuxt app renders the complete screen as a
1-bit bitmap; the ESP8266 firmware only downloads and displays it. All layout,
fonts, and data access stay in TypeScript on the server, so layout changes
never require reflashing the ESP.

```
Nuxt server ──(compose SVG → rasterize → 1-bit pack)──▶ /api/eink/screen.bin
                                                              │ HTTP GET every 60 s
                                                              ▼
                                     ESP8266 (GxEPD2) ──▶ 7.5" e-paper panel
```

## Components

### Server endpoints (in the existing app)

- `server/api/eink/screen.bin.get.ts` — returns exactly 48,000 bytes
  (800×480 / 8): the frame packed 1 bit per pixel, MSB-first, row-major,
  ready to stream into the panel framebuffer. `Content-Type:
  application/octet-stream`.
- `server/api/eink/screen.png.get.ts` — the same frame as a PNG for browser
  preview and debugging. Works in mock mode like every other endpoint.

### Renderer (`server/utils/eink/`)

- Fetches data by calling the existing handlers internally
  (`$fetch('/api/calendar')`, `$fetch('/api/inverter')`) plus the current
  time in the configured timezone.
- Builds the screen as an SVG string, rasterizes with `@resvg/resvg-js`
  (prebuilt native binary, no extra system deps in the Docker image), then
  thresholds the grayscale output to 1-bit.
- Ships a bundled TTF font (committed to the repo) so text rendering is
  deterministic in Docker; no reliance on system fonts.

### Layout v1 (800×480, landscape)

- **Top band:** large clock (HH:MM) with the date next to it.
- **Left column:** calendar — upcoming events grouped by day
  (Heute/Morgen/weekday), event time + title + calendar name, as many days as
  fit.
- **Right column:** inverter — PV power, house consumption, grid
  import/export, battery SOC and charge/discharge, using the same
  watt/percent semantics as the existing widget.

### Firmware (new subfolder `eink-display/`)

- PlatformIO Arduino project for the Waveshare ESP8266 Driver Board.
  Fixed pin mapping: CS=GPIO15, DC=GPIO4, RST=GPIO2, BUSY=GPIO5,
  SCK=GPIO14, MOSI=GPIO13.
- Display driver: GxEPD2, 7.5" V2 class (GxEPD2_750_T7).
- Loop: every 60 s, HTTP GET `screen.bin`, stream the 48,000 bytes into the
  display buffer, refresh.
- Refresh policy: partial (non-flashing) update each cycle; full refresh
  every 30 cycles to clear ghosting.
- Configuration: WiFi SSID/password and server base URL in a git-ignored
  `config.h`, copied from a committed `config.example.h`.

## Error handling

- Server: if calendar or inverter data fails to load, that section renders a
  small "no data" note; the endpoint always returns a valid full frame.
- Firmware: if the download fails or returns the wrong byte count, skip the
  cycle and keep the last frame. After 10 consecutive failures, draw a small
  offline marker in a corner (firmware-side, the only thing it ever draws
  itself).

## Testing / verification

- Browser preview via `screen.png` in mock mode (no external services
  needed).
- Byte-level check that `screen.bin` is exactly 48,000 bytes and matches the
  PNG content.
- Firmware verified on hardware; build verified via `pio run`.

## Out of scope (v1)

- Other widgets (weather, transport, presence, …) — the architecture makes
  them server-side additions later.
- Battery operation / deep sleep.
- New `NUXT_*` env vars — none needed, so nothing to mirror into the homelab
  compose file.
