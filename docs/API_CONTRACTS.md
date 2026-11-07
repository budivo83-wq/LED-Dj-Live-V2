# API Contracts (Subsystem Boundaries)

Tento dokument fixuje API mezi castmi engine, aby migrace nevedla k novemu couplingu.

## Core

- `createCoreEngineApi()`
- `tick({ now, dt, frame })`
- `on(event, handler) -> unsubscribe`
- `getSnapshot()`

Core neimportuje UI/render/output.

## Render

- `createRenderEngineApi()`
- `render(pipelineSnapshot) -> renderFrame`

Render neobsahuje output transport ani websocket side-effecty.

## Mapping

- `createMappingEngineApi()`
- `map(renderFrame, mappingState) -> mappedOutputFrames[]`

Mapping je prostorovy prekladac, ne renderer.

## Output

- `createOutputEngineApi()`
- `push(mappedFrames, outputState)`
- `getStatus()`

Output je async consumer. Render na nej nesmi cekat.

## Preview

- `createPreviewEngineApi()`
- `present(renderFrame, previewState)`

Preview je read-only consumer pipeline.

## Shared contract types

- `src/contracts/types.js`
  - `EngineFrameContext`
  - `PipelineSnapshot`
  - `RenderFrame`
  - `MappedOutputFrame`
