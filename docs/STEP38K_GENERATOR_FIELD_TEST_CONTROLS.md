# STEP38K — Generator Field Test Controls

STEP38K adds physical field-test controls directly to the Generator page.

## Goal

Make it possible to validate the real LED chain from the Generator without adding another UDP/ArtNet writer. Field tests render normal 300×8 RGB frames and reuse the existing Generator LIVE MASTER bridge and ArtNet sender chain.

## New files

- `public/runtime/generator_field_tests.js`
- `scripts/test-generator-step38k.mjs`

## Updated files

- `public/generator.html`
- `public/generator.css`
- `public/generator.js`
- `package.json`

## Operator workflow

Open `GENERATOR`, then use panel `07 Field Test Controls`.

Available tests:

- `Single strip solid` — lights one selected strip in one selected color.
- `Universe sweep` — highlights 170/130 px ArtNet universe chunks for 8×300 mapping.
- `First / last pixel probe` — strip start is green, strip end is red, center is blue.
- `RGB order probe` — R/G/B/W zones for color-order checking.
- `Direction probe` — moving white marker plus green start / red end.

Buttons:

- `PREVIEW TEST` renders the test only in Generator preview.
- `PUBLISH IF LIVE` publishes the test only when Generator mode is already `LIVE MASTER`.
- `STOP TEST` stops the active test.
- `COPY TEST REPORT` copies a compact diagnostic report.

## Safety behavior

- STEP38K does not add a new UDP writer.
- Field-test frames use the same Generator MASTER bridge path as normal Generator LIVE.
- In `OFF` or `PREVIEW`, physical output is not touched.
- If a preview-only field test is active while Generator is already in `LIVE MASTER`, live output keeps publishing the normal Generator frame instead of freezing or going stale.
- `PUBLISH IF LIVE` does not auto-arm LIVE MASTER. It only publishes when LIVE MASTER is already active.

## QA

Run:

```bash
npm run check:js
npm run check:full
npm run check:layers
npm run qa:core
npm run test:generator-step38k
```

Full Generator guard chain:

```bash
npm run test:generator-step38e
npm run test:generator-step38f
npm run test:generator-step38g
npm run test:generator-step38h
npm run test:generator-step38i
npm run test:generator-step38j
npm run test:generator-step38k
```
