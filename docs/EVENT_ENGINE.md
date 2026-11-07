# Event Engine (Baseline)

Bod 11 zavadi event engine vrstvu pro automatizace:

- `tick`
- `beat`
- `bar`
- `phrase`

## Soubory

- `src/events/core/bus.js`
- `src/events/scheduler/hierarchy_scheduler.js`
- `src/events/event_engine.js`

## API

- `createEventEngine({ beatsPerBar, barsPerPhrase })`
  - `on(event, handler)`
  - `emit(event, payload)`
  - `tick(now, bpm)`
  - `getState()`
  - `clear()`

## Integrace

`src/pipeline/orchestrator.js` vola `events.tick(now, bpm)` v UPDATE fazi.
