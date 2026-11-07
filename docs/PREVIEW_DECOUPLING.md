# Preview Decoupling (Skeleton)

Bod 9 oddeluje preview od render/output rizeni.

## Co je zavedeno

- `src/preview/preview_api.js` je cisty consumer API.
- `src/preview/runtime/throttler.js` drzi nezavisly preview FPS budget.
- `src/preview/runtime/presenter.js` izoluje draw sink adapter.

## Pravidla

1. Preview neovlivnuje render/output scheduling.
2. Preview cte `renderFrame` (+ optional `mappedFrames`) a pouze prezentuje.
3. Preview refresh je throttled (`previewFps`) nezavisle na output FPS.

## Stav/telemetrie

`preview.getStatus()` vraci:

- `presented`
- `lastMode`
- `lastPresentedAt`
- `throttler` stats (`fps`, `frameMs`, `dropped`)

## Integrace

`src/pipeline/orchestrator.js` vola:

- `preview.present(renderedFrame, state.ui, mapped)`
- volitelne zapisuje lehky preview status do `ui` slice.
