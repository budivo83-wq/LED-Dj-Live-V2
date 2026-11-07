# Animation Studio

`public/animations.html` is the dedicated gallery workspace for animation library management, editor work, and the Shadertoy staging sandbox.

## Entry point

- `public/animations.html`
- Navigation links inside the app point to `animations.html` as the Gallery shell view.

## Main areas

### Gallery

- Library grid with thumbnails and isolated selected preview.
- Search, tag filters, compact/detail card toggle, and quick navigation.
- Layer assignment controls for `L1` and `L2`.
- Batch selection and batch operations for visible items.
- Duplicate, archive/restore, reorder, and metadata editing.

### Editor

- Code editor for user animations.
- Import `.js` files and preview compiled code in an isolated runtime.
- Safe overwrite handling: built-in animations cannot be overwritten directly.
- The editor preview area has a draggable split divider and remembers its width locally.

### Shadertoy

- Standalone GLSL staging workspace.
- Import/export of shader drafts.
- Local draft save/restore.
- Validation with actionable error display.
- Preview sandbox that runs in WebGL when possible and falls back to a safe placeholder when the shader fails.
- Bridge transfer to the Editor tab for further transformation.

### Selectors and albums

- Selector manager mirrors the active `L1`/`L2` layer menu.
- Album workspace supports favorites, custom album workflows, and user-import grouping.
- Archived items stay recoverable from the gallery.

## Shadertoy contract

The sandbox preview currently exposes the following uniforms and inputs:

- `iResolution`
- `iTime`
- `iMouse`
- `iFrame`
- `iChannel0`

The preview accepts Shadertoy-style `mainImage(...)` code and can wrap it into a `main()` fragment entry when needed.

## Safety boundaries

- Gallery and editor work stay isolated from the live LED output pipeline.
- Shadertoy preview is sandboxed and does not auto-apply to live runtime.
- Export and bridge transfer are file/editor workflow helpers only.
- Batch operations are restricted to selected gallery items.

## Relevant files

- `public/animations.html`
- `public/animations.css`
- `public/animations.js`
- `public/animations_gallery.css`
- `public/animations_editor.css`
- `public/shadertoy.html`
- `public/shadertoy_sandbox.js`

## Related API endpoints

- `GET /api/animations/library`
- `GET /api/animations/list?layer=l1|l2`
- `POST /api/animations/validate-code`
- `POST /api/animations/save-code`
- `POST /api/animations/update-code`
- `POST /api/animations/update-metadata`
- `POST /api/animations/duplicate`
- `POST /api/animations/set-archived`
- `POST /api/animations/reorder`
- `POST /api/animations/enable-layer`
- `POST /api/animations/disable-layer`

## Recommended reading

- `docs/STEP_7A_ANIMATION_GALLERY_READONLY.md`
- `docs/STEP_7E_ANIMATION_GALLERY_WORKSPACE_TABS.md`
- `docs/STEP_7G_ANIMATION_METADATA_EDITOR.md`
- `docs/STEP_7H_ANIMATION_LIBRARY_MANAGEMENT.md`
- `docs/STEP_7I_ANIMATION_EDITOR_VALIDATION.md`
- `docs/STEP_7J_ANIMATION_GALLERY_THUMBNAILS_PREVIEW.md`
- `docs/STEP_7R_GALLERY_VIEW_FILTERS.md`
- `docs/STEP_7S_EDITOR_LAYOUT_POLISH.md`
- `docs/STEP_8O_GALLERY_EDITOR_LAYOUT_REPAIR.md`
- `docs/STEP_8Q_GALLERY_EDITOR_HARD_RESET.md`
- `docs/STEP_8S_EDITOR_PICKER_CUSTOM_ALBUM.md`
- `docs/STEP_4A_SHADERTOY_WRAPPER.md`
- `docs/STEP_4B_SHADERTOY_COMPILER_GUARD.md`
- `docs/STEP_4I_SHADERTOY_FRAME_VALIDATOR.md`
- `docs/STEP_4Q_SHADERTOY_LAYER_APPLY_REQUEST.md`
