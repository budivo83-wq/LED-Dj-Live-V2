import { createWiringFaultDetector22AJ } from './artnet_wiring_fault_detector_22aj.js';

const QUICK_FIX_RULES = Object.freeze({
  STRIP_ORDER_SWAP: {
    label: 'Přehozené pořadí stripů / výstupů',
    action: 'Uprav pořadí fyzických portů nebo stripIndex mapping. Nesahej na shader ani paletu.',
    settingsPath: 'Mapping / Output profile / strip port order',
    safeMode: 'dry-run marker sequence phases 0–7',
    patchHint: {
      type: 'stripOrder',
      example: 'stripOrder: [0,1,2,3,4,5,6,7] -> přepiš podle fyzicky rozsvíceného pořadí'
    }
  },
  UNIVERSE_PAIR_SWAP: {
    label: 'Prohozené půlky 0–149 a 150–299',
    action: 'Prohoď lichý/sudý universe pouze uvnitř daného stripu.',
    settingsPath: 'ArtNet universe map / per-strip pair',
    safeMode: 'dry-run universe chase phases 8–15',
    patchHint: {
      type: 'universePair',
      example: 'strip N musí mít U(2N) jako pixel 0–149 a U(2N+1) jako pixel 150–299'
    }
  },
  UNIVERSE_OFFSET: {
    label: 'Posunutý start universe',
    action: 'Srovnej start universe podle protokolu. ArtNet drž U0–U15; sACN typicky 1–16.',
    settingsPath: 'Output profile / startUniverse / protocol numbering',
    safeMode: 'full pipeline validator + universe map report',
    patchHint: {
      type: 'startUniverse',
      example: 'ArtNet: startUniverse=0; sACN: startUniverse=1, ale nikdy nemíchat ve stejné mapě'
    }
  },
  HALF_STRIP_MISSING: {
    label: 'Svítí jen půlka pásku',
    action: 'Nastav 300 px na strip, 2 universe na výstup a payload 450 DMX B na universe.',
    settingsPath: 'Receiver/node pixel count + universe count',
    safeMode: 'pixel probe 0/149/150/299',
    patchHint: {
      type: 'receiverPixelCount',
      example: 'LEDS_PER_STRIP=300, universesPerStrip=2, pixelsPerUniverse=150'
    }
  },
  REVERSED_STRIP_DIRECTION: {
    label: 'Opačný směr pásku',
    action: 'Přidej reverse flag pro konkrétní strip. Neopravuj to posunem universe.',
    settingsPath: 'Mapping / per-strip reverse',
    safeMode: 'boundary scan phases 16–19',
    patchHint: {
      type: 'stripReverse',
      example: 'reverseStrips: { "3": true } pokud strip 3 běží fyzicky opačně'
    }
  },
  RGB_ORDER_WRONG: {
    label: 'Špatné pořadí barev RGB/GRB/BRG',
    action: 'Změň COLOR_ORDER na receiveru nebo v output color transformu.',
    settingsPath: 'Receiver FastLED COLOR_ORDER / Output color order',
    safeMode: 'solid red/green/blue marker',
    patchHint: {
      type: 'colorOrder',
      example: 'WS2812B často GRB; pokud červená svítí zeleně, neřeš mapping, ale color order'
    }
  },
  DATA_DROPOUT_OR_POWER_DROP: {
    label: 'Dropout napájení/dat',
    action: 'Zkontroluj společnou GND, level shifter SN74HCT, krátké data vedení, pojistky a injektáž.',
    settingsPath: 'Hardware, ne software',
    safeMode: 'tick grid phases 20–23 při nízkém jasu a potom postupně zvýšit',
    patchHint: {
      type: 'hardwareChecklist',
      example: 'GND společná, data přes HCT, odpor v sérii u dat, injektáž obou konců dlouhého pásku'
    }
  }
});

function normalizeSeverity(fault) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[String(fault?.severity || 'low')] ?? 3;
}

function buildOrderedFaults(detectorReport = {}) {
  const raw = Array.isArray(detectorReport.priorityFaults) && detectorReport.priorityFaults.length
    ? detectorReport.priorityFaults
    : [];
  return raw
    .map((fault) => ({ ...fault, quickFix: QUICK_FIX_RULES[fault.id] || null }))
    .sort((a, b) => normalizeSeverity(a) - normalizeSeverity(b));
}

function buildDefaultWorkflow(faults) {
  const ids = new Set(faults.map(f => f.id));
  const workflow = [];
  workflow.push('1) Nejdřív nech DRY-RUN a spusť UNIVERSE MAP REPORT + FULL 8×300 PIPELINE VALIDATOR.');
  if (ids.has('HALF_STRIP_MISSING') || ids.has('UNIVERSE_OFFSET') || ids.has('UNIVERSE_PAIR_SWAP')) {
    workflow.push('2) Ověř ArtNet/sACN číslování: ArtNet U0–U15, 150 px/universe, 450 bajtů payload.');
  } else {
    workflow.push('2) Spusť MARKER SEQUENCE 22AH a porovnej fyzické pořadí stripů s OPERATOR GUIDE.');
  }
  if (ids.has('REVERSED_STRIP_DIRECTION')) workflow.push('3) Oprav pouze per-strip reverse, ne universe pořadí.');
  if (ids.has('RGB_ORDER_WRONG')) workflow.push('4) Pak teprve řeš COLOR_ORDER na receiveru.');
  if (ids.has('DATA_DROPOUT_OR_POWER_DROP')) workflow.push('5) Nakonec řeš hardware: GND, level shifter, datový odpor, injektáž, pojistky.');
  workflow.push('Finále: po každé změně spusť znovu PIXEL PROBE 0/149/150/299 a marker phase send pouze v DRY režimu.');
  return workflow;
}

export async function createWiringQuickFix22AK(options = {}) {
  const detectorReport = options.detectorReport || await createWiringFaultDetector22AJ({
    config: options.config || {},
    observation: options.observation || { text: options.observationText || '' },
    outputIp: options.outputIp
  });

  const faults = buildOrderedFaults(detectorReport);
  const suggestions = faults.map((fault, index) => Object.freeze({
    order: index + 1,
    faultId: fault.id,
    severity: fault.severity,
    title: QUICK_FIX_RULES[fault.id]?.label || fault.id,
    symptom: fault.symptom,
    likelyCause: fault.likelyCause,
    doThis: QUICK_FIX_RULES[fault.id]?.action || fault.fix || 'Zopakuj marker test a porovnej s operator guide.',
    where: QUICK_FIX_RULES[fault.id]?.settingsPath || 'Diagnostics',
    verifyWith: QUICK_FIX_RULES[fault.id]?.safeMode || 'Marker sequence dry-run',
    patchHint: QUICK_FIX_RULES[fault.id]?.patchHint || null,
    originalFix: fault.fix
  }));

  const noFaultSuggestion = suggestions.length ? [] : [{
    order: 1,
    faultId: 'NO_MATCH_FROM_TEXT',
    severity: 'info',
    title: 'Textový popis nenašel známou chybu',
    doThis: 'Spusť marker sequence a popiš přesně: který strip, která půlka, jaká barva, jestli směr sedí.',
    where: 'Settings / STEP22AK QUICK FIX',
    verifyWith: 'OPERATOR GUIDE 22AI + FAULT DETECTOR 22AJ'
  }];

  const resultSuggestions = suggestions.length ? suggestions : noFaultSuggestion;

  return Object.freeze({
    ok: true,
    version: 'step22ak-wiring-quick-fix-advisor',
    safety: Object.freeze({
      physicalOutput: false,
      dryRunOnly: true,
      changesApplied: false,
      note: 'Advisor pouze navrhuje opravy. Nic nepřepisuje a nic neposílá na LED výstup.'
    }),
    summary: Object.freeze({
      matchedFaults: Number(detectorReport?.summary?.matchedFaults || 0),
      suggestions: resultSuggestions.length,
      topPriority: resultSuggestions[0]?.faultId || 'none'
    }),
    suggestions: Object.freeze(resultSuggestions),
    recommendedWorkflow: Object.freeze(buildDefaultWorkflow(faults)),
    detectorReport
  });
}
