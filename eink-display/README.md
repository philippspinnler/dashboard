# 🪶 E-ink display companion

An ESP8266 + Waveshare 7.5" e-Paper panel showing a black-and-white
subset of the dashboard: clock, today's weather (icon + low/high),
calendar (with a gift/heart icon for birthdays and anniversaries), solar
inverter, who's home
(away people shown in a dithered "grey"), internet speed, heat-pump
status (Aus/Heizt/Kühlt + Vorlauf temp), and Netatmo inside/outside
temperature — plus a warnings box
that appears only when something needs attention. The
screen is rendered **server-side** by the main app; the firmware
downloads `/api/eink/screen.bin` (800×480, 1 bit/pixel) every few
minutes and streams it to the panel. Between frames the clock keeps
ticking **locally**: a glyph strip (`/api/eink/clock.bin`, fetched once
at boot) holds the server-rendered pixels for `0`–`9` and `:`, and each
minute the firmware composes HH:MM and partial-refreshes just the clock
window — no WiFi traffic, pixel-identical to a server frame.

> The panel is physically 1-bit black/white, so "grey" is a halftone
> dither, not true grayscale — the layout stays crisp black text with a
> lighter dot pattern for de-emphasised items.

## Hardware

- Waveshare **e-Paper ESP8266 Driver Board** (onboard ESP-12F, 24-pin FPC connector)
- Waveshare **7.5" e-Paper V2** panel, black/white, 800×480 (flex marking FPC-C001)

Connect the panel's flex cable to the driver board's connector (lift the
black latch, insert contacts-down, close the latch). No wiring — the pin
mapping is fixed by the board (CS 15, DC 4, RST 2, BUSY 5).

## Endpoints (served by the main app)

| Endpoint | Purpose |
| --- | --- |
| `/api/eink/screen.bin` | Raw 48,000-byte 1-bit frame for the ESP (plus an `x-eink-time` header the firmware syncs its clock from — no NTP) |
| `/api/eink/screen.png` | Same frame as PNG — open in a browser to preview |
| `/api/eink/clock.bin` | Clock glyph strip: 16-byte geometry header + ten 48×64 digit cells + one 24×64 colon cell (format: `server/utils/eink/clockstrip.js`) |

## Flashing

1. Install [PlatformIO](https://platformio.org) (`brew install platformio` or the VS Code extension).
2. `cp src/config.example.h src/config.h` and fill in WiFi credentials and the dashboard server URL.
3. Connect the board via micro-USB. macOS may need the CH340/CP210x USB-serial driver for older board revisions.
4. Build and flash: `pio run -t upload` (auto-detects the serial port; use `--upload-port /dev/cu.usbserial-XXXX` if you have several).
5. Watch it boot: `pio device monitor` — you should see WiFi connect, then `frame 1 drawn (full refresh)`.

## Behavior

- Downloads a full frame every 5 min (`REFRESH_INTERVAL_S`) with a
  non-flashing (differential) update; every 30th frame is a full
  flashing one to clear ghosting.
- In between, the clock is redrawn locally each minute from the cached
  glyph strip — a partial refresh of just the clock window, no network.
  Time comes from the `x-eink-time` header on `screen.bin` and advances
  on `millis()` between fetches, so the clock keeps ticking even while
  the WiFi or server is down.
- If the server is unreachable, the rest of the last frame stays on
  screen; after 10 consecutive failures a small "offline" badge appears
  top-right.
- Layout changes are server-side only (`server/utils/eink/layout.js`) —
  no reflashing needed. The one exception is the clock geometry (`CLOCK`
  in layout.js): it is mirrored in `src/main.cpp`, and the firmware
  verifies it against the `clock.bin` header — on mismatch it logs
  `clock.bin geometry mismatch` and falls back to server-frame-only
  updates until reflashed.
- Sections auto-hide: each right-column block (Energie, Internet, Heizung,
  Netatmo) only appears when its data source is configured and present, so
  the panel adapts to any setup — no heat pump, no solar inverter, etc.
  just leaves that block out and reflows the rest up.

## Troubleshooting

- **Inverted image (black background):** panel/firmware bit convention
  mismatch — pass `true` for the `invert` parameter in the
  `writeImage`/`writeImageAgain` calls in `src/main.cpp`.
- **Blank screen, BUSY timeout in the serial log:** flex cable not seated
  or latch open.
- **`screen.png` looks right but the panel shows garbage:** confirm
  `curl -s $SERVER/api/eink/screen.bin | wc -c` prints 48000.
