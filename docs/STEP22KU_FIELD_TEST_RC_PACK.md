# STEP22KU — Field Test RC Pack

Tento krok přidává Field Test RC panel pro kontrolovaný průchod celé aplikace před finálním úklidem.

## Přidáno

- Field Test RC sekce v Show OS
- DRY RUN / LIVE ROUTE / BURN-IN režimy
- Preflight checklist
- Live test route
- Burn-in plán
- Rollback / Safe Actions
- Export `budilight-step22ku-field-test-rc.json`
- localStorage bridge `budilight.fieldtest.rc`

## Zásada

Žádné destruktivní změny. Neřeže se architektura, dokud nejsou reálná data z testování.

## Co testovat

1. Start serveru
2. Navigace hlavních stránek
3. Show OS → Physics/Stability/Health/Cleanup/Field Test
4. Operator Authority MANUAL/ASSIST a Operator Lock
5. Bridge payloady
6. 15–30 min burn-in

## Rollback

Pokud se UI kouše, přepnout Stability Lab na ECO/SAFE a použít Trim Load.
Pokud show působí moc automaticky, přepnout Authority na MANUAL a zapnout Operator Lock.
