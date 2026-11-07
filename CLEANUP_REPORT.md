# LED_Dj_live_clean(27) – Safe Cleanup Report

## Cleanup mode
This package is a **safe structural cleanup** of `LED_Dj_live_clean(27).zip`.

Runtime source code was not intentionally rewritten. The goal was to reduce project noise before deeper refactoring.

## What changed

### 1. Large historical archive removed from active project
The original `archive/` directory was removed from the active package and exported into a separate backup ZIP:

- `LED_Dj_live_clean_27_ARCHIVE_BACKUP.zip`

This keeps the active project smaller and reduces confusion when searching, auditing, or editing the app.

### 2. Old START_HERE notes moved out of root
Older root-level `START_HERE_*.txt` notes were moved to:

- `docs/history/root_start_notes/`

The current/latest note remains in the root:

- `START_HERE_STEP22MH_OUTPUT_FIRST_OPTIMIZATION.txt`

### 3. Active project preserved
The following active areas remain in the cleaned project:

- `server.js`
- `package.json`
- `src/`
- `public/`
- `data/`
- `docs/`
- `scripts/`
- `arduino/`
- `shared/`
- `moje/`

## Important current principle
The current project direction is **output-first**:

- physical LED output has priority
- preview/debug/UI rendering must not compete with ArtNet/Serial output
- avoid multiple active writers to the same output path
- avoid hidden fallback animations that can fight the live frame

## What was NOT changed

- no ArtNet sender logic rewritten
- no mapping logic rewritten
- no performance renderer rewritten
- no sequencer/show-os behavior intentionally changed
- no data profiles deleted
- no `package.json` scripts changed

## Suggested next cleanup phases

### Phase 2 — import/dependency audit
Find files that are not imported or referenced by active HTML/server routes.

### Phase 3 — output path simplification
Confirm there is one authoritative output pipeline:

`Performance / Sequencer / Live Input -> master frame -> output router -> ArtNet/Serial`

### Phase 4 — UI button map
Create a button-by-button inventory for:

1. Performance
2. Settings
3. Mapping
4. Gallery
5. Show OS
6. Control Pro

### Phase 5 — remove dead legacy code inside active files
Only after behavior is verified on hardware.
