# STEP22KX — Operator Launch Pack

Další stabilizační balík nad STEP22KW Production Readiness Pack. Cíl není přidat další autonomii, ale připravit praktický start show v kontrolovaném režimu.

## Přidáno

- Nová sekce **Operator Launch** v Show OS.
- Režimy **DRY RUN**, **LIVE LOW BRIGHTNESS**, **LIVE ARMED**.
- Ruční **ARM / DISARM / SAFE** logika.
- Launch preflight nad QA, Production, Health, Stability a Control Authority stavem.
- Live quick actions: Safe Calm, Freeze Director, Low Brightness, Send Launch Bridge.
- Watch signály pro stale fallback, runtime pressure, blackout a nečekané chování.
- Export launch reportu.
- `budilight.operator.launch.bridge` payload v localStorage.

## Princip

Launch Pack nic nepřebírá sám. Je to operátorský panel. LIVE_ARMED znamená jen připravenost v UI a payloadu. Fyzický output pořád řídí existující output route a operátor.

## Doporučený test

1. Spustit `npm start`.
2. Otevřít `/show-os.html`.
3. Jít do **Final QA** a spustit RUN FINAL QA.
4. Jít do **Production Ready** a spustit RUN PRODUCTION CHECK.
5. Jít do **Operator Launch** a spustit RUN LAUNCH PREFLIGHT.
6. Nejdřív testovat **DRY RUN**.
7. Potom **LIVE LOW BRIGHTNESS**.
8. Teprve nakonec **LIVE ARMED** + ARM.
9. Při problému použít **DISARM / SAFE** nebo **SAFE CALM**.

## Kontrola

- `npm run check:js` prošlo.
- Změny jsou nedestruktivní.
- Předchozí Production/QA/Health/Physics moduly zůstávají zachované.
