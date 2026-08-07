// Copy to config.h and fill in. config.h is git-ignored.
#pragma once

#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"

// Dashboard server base URL, no trailing slash
#define SERVER_BASE_URL "http://192.168.1.10:3000"

// Seconds between full-frame downloads from the server. Between frames the
// clock is redrawn locally every minute (no WiFi traffic), so this can be
// generous — it only bounds how stale calendar/energy/weather data gets.
#define REFRESH_INTERVAL_S 300

// Every Nth server frame does a full (flashing) refresh to clear ghosting
#define FULL_REFRESH_EVERY 30
