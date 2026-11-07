# STEP22KT — Cleanup Pass 3 / Test Mode Polish

Další praktický cleanup krok nad STEP22KS. Cíl není přidávat další lore/AI vrstvy, ale připravit aplikaci na reálné testování a následné ladění výkonu.

## Přidáno

- nová SHOW OS sekce `Cleanup Pass 3 / Test Mode Polish`
- testovací režimy `FAST`, `GUIDED`, `BURN-IN`
- Session Checklist pro první průchod aplikací
- Risk Register pro UI bloat, runtime pressure, autopilot feeling a physics overload
- Routing Summary navázaný na Pass 2 LIVE/TEST/FULL mapu
- Release Gates před dalším větším refaktorem
- Operator Runbook pro testování
- export `budilight-step22kt-cleanup-pass3-test-polish.json`

## Zásada

Tento krok nic nemaže a nepřebírá řízení show. Pouze zpřehledňuje testovací postup a připravuje podklady pro výkonové/stabilitní ladění.

## Doporučený test

1. `npm install` pokud chybí balíčky.
2. `npm run check:js`
3. `npm start`
4. SHOW OS → Cleanup Pass 2 → RUN PASS 2
5. SHOW OS → Cleanup Pass 3 → RUN PASS 3
6. Stability Scan + Health Scan
7. Projít Performance, Sequencer, Show OS, Mapping, Settings.
8. Exportovat Health Report + Pass 3 payload před další úpravou.
