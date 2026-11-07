# STEP22FY Operator cleanup

Cíl: uklidit projekt pro normální používání, bez viditelného chaosu testovacích stránek a historických STEP tlačítek.

## Přesunuto do archivu

Počet položek: 553

Archiv: `archive/operator_cleanup_step22fy/`

## Zachováno

- `server.js`
- `src/server/*` backend routy
- `public/index.html` performance
- `public/settings.html` settings
- `public/mapping.html` mapping
- `public/animations.html` galerie
- Arduino receiver pro ESP32D 4×300 na GPIO 4/5/12/13

## Provozní filozofie

Serial a ArtNet už nejsou samostatné test stránky. Jsou přístupné přes Settings jako normální výstupní režimy. Testovací nástroje zůstávají v archivu nebo v backendu pro pozdější servis, ale nejsou v běžné navigaci.
