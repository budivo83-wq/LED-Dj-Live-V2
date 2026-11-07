# STEP22GG refactor audit

## Priorita
Aktuální live řetězec se nesmí rozbít:

`renderer -> master frame -> parallel output router -> Serial / ArtNet`

## Provedeno v této vlně
- Settings UI zredukované na provozní sekce.
- Odstraněné viditelné historické STEP/probe/test panely.
- Opravený konflikt starých CSS pravidel, která schovávala `settings-card-output-routing`.
- Přidaný `npm run audit` pro rychlý přehled největších souborů.

## Co nechat na další vlnu
- Backend rozdělit na `live server core` a `legacy debug API`.
- Debug API registrovat jen při `LED_DEBUG_API=1`.
- Vytáhnout ArtNet/Serial status do jednoho `/api/output/health` endpointu.
- Mapping posílat jako jediný zdroj pravdy pro Serial i ArtNet segmenty.
