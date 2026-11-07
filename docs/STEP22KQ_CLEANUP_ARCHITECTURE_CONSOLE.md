# STEP22KQ — Cleanup & Architecture Console

Navazuje na STEP22KP System Health Console.

## Přidáno

- nová sekce **Cleanup Console** v Show OS
- **Architecture Map** pro hlavní vrstvy systému
- **Cleanup Audit** s prioritami
- **Safe Actions** pro nedestruktivní úklid
- **Payload Contract Matrix** pro bridge kontrakty
- **Module Registry** pro přehled aktivních/archivovaných oblastí
- export `budilight-step22kq-cleanup-plan.json`
- localStorage payload `budilight.cleanup.plan`

## Cíl

Neuklízet naslepo. Nejdřív zjistit, co je aktivní, co je bezpečné nechat, co jen schovat a co bude možné později sloučit.

## Zásada

Renderer / Performance zůstává oddělený. SHOW OS posílá intent payloady. Cleanup Console je auditovací a plánovací vrstva, ne automatický refaktor.

## Doporučený postup testu

1. Physics Core → `SEND PHYSICS BRIDGE`
2. Stability Lab → `SEND STABILITY BRIDGE`
3. Health Console → `RUN HEALTH SCAN`
4. Cleanup Console → `RUN CLEANUP AUDIT`
5. Exportuj plán a podle priorit ladíme appku dál.
