# Central State Store (Skeleton)

Bod 4 zavadi centralni store vrstvu bez zasahu do legacy runtime.

## Umisteni

- `src/state/store.js` - subscribe/get/set/select
- `src/state/actions.js` - write-only actions
- `src/state/selectors.js` - read-only selectors
- `src/state/initial_state.js` - slices
- `src/state/central_state.js` - factory

## Slice rozdeleni

- `runtime`
- `render`
- `mapping`
- `output`
- `ui`

## Pravidla toku

`UI -> actions -> store -> selectors -> engine APIs`

- UI nesmi mutovat state primo.
- Render/output/map cte jen pres selectors/snapshot.
- Side effecty se drzi mimo reducers (actions jen patchuji state).

## Minimal usage

```js
import { createCentralState } from "../src/state/index.js";

const central = createCentralState();
central.actions.setUi({ previewMode: "shader" });
const snapshot = central.selectors.pipelineSnapshot(central.store.getState());
```
