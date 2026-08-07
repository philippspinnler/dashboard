// Copy to config.h and fill in. config.h is git-ignored.
#pragma once

#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"

// Dashboard server base URL, no trailing slash
#define SERVER_BASE_URL "http://192.168.1.10:3000"

// Seconds between display updates
#define REFRESH_INTERVAL_S 60

// Every Nth update does a full (flashing) refresh to clear ghosting
#define FULL_REFRESH_EVERY 30
