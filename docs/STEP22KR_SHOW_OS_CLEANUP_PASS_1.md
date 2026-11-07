# STEP22KR — SHOW OS Cleanup Pass 1

Cíl: zastavit expanzi funkcí a připravit appku na společné ladění výkonu, stability a UX.

## Přidáno

- Nová sekce **Cleanup Pass 1** v Show OS.
- UI režimy **BEGINNER / PRO / DEBUG**.
- Bezpečné schování advanced sekcí bez mazání kódu.
- Operator contracts: Operator First, No destructive cleanup, Bridge only, Scalable UI, Performance safety.
- Export payloadu `budilight.cleanup.pass1`.
- Praktický test plán pro první běh.

## Zásady

1. Nic nemažeme jako první krok.
2. Funkce se nejdřív archivují, skrývají nebo oddělují.
3. Performance renderer zůstává samostatný.
4. Show OS posílá intent/bridge, neřídí pixely přímo.
5. Operator má vždy vyšší prioritu než Director nebo automatika.

## Test

```bash
npm install
npm run check:js
npm start
```

Pak otevři `http://localhost:8090/show-os.html` a spusť **Cleanup Pass 1**.
