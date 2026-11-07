import { buildDefaultEightStripUniverseMap, splitRgbByUniverseMap } from './artnet_core.js';

const COLORS = Object.freeze({
  red: [255, 0, 0], amber: [255, 130, 0], yellow: [255, 240, 0], green: [0, 255, 40],
  cyan: [0, 220, 255], blue: [0, 60, 255], violet: [170, 0, 255], magenta: [255, 0, 190],
  white: [255, 255, 255], off: [0, 0, 0]
});
const STRIP_COLORS = Object.freeze([COLORS.red, COLORS.amber, COLORS.yellow, COLORS.green, COLORS.cyan, COLORS.blue, COLORS.violet, COLORS.magenta]);

function byte(v){ const n=Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0; }
function setPixel(rgb, pixel, color){ const o=pixel*3; rgb[o]=byte(color[0]); rgb[o+1]=byte(color[1]); rgb[o+2]=byte(color[2]); }
function scale(color, b){ return color.map(v=>byte(v*b)); }
function sample(rgb, pixel){ const max=Math.floor(rgb.length/3)-1; const p=Math.max(0, Math.min(max, Number(pixel)|0)); const o=p*3; return Object.freeze({ pixel:p, rgb:[rgb[o]||0, rgb[o+1]||0, rgb[o+2]||0] }); }

function makeFrame({ stripCount=8, pixelsPerStrip=300, pixelsPerUniverse=170, phase=0, brightness=0.85 }={}){
  const rgb = new Uint8Array(stripCount*pixelsPerStrip*3);
  const b = Math.max(0.02, Math.min(1, Number(brightness)||0.85));
  const marks=[];
  const phaseIndex = Number(phase)|0;

  for(let s=0;s<stripCount;s++){
    const base=s*pixelsPerStrip;
    const dim=scale(STRIP_COLORS[s%STRIP_COLORS.length], b*0.08);
    for(let p=0;p<pixelsPerStrip;p++) setPixel(rgb, base+p, dim);
  }

  const mode = phaseIndex % 24;
  if(mode < 8){
    const s = mode;
    const base=s*pixelsPerStrip;
    for(let p=0;p<pixelsPerStrip;p++) setPixel(rgb, base+p, scale(STRIP_COLORS[s], b));
    marks.push({ phase:phaseIndex, type:'strip-chase', strip:s, pixels:`${base}-${base+pixelsPerStrip-1}` });
  } else if(mode < 16){
    const universe = mode-8;
    const strip = Math.floor(universe/2);
    const localStart = (universe % 2) * pixelsPerUniverse;
    const base = strip*pixelsPerStrip + localStart;
    for(let p=0;p<pixelsPerUniverse;p++) setPixel(rgb, base+p, scale(COLORS.white, b));
    marks.push({ phase:phaseIndex, type:'universe-chase', universe, strip, localStart, pixels:`${base}-${base+pixelsPerUniverse-1}` });
  } else if(mode < 20){
    const offset = [0, 149, 150, 299][mode-16];
    for(let s=0;s<stripCount;s++){
      const gp = s*pixelsPerStrip + offset;
      setPixel(rgb, gp, COLORS.white);
      if(offset+1<pixelsPerStrip) setPixel(rgb, gp+1, STRIP_COLORS[s]);
    }
    marks.push({ phase:phaseIndex, type:'boundary-scan', localPixel:offset, description:'one marker on every strip at selected boundary pixel' });
  } else {
    const stride = [10, 25, 50, 75][mode-20];
    for(let s=0;s<stripCount;s++){
      for(let p=0;p<pixelsPerStrip;p+=stride) setPixel(rgb, s*pixelsPerStrip+p, COLORS.white);
    }
    marks.push({ phase:phaseIndex, type:'tick-grid', stride });
  }
  return Object.freeze({ rgb, marks:Object.freeze(marks), mode });
}

export async function createMarkerSequence22AH({ config={}, stripCount=8, pixelsPerStrip=300, pixelsPerUniverse=170, startUniverse=0, outputIp='2.1.1.30' }={}){
  const phaseCount = Math.max(1, Math.min(64, Number(config.phaseCount || 24)|0));
  const brightness = config.brightness ?? 0.85;
  const sequenceBase = Number(config.sequence ?? 64) & 0xff;
  const map = buildDefaultEightStripUniverseMap({ stripCount, pixelsPerStrip, pixelsPerUniverse, startUniverse, outputIp, enabled:true });
  const frames=[];
  const errors=[];
  for(let phase=0; phase<phaseCount; phase++){
    const { rgb, marks, mode } = makeFrame({ stripCount, pixelsPerStrip, pixelsPerUniverse, phase, brightness });
    const packets = splitRgbByUniverseMap({ rgb, universeMap:map, sequence:(sequenceBase+phase)&0xff, physical:0 });
    if(rgb.length !== stripCount*pixelsPerStrip*3) errors.push(`PHASE_${phase}_RGB_BYTES_MISMATCH`);
    if(packets.length !== 16) errors.push(`PHASE_${phase}_PACKET_COUNT_${packets.length}`);
    const lit = Array.from(rgb).reduce((acc,v)=>acc+(v>0?1:0),0);
    frames.push(Object.freeze({
      phase, mode,
      rgb,
      summary:Object.freeze({ phase, mode, rgbBytes:rgb.length, framePixels:rgb.length/3, packetCount:packets.length, litBytes:lit, sequence:(sequenceBase+phase)&0xff }),
      marks,
      probes:Object.freeze({
        first: sample(rgb,0), u0End: sample(rgb,149), u1Start: sample(rgb,150), strip0End: sample(rgb,299), last: sample(rgb,stripCount*pixelsPerStrip-1)
      })
    }));
  }
  return Object.freeze({
    ok: errors.length===0,
    version:'step22ah-marker-sequence-runner',
    mode:'dry-run-sequence-build',
    generatedAt:Date.now(),
    summary:Object.freeze({ phaseCount, stripCount, pixelsPerStrip, totalPixels:stripCount*pixelsPerStrip, rgbBytes:stripCount*pixelsPerStrip*3, universeCount:map.universeCount, pixelsPerUniverse, outputIp, sequenceBase }),
    legend:Object.freeze({ phases:'0-7 strip chase, 8-15 universe chase, 16-19 boundary scan 0/149/150/299, 20-23 tick grids', purpose:'manual/fyzická validace pořadí stripů, universe splitu a hranic pixelů bez shaderu' }),
    frames:Object.freeze(frames),
    frameSummaries:Object.freeze(frames.map(f=>Object.freeze({ ...f.summary, marks:f.marks, probes:f.probes }))),
    errors:Object.freeze(errors),
    warnings:Object.freeze([]),
    text:`STEP22AH marker sequence: ${phaseCount} diagnostic frames for ${stripCount}×${pixelsPerStrip}`
  });
}

export async function createMarkerSequenceFrame22AH(options={}){
  const phase = Math.max(0, Number(options.phase || options.config?.phase || 0)|0);
  const sequence = await createMarkerSequence22AH({ ...options, config:{ ...(options.config||{}), phaseCount:Math.max(phase+1, 24) } });
  const frame = sequence.frames[phase % sequence.frames.length];
  return Object.freeze({ ok:sequence.ok, version:'step22ah-marker-sequence-send', phase:frame.phase, rgb:frame.rgb, frameSummary:frame.summary, report:sequence, text:`STEP22AH selected diagnostic phase ${frame.phase}` });
}


function phaseHumanInstruction(phase, mode, marks){
  if(mode < 8){
    return `PHASE ${phase}: musí svítit celý STRIP ${mode} jasnou barvou. Ostatní stripy jen slabě podsvícené. Pokud svítí jiný strip, je prohozené pořadí výstupů nebo mapování stripů.`;
  }
  if(mode < 16){
    const u = mode - 8;
    const strip = Math.floor(u/2);
    const half = (u % 2) === 0 ? 'první polovina pixelů 0–149' : 'druhá polovina pixelů 150–299';
    return `PHASE ${phase}: musí svítit UNIVERSE ${u}, tedy STRIP ${strip} / ${half}. Pokud svítí opačná půlka, je problém na hranici U${u}.`;
  }
  if(mode < 20){
    const px = [0,149,150,299][mode-16];
    return `PHASE ${phase}: na každém stripu musí svítit bod na lokálním pixelu ${px}. Slouží ke kontrole začátku/konce stripu a hranice 149/150.`;
  }
  const stride = [10,25,50,75][mode-20];
  return `PHASE ${phase}: na každém stripu musí být pravidelné bílé tick značky každých ${stride} px. Kontroluj rovnoměrnost, směr a případné výpadky.`;
}

function phaseExpectedView(phase, mode){
  if(mode < 8) return { category:'strip-chase', mustSee:`svítí celý strip ${mode}`, check:'pořadí fyzických výstupů 0–7' };
  if(mode < 16){
    const universe = mode - 8;
    const strip = Math.floor(universe/2);
    const localRange = (universe % 2) === 0 ? '0–149' : '150–299';
    return { category:'universe-chase', mustSee:`svítí strip ${strip}, lokální pixely ${localRange}`, check:`ArtNet universe U${universe}` };
  }
  if(mode < 20){
    const pixel = [0,149,150,299][mode-16];
    return { category:'boundary-scan', mustSee:`jeden ostrý bod na pixelu ${pixel} na všech stripech`, check:'hranice 0/149/150/299 a směr stripu' };
  }
  const stride = [10,25,50,75][mode-20];
  return { category:'tick-grid', mustSee:`tick značky každých ${stride} px`, check:'měřítko, směr a rozpad segmentů' };
}

export async function createMarkerSequenceOperatorGuide22AI(options={}){
  const report = await createMarkerSequence22AH(options);
  const phases = report.frameSummaries.map(f => Object.freeze({
    phase:f.phase,
    mode:f.mode,
    ...phaseExpectedView(f.phase, f.mode),
    instruction:phaseHumanInstruction(f.phase, f.mode, f.marks),
    marks:f.marks,
    probes:f.probes
  }));
  const checklist = Object.freeze([
    'Nejdřív spusť fáze 0–7: musí postupně svítit strip 0,1,2,3,4,5,6,7.',
    'Potom fáze 8–15: každý strip má dvě poloviny, vždy 0–149 a 150–299.',
    'Fáze 16–19: zkontroluj přesné body 0, 149, 150 a 299 na všech stripech.',
    'Fáze 20–23: zkontroluj pravidelné tick značky a případné převrácení směru.',
    'Jakmile něco nesedí, neopravuj shader; řeš mapping, universe order nebo fyzické zapojení.'
  ]);
  return Object.freeze({
    ok: report.ok,
    version:'step22ai-marker-operator-guide',
    mode:'human-readable-marker-sequence-guide',
    generatedAt:Date.now(),
    summary:report.summary,
    checklist,
    phases:Object.freeze(phases),
    errors:report.errors,
    warnings:report.warnings,
    text:`STEP22AI operator guide: ${phases.length} human-readable marker phases for physical 8×300 bring-up`
  });
}
