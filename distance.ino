#include <WiFi.h>
#include <vector>
#include <algorithm>
#include <HTTPClient.h>
#include "esp_wifi.h"
#include "esp_sleep.h"

const int trigPin = 5;
const int echoPin = 18;

const char *ssid = "MWN_TP_LINK";
const char *password = "";

// ThingSpeak Configuration
const char* THINGSPEAK_SERVER = "http://api.thingspeak.com/update";
const char* THINGSPEAK_API_KEY = "";

// Configurable intervals (in milliseconds)
const unsigned long readInterval = 10000;     // 10 seconds
const unsigned long reportInterval = 120000;  // 120 seconds
const unsigned long loopDelay = readInterval/2;         // Delay between loop cycles (in ms)

std::vector<float> samples;
unsigned long lastReadTime = 0;
unsigned long lastReportTime = 0;
bool wifiConnected = false;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Start with WiFi OFF to save power
  WiFi.mode(WIFI_OFF);
  Serial.println("Starting with WiFi OFF (power saving mode)");
  
  // Configure light sleep for power saving between sensor reads
  esp_sleep_enable_timer_wakeup(loopDelay * 1000); // Convert ms to microseconds
}

void loop() {
  unsigned long currentTime = millis();

  // Read distance every readInterval
  if (currentTime - lastReadTime >= readInterval) {
    float distance = readDistance();
    samples.push_back(distance);
    Serial.print("Sample ");
    Serial.print(samples.size());
    Serial.print(": ");
    Serial.print(distance);
    Serial.println(" cm");
    lastReadTime = currentTime;
  }

  // Report median every reportInterval
  if (currentTime - lastReportTime >= reportInterval && !samples.empty()) {
    float median = calculateMedian(samples);
    Serial.print("Reporting median: ");
    Serial.print(median);
    Serial.println(" cm");

    // Connect WiFi only when needed
    connectWiFi();
    
    if (wifiConnected) {
      sendToThingSpeak(median);
      
      // Disconnect WiFi immediately after sending to save power
      disconnectWiFi();
    }
    
    samples.clear();
    lastReportTime = currentTime;
  }
  
  // Light sleep to save power between sensor readings
  esp_light_sleep_start();
}

void connectWiFi() {
  if (wifiConnected) return;
  
  Serial.print("Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    delay(100);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println(" Connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" Failed to connect!");
    wifiConnected = false;
  }
}

void disconnectWiFi() {
  if (!wifiConnected) return;
  
  Serial.println("Disconnecting WiFi to save power...");
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  wifiConnected = false;
  
  // Additional power savings
  esp_wifi_stop();
  
  Serial.println("WiFi OFF - Power saving active");
}

float readDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // timeout after 30ms
  return duration * 0.034 / 2;
}

float calculateMedian(std::vector<float> &data) {
  std::sort(data.begin(), data.end());
  size_t size = data.size();
  if (size % 2 == 0) {
    return (data[size / 2 - 1] + data[size / 2]) / 2.0;
  } else {
    return data[size / 2];
  }
}

void sendToThingSpeak(float value) {
    HTTPClient http;
    
    // Build URL with query parameters
    String url = String(THINGSPEAK_SERVER);
    url += "?api_key=" + String(THINGSPEAK_API_KEY);
    url += "&field1=" + String(value, 2);
    
    Serial.println("Sending to ThingSpeak: " + url);
    
    http.begin(url);
    http.setTimeout(5000);
    int httpCode = http.GET();
    
    if (httpCode > 0) {
      String payload = http.getString();
      Serial.println("Response: " + payload);
      Serial.println("Data sent successfully!");
    } else {
      Serial.println("Error sending data: " + String(httpCode));
    }
    
    http.end();
}
