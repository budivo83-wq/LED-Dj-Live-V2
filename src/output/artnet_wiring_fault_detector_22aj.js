import { createMarkerSequenceOperatorGuide22AI } from './artnet_marker_sequence_22ah.js';

const FAULT_CATALOG = Object.freeze([
  {
    id: 'STRIP_ORDER_SWAP',
    severity: 'high',
    symptom: 'Ve fázích 0–7 svítí vždy celý strip, ale číslo fyzického stripu neodpovídá fázi.',
    likelyCause: 'Prohozené fyzické výstupy, strip index v mapování, nebo pořadí portů na receiveru/node.',
    checkPhases: [0,1,2,3,4,5,6,7],
    fix: 'Oprav strip router / output port pořadí. Shader ani ArtNet packetizér neřeš, pokud celý strip svítí správně, jen na špatném místě.'
  },
  {
    id: 'UNIVERSE_PAIR_SWAP',
    severity: 'high',
    symptom: 'Ve fázích 8–15 svítí správný strip, ale opačná polovina 0–149 vs 150–299.',
    likelyCause: 'Prohozené dva universe v rámci jednoho 300px stripu.',
    checkPhases: [8,9,10,11,12,13,14,15],
    fix: 'Pro každý strip drž dvojici universe: strip0 U0/U1, strip1 U2/U3 ... lichý universe musí být druhá půlka.'
  },
  {
    id: 'UNIVERSE_OFFSET',
    severity: 'critical',
    symptom: 'Ve fázích 8–15 svítí jiný strip nebo jiná půlka s pravidelným posunem o jeden universe.',
    likelyCause: 'Start universe je posunutý, typicky ArtNet 0–15 vs sACN 1–16 záměna.',
    checkPhases: [8,9,10,11,12,13,14,15],
    fix: 'Zkontroluj startUniverse. Pro ArtNet používej U0–U15; pro sACN se často mapuje 1–16, ale nesmí se to míchat ve stejné vrstvě.'
  },
  {
    id: 'HALF_STRIP_MISSING',
    severity: 'critical',
    symptom: 'Ve universe chase svítí vždy jen první nebo jen druhá půlka stripu, druhá nikdy.',
    likelyCause: 'Node přijímá jen jeden universe na výstup, špatná length/pixel count konfigurace, nebo limit 150 px místo 300 px.',
    checkPhases: [8,9,10,11,12,13,14,15],
    fix: 'Na nodu/receiveru nastav 300 px na strip a 2 universe po 150 px. Ověř, že oba universe mají 450 DMX bajtů.'
  },
  {
    id: 'REVERSED_STRIP_DIRECTION',
    severity: 'medium',
    symptom: 'Boundary fáze 16–19 ukazují pixel 0 na fyzickém konci pásku a pixel 299 na začátku.',
    likelyCause: 'Strip je fyzicky veden opačným směrem než mapping.',
    checkPhases: [16,17,18,19,20,21,22,23],
    fix: 'Buď otoč fyzickou orientaci v mapování, nebo přidej per-strip reverse flag. Neopravuj to universe offsetem.'
  },
  {
    id: 'RGB_ORDER_WRONG',
    severity: 'medium',
    symptom: 'Stripy/universe sedí, ale barvy neodpovídají: červená je zelená/modrá, cyan je divný odstín.',
    likelyCause: 'Špatné color order RGB/GRB/BRG mezi softwarem, receiverem a LED páskem.',
    checkPhases: [0,1,2,3,4,5,6,7],
    fix: 'Na receiveru nastav správné FastLED COLOR_ORDER. U WS2812B bývá často GRB, ne RGB.'
  },
  {
    id: 'DATA_DROPOUT_OR_POWER_DROP',
    severity: 'critical',
    symptom: 'Tick grid fáze 20–23 nejsou pravidelné, některé části blikají, zhasínají nebo mění barvu podle jasu.',
    likelyCause: 'Napájení, zem, level shifter, signálové rušení, slabý zdroj nebo špatná injektáž.',
    checkPhases: [20,21,22,23],
    fix: 'Nejdřív zkontroluj společnou GND, level shifter SN74HCT, krátké datové vedení, pojistky a napájecí injektáž.'
  }
]);

function buildPhaseFaultMatrix(phases = []) {
  return phases.map((phase) => {
    const category = phase.category || 'unknown';
    const relevantFaults = FAULT_CATALOG.filter(f => f.checkPhases.includes(Number(phase.phase))).map(f => f.id);
    return Object.freeze({
      phase: phase.phase,
      category,
      mustSee: phase.mustSee,
      check: phase.check,
      ifWrongSuspect: Object.freeze(relevantFaults),
      quickDecision: relevantFaults.length ? `Pokud tato fáze nesedí, řeš: ${relevantFaults.join(', ')}` : 'bez speciálního pravidla'
    });
  });
}

function classifyObservation(observation = {}) {
  const text = String(observation.text || observation.note || '').toLowerCase();
  const flags = [];
  if (/jin[yý]|jiny|prohozen|swap|špatn.*strip|spatn.*strip/.test(text)) flags.push('STRIP_ORDER_SWAP');
  if (/p[uů]lka|polovina|149|150|half/.test(text)) flags.push('UNIVERSE_PAIR_SWAP', 'HALF_STRIP_MISSING');
  if (/posun|offset|universe 1|u1|start/.test(text)) flags.push('UNIVERSE_OFFSET');
  if (/opa[cč]n|reverse|konec|za[cč][aá]tek/.test(text)) flags.push('REVERSED_STRIP_DIRECTION');
  if (/barv|rgb|grb|brg|červen|cerven|zelen|modr/.test(text)) flags.push('RGB_ORDER_WRONG');
  if (/blik|drop|výpad|vypad|nap[aá]j|power|ru[šs]en|sum|šum/.test(text)) flags.push('DATA_DROPOUT_OR_POWER_DROP');
  return Object.freeze([...new Set(flags)]);
}

export async function createWiringFaultDetector22AJ(options = {}) {
  const guide = await createMarkerSequenceOperatorGuide22AI(options);
  const observation = options.observation || options.config?.observation || {};
  const matched = classifyObservation(observation);
  const matchedFaults = matched.map(id => FAULT_CATALOG.find(f => f.id === id)).filter(Boolean);
  const priority = matchedFaults.length ? matchedFaults : [
    FAULT_CATALOG.find(f => f.id === 'UNIVERSE_OFFSET'),
    FAULT_CATALOG.find(f => f.id === 'HALF_STRIP_MISSING'),
    FAULT_CATALOG.find(f => f.id === 'STRIP_ORDER_SWAP'),
    FAULT_CATALOG.find(f => f.id === 'REVERSED_STRIP_DIRECTION'),
    FAULT_CATALOG.find(f => f.id === 'RGB_ORDER_WRONG')
  ].filter(Boolean);
  return Object.freeze({
    ok: guide.ok,
    version: 'step22aj-wiring-fault-detector',
    mode: 'marker-sequence-fault-interpretation',
    generatedAt: Date.now(),
    summary: Object.freeze({
      ...guide.summary,
      catalogFaults: FAULT_CATALOG.length,
      matchedFaults: matched.length,
      physicalOutput: false,
      safe: true
    }),
    observation: Object.freeze({
      provided: Boolean(observation && Object.keys(observation).length),
      text: observation.text || observation.note || '',
      matchedFaultIds: Object.freeze(matched)
    }),
    priorityFaults: Object.freeze(priority.map(f => Object.freeze(f))),
    catalog: FAULT_CATALOG,
    phaseFaultMatrix: Object.freeze(buildPhaseFaultMatrix(guide.phases)),
    recommendedOrder: Object.freeze([
      '1) Spusť PHASE 0–7: ověř pořadí fyzických stripů.',
      '2) Spusť PHASE 8–15: ověř vždy první a druhou polovinu každého stripu.',
      '3) Spusť PHASE 16–19: ověř začátek/konec a hranici 149/150.',
      '4) Spusť PHASE 20–23: ověř pravidelnost, výpadky a směr.',
      '5) Až když sedí mapping, řeš shadery a estetiku.'
    ]),
    errors: guide.errors,
    warnings: guide.warnings,
    text: 'STEP22AJ wiring fault detector: interprets STEP22AH/AI marker phases into likely wiring/mapping faults without sending physical output'
  });
}
