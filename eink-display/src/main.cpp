// E-ink dashboard client for the Waveshare e-Paper ESP8266 Driver Board with a
// 7.5" V2 (800x480 B/W) panel. All layout happens server-side: this firmware
// downloads /api/eink/screen.bin (48,000 bytes, 1bpp, bit 1 = white) and
// streams it to the panel in row bands — the ESP8266 cannot hold a full frame.
//
// Refresh strategy: a differential (non-flashing) refresh each cycle needs the
// controller's "previous frame" RAM to match, so after each refresh the frame
// is streamed a second time via writeImageAgain. Every FULL_REFRESH_EVERY
// cycles a full refresh clears ghosting.
//
// Between server frames the clock keeps ticking locally: a glyph strip
// (/api/eink/clock.bin, fetched once at boot) holds the server-rendered pixels
// for '0'-'9' and ':', and each minute the firmware composes HH:MM into the
// clock window and partial-refreshes just that region — no WiFi traffic, and
// pixel-identical to a server-rendered frame. Time comes from the x-eink-time
// header on screen.bin (no NTP) and advances via millis() between fetches.
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <GxEPD2_BW.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include "config.h"

#if FULL_REFRESH_EVERY < 1
#error "FULL_REFRESH_EVERY must be >= 1"
#endif

// Pin mapping is fixed by the driver board
static const uint8_t PIN_CS = 15;
static const uint8_t PIN_DC = 4;
static const uint8_t PIN_RST = 2;
static const uint8_t PIN_BUSY = 5;

static const uint16_t SCREEN_W = 800;
static const uint16_t SCREEN_H = 480;
static const uint16_t ROW_BYTES = SCREEN_W / 8;                       // 100
static const uint16_t BAND_ROWS = 20;                                 // 2000-byte bands
static const uint32_t FRAME_BYTES = (uint32_t)ROW_BYTES * SCREEN_H;   // 48000

// Clock geometry — must match CLOCK in server/utils/eink/layout.js; the
// clock.bin header carries the server's values and the strip is rejected on
// mismatch, so a layout change can never smear misplaced digits on the panel.
static const uint8_t CLOCK_STRIP_VERSION = 1;
static const uint16_t CLOCK_WIN_X = 24;   // multiple of 8
static const uint16_t CLOCK_WIN_Y = 8;
static const uint16_t CLOCK_WIN_W = 216;  // multiple of 8
static const uint16_t CLOCK_WIN_H = 64;
static const uint16_t CLOCK_DIGIT_W = 48; // 6 bytes
static const uint16_t CLOCK_COLON_W = 24; // 3 bytes
static const uint16_t CLOCK_WIN_ROW_BYTES = CLOCK_WIN_W / 8;            // 27
static const uint16_t CLOCK_DIGIT_ROW_BYTES = CLOCK_DIGIT_W / 8;        // 6
static const uint16_t CLOCK_COLON_ROW_BYTES = CLOCK_COLON_W / 8;        // 3
static const uint16_t CLOCK_DIGIT_BYTES = CLOCK_DIGIT_ROW_BYTES * CLOCK_WIN_H; // 384
static const uint16_t CLOCK_COLON_BYTES = CLOCK_COLON_ROW_BYTES * CLOCK_WIN_H; // 192
// byte offset of each "HH:MM" char cell within a window row (panel x 24, 72, 120, 144, 192)
static const uint8_t CLOCK_CELL_OFFSET[5] = {0, 6, 12, 15, 21};

// Small paged buffer (HEIGHT/8 = 6000 bytes) — only used for the offline marker
GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT / 8> display(GxEPD2_750_T7(PIN_CS, PIN_DC, PIN_RST, PIN_BUSY));

static uint8_t band[ROW_BYTES * BAND_ROWS];
static uint32_t cycle = 0;
static uint32_t failures = 0;
static unsigned long lastAttempt = 0;
static bool offlineMarkerShown = false;

static uint8_t clockDigits[10][CLOCK_DIGIT_BYTES];
static uint8_t clockColon[CLOCK_COLON_BYTES];
static uint8_t clockWin[CLOCK_WIN_ROW_BYTES * CLOCK_WIN_H];
static bool clockStripLoaded = false;
static int16_t minutesOfDay = -1;       // server time at the last frame fetch, -1 = unknown
static unsigned long minutesBaseMs = 0; // millis() when minutesOfDay was set
static int16_t lastDrawnMinute = -1;    // minute currently shown on the panel

static bool readFully(WiFiClient *stream, uint8_t *dst, size_t need) {
  size_t got = 0;
  const unsigned long start = millis();
  while (got < need && millis() - start < 10000) {
    if (stream->available()) {
      got += stream->readBytes(dst + got, need - got);
    } else {
      delay(1);
    }
    yield();
  }
  return got == need;
}

static int16_t currentMinutes() {
  if (minutesOfDay < 0) return -1;
  const uint32_t elapsedMin = (millis() - minutesBaseMs) / 60000UL;
  return (int16_t)(((uint32_t)minutesOfDay + elapsedMin) % 1440UL);
}

// Downloads the frame and writes it into the controller RAM band by band.
// `again` selects the controller's previous-frame RAM (for differential mode).
static bool streamFrame(bool again) {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(15000);
  const char *wantHeaders[] = {"x-eink-time"};
  http.collectHeaders(wantHeaders, 1);
  if (!http.begin(client, String(SERVER_BASE_URL) + "/api/eink/screen.bin")) return false;
  int code = http.GET();
  if (code != HTTP_CODE_OK || http.getSize() != (int)FRAME_BYTES) {
    Serial.printf("GET failed: code=%d size=%d\n", code, http.getSize());
    http.end();
    return false;
  }
  // sync the local minute counter to the time baked into this frame
  const String t = http.header("x-eink-time");
  if (t.length() == 5 && t[2] == ':') {
    minutesOfDay = (int16_t)(t.substring(0, 2).toInt() * 60 + t.substring(3).toInt());
    minutesBaseMs = millis();
  }
  WiFiClient *stream = http.getStreamPtr();
  for (uint16_t y = 0; y < SCREEN_H; y += BAND_ROWS) {
    if (!readFully(stream, band, (size_t)ROW_BYTES * BAND_ROWS)) {
      Serial.printf("short read at row %u\n", y);
      http.end();
      return false;
    }
    if (again) {
      display.epd2.writeImageAgain(band, 0, y, SCREEN_W, BAND_ROWS);
    } else {
      display.epd2.writeImage(band, 0, y, SCREEN_W, BAND_ROWS);
    }
  }
  http.end();
  return true;
}

// Fetches the clock glyph strip (format: server/utils/eink/clockstrip.js).
static bool fetchClockStrip() {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, String(SERVER_BASE_URL) + "/api/eink/clock.bin")) return false;
  int code = http.GET();
  const int expected = 16 + 10 * CLOCK_DIGIT_BYTES + CLOCK_COLON_BYTES;
  if (code != HTTP_CODE_OK || http.getSize() != expected) {
    Serial.printf("clock.bin GET failed: code=%d size=%d\n", code, http.getSize());
    http.end();
    return false;
  }
  WiFiClient *stream = http.getStreamPtr();
  uint8_t header[16];
  bool ok = readFully(stream, header, sizeof(header));
  if (ok) {
    // u16-LE fields at offset 4: winX winY winW winH digitW colonW
    const auto geo = [&](uint8_t i) { return (uint16_t)(header[4 + 2 * i] | header[5 + 2 * i] << 8); };
    ok = header[0] == 'E' && header[1] == 'K' && header[2] == CLOCK_STRIP_VERSION
      && geo(0) == CLOCK_WIN_X && geo(1) == CLOCK_WIN_Y && geo(2) == CLOCK_WIN_W
      && geo(3) == CLOCK_WIN_H && geo(4) == CLOCK_DIGIT_W && geo(5) == CLOCK_COLON_W;
    if (!ok) Serial.println("clock.bin geometry mismatch — server layout changed, reflash firmware");
  }
  for (uint8_t d = 0; ok && d < 10; d++) {
    ok = readFully(stream, clockDigits[d], CLOCK_DIGIT_BYTES);
  }
  if (ok) ok = readFully(stream, clockColon, CLOCK_COLON_BYTES);
  http.end();
  clockStripLoaded = ok;
  if (ok) Serial.println("clock glyph strip loaded");
  return ok;
}

// Composes HH:MM from the glyph strip and partial-refreshes the clock window —
// entirely local, no network. All cell offsets are byte-aligned, so this is
// plain memcpy per row.
static void drawClockLocal(int16_t minutes) {
  const uint8_t chars[5] = {
    (uint8_t)(minutes / 600), (uint8_t)(minutes / 60 % 10), 10,
    (uint8_t)(minutes % 60 / 10), (uint8_t)(minutes % 10),
  };
  for (uint16_t r = 0; r < CLOCK_WIN_H; r++) {
    uint8_t *row = clockWin + r * CLOCK_WIN_ROW_BYTES;
    memset(row, 0xFF, CLOCK_WIN_ROW_BYTES); // white
    for (uint8_t i = 0; i < 5; i++) {
      const bool colon = chars[i] == 10;
      memcpy(row + CLOCK_CELL_OFFSET[i],
             colon ? clockColon + r * CLOCK_COLON_ROW_BYTES : clockDigits[chars[i]] + r * CLOCK_DIGIT_ROW_BYTES,
             colon ? CLOCK_COLON_ROW_BYTES : CLOCK_DIGIT_ROW_BYTES);
    }
  }
  display.epd2.writeImage(clockWin, CLOCK_WIN_X, CLOCK_WIN_Y, CLOCK_WIN_W, CLOCK_WIN_H);
  display.epd2.refresh(CLOCK_WIN_X, CLOCK_WIN_Y, CLOCK_WIN_W, CLOCK_WIN_H);
  display.epd2.writeImageAgain(clockWin, CLOCK_WIN_X, CLOCK_WIN_Y, CLOCK_WIN_W, CLOCK_WIN_H);
  display.epd2.powerOff();
}

static void drawOfflineMarker() {
  display.setPartialWindow(SCREEN_W - 160, 0, 160, 40);
  display.setFont(&FreeMonoBold9pt7b);
  display.setTextColor(GxEPD_BLACK);
  display.firstPage();
  do {
    display.fillRect(SCREEN_W - 160, 0, 160, 40, GxEPD_WHITE);
    display.drawRect(SCREEN_W - 158, 2, 156, 36, GxEPD_BLACK);
    display.setCursor(SCREEN_W - 145, 26);
    display.print("offline");
  } while (display.nextPage());
  display.powerOff();
}

static void onFailure() {
  failures++;
  Serial.printf("update failed (%u consecutive)\n", failures);
  if (failures >= 10 && !offlineMarkerShown) {
    drawOfflineMarker();
    offlineMarkerShown = true;
  }
}

static void updateDisplay() {
  const bool full = (cycle % FULL_REFRESH_EVERY == 0) || offlineMarkerShown;
  if (!streamFrame(false)) {
    onFailure();
    return;
  }
  display.epd2.refresh(!full); // refresh(true) = differential/non-flashing
  // Sync the previous-frame RAM so the next differential refresh has a
  // correct base. A minute-boundary change between the two fetches shows as a
  // tiny artifact that the next full refresh clears.
  if (!streamFrame(true)) {
    onFailure();
    return;
  }
  display.epd2.powerOff();
  failures = 0;
  offlineMarkerShown = false;
  lastDrawnMinute = currentMinutes(); // the frame carries the server-drawn clock
  cycle++;
  Serial.printf("frame %u drawn (%s refresh)\n", cycle, full ? "full" : "partial");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\ne-ink dashboard starting");
  display.init(115200);

  WiFi.mode(WIFI_STA);
  WiFi.hostname("eink-dashboard");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nconnected, IP %s\n", WiFi.localIP().toString().c_str());

  fetchClockStrip();
  updateDisplay();
  lastAttempt = millis();
}

void loop() {
  if (millis() - lastAttempt >= (unsigned long)REFRESH_INTERVAL_S * 1000UL) {
    lastAttempt = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi down, reconnecting");
      WiFi.reconnect();
      onFailure();
      return;
    }
    if (!clockStripLoaded) fetchClockStrip();
    updateDisplay();
    return;
  }
  // between server frames: tick the clock locally on each minute boundary.
  // This deliberately also runs while the server/WiFi is unreachable — the
  // clock stays right (on millis() drift alone) even when everything else
  // on the panel is stale.
  if (clockStripLoaded) {
    const int16_t m = currentMinutes();
    if (m >= 0 && m != lastDrawnMinute) {
      drawClockLocal(m);
      lastDrawnMinute = m;
      Serial.printf("clock %02d:%02d drawn locally\n", m / 60, m % 60);
    }
  }
  delay(100);
}
