# STEP22FQ receiver lock 1000000

Pouzij pouze tento receiver:

`BudiLight_ESP32D_Receiver_4x300_GPIO4_5_12_13_STEP22FQ_LOCK_1000000.ino`

Zamcene nastaveni:

- ESP32D
- OUT1 = GPIO4 = 300 px
- OUT2 = GPIO5 = 300 px
- OUT3 = GPIO12 = 300 px
- OUT4 = GPIO13 = 300 px
- total = 1200 px
- baudrate = `1000000`
- packet = `AA + LEN16 little-endian + RGB`
- LEN16 = `1200` = `B0 04`
- packet bytes = `3603`

Duvod zamku:

Realny test potvrdil, ze 115200 / 230400 / 460800 / 921600 / 1000000 projdou, ale 2000000 a 3000000 selhavaji. Pro provoz proto zamykame stabilni maximum `1000000`.
