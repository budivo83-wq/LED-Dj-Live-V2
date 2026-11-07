# STEP37BC – Server Output Registry

Cíl: doplnit backendovou ochranu fyzického výstupu ke klientskému Output Route Registry z STEP37BB.

## Co se změnilo

- Přidán serverový registry modul:
  - `src/server/server_output_registry_37bc.js`
- ArtNet live sender se registruje jako fyzický writer:
  - owner: `artnet-sync-live-sender-22dq`
  - kind: `artnet-udp`
- Safe AA serial WebSocket cesta je blokovaná, pokud má serverový output lock aktivní ArtNet owner.
- Přidán debug/status endpoint:
  - `GET /api/output/server-route-registry`
- Status ArtNet live senderu obsahuje:
  - `serverOutputRegistry37BC`

## Proč

Předchozí krok hlídal hlavně browser/runtime vrstvu. Tahle verze přidává stejný princip na server: když běží ArtNet UDP live writer, náhodná serial/legacy cesta nesmí současně sáhnout na fyzický výstup.

## Očekávaný stav při ArtNet live

`/api/output/server-route-registry` by měl ukazovat:

```json
{
  "active": true,
  "owner": "artnet-sync-live-sender-22dq",
  "kind": "artnet-udp"
}
```

Pokud se během ArtNet live pokusí zapisovat serial WS cesta, registry zvýší `deniedCount` / `conflictCount` a write se odmítne.

## Bezpečnost změny

- Nemění se samotné skládání ArtNet packetů.
- Nemění se mapping.
- Nemění se FrameBus.
- Přidává se pouze rozhodovací brána před fyzickým zápisem.
