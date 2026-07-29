// E-ink dashboard client for the Waveshare e-Paper ESP8266 Driver Board with a
// 7.5" V2 (800x480 B/W) panel. All layout happens server-side: this firmware
// downloads /api/eink/screen.bin (48,000 bytes, 1bpp, bit 1 = white) and
// streams it to the panel in row bands — the ESP8266 cannot hold a full frame.
//
// Refresh strategy: a differential (non-flashing) refresh each cycle needs the
// controller's "previous frame" RAM to match, so after each refresh the frame
// is streamed a second time via writeImageAgain. Every FULL_REFRESH_EVERY
// cycles a full refresh clears ghosting.
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

// Small paged buffer (HEIGHT/8 = 6000 bytes) — only used for the offline marker
GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT / 8> display(GxEPD2_750_T7(PIN_CS, PIN_DC, PIN_RST, PIN_BUSY));

static uint8_t band[ROW_BYTES * BAND_ROWS];
static uint32_t cycle = 0;
static uint32_t failures = 0;
static unsigned long lastAttempt = 0;
static bool offlineMarkerShown = false;

// Downloads the frame and writes it into the controller RAM band by band.
// `again` selects the controller's previous-frame RAM (for differential mode).
static bool streamFrame(bool again) {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, String(SERVER_BASE_URL) + "/api/eink/screen.bin")) return false;
  int code = http.GET();
  if (code != HTTP_CODE_OK || http.getSize() != (int)FRAME_BYTES) {
    Serial.printf("GET failed: code=%d size=%d\n", code, http.getSize());
    http.end();
    return false;
  }
  WiFiClient *stream = http.getStreamPtr();
  for (uint16_t y = 0; y < SCREEN_H; y += BAND_ROWS) {
    const size_t need = (size_t)ROW_BYTES * BAND_ROWS;
    size_t got = 0;
    const unsigned long start = millis();
    while (got < need && millis() - start < 10000) {
      if (stream->available()) {
        got += stream->readBytes(band + got, need - got);
      } else {
        delay(1);
      }
      yield();
    }
    if (got < need) {
      Serial.printf("short read at row %u: %u/%u\n", y, (unsigned)got, (unsigned)need);
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
    updateDisplay();
  }
  delay(100);
}
