# 🪶 E-ink display companion

An ESP8266 + Waveshare 7.5" e-Paper panel showing a black-and-white
subset of the dashboard: clock, calendar (with a gift/heart icon for
birthdays and anniversaries), solar inverter, who's home
(away people shown in a dithered "grey"), internet speed, and heat-pump
status (Aus/Heizt/Kühlt + inside/outside temp) — plus a warnings box
that appears only when something needs attention. The
screen is rendered **server-side** by the main app; the firmware just
downloads `/api/eink/screen.bin` (800×480, 1 bit/pixel) every minute and
streams it to the panel.

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
| `/api/eink/screen.bin` | Raw 48,000-byte 1-bit frame for the ESP |
| `/api/eink/screen.png` | Same frame as PNG — open in a browser to preview |

## Flashing

1. Install [PlatformIO](https://platformio.org) (`brew install platformio` or the VS Code extension).
2. `cp src/config.example.h src/config.h` and fill in WiFi credentials and the dashboard server URL.
3. Connect the board via micro-USB. macOS may need the CH340/CP210x USB-serial driver for older board revisions.
4. Build and flash: `pio run -t upload` (auto-detects the serial port; use `--upload-port /dev/cu.usbserial-XXXX` if you have several).
5. Watch it boot: `pio device monitor` — you should see WiFi connect, then `frame 1 drawn (full refresh)`.

## Behavior

- Refreshes every 60 s with a non-flashing (differential) update; every
  30th refresh is a full flashing one to clear ghosting.
- If the server is unreachable, the last frame stays on screen; after 10
  consecutive failures a small "offline" badge appears top-right.
- Layout changes are server-side only (`server/utils/eink/layout.js`) —
  no reflashing needed.

## Troubleshooting

- **Inverted image (black background):** panel/firmware bit convention
  mismatch — pass `true` for the `invert` parameter in the
  `writeImage`/`writeImageAgain` calls in `src/main.cpp`.
- **Blank screen, BUSY timeout in the serial log:** flex cable not seated
  or latch open.
- **`screen.png` looks right but the panel shows garbage:** confirm
  `curl -s $SERVER/api/eink/screen.bin | wc -c` prints 48000.
