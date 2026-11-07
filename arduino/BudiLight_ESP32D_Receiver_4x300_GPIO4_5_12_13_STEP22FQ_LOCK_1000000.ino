
#include <Arduino.h>
#include <FastLED.h>

/*
  BudiLight ESP32D Receiver - STEP22FQ LOCK BAUD 1000000

  Ucel: potvrdit, ze aplikace opravdu posila validni packet do ESP32.
  Tohle je stabilni provozni receiver po realnem testu baudrate.

  Hardware:
    OUT1 = GPIO4   = 300 px
    OUT2 = GPIO5   = 300 px
    OUT3 = GPIO12  = 300 px
    OUT4 = GPIO13  = 300 px

  Serial:
    baud: 1000000  <-- v aplikaci nastav taky 1000000
    packet: AA + LEN16 little-endian + RGB
    LEN16 = pixels = 1200 = B0 04
    RGB = 3600 bytes
    total = 3603 bytes
*/

#define BAUDRATE 1000000

#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
#define BRIGHTNESS 255
#define BOOT_BRIGHTNESS 70

#define PIN_OUT1 4
#define PIN_OUT2 5
#define PIN_OUT3 12
#define PIN_OUT4 13

#define OUTPUTS 4
#define LEDS_PER_OUTPUT 300
#define TOTAL_PIXELS (OUTPUTS * LEDS_PER_OUTPUT)
#define FRAME_RGB_BYTES (TOTAL_PIXELS * 3)

#define START_BYTE 0xAA
#define EXPECT_PIXELS 1200
#define READ_TIMEOUT_MS 1200
#define IDLE_FLASH_MS 0

CRGB out1[LEDS_PER_OUTPUT];
CRGB out2[LEDS_PER_OUTPUT];
CRGB out3[LEDS_PER_OUTPUT];
CRGB out4[LEDS_PER_OUTPUT];
CRGB* strips[OUTPUTS] = { out1, out2, out3, out4 };

uint8_t frame[FRAME_RGB_BYTES];
uint32_t framesOk = 0;
uint32_t badLen = 0;
uint32_t timeoutCount = 0;

void clearAll(bool showNow = true) {
  fill_solid(out1, LEDS_PER_OUTPUT, CRGB::Black);
  fill_solid(out2, LEDS_PER_OUTPUT, CRGB::Black);
  fill_solid(out3, LEDS_PER_OUTPUT, CRGB::Black);
  fill_solid(out4, LEDS_PER_OUTPUT, CRGB::Black);
  if (showNow) FastLED.show();
}

void bootTest() {
  FastLED.setBrightness(BOOT_BRIGHTNESS);
  clearAll(false); fill_solid(out1, LEDS_PER_OUTPUT, CRGB::Red);    FastLED.show(); delay(350);
  clearAll(false); fill_solid(out2, LEDS_PER_OUTPUT, CRGB::Green);  FastLED.show(); delay(350);
  clearAll(false); fill_solid(out3, LEDS_PER_OUTPUT, CRGB::Blue);   FastLED.show(); delay(350);
  clearAll(false); fill_solid(out4, LEDS_PER_OUTPUT, CRGB::Orange); FastLED.show(); delay(350);
  clearAll(false);
  fill_solid(out1, LEDS_PER_OUTPUT, CRGB::Red);
  fill_solid(out2, LEDS_PER_OUTPUT, CRGB::Green);
  fill_solid(out3, LEDS_PER_OUTPUT, CRGB::Blue);
  fill_solid(out4, LEDS_PER_OUTPUT, CRGB::Orange);
  FastLED.show(); delay(800);
  clearAll(true);
  FastLED.setBrightness(BRIGHTNESS);
}

bool waitForByte(uint8_t& b, uint32_t timeoutMs) {
  uint32_t t0 = millis();
  while (!Serial.available()) {
    if (millis() - t0 > timeoutMs) return false;
    delay(0);
  }
  b = (uint8_t)Serial.read();
  return true;
}

bool findStart() {
  uint8_t b = 0;
  while (true) {
    if (!waitForByte(b, READ_TIMEOUT_MS)) return false;
    if (b == START_BYTE) return true;
  }
}

bool readExact(uint8_t* dst, size_t len, uint32_t timeoutMs) {
  size_t got = 0;
  uint32_t last = millis();
  while (got < len) {
    int n = Serial.available();
    if (n > 0) {
      int want = min((int)(len - got), n);
      int r = Serial.readBytes(dst + got, want);
      if (r > 0) {
        got += (size_t)r;
        last = millis();
      }
    } else {
      if (millis() - last > timeoutMs) return false;
      delay(0);
    }
  }
  return true;
}

void applyFrame() {
  size_t o = 0;
  for (int s = 0; s < OUTPUTS; s++) {
    for (int i = 0; i < LEDS_PER_OUTPUT; i++) {
      uint8_t r = frame[o++];
      uint8_t g = frame[o++];
      uint8_t b = frame[o++];
      strips[s][i].setRGB(r, g, b);
    }
  }
  FastLED.show();
}

void setup() {
  delay(500);
  Serial.begin(BAUDRATE);
  Serial.setTimeout(READ_TIMEOUT_MS);

  FastLED.addLeds<LED_TYPE, PIN_OUT1, COLOR_ORDER>(out1, LEDS_PER_OUTPUT);
  FastLED.addLeds<LED_TYPE, PIN_OUT2, COLOR_ORDER>(out2, LEDS_PER_OUTPUT);
  FastLED.addLeds<LED_TYPE, PIN_OUT3, COLOR_ORDER>(out3, LEDS_PER_OUTPUT);
  FastLED.addLeds<LED_TYPE, PIN_OUT4, COLOR_ORDER>(out4, LEDS_PER_OUTPUT);
  FastLED.setBrightness(BRIGHTNESS);
  clearAll(true);

  Serial.println();
  Serial.println("BDL_BOOT STEP22FQ LOCK_1000000 pins=4,5,12,13 baud=1000000 packet=AA_B0_04_RGB total=3603");
  bootTest();
  Serial.println("BDL_READY set app baudrate to 1000000, close Serial Monitor, then TEST GPIO4");
}

void loop() {
  if (!findStart()) return;

  uint8_t lenLo = 0;
  uint8_t lenHi = 0;
  if (!waitForByte(lenLo, READ_TIMEOUT_MS) || !waitForByte(lenHi, READ_TIMEOUT_MS)) {
    timeoutCount++;
    Serial.println("BDL_ERR timeout_header");
    return;
  }

  uint16_t len = (uint16_t)lenLo | ((uint16_t)lenHi << 8);
  if (len != EXPECT_PIXELS) {
    badLen++;
    Serial.print("BDL_ERR bad_len="); Serial.print(len);
    Serial.print(" lo="); Serial.print(lenLo, HEX);
    Serial.print(" hi="); Serial.println(lenHi, HEX);
    return;
  }

  if (!readExact(frame, FRAME_RGB_BYTES, READ_TIMEOUT_MS)) {
    timeoutCount++;
    Serial.println("BDL_ERR timeout_payload");
    return;
  }

  applyFrame();
  framesOk++;
  Serial.print("BDL_ACK frames="); Serial.print(framesOk);
  Serial.print(" badLen="); Serial.print(badLen);
  Serial.print(" timeout="); Serial.print(timeoutCount);
  Serial.println(" ok=1");
}
