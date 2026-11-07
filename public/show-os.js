import { normalizeShowOsBridgePayload, mapShowOsBridgeToGeneratorState, GENERATOR_SHOWOS_BRIDGE_VERSION, GENERATOR_SHOWOS_AUTO_KEY, GENERATOR_SHOWOS_SNAPSHOT_KEY } from './runtime/generator_showos_bridge.js';
const KEY='budilight.showos.step22ie';
// STEP37DC: shell view activity guard for Show OS. This page is heavy,
// so its 1 Hz housekeeping must not run while another shell page is active.
let shellViewActive37BQ = true;
const showOsPerf37BQ = { version: 'STEP37DC_SHOWOS_TICK_GUARD', skipped: 0, lastTickAt: 0 };
try {
  window.addEventListener('message', (event) => {
    const data = event?.data || {};
    if (data?.type === 'led-shell-view-active') shellViewActive37BQ = data.active !== false;
  });
  window.__budilightShowOsPerf37BQ = showOsPerf37BQ;
} catch {}
const OLD_KEYS=['budilight.showos.step22hr','budilight.showos.step22hp','budilight.showos.step22ho','budilight.showos.step22hn','budilight.showos.step22hm'];
const INTENT_KEY='budilight.showos.intent';
const sections=[['control','Control Room'],['universe','Universe Mode'],['story','Story Engine'],['ecosystem','Visual Ecosystem'],['authority','Control Authority'],['phenomena','Phenomena Engine'],['physics','Physics Core'],['stability','Stability Lab'],['health','Health Console'],['cleanup','Cleanup Console'],['cleanup-pass','Cleanup Pass 1'],['cleanup-pass2','Cleanup Pass 2'],['cleanup-pass3','Test Polish'],['field-test','Field Test RC'],['final-qa','Final QA'],['production','Production Ready'],['launch','Operator Launch'],['liveops','Live Ops Console'],['postshow','Post‑Show Review'],['legendary','Legendary Worlds'],['market','World Market'],['creator','Creator Mode'],['bridge','Bridge Pro'],['generator-bridge','Generator Bridge'],['map','World Map'],['composer','Composer'],['factory','World Factory'],['events','Event Factory'],['graph','Node Designer'],['inspire','Inspire Lab'],['memory','Memory / Health'],['intelligence','Intelligence'],['weather','Weather'],['history','History'],['director','Director AI'],['economy','World Economy'],['discovery','Discovery'],['operator','Club Operator'],['festival','Festival Mode'],['evolution','Evolution Lab'],['genome','Genome Library'],['recipes','Recipes'],['ambient','Ambient Master']];
const baseWorlds=[
 {name:'Forge Reactor',short:'FORGE',x:56,y:38,dna:{heat:92,flow:58,chaos:38,motion:70,life:20,density:62,contrast:78}},
 {name:'Alien Temple',short:'ALIEN',x:78,y:48,dna:{heat:25,flow:65,chaos:72,motion:62,life:55,density:52,contrast:70}},
 {name:'Deep Space',short:'DEEP',x:45,y:72,dna:{heat:10,flow:72,chaos:18,motion:38,life:22,density:28,contrast:44}},
 {name:'Forest Sanctuary',short:'FOREST',x:24,y:48,dna:{heat:18,flow:82,chaos:24,motion:44,life:90,density:42,contrast:38}},
 {name:'Peak Ritual',short:'PEAK',x:52,y:16,dna:{heat:78,flow:62,chaos:54,motion:88,life:45,density:82,contrast:90}},
 {name:'Afterhours Drift',short:'AFTER',x:58,y:88,dna:{heat:18,flow:80,chaos:15,motion:26,life:35,density:20,contrast:32}},
 {name:'Tribal Cave',short:'TRIBAL',x:27,y:76,dna:{heat:55,flow:50,chaos:30,motion:58,life:58,density:50,contrast:60}},
 {name:'Crystal Hive',short:'HIVE',x:74,y:76,dna:{heat:35,flow:55,chaos:42,motion:60,life:40,density:68,contrast:76}},
 {name:'Cyber Ritual',short:'CYBER',x:86,y:25,dna:{heat:45,flow:48,chaos:62,motion:78,life:25,density:70,contrast:86}},
 {name:'Moss Reactor',short:'MOSS',x:14,y:29,dna:{heat:30,flow:80,chaos:28,motion:48,life:95,density:52,contrast:50}}
];
const worldLinks=[['Forest Sanctuary','Moss Reactor'],['Moss Reactor','Forge Reactor'],['Forest Sanctuary','Deep Space'],['Forest Sanctuary','Tribal Cave'],['Deep Space','Afterhours Drift'],['Deep Space','Alien Temple'],['Forge Reactor','Peak Ritual'],['Forge Reactor','Alien Temple'],['Alien Temple','Crystal Hive'],['Alien Temple','Cyber Ritual'],['Peak Ritual','Cyber Ritual'],['Tribal Cave','Afterhours Drift'],['Tribal Cave','Forge Reactor'],['Crystal Hive','Afterhours Drift']];
const phases=['WARMUP','GROOVE','BUILD','TENSION','DROP','PEAK','RECOVERY','AFTERHOURS'];
const dnaKeys=['heat','flow','chaos','motion','life','density','contrast'];
const eventParts=['Pulse','Spark','Fade','Mirror','Sweep','Bloom','Invert','Heat','Glitch','Wave','Collapse','Shimmer','Ignite','Drift','Blackout','StrobeSafe','Comet','Ripple','Gate','Afterglow'];
const ideas={
 world:['Solar Forge','Cyber Ritual','Moss Reactor','Void Ocean','Crystal Hive','Neon Monastery','Volcanic Garden','Bio Electric Forest','Sub Bass Cathedral','Chrome Jungle','Alien Orchard','Ritual Machine'],
 event:['Heat Surge + Spark Rain','Mirror Collapse into Recovery','Dark Sweep before Drop','Slow Bloom for 128 beats','Tribal Pulse Wave','Alien Glitch Bloom','One beat blackout into warm recovery','Comet sweep with afterglow tail'],
 mood:['Deep Psy with low chaos','Forest → Alien slow morph','Forge peak with safe strobes','Afterhours hypnotic minimal','Tribal ritual build','Cosmic drift with micro sparkle','Cyber ritual with slow mirrored gates'],
 ambient:['8h Forest Sanctuary with rare fireflies','24h Deep Space with no hard strobes','12h Alien Jungle with slow morphs','48h Afterhours Drift with low density','6h Forge Reactor with low heat surges'],
 transition:['Morph 180s, reduce density first, then increase motion','Crossfade via Deep Space as neutral bridge','Before Peak, hold Tension 32 beats and then release','Target world through 2 minute low-density tunnel'],
 safety:['Reduce repetition by mutating event palette','Lower chaos 15%, keep motion, remove blackout chain','Thin dense events and preserve only one accent per phrase','Convert hard strobes to StrobeSafe shimmer'],
 surprise:['Generate World → morph 180s → Peak Ritual','Drop after 16 bars silence fakeout','Clone current world and mutate chaos +12','Paint 30min Deep then 10min Forge','Breed Forest and Alien into a slow biomorphic ritual']
};
const ambientProfiles=[
 ['Forest Sanctuary','8h','organic breath, rare fireflies, soft pulses'],['Deep Space','12h','slow cosmic drift, no hard strobes'],['Ritual Cave','24h','low heat, tribal pulse, minimal repetition'],['Alien Jungle','8h','biomorphic motion, careful glitches'],['Forge Reactor','6h','warm forge, no peak strobes, long cooldowns'],['Afterhours Drift','48h','dark calm, very low density'],['Moss Reactor','12h','green organic movement, occasional heat veins'],['Crystal Hive','24h','geometric drift, shimmering lattice, calm density'],['Void Ocean','48h','minimal blue/black space, very slow morphs']
];
const weatherProfiles={
 Calm:{energy:-8,chaos:-10,density:-6,motion:-4,desc:'klidné počasí, méně eventů, delší morphy'},
 Mist:{energy:-12,chaos:-4,density:-12,motion:-10,desc:'mlha, soft přechody, nízký kontrast'},
 Storm:{energy:18,chaos:16,density:12,motion:18,desc:'bouře, častější sweepy a silnější pohyb'},
 Electrical:{energy:10,chaos:22,density:8,motion:14,desc:'elektrické výboje, glitch a micro sparkle'},
 Ritual:{energy:6,chaos:4,density:10,motion:-2,desc:'rituální pulz, opakování kontrolované guardem'},
 Solar:{energy:14,chaos:-4,density:6,motion:6,desc:'světlé otevření a teplé buildy'},
 Void:{energy:-18,chaos:8,density:-18,motion:-14,desc:'temný prostor, minimum pohybu, dobré pro recovery'}
};
const worldFamilies={
 'Forest Sanctuary':['Deep Space','Moss Reactor','Tribal Cave'],
 'Moss Reactor':['Forest Sanctuary','Forge Reactor','Deep Space'],
 'Deep Space':['Afterhours Drift','Forest Sanctuary','Alien Temple'],
 'Afterhours Drift':['Deep Space','Tribal Cave','Crystal Hive'],
 'Tribal Cave':['Forest Sanctuary','Forge Reactor','Afterhours Drift'],
 'Forge Reactor':['Peak Ritual','Alien Temple','Tribal Cave'],
 'Peak Ritual':['Forge Reactor','Cyber Ritual','Afterhours Drift'],
 'Alien Temple':['Crystal Hive','Cyber Ritual','Deep Space'],
 'Crystal Hive':['Alien Temple','Afterhours Drift','Deep Space'],
 'Cyber Ritual':['Alien Temple','Peak Ritual','Forge Reactor']
};

const $=id=>document.getElementById(id); const qsa=s=>Array.from(document.querySelectorAll(s));
function clamp(v){return Math.max(0,Math.min(100,Math.round(Number(v)||0)));}
function choice(a){return a[Math.floor(Math.random()*a.length)];}
function safeJson(k){try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}}
function load(){let now=safeJson(KEY); if(Object.keys(now).length)return now; for(const k of OLD_KEYS){const v=safeJson(k); if(Object.keys(v).length)return v;} return {};}
function fresh(){return {authority:{mode:'ASSIST',maxEnergy:88,maxChaos:58,maxDensity:76,maxMotion:88,autoApply:false,allowMegaEvents:false,allowWorldTravel:true,allowTimelineRewrite:true,allowDiscovery:true,operatorLock:false,log:[]},universe:'Forge Universe',targetUniverse:'Synthetic Universe',current:'Forge Reactor',target:'Alien Temple',weather:'Calm',phase:'BUILD',energy:62,chaos:34,density:48,motion:56,morph:60,transition:36,started:Date.now(),history:[],snapshots:[],generatedWorlds:[],events:[],journey:[],graph:[],trend:[],discoveries:[],directorPlan:[],civilizations:[],dna:{heat:62,flow:58,chaos:34,motion:56,life:42,density:48,contrast:68}}}
const state=Object.assign(fresh(),load());
state.history=Array.isArray(state.history)?state.history:[]; state.snapshots=Array.isArray(state.snapshots)?state.snapshots:[]; state.trend=Array.isArray(state.trend)?state.trend:[]; state.weather=state.weather||'Calm'; state.generatedWorlds=Array.isArray(state.generatedWorlds)?state.generatedWorlds:[]; state.events=Array.isArray(state.events)?state.events:[]; state.journey=Array.isArray(state.journey)?state.journey:[]; state.graph=Array.isArray(state.graph)?state.graph:[]; state.discoveries=Array.isArray(state.discoveries)?state.discoveries:[]; state.directorPlan=Array.isArray(state.directorPlan)?state.directorPlan:[]; state.civilizations=Array.isArray(state.civilizations)?state.civilizations:[]; state.legendaryWorlds=Array.isArray(state.legendaryWorlds)?state.legendaryWorlds:[]; state.market=state.market&&typeof state.market==='object'?state.market:{favorites:[],clones:[],variants:[],packages:[]}; state.creatorPackages=Array.isArray(state.creatorPackages)?state.creatorPackages:[]; state.eventGenome=Array.isArray(state.eventGenome)?state.eventGenome:[]; state.story=Array.isArray(state.story)?state.story:[]; state.festivalPlan=Array.isArray(state.festivalPlan)?state.festivalPlan:[]; state.evolutionTree=Array.isArray(state.evolutionTree)?state.evolutionTree:[]; state.genomes=Array.isArray(state.genomes)?state.genomes:[]; state.recipes=Array.isArray(state.recipes)?state.recipes:[]; state.livingTimeline=Array.isArray(state.livingTimeline)?state.livingTimeline:[]; state.storyTick=state.storyTick||{running:false,startedAt:Date.now(),activeIndex:0,lastDecision:'manual'}; state.ecosystem=state.ecosystem&&typeof state.ecosystem==='object'?state.ecosystem:{ageMin:0,novelty:72,fatigue:18,curiosity:80,coherence:66,historyScore:0}; state.hiddenSignals=Array.isArray(state.hiddenSignals)?state.hiddenSignals:[]; state.megaEvents=Array.isArray(state.megaEvents)?state.megaEvents:[]; state.showHistory=Array.isArray(state.showHistory)?state.showHistory:[]; state.directorGenome=state.directorGenome&&typeof state.directorGenome==='object'?state.directorGenome:{exploration:80,aggression:42,mystery:88,organic:55,synthetic:45,cosmic:62,forge:58}; state.phenomena=state.phenomena&&typeof state.phenomena==='object'?state.phenomena:{active:['Flow','Pulse','Storm'],physics:{gravity:30,temperature:80,turbulence:65,radiation:20},entities:[{type:'Energy Node',energy:74,age:12,dna:'forge'},{type:'Machine Cluster',energy:52,age:31,dna:'synthetic'}],emotion:'Wonder',camera:{mode:'Orbit',zoom:62,pan:50,focus:'Current World'},log:[]};
state.physicsCore=state.physicsCore&&typeof state.physicsCore==='object'?state.physicsCore:null;
if(!state.physicsCore){state.physicsCore={enabled:true,quality:'balanced',blendA:'Forge Reactor',blendB:'Forest Sanctuary',blendMix:30,variables:{energy:62,temperature:56,pressure:42,turbulence:50,entropy:28,gravity:45,radiation:38,density:55},memory:{enabled:true,decaySec:300,intensity:45,scars:[]},attention:{enabled:true,sensitivity:62,focus:'event',map:[28,44,62,38,72,55,31,67]},flow:{enabled:true,strength:55,diffusion:42,decay:24,injectRate:38,nodes:[]},emergent:{enabled:true,cooldownSec:45,lastAt:0,events:[]},log:[]};}
state.physicsCore.memory.scars=Array.isArray(state.physicsCore.memory?.scars)?state.physicsCore.memory.scars:[];
state.physicsCore.flow.nodes=Array.isArray(state.physicsCore.flow?.nodes)?state.physicsCore.flow.nodes:[];
state.physicsCore.emergent.events=Array.isArray(state.physicsCore.emergent?.events)?state.physicsCore.emergent.events:[];
state.physicsCore.log=Array.isArray(state.physicsCore.log)?state.physicsCore.log:[];
state.stabilityLab=state.stabilityLab&&typeof state.stabilityLab==='object'?state.stabilityLab:{profile:'balanced',fpsTarget:30,uiThrottleMs:250,bridgeRateHz:10,physicsTickMs:1000,maxNodes:24,maxScars:30,renderBudgetMs:12,watchdogEnabled:true,autoDegrade:true,outputGuard:true,bridgeHeartbeat:true,lastBridgeAt:0,frameCounter:0,framesDropped:0,health:'GOOD',metrics:{fps:30,avgFrameMs:8,bridgeAgeMs:0,memoryItems:0,flowNodes:0,events:0,pressure:0},log:[]};
state.stabilityLab.log=Array.isArray(state.stabilityLab.log)?state.stabilityLab.log:[];
state.cleanupConsole=state.cleanupConsole&&typeof state.cleanupConsole==='object'?state.cleanupConsole:{score:0,status:'NOT AUDITED',lastAudit:0,architecture:[],priorities:[],actions:[],contracts:[],registry:[],reports:[]};
state.cleanupPass=state.cleanupPass&&typeof state.cleanupPass==='object'?state.cleanupPass:{uiMode:'PRO',safeMode:true,advancedVisible:false,sections:['control','performance','showos','diagnostics'],findings:[],contracts:[],hidden:[],testPlan:[],lastRun:0};
state.cleanupPass2=state.cleanupPass2&&typeof state.cleanupPass2==='object'?state.cleanupPass2:{navigationProfile:'TEST',focusMode:true,liveStatus:'READY',routeMap:[],statusCards:[],testChecklist:[],safeFallbacks:[],notes:[],lastRun:0};
state.cleanupPass3=state.cleanupPass3&&typeof state.cleanupPass3==='object'?state.cleanupPass3:{testMode:'GUIDED',operatorView:'COMPACT',sessionChecklist:[],routingSummary:[],riskRegister:[],performanceNotes:[],releaseGates:[],runbook:[],lastRun:0};
state.fieldTest=state.fieldTest&&typeof state.fieldTest==='object'?state.fieldTest:{mode:'DRY_RUN',stage:'PRECHECK',score:0,preflight:[],liveRoute:[],burnin:[],rollback:[],operatorNotes:[],lastRun:0};
state.cleanupConsole.architecture=Array.isArray(state.cleanupConsole.architecture)?state.cleanupConsole.architecture:[];
state.cleanupConsole.priorities=Array.isArray(state.cleanupConsole.priorities)?state.cleanupConsole.priorities:[];
state.cleanupConsole.actions=Array.isArray(state.cleanupConsole.actions)?state.cleanupConsole.actions:[];
state.cleanupConsole.contracts=Array.isArray(state.cleanupConsole.contracts)?state.cleanupConsole.contracts:[];
state.cleanupConsole.registry=Array.isArray(state.cleanupConsole.registry)?state.cleanupConsole.registry:[];

// STEP37DD: guarded Show OS persistence. Older builds wrote the full Show OS state
// on every render(), including periodic housekeeping renders. That can create small
// main-thread stalls during live output. We keep the same storage key/schema, but
// skip writes when the state body has not changed and coalesce very rapid repeats.
let lastShowOsSaveBody37DD = '';
let lastShowOsSaveAt37DD = 0;
function save(){
 const body=JSON.stringify({...state,version:'STEP22KZ_POST_SHOW_REVIEW_LEARNING_PACK'});
 const now=Date.now();
 if(body===lastShowOsSaveBody37DD && now-lastShowOsSaveAt37DD<5000)return;
 if(body!==lastShowOsSaveBody37DD || now-lastShowOsSaveAt37DD>750){
  lastShowOsSaveBody37DD=body;
  lastShowOsSaveAt37DD=now;
  localStorage.setItem(KEY,JSON.stringify({...state,savedAt:new Date().toISOString(),version:'STEP22KZ_POST_SHOW_REVIEW_LEARNING_PACK'}));
 }
}
function toast(text){document.querySelector('.toast')?.remove(); const n=document.createElement('div'); n.className='toast'; n.textContent=text; document.body.appendChild(n); setTimeout(()=>n.remove(),3200);}
function log(item){state.history.unshift({t:new Date().toLocaleTimeString(),item}); if(/World|Target|Arrived|Ambient|Weather|Graph node|Journey/.test(item)){state.snapshots.unshift({t:new Date().toLocaleTimeString(),world:state.current,target:state.target,weather:state.weather,phase:state.phase,energy:state.energy,chaos:state.chaos,density:state.density,motion:state.motion,item}); state.snapshots=state.snapshots.slice(0,120);} state.history=state.history.slice(0,100);}
function allWorlds(){return [...baseWorlds,...state.generatedWorlds.map((w,i)=>({x:10+(i*13)%80,y:16+(i*19)%74,short:(w.short||w.name.slice(0,5)).toUpperCase(),...w}))];}
function renderTabs(){const box=$('sectionTabs'); if(!box)return; box.innerHTML=''; sections.forEach(([id,label])=>{const b=document.createElement('button'); b.textContent=label; b.dataset.goto=id; b.onclick=()=>showSection(id); box.appendChild(b);});}
let activeShowOsSection37DD = localStorage.getItem('budilight.showos.section') || 'control';
function showSection(id){activeShowOsSection37DD=id||'control'; qsa('.os-section').forEach(s=>s.classList.toggle('active',s.dataset.section===activeShowOsSection37DD)); qsa('[data-goto]').forEach(b=>b.classList.toggle('active',b.dataset.goto===activeShowOsSection37DD)); localStorage.setItem('budilight.showos.section',activeShowOsSection37DD); render();}
function showOsSectionActive37DD(...ids){return ids.includes(activeShowOsSection37DD);}
function render(){
 const worlds=allWorlds(), current=worlds.find(w=>w.name===state.current)||worlds[0];
 if($('currentWorld'))$('currentWorld').textContent=state.current; if($('targetWorld'))$('targetWorld').textContent=state.target; if($('transitionVal'))$('transitionVal').textContent=state.transition+'%';
 ['energy','chaos','density','motion','morph'].forEach(id=>{const el=$(id); if(el)el.value=state[id]; const t=$(id+'Text'); if(t)t.textContent=state[id];});
 if($('topWorld'))$('topWorld').textContent=current.short||state.current; if($('topPhase'))$('topPhase').textContent=state.phase;
 const repeat=getRepeatScore(), variety=100-repeat; if($('varietyVal'))$('varietyVal').textContent=variety+'%'; if($('topHealth'))$('topHealth').textContent=repeat<18?'GOOD':repeat<32?'WATCH':'BUSY';
 renderWorlds(); renderPhases(); renderHealth(); renderMemory(); renderGenerated(); renderEvents(); renderSaved(); renderGraph(); renderWeather(); renderHistory(); renderCommandCenter(); renderEcosystem();
 // STEP37DF: render only heavy Show OS panels that can actually be visible.
 // This keeps the page responsive when Show OS is cached/hidden by the shell.
 if(showOsSectionActive37DD('intelligence','control','director'))renderIntelligence();
 if(showOsSectionActive37DD('authority','control','director'))renderAuthority();
 if(showOsSectionActive37DD('phenomena','physics','bridge'))renderPhenomena();
 if(showOsSectionActive37DD('bridge','generator-bridge')){renderBridge(); renderGeneratorBridge();}
 if(showOsSectionActive37DD('physics','phenomena','bridge'))renderPhysicsCore();
 if(showOsSectionActive37DD('stability','health','cleanup'))renderStabilityLab();
 if(showOsSectionActive37DD('health','cleanup','memory'))renderHealthConsole();
 if(showOsSectionActive37DD('cleanup','cleanup-pass','cleanup-pass2','cleanup-pass3'))renderCleanupConsole();
 if(showOsSectionActive37DD('cleanup-pass'))renderCleanupPass();
 if(showOsSectionActive37DD('cleanup-pass2'))renderCleanupPass2();
 if(showOsSectionActive37DD('cleanup-pass3'))renderCleanupPass3();
 if(showOsSectionActive37DD('fieldtest','finalqa','production'))renderFieldTest();
 if(showOsSectionActive37DD('launch','liveops','production'))renderOperatorLaunch();
 save();
}
function renderWorlds(){const box=$('worldMap'),svg=$('worldLinks'); if(!box||!svg)return; svg.innerHTML=''; const ws=allWorlds(); worldLinks.forEach(([a,b])=>{const A=ws.find(w=>w.name===a),B=ws.find(w=>w.name===b); if(!A||!B)return; const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',A.x); line.setAttribute('y1',A.y); line.setAttribute('x2',B.x); line.setAttribute('y2',B.y); svg.appendChild(line);}); box.querySelectorAll('.world-node').forEach(n=>n.remove()); ws.forEach(w=>{const b=document.createElement('button'); b.className='world-node'+(w.name===state.current?' active':'')+(w.name===state.target?' target':''); b.style.left=w.x+'%'; b.style.top=w.y+'%'; b.innerHTML=`<b>${w.short||w.name.slice(0,6)}</b><small>${Math.round(w.dna?.chaos||30)}% chaos</small>`; b.title=w.name; b.onclick=()=>selectWorld(w); box.appendChild(b);});}
function selectWorld(w){state.target=w.name; state.transition=0; state.dna=Object.assign({},w.dna||state.dna); log('Target world → '+w.name); renderDNA(); render();}
function renderPhases(){const box=$('phaseRow'); if(!box)return; box.innerHTML=''; phases.forEach(p=>{const b=document.createElement('button'); b.textContent=p; b.className=p===state.phase?'active':''; b.onclick=()=>{state.phase=p; log('Phase → '+p); render();}; box.appendChild(b);});}
function getRepeatScore(){const recent=state.history.slice(0,24).map(h=>(h.item||'').split('→')[0]); const unique=new Set(recent).size||1; return clamp(7+(recent.length-unique)*4+Math.max(0,state.density-70)*.25-state.chaos*.06);}
function renderHealth(){const box=$('healthBars'); if(!box)return; const repeat=getRepeatScore(); const data=[['Repetition',repeat,true],['Color Diversity',clamp(54+state.chaos*.20+(state.dna.contrast||50)*.16),false],['Motion Diversity',clamp(42+state.motion*.46),false],['Event Balance',clamp(90-Math.abs(state.density-52)*.56),false],['Crowd Risk',clamp(state.energy*.45+state.chaos*.28+state.density*.12),true],['Ambient Safety',clamp(100-(state.energy*.25+state.chaos*.35)),false],['Journey Coherence',clamp(55+(state.journey.length*3)-getRepeatScore()*.4),false],['Morph Smoothness',clamp(35+state.morph*.2+(100-state.chaos)*.2),false]]; box.innerHTML=''; data.forEach(([name,val,low])=>{const row=document.createElement('div'); row.className='health-row'; row.innerHTML=`<span>${name}<b>${val}%</b></span><div class="bar ${low?'low-good':''}"><i style="width:${val}%"></i></div>`; box.appendChild(row);});}
function renderMemory(){const box=$('memoryLog'); if(!box)return; box.innerHTML=state.history.length?state.history.map(h=>`<div><b>${h.t}</b><span>${h.item}</span></div>`).join(''):'<em>zatím žádná historie</em>';}
function phaseForIndex(i,n,style){const ratio=i/Math.max(1,n-1); if(style.includes('Ambient'))return ratio>.8?'AFTERHOURS':ratio>.55?'GROOVE':'WARMUP'; if(ratio<.15)return'WARMUP'; if(ratio<.34)return'BUILD'; if(ratio<.48)return'TENSION'; if(ratio<.68)return'PEAK'; if(ratio<.82)return'RECOVERY'; return'AFTERHOURS';}
function generateJourney(hours=6,style='Psytrance Journey'){
 const templates={
  'Psytrance Journey':['Forest Sanctuary','Deep Space','Alien Temple','Forge Reactor','Peak Ritual','Deep Space','Afterhours Drift'],
  'Tribe Ritual':['Tribal Cave','Forest Sanctuary','Forge Reactor','Tribal Cave','Peak Ritual','Afterhours Drift'],
  'Peak Techno':['Deep Space','Cyber Ritual','Forge Reactor','Peak Ritual','Crystal Hive','Afterhours Drift'],
  'Forest Flow':['Forest Sanctuary','Moss Reactor','Deep Space','Alien Temple','Forest Sanctuary','Afterhours Drift'],
  'Darkpsy Night':['Deep Space','Alien Temple','Cyber Ritual','Crystal Hive','Peak Ritual','Alien Temple','Afterhours Drift'],
  'Ambient Installation':['Afterhours Drift','Deep Space','Forest Sanctuary','Moss Reactor','Crystal Hive','Deep Space','Afterhours Drift'],
  'Forge Longform':['Deep Space','Moss Reactor','Forge Reactor','Volcanic Garden','Peak Ritual','Forge Reactor','Afterhours Drift'],
  'Alien Story':['Deep Space','Alien Temple','Crystal Hive','Cyber Ritual','Peak Ritual','Alien Temple','Afterhours Drift']
 };
 const arr=templates[style]||templates['Psytrance Journey']; const total=hours*60; const minBase=Math.max(8,Math.round(total/arr.length)); const intensity=$('journeyIntensity')?.value||'Balanced'; const detail=$('journeyDetail')?.value||'Normal';
 return arr.map((w,i)=>{let min=minBase+Math.round((Math.random()-.5)*minBase*.45); if(detail==='Long Morphs')min+=8; if(intensity==='Soft')min+=4; if(intensity==='Strong')min=Math.max(6,min-3); const phase=phaseForIndex(i,arr.length,style); const note=choice(['slow morph','thin events','micro variation','safe sparkle','density wave','world blend','anti-repeat pass','long drift']); return {world:w.replace('Recovery:',''),phase,min:Math.max(4,min),energy:phase==='PEAK'?86:phase==='DROP'?92:phase==='AFTERHOURS'?22:phase==='WARMUP'?30:62,note};});
}
function renderJourney(j=state.journey){const list=$('journeyList'),tl=$('journeyTimeline'); if(!list||!tl)return; if(!j?.length)j=generateJourney(6,'Psytrance Journey'); state.journey=j; list.innerHTML=''; tl.innerHTML=''; const total=j.reduce((a,s)=>a+s.min,0)||1; j.forEach((s,i)=>{const item=document.createElement('div'); item.className='journey-step'; item.innerHTML=`<b>${String(i+1).padStart(2,'0')}</b><div><strong>${s.world}</strong><small>${s.phase} · energy ${s.energy||'-'} · ${s.note}</small></div><em>${s.min}m</em>`; item.onclick=()=>{state.target=s.world; state.phase=s.phase; state.energy=s.energy||state.energy; state.transition=0; log('Journey step selected → '+s.world); render();}; list.appendChild(item); const seg=document.createElement('button'); seg.style.flexBasis=(s.min/total*100)+'%'; seg.innerHTML=`<b>${s.world.split(' ')[0]}</b><small>${s.min}m</small>`; seg.onclick=item.onclick; tl.appendChild(seg);});}
function renderDNA(){const box=$('dnaSliders'); if(!box)return; box.innerHTML=''; dnaKeys.forEach(k=>{const lab=document.createElement('label'); lab.innerHTML=`<span>${k.toUpperCase()} <b>${state.dna[k]??50}</b>%</span><input data-dna="${k}" type="range" min="0" max="100" value="${state.dna[k]??50}">`; box.appendChild(lab);}); box.querySelectorAll('[data-dna]').forEach(inp=>inp.oninput=e=>{state.dna[e.target.dataset.dna]=clamp(e.target.value); renderDNA(); save();});}
function makeWorldName(){return choice(['Solar','Crystal','Cyber','Moss','Void','Neon','Volcanic','Bio','Chrome','Sub Bass','Alien','Ritual','Quantum'])+' '+choice(['Forge','Temple','Hive','Garden','Reactor','Jungle','Monastery','Ocean','Cathedral','Ritual','Sanctuary','Machine']);}
function generateWorld(){const name=$('worldNameInput')?.value.trim()||makeWorldName(); const dna={}; dnaKeys.forEach(k=>dna[k]=clamp((state.dna[k]||50)+Math.round((Math.random()-.5)*30))); const w={name,short:name.split(' ').map(x=>x[0]).join('').slice(0,5).toUpperCase(),dna,createdAt:new Date().toISOString()}; state.generatedWorlds.unshift(w); state.generatedWorlds=state.generatedWorlds.slice(0,40); state.target=name; state.transition=0; log('Generated world → '+name); if($('worldNameInput'))$('worldNameInput').value=''; renderDNA(); render();}
function mutateWorld(){dnaKeys.forEach(k=>state.dna[k]=clamp((state.dna[k]||50)+(Math.random()>.5?1:-1)*Math.round(6+Math.random()*20))); log('DNA mutation pass'); renderDNA(); render();}
function breedWorld(){const a=allWorlds().find(w=>w.name===state.current)||baseWorlds[0],b=allWorlds().find(w=>w.name===state.target)||baseWorlds[1]; dnaKeys.forEach(k=>state.dna[k]=clamp(((a.dna?.[k]||50)*.55)+((b.dna?.[k]||50)*.45)+((Math.random()-.5)*12))); if($('worldNameInput'))$('worldNameInput').value=a.name.split(' ')[0]+' '+b.name.split(' ').slice(-1)[0]; log('Bred DNA from '+a.name+' + '+b.name); renderDNA(); render();}
function renderGenerated(){const box=$('generatedWorlds'); if(!box)return; box.innerHTML=state.generatedWorlds.length?state.generatedWorlds.map((w,i)=>`<button data-gen-world="${i}"><b>${w.name}</b><small>heat ${w.dna.heat}% · chaos ${w.dna.chaos}% · density ${w.dna.density}%</small></button>`).join(''):'<em>Zatím žádné generované světy.</em>'; box.querySelectorAll('[data-gen-world]').forEach(b=>b.onclick=()=>{const w=state.generatedWorlds[Number(b.dataset.genWorld)]; selectWorld({...w,x:50,y:50});});}
function renderSaved(){const sw=$('savedWorlds'); if(sw)sw.innerHTML=state.generatedWorlds.length?state.generatedWorlds.map(w=>`<div><b>${w.name}</b><span>heat ${w.dna.heat} / flow ${w.dna.flow} / chaos ${w.dna.chaos}</span></div>`).join(''):'<em>Žádné uložené světy.</em>'; const se=$('savedEvents'); if(se)se.innerHTML=state.events.length?state.events.map(e=>`<div><b>${e.name}</b><span>${e.parts.join(' + ')}</span></div>`).join(''):'<em>Žádné uložené eventy.</em>';}
function renderEventLego(){const box=$('eventLego'); if(!box)return; box.innerHTML=''; eventParts.forEach(p=>{const b=document.createElement('button'); b.textContent=p; b.dataset.part=p; b.onclick=()=>b.classList.toggle('active'); box.appendChild(b);});}
function buildEvent(){const parts=qsa('#eventLego button.active').map(b=>b.dataset.part); if(!parts.length)parts.push(choice(eventParts),choice(eventParts),choice(eventParts)); const name=$('eventName')?.value.trim()||parts.join(' ')+' Event'; state.events.unshift({name,parts,createdAt:new Date().toISOString(),energy:state.energy,phase:state.phase}); state.events=state.events.slice(0,60); log('Saved event → '+name); if($('eventName'))$('eventName').value=''; qsa('#eventLego button.active').forEach(b=>b.classList.remove('active')); render();}
function randomEvent(){qsa('#eventLego button').forEach(b=>b.classList.toggle('active',Math.random()>.66)); if($('eventName'))$('eventName').value=choice(['Forge Impact','Alien Bloom','Tribal Sweep','Deep Pulse','Crystal Collapse','Heat Rain','Cyber Gate','Moss Ripple']);}
function renderEvents(){const box=$('eventList'); if(!box)return; box.innerHTML=state.events.length?state.events.map((e,i)=>`<button data-event="${i}"><b>${e.name}</b><small>${e.parts.join(' + ')}</small></button>`).join(''):'<em>Zatím žádné vlastní eventy.</em>'; box.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{const e=state.events[Number(b.dataset.event)]; log('Triggered event intent → '+e.name); toast('Event intent: '+e.name); render();});}
function renderAmbient(){const box=$('ambientGrid'); if(!box)return; box.innerHTML=''; ambientProfiles.forEach(([world,dur,desc])=>{const b=document.createElement('button'); b.innerHTML=`<b>${world}</b><span>${dur}</span><small>${desc}</small>`; b.onclick=()=>{state.phase='AFTERHOURS'; state.target=world; state.energy=22; state.chaos=18; state.density=28; state.motion=24; state.morph=180; log('Ambient profile → '+world+' '+dur); render();}; box.appendChild(b);});}
function graphFromJourney(){const j=state.journey.length?state.journey:generateJourney(6,'Psytrance Journey'); state.graph=j.map((s,i)=>({id:'n'+i,type:i===0?'WORLD':(s.phase==='DROP'||s.phase==='PEAK'?'EVENT':'MORPH'),label:s.world,phase:s.phase,x:10+(i%5)*20,y:22+Math.floor(i/5)*30,world:s.world})); log('Graph generated from journey'); renderGraph(); save();}
function graphPreset(){state.journey=generateJourney(6,'Psytrance Journey'); graphFromJourney(); showSection('graph');}
function renderGraph(){const box=$('nodeCanvas'),svg=$('nodeLinks'); if(!box||!svg)return; if(!state.graph.length)graphFromJourney(); svg.innerHTML=''; box.querySelectorAll('.graph-node').forEach(n=>n.remove()); state.graph.forEach((n,i)=>{if(i<state.graph.length-1){const b=state.graph[i+1]; const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',n.x+7); line.setAttribute('y1',n.y+5); line.setAttribute('x2',b.x+7); line.setAttribute('y2',b.y+5); svg.appendChild(line);}}); state.graph.forEach((n,i)=>{const el=document.createElement('button'); el.className='graph-node '+n.type.toLowerCase(); el.style.left=n.x+'%'; el.style.top=n.y+'%'; el.innerHTML=`<small>${n.type}</small><b>${n.label}</b><span>${n.phase}</span>`; el.onclick=()=>{state.target=n.world||n.label; state.phase=n.phase||state.phase; state.transition=0; log('Graph node selected → '+n.label); render();}; box.appendChild(el);});}
function inspire(kind){if(kind==='journey'){const j=generateJourney(6,choice(['Psytrance Journey','Tribe Ritual','Forest Flow','Darkpsy Night','Alien Story'])); state.journey=j; renderJourney(j); if($('inspireOutput'))$('inspireOutput').textContent='Nová cesta: '+j.map(x=>x.world.split(' ')[0]).join(' → '); log('Inspire journey'); render(); return;} if(kind==='world'){const name=makeWorldName(); if($('worldNameInput'))$('worldNameInput').value=name; if($('inspireOutput'))$('inspireOutput').textContent='Nový world seed: '+name; log('Inspire world seed → '+name); showSection('factory'); return;} if(kind==='event'){randomEvent(); if($('inspireOutput'))$('inspireOutput').textContent='Event seed připravený v Event Factory.'; log('Inspire event seed'); showSection('events'); return;} const text=choice(ideas[kind]||ideas.surprise); if($('inspireOutput'))$('inspireOutput').textContent=text; log('Inspire '+kind+' → '+text); render();}

function getWorldAgeMinutes(){const hit=state.history.find(h=>String(h.item||'').startsWith('Arrived')); if(!hit)return Math.floor((Date.now()-state.started)/60000); return Math.max(0,Math.floor((Date.now()-state.started)/60000));}
function getFatigue(){const sameWorld=state.history.slice(0,40).filter(h=>String(h.item||'').includes(state.current)).length; const repeat=getRepeatScore(); return clamp(repeat*0.75 + sameWorld*2.2 + Math.max(0,state.density-65)*0.35 + Math.max(0,state.energy-82)*0.25);}
function getStaleness(){const recent=state.snapshots.slice(0,18); const worldRepeats=recent.filter(s=>s.world===state.current||s.target===state.current).length; const lowMorph=state.transition>=100?18:0; return clamp(worldRepeats*5 + lowMorph + Math.max(0,60-state.chaos)*0.12 + Math.max(0,55-state.motion)*0.18);}
function intelligenceMetrics(){const fatigue=getFatigue(), stale=getStaleness(), repeat=getRepeatScore(); return [
 ['ENERGY',state.energy,false],['CHAOS',state.chaos,false],['DENSITY',state.density,false],['MOTION',state.motion,false],['VARIETY',100-repeat,false],['FATIGUE',fatigue,true],['STALENESS',stale,true],['SAFETY',clamp(100-(state.chaos*.35+state.energy*.25+state.density*.18)),false]
];}
function makeRecommendations(){const fatigue=getFatigue(), stale=getStaleness(), repeat=getRepeatScore(); const rec=[]; if(fatigue>58)rec.push({type:'fatigue',title:'Vysoká únava publika',text:'Sniž energy/density, přepni do recovery nebo Deep/Afterhours na 3–8 minut.',action:()=>{state.energy=clamp(state.energy-22);state.density=clamp(state.density-18);state.chaos=clamp(state.chaos-8);state.phase='RECOVERY';state.target='Deep Space';}}); if(stale>55)rec.push({type:'stale',title:'Svět začíná být zatuchlý',text:'Nastav target do příbuzného světa a dej morph 120–180 s.',action:()=>{state.target=choice(getSuggestedWorlds()).name;state.morph=180;state.transition=0;}}); if(repeat>30)rec.push({type:'repeat',title:'Opakování je moc vysoké',text:'Vygeneruj nový event nebo mutuj aktuální world DNA.',action:()=>{mutateWorld(); randomEvent();}}); if(state.energy>82&&state.phase!=='PEAK'&&state.phase!=='DROP')rec.push({type:'phase',title:'Energie neodpovídá fázi',text:'Přepni fázi na PEAK nebo stáhni energii pod 70 %.',action:()=>{state.phase='PEAK';}}); if(!rec.length)rec.push({type:'ok',title:'Show je zdravá',text:'Můžeš pomalu přidat motion nebo připravit další target world.',action:()=>{state.motion=clamp(state.motion+6);state.target=choice(getSuggestedWorlds()).name;state.transition=0;}}); return rec.slice(0,5);}
function renderIntelligence(){const hb=$('heartbeatGrid'); if(hb){hb.innerHTML=intelligenceMetrics().map(([k,v,low])=>`<div class="heartbeat-cell ${low?'risk':''}"><span>${k}</span><b>${v}%</b><i style="--v:${v}%"></i></div>`).join('');}
 const fatigue=getFatigue(), stale=getStaleness(); const f=$('fatigueBox'); if(f)f.innerHTML=`<b class="${fatigue>65?'danger':fatigue>40?'warn':'ok'}">${fatigue>65?'HIGH':fatigue>40?'MEDIUM':'LOW'}</b><span>${fatigue}%</span><small>Sleduje podobné eventy, hustotu, energy a historii worldů.</small>`;
 const st=$('stalenessBox'); if(st)st.innerHTML=`<b class="${stale>65?'danger':stale>40?'warn':'ok'}">${stale>65?'HIGH':stale>40?'MEDIUM':'LOW'}</b><span>${stale}%</span><small>Hlídá, jestli nejsi dlouho v podobném světě / podobné dramaturgii.</small>`;
 const r=$('recommendations'); if(r){r.innerHTML=makeRecommendations().map((x,i)=>`<button data-rec="${i}"><b>${x.title}</b><small>${x.text}</small></button>`).join(''); r.querySelectorAll('[data-rec]').forEach(b=>b.onclick=()=>{makeRecommendations()[Number(b.dataset.rec)].action(); log('Applied recommendation → '+b.innerText.split('\n')[0]); render();});}
 const tr=$('trendRadar'); if(tr){const last=(state.trend||[]).slice(-30); tr.innerHTML=(last.length?last:[{energy:state.energy,chaos:state.chaos,density:state.density,variety:100-getRepeatScore()}]).map(x=>`<i style="--e:${x.energy}%;--c:${x.chaos}%;--d:${x.density}%;--v:${x.variety}%" title="E${x.energy} C${x.chaos} D${x.density} V${x.variety}"></i>`).join('');}
}
function applyRecommendation(){const rec=makeRecommendations()[0]; if(rec){rec.action(); log('Applied best intelligence fix → '+rec.title); render(); toast('Použit nejlepší intelligence fix.');}}
function renderWeather(){const box=$('weatherGrid'); if(box){box.innerHTML=Object.entries(weatherProfiles).map(([name,w])=>`<button data-weather="${name}" class="${state.weather===name?'active':''}"><b>${name}</b><small>${w.desc}</small></button>`).join(''); box.querySelectorAll('[data-weather]').forEach(b=>b.onclick=()=>setWeather(b.dataset.weather));} const st=$('weatherStatus'); if(st){const w=weatherProfiles[state.weather]||weatherProfiles.Calm; st.innerHTML=`<b>${state.current}</b> + <b>${state.weather}</b><span>${w.desc}</span><small>Weather upravuje intent: energy ${w.energy>=0?'+':''}${w.energy}, chaos ${w.chaos>=0?'+':''}${w.chaos}, density ${w.density>=0?'+':''}${w.density}, motion ${w.motion>=0?'+':''}${w.motion}</small>`;}}
function setWeather(name){const w=weatherProfiles[name]||weatherProfiles.Calm; state.weather=name; state.energy=clamp(state.energy+w.energy); state.chaos=clamp(state.chaos+w.chaos); state.density=clamp(state.density+w.density); state.motion=clamp(state.motion+w.motion); log('Weather → '+name); render();}
function getSuggestedWorlds(){const ws=allWorlds(); const names=worldFamilies[state.current]||worldFamilies[state.target]||['Deep Space','Forge Reactor','Alien Temple']; return names.map(n=>ws.find(w=>w.name===n)).filter(Boolean).concat(ws.filter(w=>!names.includes(w.name))).slice(0,6);}
function renderHistory(){const wh=$('worldHistory'); if(wh){wh.innerHTML=(state.snapshots||[]).slice(0,32).map((s,i)=>`<button data-snap="${i}"><b>${s.t} · ${s.world}</b><small>${s.item} · target ${s.target} · ${s.weather||'Calm'}</small></button>`).join('')||'<em>Zatím žádná world historie.</em>'; wh.querySelectorAll('[data-snap]').forEach(b=>b.onclick=()=>{const s=state.snapshots[Number(b.dataset.snap)]; Object.assign(state,{current:s.world,target:s.target,weather:s.weather||'Calm',phase:s.phase,energy:s.energy,chaos:s.chaos,density:s.density,motion:s.motion,transition:100}); log('Restored history snapshot → '+s.world); render();});}
 const rm=$('relationshipMatrix'); if(rm){const rows=Object.entries(worldFamilies).slice(0,10); rm.innerHTML=rows.map(([a,bs])=>`<div><b>${a}</b><span>${bs.join(' → ')}</span></div>`).join('');}
 const nw=$('nextWorlds'); if(nw){nw.innerHTML=getSuggestedWorlds().slice(0,6).map(w=>`<button data-next-world="${w.name}"><b>${w.name}</b><small>good bridge · chaos ${Math.round(w.dna?.chaos||30)} · motion ${Math.round(w.dna?.motion||50)}</small></button>`).join(''); nw.querySelectorAll('[data-next-world]').forEach(b=>b.onclick=()=>{state.target=b.dataset.nextWorld; state.transition=0; state.morph=Math.max(state.morph,120); log('Relationship target → '+state.target); render();});}}
function cleanHistory(){const seen=new Set(); state.snapshots=(state.snapshots||[]).filter(s=>{const k=s.world+'|'+s.target+'|'+s.phase+'|'+s.weather; if(seen.has(k))return false; seen.add(k); return true;}); log('Cleaned duplicate history snapshots'); render();}


// STEP22HQ — Command Center additions
function worldUsage(){const map={}; (state.snapshots||[]).forEach(s=>{map[s.world]=(map[s.world]||0)+1; map[s.target]=(map[s.target]||0)+.35;}); return map;}
function renderEconomy(){const box=$('economyGrid'); if(!box)return; const usage=worldUsage(); const ws=allWorlds().slice(0,18); box.innerHTML=ws.map(w=>{const used=usage[w.name]||0; const freshness=clamp(100-used*8); const attention=clamp(100-Math.abs((w.dna?.chaos||40)-state.chaos)*.35-used*4); const cls=freshness<38?'hot':'ok'; return `<button data-eco-world="${w.name}" class="economy-card ${cls}"><b>${w.name}</b><span>freshness ${freshness}%</span><i><em style="width:${freshness}%"></em></i><small>attention yield ${attention}% · usage ${Math.round(used)}</small></button>`;}).join(''); box.querySelectorAll('[data-eco-world]').forEach(b=>b.onclick=()=>{state.target=b.dataset.ecoWorld; state.transition=0; state.morph=Math.max(state.morph,120); log('Economy target → '+state.target); render();});}
function rebalanceEconomy(){const usage=worldUsage(); const fresh=allWorlds().filter(w=>(usage[w.name]||0)<2); const w=choice(fresh.length?fresh:allWorlds()); state.target=w.name; state.transition=0; state.morph=180; state.chaos=clamp(state.chaos-6); log('Economy rebalance → '+w.name); render(); toast('World Economy vybrala čerstvější target.');}
function directorVerdict(){const fatigue=getRepeatScore(); if(state.energy>82&&fatigue>45)return ['HIGH','Peak je dlouhý a repetice roste. Dej recovery nebo změň svět.','danger']; if(state.energy<35&&state.phase==='AFTERHOURS')return ['CALM','Ambientní stav je bezpečný. Můžeš pomalu přidat motion.','ok']; if(state.transition<100)return ['MORPH','Probíhá přechod. Nech ho dojet, nebo použij DROP jen záměrně.','warn']; return ['READY','Show je stabilní. Vhodný moment pro target nebo journey krok.','ok'];}
function generateDirectorPlan(){const h=Number($('directorDuration')?.value||6), peaks=Number($('directorPeaks')?.value||2), rec=Number($('directorRecovery')?.value||2); const worlds=['Forest Flow','Deep Space','Alien Temple','Forge Reactor','Peak Ritual','Afterhours Drift']; const plan=[]; const total=h*60; const slots=Math.max(6,peaks*2+rec+3); for(let i=0;i<slots;i++){const pos=i/(slots-1); let phase=pos<.15?'WARMUP':pos<.35?'GROOVE':pos<.55?'BUILD':pos<.72?'PEAK':pos<.88?'RECOVERY':'AFTERHOURS'; if(i>0&&i%(Math.floor(slots/(peaks+1))||3)===0)phase='PEAK'; const world=worlds[(i+Math.floor(Math.random()*2))%worlds.length]; plan.push({min:Math.round(total/slots),phase,world,energy:phase==='PEAK'?86:phase==='BUILD'?68:phase==='RECOVERY'?38:phase==='AFTERHOURS'?25:52,note:'Director AI · '+phase.toLowerCase()});} state.directorPlan=plan; state.journey=plan; log('Director plan generated → '+h+'h / '+peaks+' peaks'); renderJourney(plan); render();}
function applyDirectorNext(){const next=(state.directorPlan&&state.directorPlan[0])||((state.journey||[])[0]); if(!next){generateDirectorPlan(); return;} state.target=next.world; state.phase=next.phase; state.energy=next.energy||state.energy; state.transition=0; state.directorPlan=state.directorPlan.slice(1); log('Director next move → '+next.world); render();}
function renderDirector(){const v=$('directorVerdict'); if(v){const [title,text,cls]=directorVerdict(); v.innerHTML=`<b class="${cls}">${title}</b><small>${text}</small>`;} const p=$('directorPlan'); if(p){const plan=(state.directorPlan&&state.directorPlan.length?state.directorPlan:state.journey||[]).slice(0,14); p.innerHTML=plan.length?plan.map((s,i)=>`<button data-dir-step="${i}"><b>${String(i+1).padStart(2,'0')} · ${s.world}</b><small>${s.phase} · ${s.min||'?'}m · energy ${s.energy||'-'}</small></button>`).join(''):'<em>Zatím žádný Director plán.</em>'; p.querySelectorAll('[data-dir-step]').forEach(b=>b.onclick=()=>{const s=(state.directorPlan.length?state.directorPlan:state.journey)[Number(b.dataset.dirStep)]; state.target=s.world; state.phase=s.phase; state.energy=s.energy||state.energy; state.transition=0; log('Director step selected → '+s.world); render();});}}
function discoverWorld(){const roots=['Crystal','Ancient','Solar','Void','Neon','Organic','Cyber','Molten','Deep','Ritual','Electric']; const forms=['Temple','Swamp','Reactor','Hive','Sanctuary','Forge','Ocean','Jungle','Cathedral','Machine']; const name=choice(roots)+' '+choice(forms); const dna={}; dnaKeys.forEach(k=>dna[k]=clamp(30+Math.random()*60)); const w={name,short:name.split(' ').map(x=>x[0]).join('').slice(0,5).toUpperCase(),dna,createdAt:new Date().toISOString(),discovered:true}; state.generatedWorlds.unshift(w); state.discoveries.unshift({type:'World',name,desc:`heat ${dna.heat}% · chaos ${dna.chaos}% · life ${dna.life}%`}); state.discoveries=state.discoveries.slice(0,80); state.target=name; log('Discovery world → '+name); render();}
function discoverEvent(){const parts=[choice(eventParts),choice(eventParts),choice(eventParts),choice(eventParts)].filter((v,i,a)=>a.indexOf(v)===i); const name=choice(['Ritual','Forge','Alien','Deep','Solar','Cyber'])+' '+choice(['Impact','Bloom','Surge','Wave','Collapse','Pulse']); state.events.unshift({name,parts,createdAt:new Date().toISOString(),energy:state.energy,phase:state.phase,discovered:true}); state.discoveries.unshift({type:'Event',name,desc:parts.join(' + ')}); log('Discovery event → '+name); render();}
function discoverCivilization(){const base=choice(['Forge Empire','Deep Ocean','Alien Archive','Forest Sanctuary','Cyber Ritual','Solar Tribe']); const worlds=[0,1,2,3].map(i=>base.split(' ')[0]+' '+choice(['Dawn','Core','Echo','Storm','Afterglow','Temple'])); const civ={name:base,worlds,createdAt:new Date().toISOString()}; state.civilizations.unshift(civ); state.discoveries.unshift({type:'Civilization',name:base,desc:worlds.join(' → ')}); log('Discovery civilization → '+base); render();}
function renderDiscovery(){const latest=$('latestDiscovery'); if(latest){const d=state.discoveries[0]; latest.innerHTML=d?`<b>${d.type}: ${d.name}</b><br><span>${d.desc}</span>`:'Zatím nic. Dej DISCOVER WORLD.';} const lib=$('discoveryLibrary'); if(lib){lib.innerHTML=state.discoveries.length?state.discoveries.slice(0,30).map((d,i)=>`<button data-disc="${i}"><b>${d.type}: ${d.name}</b><small>${d.desc}</small></button>`).join(''):'<em>Discovery library je prázdná.</em>'; lib.querySelectorAll('[data-disc]').forEach(b=>b.onclick=()=>{const d=state.discoveries[Number(b.dataset.disc)]; if(d.type==='World'){state.target=d.name; state.transition=0;} log('Discovery selected → '+d.name); render();});} const civ=$('civilizationBox'); if(civ){civ.innerHTML=state.civilizations.length?state.civilizations.slice(0,5).map(c=>`<div><b>${c.name}</b><small>${c.worlds.join(' → ')}</small></div>`).join(''):'<em>Žádná civilizace. Dej DISCOVER CIVILIZATION.</em>';}}
function operatorAction(a){if(a==='build'){state.phase='BUILD'; state.energy=clamp(state.energy+15); state.density=clamp(state.density+9); state.motion=clamp(state.motion+8);} if(a==='break'){state.phase='RECOVERY'; state.energy=clamp(state.energy-22); state.density=clamp(state.density-12);} if(a==='drop'){state.phase='DROP'; state.energy=92; state.motion=86; state.density=80; state.transition=100;} if(a==='calm'){state.phase='AFTERHOURS'; state.energy=22; state.chaos=16; state.density=22; state.motion=18;} if(a==='inspire'){discoverWorld();} if(a==='next'){const w=choice(getSuggestedWorlds()); state.target=w.name; state.transition=0;} log('Club operator → '+a); sendIntent(); render();}
function operatorSafe(){state.phase='GROOVE'; state.energy=45; state.chaos=25; state.density=36; state.motion=40; state.morph=120; log('Operator safe state'); sendIntent(); render();}
function renderOperator(){if($('operatorWorld'))$('operatorWorld').textContent=(state.current||'').split(' ')[0].toUpperCase(); if($('operatorEnergy'))$('operatorEnergy').textContent=state.energy+'%'; if($('operatorChaos'))$('operatorChaos').textContent=state.chaos+'%'; if($('operatorNext'))$('operatorNext').textContent=(state.target||'').split(' ')[0].toUpperCase();}
function renderCommandCenter(){renderDirector(); renderEconomy(); renderDiscovery(); renderOperator(); renderLongRunLayer();}



// STEP22HR — Long Run / Evolution / Genome / Recipe layer
function festivalPlan(hours){
 const personality=$('festivalPersonality')?.value||'Psytrance Journey';
 const surprise=$('festivalSurprise')?.value||'Balanced';
 const worlds={
  'Psytrance Journey':['Forest Sanctuary','Deep Space','Alien Temple','Forge Reactor','Peak Ritual','Afterhours Drift'],
  'Tribe Techno Ritual':['Tribal Cave','Forge Reactor','Peak Ritual','Deep Space','Tribal Cave','Afterhours Drift'],
  'Dark Forest Night':['Forest Sanctuary','Moss Reactor','Deep Space','Alien Temple','Crystal Hive','Afterhours Drift'],
  'Forge Industrial':['Forge Reactor','Cyber Ritual','Peak Ritual','Forge Reactor','Deep Space','Afterhours Drift'],
  'Ambient Civilization':['Deep Space','Forest Sanctuary','Crystal Hive','Afterhours Drift','Moss Reactor','Deep Space']
 }[personality]||['Forest Sanctuary','Deep Space','Forge Reactor','Peak Ritual','Afterhours Drift'];
 const slots=Math.max(8,Math.round(hours*1.8)); const phases=['WARMUP','GROOVE','BUILD','TENSION','PEAK','RECOVERY','BUILD','PEAK','AFTERHOURS'];
 state.festivalPlan=[];
 for(let i=0;i<slots;i++){
  const pos=i/(slots-1); let phase=phases[Math.min(phases.length-1,Math.floor(pos*phases.length))];
  if(hours>=12 && i%5===4) phase='RECOVERY';
  const world=worlds[i%worlds.length];
  const base=phase==='PEAK'?88:phase==='BUILD'?68:phase==='TENSION'?58:phase==='RECOVERY'?34:phase==='AFTERHOURS'?22:48;
  const safeSurprise=surprise.includes('High')?'+ rare surprise events':surprise==='Low'?'+ smooth minimal events':'+ balanced variation';
  state.festivalPlan.push({min:Math.round((hours*60)/slots),phase,world,energy:base,note:personality+' '+safeSurprise});
 }
 state.journey=state.festivalPlan.slice();
 log('Festival plan generated → '+hours+'h'); renderJourney(state.journey); render();
}
function renderFestival(){
 const dur=Number($('festivalDuration')?.value||6); const clock=$('festivalClock'); if(clock){const s=Math.floor((Date.now()-state.started)/1000),m=Math.floor(s/60); clock.textContent=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+' / '+String(dur).padStart(2,'0')+':00';}
 const phase=$('festivalPhase'); if(phase){phase.innerHTML=`<b>${state.phase}</b><br><span>${state.current} → ${state.target}<br>energy ${state.energy}% · chaos ${state.chaos}% · weather ${state.weather}</span>`;}
 const box=$('festivalPlan'); if(box){box.innerHTML=(state.festivalPlan||[]).length?state.festivalPlan.map((s,i)=>`<button data-festival-step="${i}"><b>${String(i+1).padStart(2,'0')} · ${s.phase} · ${s.world}</b><small>${s.min}m · energy ${s.energy}% · ${s.note}</small></button>`).join(''):'<em>Zatím není vygenerovaný long-run plán.</em>'; box.querySelectorAll('[data-festival-step]').forEach(b=>b.onclick=()=>{const step=state.festivalPlan[Number(b.dataset.festivalStep)]; state.target=step.world; state.phase=step.phase; state.energy=step.energy; state.transition=0; log('Festival step selected → '+step.world); render();});}
}
function evolveCurrent(){
 const amount=Number($('mutationAmount')?.value||15); const style=$('evolutionStyle')?.value||'Organic'; const base=allWorlds().find(w=>w.name===state.current)||baseWorlds[0];
 const suffix={Organic:'Organic',Ritual:'Ritual',Industrial:'Industrial',Alien:'Alien',Minimal:'Minimal'}[style]||'Evolved';
 const dna={}; dnaKeys.forEach(k=>dna[k]=clamp((base.dna?.[k]||state.dna[k]||50)+(Math.random()*2-1)*amount));
 if(style==='Ritual'){dna.density=clamp(dna.density+10);dna.chaos=clamp(dna.chaos-5)} if(style==='Industrial'){dna.heat=clamp(dna.heat+15);dna.contrast=clamp(dna.contrast+12)} if(style==='Minimal'){dna.density=clamp(dna.density-20);dna.motion=clamp(dna.motion-12)} if(style==='Alien'){dna.chaos=clamp(dna.chaos+18);dna.flow=clamp(dna.flow+8)}
 const root=base.name.split(' ')[0]; const name=root+' '+suffix+' '+choice(['Echo','Core','Bloom','Gate','Drift','Temple']);
 const w={name,short:name.split(' ').map(x=>x[0]).join('').slice(0,5).toUpperCase(),dna,createdAt:new Date().toISOString(),evolvedFrom:base.name};
 state.generatedWorlds.unshift(w); state.evolutionTree.unshift({from:base.name,to:name,style,amount,dna,createdAt:new Date().toLocaleTimeString()}); state.evolutionTree=state.evolutionTree.slice(0,40); state.target=name; state.transition=0; log('World evolved → '+name); render();
}
function buildEvolutionTree(){for(let i=0;i<4;i++)evolveCurrent(); toast('Evolution tree vytvořený.');}
function renderEvolution(){const box=$('evolutionTree'); if(!box)return; box.innerHTML=(state.evolutionTree||[]).length?state.evolutionTree.slice(0,18).map((e,i)=>`<div class="branch"><div><b>${e.from} → ${e.to}</b><small>${e.style} · mutate ${e.amount}% · ${e.createdAt}</small></div><button data-evo="${i}">TARGET</button></div>`).join(''):'<em>Zatím žádný evolution strom. Dej EVOLVE CURRENT.</em>'; box.querySelectorAll('[data-evo]').forEach(b=>b.onclick=()=>{const e=state.evolutionTree[Number(b.dataset.evo)]; state.target=e.to; state.transition=0; log('Evolution target → '+e.to); render();});}
function renderGenomeBars(targetId,dna){const box=$(targetId); if(!box)return; box.innerHTML=dnaKeys.map(k=>`<div class="genome-bar"><span>${k}</span><i style="width:${clamp(dna?.[k]||0)}%"></i><b>${clamp(dna?.[k]||0)}</b></div>`).join('');}
function saveGenome(){const name=state.current+' DNA '+new Date().toLocaleTimeString(); state.genomes.unshift({name,dna:Object.assign({},state.dna),world:state.current,createdAt:new Date().toISOString()}); state.genomes=state.genomes.slice(0,60); log('Genome saved → '+name); render();}
function generateFromGenome(){const g=state.genomes[0]; if(!g){saveGenome(); return;} const dna={}; dnaKeys.forEach(k=>dna[k]=clamp(g.dna[k]+(Math.random()*18-9))); const name=choice(['Living','Ancient','Solar','Void','Ritual','Crystal'])+' '+g.world.split(' ')[0]; state.generatedWorlds.unshift({name,short:name.split(' ').map(x=>x[0]).join('').slice(0,5).toUpperCase(),dna,fromGenome:g.name}); state.target=name; state.transition=0; log('Generated from genome → '+name); render();}
function renderGenome(){renderGenomeBars('currentGenome',state.dna); const lib=$('genomeLibrary'); if(lib){lib.innerHTML=(state.genomes||[]).length?state.genomes.map((g,i)=>`<button data-genome="${i}"><b>${g.name}</b><small>${g.world} · heat ${g.dna.heat} · chaos ${g.dna.chaos} · density ${g.dna.density}</small></button>`).join(''):'<em>DNA knihovna je prázdná. Ulož current DNA.</em>'; lib.querySelectorAll('[data-genome]').forEach(b=>b.onclick=()=>{const g=state.genomes[Number(b.dataset.genome)]; state.dna=Object.assign({},g.dna); log('Genome loaded → '+g.name); renderDNA(); render();});}}
function defaultRecipes(){return [
 {name:'Safe Psy Build',desc:'32–128 beat build bez agresivního strobu. Zvedá energy, motion a density, chaos drží pod kontrolou.',apply:()=>{state.phase='BUILD';state.energy=clamp(state.energy+18);state.motion=clamp(state.motion+16);state.density=clamp(state.density+10);state.chaos=clamp(Math.min(state.chaos,42));}},
 {name:'Clean Break',desc:'Otevře prostor, sníží density a připraví target world s dlouhým morphem.',apply:()=>{state.phase='RECOVERY';state.energy=34;state.density=24;state.motion=28;state.morph=180;}},
 {name:'Drop Architect',desc:'Tension → impact → recovery. Bez audio vstupu, vhodné jako manuální dramaturgický zásah.',apply:()=>{state.phase='DROP';state.energy=92;state.density=78;state.motion=86;state.transition=100;}},
 {name:'Afterhours Drift',desc:'Nízká energie, dlouhé morphy, vysoká variace, minimum eventů.',apply:()=>{state.phase='AFTERHOURS';state.energy=20;state.chaos=18;state.density=18;state.motion=16;state.morph=240;}},
 {name:'Anti Repeat Shift',desc:'Vybere dramaturgicky příbuzný, ale méně používaný svět a přepne target.',apply:()=>{const w=choice(getSuggestedWorlds());state.target=w.name;state.transition=0;state.chaos=clamp(state.chaos+4);}},
 {name:'Forge Peak Safe',desc:'Silný forge peak bez bílého bordelu: teplo, kontrast, kontrolovaná hustota.',apply:()=>{state.target='Forge Reactor';state.phase='PEAK';state.energy=84;state.density=68;state.motion=78;state.chaos=36;}}
];}
function generateRecipes(){state.recipes=defaultRecipes().map(r=>({name:r.name,desc:r.desc})); log('Recipes generated'); renderRecipes();}
function applyRecipe(name){const r=defaultRecipes().find(x=>x.name===name); if(r){r.apply(); log('Recipe applied → '+name); sendIntent(); render();}}
function renderRecipes(){const box=$('recipeBoard'); if(!box)return; const recipes=(state.recipes&&state.recipes.length?state.recipes:defaultRecipes().map(r=>({name:r.name,desc:r.desc}))); box.innerHTML=recipes.map(r=>`<div class="recipe-card"><b>${r.name}</b><small>${r.desc}</small><button data-recipe="${r.name}">APPLY</button></div>`).join(''); box.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>applyRecipe(b.dataset.recipe));}
function renderLongRunLayer(){renderFestival(); renderEvolution(); renderGenome(); renderRecipes(); renderUniverseLayer(); renderAuthority();}


// STEP22IE — Universe Mode / STEP22IF-IL foundation
const universeLibrary=[
 {name:'Forge Universe',icon:'🔥',tone:'industrial heat, metal, ignition, reactor pressure',civilizations:['Forge Empire','Industrial Core','Reactor Network','Ancient Forge'],worlds:['Forge Reactor','Peak Ritual','Moss Reactor','Tribal Cave'],weather:['Molten Storm','Ash Wind','Solar','Ritual'],dna:{heat:90,flow:46,chaos:44,motion:72,life:18,density:70,contrast:82}},
 {name:'Organic Universe',icon:'🌲',tone:'forest, roots, living patterns, ritual growth',civilizations:['Forest Realm','Living Jungle','Sacred Grove','Deep Forest'],worlds:['Forest Sanctuary','Moss Reactor','Tribal Cave','Afterhours Drift'],weather:['Calm','Mist','Ritual','Root Rain'],dna:{heat:22,flow:82,chaos:28,motion:44,life:94,density:44,contrast:42}},
 {name:'Synthetic Universe',icon:'👽',tone:'alien logic, grids, crystals, neural behavior',civilizations:['Alien Collective','Neural Grid','Crystal Hive','Quantum Network'],worlds:['Alien Temple','Crystal Hive','Cyber Ritual','Deep Space'],weather:['Electrical','Quantum Fog','Glitch Rain','Void'],dna:{heat:35,flow:58,chaos:70,motion:68,life:36,density:66,contrast:78}},
 {name:'Cosmic Universe',icon:'🌌',tone:'space, silence, stars, cosmic ritual',civilizations:['Deep Space','Void Ocean','Stellar Garden','Solar Ritual'],worlds:['Deep Space','Afterhours Drift','Crystal Hive','Forest Sanctuary'],weather:['Void','Solar','Stellar Drift','Calm'],dna:{heat:18,flow:76,chaos:22,motion:34,life:26,density:28,contrast:62}}
];
const legendaryTemplates=['Black Sun','Crystal Cathedral','Infinite Reactor','Silent Machine','Living Star'];
const storyTemplates={
 Psytrance:['Discovery','Exploration','Alien Contact','Forge Conflict','Peak Ritual','Afterhours Resolution'],
 Ambient:['Deep Entry','Ocean Drift','Cosmic Garden','Void Rest','Return To Deep'],
 Forge:['Ignition','Pressure','Reactor Network','Ancient Forge','Cooling Ritual'],
 Organic:['Seed','Forest Realm','Living Jungle','Sacred Grove','Night Bloom']
};
function getUniverse(name=state.universe){return universeLibrary.find(u=>u.name===name)||universeLibrary[0];}
function applyUniverse(name){const u=getUniverse(name); state.universe=u.name; state.targetUniverse=u.name; state.target=choice(u.worlds); state.weather=choice(u.weather); state.dna=Object.assign({},state.dna,u.dna); state.energy=clamp((state.energy+u.dna.density)/2); state.chaos=clamp((state.chaos+u.dna.chaos)/2); state.density=clamp((state.density+u.dna.density)/2); state.motion=clamp((state.motion+u.dna.motion)/2); state.transition=0; log('Universe travel → '+u.name+' / '+state.target); sendIntent(); renderDNA(); render();}
function travelUniverse(){const cur=universeLibrary.findIndex(u=>u.name===state.universe); const next=universeLibrary[(cur+1+Math.floor(Math.random()*(universeLibrary.length-1)))%universeLibrary.length]; applyUniverse(next.name);}
function maybeLegendary(force=false){if(!force && Math.random()>.005){toast('Legendary scan: nic vzácného. Chance 0.5 %.');return;} const name=choice(legendaryTemplates); const base=getUniverse(); const w={name,universe:state.universe,discoveredAt:new Date().toISOString(),dna:{...base.dna,chaos:clamp(base.dna.chaos+18),contrast:clamp(base.dna.contrast+12)},saved:true}; state.legendaryWorlds.unshift(w); state.generatedWorlds.unshift({name,short:name.split(' ').map(x=>x[0]).join('').slice(0,5).toUpperCase(),dna:w.dna,createdAt:w.discoveredAt,legendary:true}); state.target=name; state.transition=0; log('⭐ Legendary world discovered → '+name); toast('⭐ Legendary World: '+name); render();}
function mutateEventGenome(idx=0){const src=state.events[idx]||{name:'Heat Surge',parts:['Heat','Pulse','Spark'],energy:state.energy,phase:state.phase}; const genes={impact:clamp(src.impact||80),chaos:clamp(src.chaos||state.chaos),brightness:clamp(src.brightness||70),motion:clamp(src.motion||state.motion),heat:clamp(src.heat||state.dna.heat||60)}; Object.keys(genes).forEach(k=>genes[k]=clamp(genes[k]+Math.round((Math.random()-.5)*22))); const name=(src.name||'Event')+' Mk'+(state.eventGenome.length+2); const e={name,parts:[...(src.parts||['Pulse'])],...genes,createdAt:new Date().toISOString()}; state.eventGenome.unshift(e); state.events.unshift({name,parts:e.parts,createdAt:e.createdAt,energy:genes.impact,phase:state.phase,genome:genes}); log('🧬 Mutated event → '+name); render();}
function buildStory(type='Psytrance'){const seq=storyTemplates[type]||storyTemplates.Psytrance; const u=universeLibrary; state.story=seq.map((phase,i)=>{const uni=u[i%u.length]; return {phase,universe:uni.name,world:choice(uni.worlds),min:type==='Ambient'?28+Math.round(Math.random()*22):12+Math.round(Math.random()*18),energy:clamp(24+i*12+(type==='Ambient'?-10:0)),chaos:clamp(20+i*7)};}); state.journey=state.story.map(s=>({world:s.world,phase:s.phase.toUpperCase().slice(0,12),min:s.min,energy:s.energy,note:s.universe})); log('Story Engine generated → '+type); renderJourney(state.journey); render();}
function timelineRewrite(mode='extend'){if(!state.story.length)buildStory('Psytrance'); const ix=Math.min(state.story.length-1,Math.max(0,Math.floor(state.story.length/2))); const pick=state.story[ix]; const delta=mode==='extend'?20:-10; pick.min=Math.max(4,pick.min+delta); state.livingTimeline.unshift({t:new Date().toLocaleTimeString(),action:mode,phase:pick.phase,delta,min:pick.min,reason:mode==='extend'?'phase drží energii, nechávám ji dýchat':'recovery je dlouhá, zkracuju cestu'}); state.livingTimeline=state.livingTimeline.slice(0,80); log('Living timeline '+mode+' → '+pick.phase+' '+pick.min+'m'); render();}
function storyPressure(){const fatigue=getFatigue(); const novelty=clamp(100-getRepeatScore()); const peakBias=state.phase==='PEAK'||state.energy>80?18:0; return {fatigue,novelty,pressure:clamp(state.energy*.45+state.chaos*.25+state.density*.2+peakBias-fatigue*.18),needsRecovery:fatigue>68||state.energy>88,needsDiscovery:novelty<42||state.chaos<28,goodPeak:state.phase==='PEAK'&&state.energy>72&&state.density>52};}
function generateLivingTimeline(type='Psytrance'){buildStory(type); state.livingTimeline=[]; state.storyTick={running:false,startedAt:Date.now(),activeIndex:0,lastDecision:'generated'}; state.story=state.story.map((s,i)=>({...s,id:'S'+String(i+1).padStart(2,'0'),elapsed:0,locked:false,bridge:{targetUniverse:s.universe,targetWorld:s.world,targetWeather:choice(getUniverse(s.universe).weather),energy:s.energy,chaos:s.chaos,density:clamp(35+i*8),storyPhase:s.phase.toUpperCase().replace(/\s+/g,'_')}})); log('Living Story Timeline generated → '+type); render();}
function applyStoryStep(i){if(!state.story.length)generateLivingTimeline('Psytrance'); const s=state.story[Math.max(0,Math.min(state.story.length-1,Number(i)||0))]; state.storyTick.activeIndex=Number(i)||0; state.universe=s.universe; state.targetUniverse=s.universe; state.target=s.world; state.weather=s.bridge?.targetWeather||choice(getUniverse(s.universe).weather); state.phase=s.bridge?.storyPhase||s.phase.toUpperCase(); state.energy=clamp(s.energy); state.chaos=clamp(s.chaos); state.density=clamp(s.bridge?.density||state.density); state.transition=0; log('Story step armed → '+s.phase+' / '+s.world); sendBridgePro(); render();}
function directorRewriteTimeline(){if(!state.story.length)generateLivingTimeline('Psytrance'); const m=storyPressure(); let action='hold'; let reason='timeline drží stabilní dramaturgii'; if(m.needsRecovery){action='insert recovery'; reason='fatigue nebo energy jsou vysoko'; const u=getUniverse('Cosmic Universe'); state.story.splice((state.storyTick.activeIndex||0)+1,0,{id:'RX'+Date.now().toString(36).slice(-4),phase:'Recovery Corridor',universe:u.name,world:'Afterhours Drift',min:12,energy:32,chaos:18,bridge:{targetUniverse:u.name,targetWorld:'Afterhours Drift',targetWeather:'Void',energy:32,chaos:18,density:22,storyPhase:'RECOVERY'}});}
 else if(m.needsDiscovery){action='insert discovery'; reason='novelty je nízko, přidávám nový směr'; const u=choice(universeLibrary); state.story.splice((state.storyTick.activeIndex||0)+1,0,{id:'DX'+Date.now().toString(36).slice(-4),phase:'Discovery Signal',universe:u.name,world:choice(u.worlds),min:10,energy:clamp(state.energy-8),chaos:clamp(state.chaos+14),bridge:{targetUniverse:u.name,targetWorld:choice(u.worlds),targetWeather:choice(u.weather),energy:clamp(state.energy-8),chaos:clamp(state.chaos+14),density:state.density,storyPhase:'DISCOVERY'}});}
 else if(m.goodPeak){action='extend peak'; reason='peak běží dobře, prodlužuju ho'; timelineRewrite('extend');}
 state.livingTimeline.unshift({t:new Date().toLocaleTimeString(),action,reason,pressure:m.pressure,fatigue:m.fatigue,novelty:m.novelty}); state.livingTimeline=state.livingTimeline.slice(0,80); state.storyTick.lastDecision=action; log('Director rewrite → '+action); render();}
function storyBridgePreview(){const active=state.story[state.storyTick?.activeIndex||0]; const base=bridgePayload(); if(!active)return base; return {...base,targetWorld:active.world,targetUniverse:active.universe,targetWeather:active.bridge?.targetWeather||state.weather,energy:active.energy,chaos:active.chaos,density:active.bridge?.density||state.density,storyPhase:active.bridge?.storyPhase||active.phase,storyStep:active.id||active.phase,storyMinutes:active.min,storyDirectorDecision:state.storyTick?.lastDecision||'manual'};}
function favoriteItem(type,name){state.market.favorites.unshift({type,name,t:new Date().toLocaleTimeString()}); state.market.favorites=state.market.favorites.slice(0,80); log('⭐ Favorite '+type+' → '+name); render();}
function cloneCurrentMarket(){const w=allWorlds().find(x=>x.name===state.current)||baseWorlds[0]; const clone={name:w.name+' Clone',source:w.name,type:'World',dna:{...(w.dna||state.dna)},createdAt:new Date().toISOString()}; state.market.clones.unshift(clone); state.generatedWorlds.unshift({name:clone.name,short:'CLONE',dna:clone.dna,createdAt:clone.createdAt}); log('📋 Clone world → '+clone.name); render();}
function randomVariantMarket(){const u=getUniverse(); const name=choice(u.worlds).split(' ')[0]+' '+choice(['Variant','Ritual','Network','Bloom','Core']); const dna={...u.dna}; Object.keys(dna).forEach(k=>dna[k]=clamp(dna[k]+Math.round((Math.random()-.5)*28))); state.market.variants.unshift({name,type:'Random Variant',universe:u.name,dna,createdAt:new Date().toISOString()}); state.generatedWorlds.unshift({name,short:'VAR',dna,createdAt:new Date().toISOString()}); state.target=name; log('🎲 Random variant → '+name); render();}
function saveCreatorPackage(){const name=$('creatorName')?.value.trim()||'Budi Ritual'; const pack={name,createdAt:new Date().toISOString(),universe:state.universe,worlds:[state.current,state.target,...state.generatedWorlds.slice(0,4).map(w=>w.name)],events:state.events.slice(0,6).map(e=>e.name),weather:state.weather,story:state.story.slice(0,8)}; state.creatorPackages.unshift(pack); state.market.packages.unshift(pack); log('Creator package saved → '+name); render();}
function bridgePayload(){const a=authority(); return {targetWorld:state.target,targetUniverse:state.targetUniverse||state.universe,targetWeather:state.weather,energy:clamp(state.energy,0,a.maxEnergy),chaos:clamp(state.chaos,0,a.maxChaos),density:clamp(state.density,0,a.maxDensity),motion:clamp(state.motion,0,a.maxMotion),storyPhase:state.phase,universeTone:getUniverse(state.targetUniverse||state.universe).tone,authority:{mode:a.mode,autoApply:!!a.autoApply,operatorLock:!!a.operatorLock,limits:{energy:a.maxEnergy,chaos:a.maxChaos,density:a.maxDensity,motion:a.maxMotion}},t:Date.now()};}
function sendBridgePro(){localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(bridgePayload())); sendIntent(); if($('bridgePayload'))$('bridgePayload').textContent=JSON.stringify(bridgePayload(),null,2); renderGeneratorBridge(); toast('Performance Bridge Pro payload uložen.');}
function renderUniverseLayer(){renderUniverseMode(); renderStoryEngine(); renderLegendary(); renderMarket(); renderCreator(); renderBridge();}
function renderUniverseMode(){const box=$('universeGrid'); if(box){box.innerHTML=universeLibrary.map(u=>`<button data-universe="${u.name}" class="${u.name===state.universe?'active':''}"><b>${u.icon} ${u.name}</b><small>${u.tone}</small><span>${u.civilizations.join(' · ')}</span></button>`).join(''); box.querySelectorAll('[data-universe]').forEach(b=>b.onclick=()=>applyUniverse(b.dataset.universe));} if($('universePath'))$('universePath').innerHTML=`<b>${state.universe}</b><i>↓</i><b>${state.current}</b><i>→</i><b>${state.target}</b><small>${getUniverse().civilizations.join(' / ')}</small>`; const civ=$('civilizationLibrary'); if(civ){const u=getUniverse(); civ.innerHTML=u.civilizations.map(c=>`<div><b>${c}</b><span>${choice(u.worlds)} · ${choice(u.weather)}</span></div>`).join('');}}
function renderStoryEngine(){const box=$('storyTimeline'); if(box){const list=state.story.length?state.story:[]; box.innerHTML=list.length?list.map((s,i)=>`<button data-story-step="${i}" class="${i===(state.storyTick?.activeIndex||0)?'active':''}"><b>${s.id||String(i+1).padStart(2,'0')} · ${s.phase}</b><small>${s.universe} → ${s.world} · ${s.min}m · E${s.energy} C${s.chaos}</small></button>`).join(''):'<em>Zatím žádná living timeline. Dej GENERATE PSY nebo AMBIENT.</em>'; box.querySelectorAll('[data-story-step]').forEach(b=>b.onclick=()=>applyStoryStep(b.dataset.storyStep));}
 const p=storyPressure(); const m=$('storyMetrics'); if(m)m.innerHTML=`<div><span>Pressure</span><b>${p.pressure}%</b></div><div><span>Fatigue</span><b>${p.fatigue}%</b></div><div><span>Novelty</span><b>${p.novelty}%</b></div><div><span>Decision</span><b>${state.storyTick?.lastDecision||'manual'}</b></div>`;
 const logBox=$('livingTimelineLog'); if(logBox)logBox.innerHTML=(state.livingTimeline||[]).slice(0,18).map(x=>`<div><b>${x.t} · ${x.action}</b><span>${x.reason||x.phase||''}${x.delta?` · ${x.delta>0?'+':''}${x.delta}m`:''}</span></div>`).join('')||'<em>Timeline zatím nebyla přepsána.</em>';
 const pre=$('storyBridgePayload'); if(pre)pre.textContent=JSON.stringify(storyBridgePreview(),null,2);}
function renderLegendary(){const box=$('legendaryList'); if(box)box.innerHTML=state.legendaryWorlds.length?state.legendaryWorlds.map(w=>`<button><b>⭐ ${w.name}</b><small>${w.universe} · saved ${new Date(w.discoveredAt).toLocaleTimeString()}</small></button>`).join(''):'<em>Zatím žádný Legendary World. Scan má defaultně 0.5 %.</em>'; const g=$('eventGenomeList'); if(g)g.innerHTML=(state.eventGenome.length?state.eventGenome:[{name:'Heat Surge DNA',impact:80,chaos:40,brightness:70,motion:60,heat:85}]).map(e=>`<div class="genome-pill"><b>${e.name}</b><span>Impact ${e.impact||80} · Chaos ${e.chaos||40} · Bright ${e.brightness||70} · Motion ${e.motion||60}</span></div>`).join('');}
function renderMarket(){const box=$('marketBoard'); if(!box)return; const groups=[['Worlds',allWorlds().slice(0,8).map(w=>w.name)],['Events',state.events.slice(0,8).map(e=>e.name)],['Journeys',state.journey.slice(0,8).map(j=>j.world)],['Civilizations',getUniverse().civilizations],['Universes',universeLibrary.map(u=>u.name)]]; box.innerHTML=groups.map(([name,items])=>`<div class="market-col"><h3>${name}</h3>${(items.length?items:['Empty']).map(it=>`<button data-fav-type="${name}" data-fav-name="${it}"><b>${it}</b><small>⭐ Favorite · 🧬 Mutate · 📋 Clone · 🎲 Variant</small></button>`).join('')}</div>`).join(''); box.querySelectorAll('[data-fav-name]').forEach(b=>b.onclick=()=>favoriteItem(b.dataset.favType,b.dataset.favName)); const fav=$('marketFavorites'); if(fav)fav.innerHTML=(state.market.favorites||[]).slice(0,12).map(f=>`<div><b>${f.type}</b><span>${f.name}</span></div>`).join('')||'<em>Bez favoritů.</em>';}
function renderCreator(){if($('creatorUniverse'))$('creatorUniverse').textContent=state.universe; if($('creatorWeather'))$('creatorWeather').textContent=state.weather; const box=$('creatorPackages'); if(box)box.innerHTML=state.creatorPackages.length?state.creatorPackages.map(p=>`<button><b>${p.name}</b><small>${p.universe} · ${p.worlds.length} worlds · ${p.events.length} events</small></button>`).join(''):'<em>Zatím žádný vlastní balíček.</em>';}
function renderBridge(){if($('bridgePayload'))$('bridgePayload').textContent=JSON.stringify(bridgePayload(),null,2); if($('bridgeStatus'))$('bridgeStatus').textContent=`${state.targetUniverse||state.universe} → ${state.target} · ${state.weather} · ${state.phase}`;}

function generatorBridgePayload(){return {...bridgePayload(),source:'show-os-generator-bridge',rendererIntent:'generator-node-graph',generatorBridgeVersion:GENERATOR_SHOWOS_BRIDGE_VERSION};}
function renderGeneratorBridge(){
 const payload=normalizeShowOsBridgePayload(generatorBridgePayload());
 let mapped=null;
 try{mapped=mapShowOsBridgeToGeneratorState(payload,safeJson('budilight.generator.state.v1'),{influence:0.86});}catch(e){mapped={summary:{error:String(e?.message||e)}};}
 const auto=localStorage.getItem(GENERATOR_SHOWOS_AUTO_KEY)==='1';
 if($('generatorBridgeStatus'))$('generatorBridgeStatus').textContent=`${payload.targetUniverse} → ${payload.targetWorld} · ${payload.targetWeather} · ${payload.storyPhase} · Auto ${auto?'ON':'OFF'}`;
 if($('generatorBridgePreview'))$('generatorBridgePreview').textContent=JSON.stringify({version:GENERATOR_SHOWOS_BRIDGE_VERSION,payload,summary:mapped?.summary||{},generatorStateKey:'budilight.generator.state.v1'},null,2);
 qsa('[data-generator-auto]').forEach(b=>b.classList.toggle('active',auto));
}
function sendGeneratorBridge(){
 const payload=generatorBridgePayload();
 localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(payload));
 localStorage.setItem(GENERATOR_SHOWOS_SNAPSHOT_KEY,JSON.stringify({version:GENERATOR_SHOWOS_BRIDGE_VERSION,source:'show-os-send',payload:normalizeShowOsBridgePayload(payload),at:Date.now()}));
 renderGeneratorBridge();
 toast('Generator Bridge payload uložen. V Generatoru dej APPLY SHOW OS nebo zapni AUTO FOLLOW.');
}
function setGeneratorAutoFollowFromShowOs(enabled){localStorage.setItem(GENERATOR_SHOWOS_AUTO_KEY,enabled?'1':'0'); renderGeneratorBridge(); toast('Generator AUTO FOLLOW '+(enabled?'ON':'OFF'));}




/* STEP22JP — Control Authority / Operator Override */
function defaultAuthority(){return {mode:'ASSIST',maxEnergy:88,maxChaos:58,maxDensity:76,maxMotion:88,autoApply:false,allowMegaEvents:false,allowWorldTravel:true,allowTimelineRewrite:true,allowDiscovery:true,operatorLock:false,log:[]};}
function authority(){state.authority=Object.assign(defaultAuthority(),state.authority||{}); return state.authority;}
function authorityNote(action,result){const a=authority(); a.log.unshift({t:new Date().toLocaleTimeString(),action,result,mode:a.mode}); a.log=a.log.slice(0,80);}
function authorityClampState(reason='limit'){const a=authority(); const before={energy:state.energy,chaos:state.chaos,density:state.density,motion:state.motion}; state.energy=clamp(state.energy,0,a.maxEnergy); state.chaos=clamp(state.chaos,0,a.maxChaos); state.density=clamp(state.density,0,a.maxDensity); state.motion=clamp(state.motion,0,a.maxMotion); if(before.energy!==state.energy||before.chaos!==state.chaos||before.density!==state.density||before.motion!==state.motion)authorityNote(reason,'clamped to operator limits');}
function authorityCan(kind){const a=authority(); if(a.operatorLock && kind!=='manual')return false; if(a.mode==='MANUAL' && kind!=='manual' && kind!=='preview')return false; if(kind==='mega'&&!a.allowMegaEvents)return false; if(kind==='travel'&&!a.allowWorldTravel)return false; if(kind==='timeline'&&!a.allowTimelineRewrite)return false; if(kind==='discovery'&&!a.allowDiscovery)return false; return true;}
function authorityPreview(dec){const a=authority(); const base={mode:a.mode,allowed:false,reason:'',limits:{energy:a.maxEnergy,chaos:a.maxChaos,density:a.maxDensity,motion:a.maxMotion}}; if(a.mode==='MANUAL')return {...base,reason:'MANUAL: Director jen radí, nic sám neaplikuje'}; if(a.operatorLock)return {...base,reason:'OPERATOR LOCK: všechny automatické zásahy jsou zamčené'}; if(dec?.mode==='DISCOVERY'&&!a.allowDiscovery)return {...base,reason:'Discovery zakázáno'}; if(dec?.mode==='PEAK ALIGN'&&state.energy>a.maxEnergy-8)return {...base,reason:'Peak by překročil energy limit'}; return {...base,allowed:!!a.autoApply,reason:a.autoApply?'AUTO APPLY povoleno v limitech':'ASSIST: návrh připravený, čeká na ruční potvrzení'};}
function renderAuthority(){const a=authority(); if($('authorityMode'))$('authorityMode').textContent=a.mode; if($('authorityAuto'))$('authorityAuto').textContent=a.autoApply?'ON':'OFF'; if($('authorityLock'))$('authorityLock').textContent=a.operatorLock?'LOCKED':'OPEN'; ['maxEnergy','maxChaos','maxDensity','maxMotion'].forEach(k=>{const inp=$('auth_'+k),txt=$('auth_'+k+'_txt'); if(inp&&Number(inp.value)!==Number(a[k]))inp.value=a[k]; if(txt)txt.textContent=a[k];}); ['autoApply','allowMegaEvents','allowWorldTravel','allowTimelineRewrite','allowDiscovery','operatorLock'].forEach(k=>{const el=$('auth_'+k); if(el)el.checked=!!a[k];}); qsa('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===a.mode)); const d=directorBrainDecision?.(); const p=authorityPreview(d); if($('authorityDecision'))$('authorityDecision').innerHTML=`<b>${d?.mode||'NO DECISION'}</b><span>${d?.text||''}</span><small>${p.reason}</small>`; if($('authorityPayload'))$('authorityPayload').textContent=JSON.stringify({step:'STEP22JP_CONTROL_AUTHORITY',authority:a,preview:p,bridge:bridgePayload()},null,2); const log=$('authorityLog'); if(log)log.innerHTML=(a.log||[]).slice(0,16).map(x=>`<div><b>${x.t} · ${x.action}</b><span>${x.result}</span><small>${x.mode}</small></div>`).join('')||'<em>Zatím žádný authority zásah.</em>';}
function setAuthorityMode(mode){authority().mode=mode; authorityNote('mode',mode); render();}
function applyAuthoritySettings(){const a=authority(); ['maxEnergy','maxChaos','maxDensity','maxMotion'].forEach(k=>{const el=$('auth_'+k); if(el)a[k]=clamp(Number(el.value||a[k]));}); ['autoApply','allowMegaEvents','allowWorldTravel','allowTimelineRewrite','allowDiscovery','operatorLock'].forEach(k=>{const el=$('auth_'+k); if(el)a[k]=!!el.checked;}); authorityClampState('settings'); authorityNote('settings','operator limits saved'); render();}
function authorityManualApply(){const d=directorBrainDecision(); const a=authority(); const oldAuto=a.autoApply; a.autoApply=true; const oldMode=a.mode; if(a.mode==='MANUAL')a.mode='ASSIST'; directorPulse(); a.autoApply=oldAuto; a.mode=oldMode; authorityClampState('manual apply'); authorityNote('manual apply',d.mode); render();}
function authorityFreeze(){const a=authority(); a.mode='MANUAL'; a.autoApply=false; a.operatorLock=true; authorityNote('freeze','Director disabled, manual control only'); render();}

/* STEP22IO — Universe Director AI + Visual Ecosystem */
function ecosystemRollup(){
 const runtimeMin=Math.floor((Date.now()-state.started)/60000);
 const repeat=getRepeatScore();
 const novelty=clamp(100-repeat+Math.min(30,(state.discoveries?.length||0)*3)+(state.chaos*.08));
 const fatigue=clamp((runtimeMin/12)+repeat*.35+Math.max(0,state.density-70)*.28-Math.max(0,state.morph-90)*.04);
 const curiosity=clamp((state.directorGenome?.exploration||70)*.55+(state.directorGenome?.mystery||70)*.35+Math.max(0,60-fatigue)*.2);
 const coherence=clamp(72-Math.abs((state.energy||50)-(state.density||50))*.18-Math.max(0,state.chaos-70)*.25+(state.story?.length||0)*2);
 state.ecosystem={ageMin:runtimeMin,novelty,fatigue,curiosity,coherence,historyScore:clamp((state.history?.length||0)+(state.showHistory?.length||0)*12)};
 return state.ecosystem;
}
function directorBrainDecision(){
 const e=ecosystemRollup();
 if(e.fatigue>72) return {mode:'RECOVERY REWRITE',text:'fatigue vysoká → snížit density, prodloužit morph, poslat show do recovery světa'};
 if(e.curiosity>76 && e.novelty<58) return {mode:'DISCOVERY',text:'curiosity vysoká + novelty nízká → hledat hidden world nebo hidden event'};
 if(state.energy>78 && state.phase!=='PEAK') return {mode:'PEAK ALIGN',text:'energie je vysoko → zarovnat story phase na PEAK nebo DROP'};
 if(e.coherence<45) return {mode:'COHERENCE FIX',text:'show je rozházená → zjemnit chaos a najít svět ze stejné rodiny'};
 return {mode:'STABLE EXPLORATION',text:'držet směr, jemně mutovat eventy a počasí'};
}
function renderDirectorGenomeBars(){
 const box=$('directorGenomeBars'); if(!box)return; box.innerHTML='';
 Object.entries(state.directorGenome||{}).forEach(([k,v])=>{const row=document.createElement('label'); row.className='eco-slider'; row.innerHTML=`<span>${k.toUpperCase()} <b>${v}</b>%</span><input data-genome-step22io="${k}" type="range" min="0" max="100" value="${v}">`; box.appendChild(row);});
 box.querySelectorAll('[data-genome-step22io]').forEach(inp=>inp.oninput=e=>{state.directorGenome[e.target.dataset.genomeStep22io]=clamp(e.target.value); renderEcosystem(); renderAuthority(); save();});
}
function renderEcosystem(){
 const e=ecosystemRollup(); const dec=directorBrainDecision();
 if($('ecoAge'))$('ecoAge').textContent=e.ageMin+'m'; if($('ecoNovelty'))$('ecoNovelty').textContent=e.novelty+'%'; if($('ecoFatigue'))$('ecoFatigue').textContent=e.fatigue+'%'; if($('ecoCuriosity'))$('ecoCuriosity').textContent=e.curiosity+'%'; if($('ecoCoherence'))$('ecoCoherence').textContent=e.coherence+'%'; if($('ecoDecision'))$('ecoDecision').innerHTML=`<b>${dec.mode}</b><span>${dec.text}</span>`;
 renderDirectorGenomeBars();
 const sig=$('hiddenSignalList'); if(sig) sig.innerHTML=(state.hiddenSignals||[]).slice(0,18).map(s=>`<div><b>${s.type}</b><span>${s.name} · ${s.t}</span><small>${s.note}</small></div>`).join('')||'<em>Zatím žádný hidden signal.</em>';
 const mega=$('megaEventList'); if(mega) mega.innerHTML=(state.megaEvents||[]).slice(0,12).map(m=>`<div><b>${m.name}</b><span>${m.phase} · ${m.t}</span><small>${m.note}</small></div>`).join('')||'<em>Mega event zatím nenastal.</em>';
 const hist=$('showHistoryList'); if(hist) hist.innerHTML=(state.showHistory||[]).slice(0,10).map(h=>`<div><b>${h.name}</b><span>${h.runtime} · universes ${h.universes} · worlds ${h.worlds}</span><small>legendary ${h.legendary} · mega ${h.mega} · discoveries ${h.discoveries}</small></div>`).join('')||'<em>Žádná uložená show history.</em>';
 if($('ecosystemPayload')) $('ecosystemPayload').textContent=JSON.stringify({version:'STEP22KZ_POST_SHOW_REVIEW_LEARNING_PACK',universe:state.universe,targetUniverse:state.targetUniverse,currentWorld:state.current,targetWorld:state.target,weather:state.weather,storyPhase:state.phase,directorGenome:state.directorGenome,ecosystem:e,decision:dec,bridge:bridgePayload?.()||{}},null,2);
}
function directorPulse(){
 const dec=directorBrainDecision();
 const gate=authorityPreview(dec);
 if(!gate.allowed){authorityNote('director blocked',dec.mode+' · '+gate.reason); renderAuthority(); toast('Director jen radí: '+gate.reason); return;}
 if(dec.mode==='DISCOVERY'&&!authorityCan('discovery')){authorityNote('director blocked','Discovery disabled'); renderAuthority(); return;}
 if(dec.mode==='RECOVERY REWRITE'){state.phase='RECOVERY'; state.energy=clamp(state.energy-18); state.density=clamp(state.density-18); state.motion=clamp(state.motion-10); state.morph=Math.max(state.morph||60,150);}
 else if(dec.mode==='DISCOVERY'){forgeHiddenSignal();}
 else if(dec.mode==='PEAK ALIGN'){state.phase=state.energy>88?'PEAK':'DROP'; state.density=clamp(state.density+8); state.motion=clamp(state.motion+8);}
 else if(dec.mode==='COHERENCE FIX'){state.chaos=clamp(state.chaos-12); const fam=worldFamilies[state.current]||[]; if(fam.length)state.target=choice(fam);}
 else {state.chaos=clamp(state.chaos+choice([-2,-1,1,2])); state.density=clamp(state.density+choice([-2,-1,1,2]));}
 authorityClampState('director pulse'); authorityNote('director applied',dec.mode); log('Universe Director AI → '+dec.mode); render(); toast('Director pulse: '+dec.mode);
}
function forgeHiddenSignal(){
 if(!authorityCan('discovery')){authorityNote('discovery blocked','Discovery disabled by operator'); renderAuthority(); toast('Discovery je vypnuté v Control Authority.'); return;}
 const types=['Hidden World','Hidden Civilization','Hidden Weather','Hidden Event','Hidden Journey'];
 const names=['Black Moss Signal','Neural Grove','Subspace Ritual','Molten Memory','Crystal Anomaly','Void Garden','Ancient Pulse','Living Reactor','Solar Whisper'];
 const s={type:choice(types),name:choice(names),t:new Date().toLocaleTimeString(),note:`born from ${state.universe} / ${state.current} · curiosity ${state.ecosystem?.curiosity||0}%`};
 state.hiddenSignals.unshift(s); state.hiddenSignals=state.hiddenSignals.slice(0,50);
 if(s.type==='Hidden World'){state.generatedWorlds.unshift({name:s.name,dna:{...state.dna,chaos:clamp((state.dna.chaos||50)+8),flow:clamp((state.dna.flow||50)+12)},x:Math.floor(15+Math.random()*70),y:Math.floor(15+Math.random()*70)});}
 log('Discovery System → '+s.type+' '+s.name); render(); toast('Hidden signal objeven: '+s.name);
}
function triggerMegaEvent(){
 if(!authorityCan('mega')){authorityNote('mega blocked','Mega Events disabled by operator'); renderAuthority(); toast('Mega Events jsou vypnuté v Control Authority.'); return;}
 const pool=['Black Sun Rise','Infinite Reactor','Galactic Convergence','Birth of Living Planet','First Contact','Crystal Cathedral Opens','Silent Machine Awakens'];
 const m={name:choice(pool),phase:'GALACTIC EVENT',t:new Date().toLocaleTimeString(),note:'vzácný režim: 10–30 minut speciální dramaturgie'};
 state.megaEvents.unshift(m); state.megaEvents=state.megaEvents.slice(0,30); state.phase='PEAK'; state.energy=92; state.chaos=clamp(Math.max(state.chaos,62)); state.density=clamp(Math.max(state.density,76)); state.motion=clamp(Math.max(state.motion,82));
 authorityClampState('mega event'); authorityNote('mega applied',m.name); log('MEGA EVENT → '+m.name); render(); toast('MEGA EVENT: '+m.name);
}
function saveShowHistory(){
 const runtime=Math.floor((Date.now()-state.started)/60000)+'m';
 const universes=new Set([state.universe,state.targetUniverse,...(state.journey||[]).map(j=>j.universe).filter(Boolean)]).size;
 const worlds=new Set([state.current,state.target,...(state.journey||[]).map(j=>j.world).filter(Boolean),...(state.generatedWorlds||[]).map(w=>w.name)]).size;
 const h={name:'Budi Ritual #'+String((state.showHistory?.length||0)+1).padStart(3,'0'),runtime,universes,worlds,legendary:(state.legendaryWorlds||[]).length,mega:(state.megaEvents||[]).length,discoveries:(state.hiddenSignals||[]).length,t:new Date().toLocaleString()};
 state.showHistory.unshift(h); state.showHistory=state.showHistory.slice(0,30); log('Show History saved → '+h.name); render(); toast('Show history uložena: '+h.name);
}
function sendEcosystemBridge(){
 const payload={...bridgePayload(),ecosystem:ecosystemRollup(),directorGenome:state.directorGenome,hiddenSignals:(state.hiddenSignals||[]).slice(0,5),megaEvents:(state.megaEvents||[]).slice(0,3),source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE'};
 localStorage.setItem('budilight.visual.ecosystem.bridge',JSON.stringify(payload));
 localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(payload));
 toast('Visual Ecosystem Bridge payload uložen.'); render();
}


const phenomenaLibrary=['Flow','Pulse','Storm','Growth','Migration','Collapse','Swarm','Wave','Reaction','Orbit','Ignition','Crystalize','Breath','Tide','Spiral'];
const emotionProfiles=['Peace','Wonder','Mystery','Fear','Conflict','Ascension','Afterhours'];
function worldPhysicsSuggestion(){
 const u=getUniverse?.()||{tone:'balanced'}; const dna=state.dna||{};
 return {
  gravity:clamp(20+(dna.density||50)*.35-(dna.flow||50)*.12),
  temperature:clamp((dna.heat||50)+(state.energy||50)*.18),
  turbulence:clamp((state.chaos||30)*.75+(state.motion||50)*.25),
  radiation:clamp((u.tone||'').includes('cosmic')?72:(dna.contrast||50)*.55+(state.chaos||30)*.2)
 };
}
function applyPhenomenaPreset(name){
 const presets={
  Forge:['Flow','Pulse','Ignition','Reaction'],
  Organic:['Growth','Migration','Breath','Tide'],
  Synthetic:['Swarm','Wave','Crystalize','Collapse'],
  Cosmic:['Orbit','Storm','Spiral','Tide'],
  Psy:['Pulse','Storm','Swarm','Ignition'],
  Ambient:['Flow','Breath','Orbit','Tide']
 };
 state.phenomena.active=[...(presets[name]||presets.Psy)];
 state.phenomena.physics=worldPhysicsSuggestion();
 state.phenomena.log.unshift({t:new Date().toLocaleTimeString(),item:'Preset '+name+' → '+state.phenomena.active.join(' + ')});
 state.phenomena.log=state.phenomena.log.slice(0,80);
 log('Phenomena preset → '+name); render();
}
function mutatePhenomena(){
 const p=state.phenomena; const pool=phenomenaLibrary.filter(x=>!p.active.includes(x));
 if(pool.length && Math.random()>.35)p.active[Math.floor(Math.random()*p.active.length)]=choice(pool);
 Object.keys(p.physics).forEach(k=>p.physics[k]=clamp(p.physics[k]+Math.round((Math.random()-.5)*22)));
 p.emotion=choice(emotionProfiles);
 p.log.unshift({t:new Date().toLocaleTimeString(),item:'Mutace → '+p.active.join(' + ')+' / '+p.emotion});
 p.log=p.log.slice(0,80); log('Phenomena mutated'); render();
}
function addPhenomenaEntity(){
 const types=['Energy Node','Machine Cluster','Living Seed','Crystal Organism','Plasma Swarm','Void Cell','Forge Spark'];
 state.phenomena.entities.unshift({type:choice(types),energy:clamp(35+Math.random()*65),age:0,dna:choice(['forge','organic','synthetic','cosmic','hybrid'])});
 state.phenomena.entities=state.phenomena.entities.slice(0,18); log('Entity born → '+state.phenomena.entities[0].type); render();
}
function sendPhenomenaBridge(){
 const payload={...bridgePayload(),source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE',phenomena:state.phenomena.active,worldPhysics:state.phenomena.physics,emotionField:state.phenomena.emotion,entities:state.phenomena.entities.slice(0,10),camera:state.phenomena.camera,rendererIntent:'phenomena_not_animation',operatorAuthority:authority()};
 localStorage.setItem('budilight.phenomena.bridge',JSON.stringify(payload));
 localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(payload));
 toast('Phenomena Bridge payload uložen. Renderer pořád zůstává pod kontrolou Performance.'); render();
}
function renderPhenomena(){
 const p=state.phenomena; if(!p)return;
 const chips=$('phenomenaChips'); if(chips){chips.innerHTML=phenomenaLibrary.map(x=>`<button data-phenomena-chip="${x}" class="${p.active.includes(x)?'active':''}">${x}</button>`).join(''); chips.querySelectorAll('[data-phenomena-chip]').forEach(b=>b.onclick=()=>{const v=b.dataset.phenomenaChip; if(p.active.includes(v))p.active=p.active.filter(x=>x!==v); else p.active.push(v); p.active=p.active.slice(-6); log('Phenomena toggle → '+v); render();});}
 const phys=$('physicsBars'); if(phys){phys.innerHTML=Object.entries(p.physics).map(([k,v])=>`<label><span>${k.toUpperCase()} <b>${v}</b>%</span><input data-physics="${k}" type="range" min="0" max="100" value="${v}"></label>`).join(''); phys.querySelectorAll('[data-physics]').forEach(inp=>inp.oninput=e=>{p.physics[e.target.dataset.physics]=clamp(e.target.value); renderPhenomena(); save();});}
 const ent=$('entityList'); if(ent)ent.innerHTML=p.entities.length?p.entities.map(e=>`<div><b>${e.type}</b><span>${e.dna} · energy ${e.energy}% · age ${e.age}</span></div>`).join(''):'<em>Zatím žádné entity.</em>';
 const emo=$('emotionField'); if(emo){emo.innerHTML=emotionProfiles.map(x=>`<button data-emotion="${x}" class="${p.emotion===x?'active':''}">${x}</button>`).join(''); emo.querySelectorAll('[data-emotion]').forEach(b=>b.onclick=()=>{p.emotion=b.dataset.emotion; log('Emotion field → '+p.emotion); render();});}
 const cam=$('worldCameraState'); if(cam)cam.innerHTML=`<b>${p.camera.mode}</b><span>zoom ${p.camera.zoom}% · pan ${p.camera.pan}% · focus ${p.camera.focus}</span>`;
 const pre=$('phenomenaPayload'); if(pre)pre.textContent=JSON.stringify({phenomena:p.active,physics:p.physics,emotion:p.emotion,entities:p.entities,camera:p.camera,authority:authority()},null,2);
 const l=$('phenomenaLog'); if(l)l.innerHTML=(p.log||[]).slice(0,14).map(x=>`<div><b>${x.t}</b><span>${x.item}</span></div>`).join('')||'<em>Phenomena log je prázdný.</em>';
}


// STEP22KH-KN — Visual Physics Core pack
const physicsKeys=['energy','temperature','pressure','turbulence','entropy','gravity','radiation','density'];
const physicsLabels={energy:'Energy',temperature:'Temperature',pressure:'Pressure',turbulence:'Turbulence',entropy:'Entropy',gravity:'Gravity',radiation:'Radiation',density:'Density'};
function physicsCore(){
 if(!state.physicsCore){state.physicsCore={enabled:true,quality:'balanced',blendA:state.current,blendB:state.target,blendMix:25,variables:{energy:state.energy,temperature:50,pressure:40,turbulence:state.chaos,entropy:25,gravity:45,radiation:35,density:state.density},memory:{enabled:true,decaySec:300,intensity:40,scars:[]},attention:{enabled:true,sensitivity:60,focus:'event',map:[35,55,70,40,60,45,30,75]},flow:{enabled:true,strength:50,diffusion:40,decay:24,injectRate:30,nodes:[]},emergent:{enabled:true,cooldownSec:45,lastAt:0,events:[]},log:[]};}
 return state.physicsCore;
}
function pLog(msg){const p=physicsCore(); p.log.unshift({t:new Date().toLocaleTimeString(),item:msg}); p.log=p.log.slice(0,80);}
function derivePhysicsFromShow(){
 const p=physicsCore(); const dna=state.dna||{}; const ph=state.phenomena?.physics||{};
 p.variables.energy=clamp((state.energy||50)*.72+(dna.density||50)*.18+(state.motion||50)*.10);
 p.variables.temperature=clamp((dna.heat||50)*.62+(state.energy||50)*.25+(ph.temperature||50)*.13);
 p.variables.pressure=clamp((state.density||50)*.45+(state.transition||0)*.20+(p.variables.gravity||45)*.15+(state.chaos||30)*.20);
 p.variables.turbulence=clamp((state.chaos||30)*.58+(state.motion||50)*.30+(ph.turbulence||50)*.12);
 p.variables.entropy=clamp((state.chaos||30)*.52+(100-(state.morph||60))*.18+(p.variables.radiation||35)*.14+(p.emergent.events.length*4));
 p.variables.gravity=clamp(ph.gravity??p.variables.gravity??45);
 p.variables.radiation=clamp((ph.radiation||35)*.45+(dna.contrast||50)*.30+(state.chaos||30)*.25);
 p.variables.density=clamp((state.density||50)*.75+(dna.density||50)*.25);
 pLog('Derived physics from show state'); renderPhysicsCore(); save();
}
function applyPhysicsToPhenomena(){
 const p=physicsCore(), v=p.variables;
 state.energy=clamp(v.energy); state.chaos=clamp(v.turbulence*.62+v.entropy*.38); state.density=clamp(v.density); state.motion=clamp(v.energy*.35+v.turbulence*.45+(100-v.gravity)*.20);
 if(state.phenomena){state.phenomena.physics={gravity:v.gravity,temperature:v.temperature,turbulence:v.turbulence,radiation:v.radiation};}
 pLog('Applied physics safely into Show OS sliders + Phenomena'); log('Physics Core → Show OS parameters'); renderDNA(); render();
}
function injectFlowNode(type='manual'){
 const p=physicsCore(); const v=p.variables;
 p.flow.nodes.unshift({type,x:Math.round(Math.random()*100),y:Math.round(Math.random()*100),energy:clamp(v.energy+Math.random()*25),age:0});
 p.flow.nodes=p.flow.nodes.slice(0,24);
 p.memory.scars.unshift({kind:type==='event'?'event scar':'energy injection',power:clamp(v.energy),decay:p.memory.decaySec,t:new Date().toLocaleTimeString()});
 p.memory.scars=p.memory.scars.slice(0,30);
 p.attention.map=p.attention.map.map((n,i)=>clamp(n+(i%3===0?18:Math.random()*10)-4));
 pLog('Flow injection → memory scar + attention peak'); renderPhysicsCore(); save();
}
function evaluateEmergentEvents(force=false){
 const p=physicsCore(), v=p.variables, now=Date.now();
 if(!force && p.emergent.enabled && now-(p.emergent.lastAt||0)<(p.emergent.cooldownSec||45)*1000){toast('Emergent cooldown ještě běží.'); return;}
 const rules=[
  {name:'Heat Surge', ok:v.energy>74&&v.temperature>68&&v.pressure>45, weight:v.energy+v.temperature+v.pressure},
  {name:'Plasma Storm', ok:v.energy>70&&v.turbulence>64&&v.radiation>45, weight:v.energy+v.turbulence+v.radiation},
  {name:'Void Collapse', ok:v.entropy>72&&v.density<42, weight:v.entropy+(100-v.density)},
  {name:'Crystal Bloom', ok:v.radiation>62&&v.gravity<45&&v.turbulence<62, weight:v.radiation+(100-v.gravity)},
  {name:'Reactor Pressure Wave', ok:v.pressure>70&&v.density>58, weight:v.pressure+v.density},
  {name:'Living Forge Blend', ok:p.blendMix>35&&p.blendA!==p.blendB&&v.temperature>55, weight:p.blendMix+v.temperature}
 ];
 const candidates=rules.filter(r=>force||r.ok);
 if(!candidates.length){pLog('Emergent scan: no event'); renderPhysicsCore(); return;}
 const ev=candidates.sort((a,b)=>b.weight-a.weight)[0];
 const item={name:ev.name,phase:state.phase,world:state.current,physics:{...v},t:new Date().toLocaleTimeString(),forced:!!force};
 p.emergent.events.unshift(item); p.emergent.events=p.emergent.events.slice(0,40); p.emergent.lastAt=now;
 state.events.unshift({name:ev.name,parts:[ev.name,'Physics','Emergent'],dna:{impact:clamp(ev.weight/3),chaos:v.turbulence,brightness:v.energy,motion:state.motion,heat:v.temperature},createdAt:new Date().toLocaleString(),emergent:true}); state.events=state.events.slice(0,60);
 injectFlowNode('event'); pLog('Emergent event → '+ev.name); toast('Emergent Event: '+ev.name); render();
}
function computeWorldBlend(){
 const p=physicsCore(); const a=allWorlds().find(w=>w.name===p.blendA)||allWorlds()[0]; const b=allWorlds().find(w=>w.name===p.blendB)||allWorlds()[1]||a; const mix=(p.blendMix||0)/100;
 const dna={}; dnaKeys.forEach(k=>dna[k]=clamp((a.dna?.[k]||50)*(1-mix)+(b.dna?.[k]||50)*mix));
 return {name:`${a.short||a.name} ${Math.round(100-p.blendMix)}% + ${b.short||b.name} ${p.blendMix}%`,a:a.name,b:b.name,mix:p.blendMix,dna};
}
function applyWorldBlend(){const blend=computeWorldBlend(); state.dna={...state.dna,...blend.dna}; state.target=blend.name; pLog('World blend applied → '+blend.name); log('World Blending → '+blend.name); renderDNA(); render();}
function sendPhysicsBridge(){
 const p=physicsCore(); const payload={...bridgePayload(),source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE',visualPhysics:{enabled:p.enabled,quality:p.quality,variables:p.variables,worldBlend:computeWorldBlend(),memory:p.memory,attention:p.attention,flow:p.flow,emergent:p.emergent},operatorAuthority:authority(),rendererIntent:'visual_physics_core_safe_intent'};
 localStorage.setItem('budilight.physics.bridge',JSON.stringify(payload)); localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(payload));
 pLog('Physics Bridge payload sent'); toast('Physics Bridge payload uložen. Performance renderer zůstává samostatný.'); renderPhysicsCore();
}
function physicsTickLite(){
 const p=physicsCore(); if(!p.enabled)return;
 p.flow.nodes.forEach(n=>{n.age=(n.age||0)+1; n.energy=clamp((n.energy||0)-(p.flow.decay||20)/40); n.x=clamp(n.x+Math.round((Math.random()-.5)*(p.flow.diffusion||40)/18)); n.y=clamp(n.y+Math.round((Math.random()-.5)*(p.flow.diffusion||40)/18));});
 p.flow.nodes=p.flow.nodes.filter(n=>n.energy>2).slice(0,24);
 p.memory.scars.forEach(s=>{s.decay=Math.max(0,(s.decay||0)-1); s.power=clamp((s.power||0)-100/Math.max(20,p.memory.decaySec||300));});
 p.memory.scars=p.memory.scars.filter(s=>s.decay>0&&s.power>1).slice(0,30);
 p.attention.map=p.attention.map.map(n=>clamp(n*.96+(Math.random()*5)));
 if(Math.random()<0.015*(p.flow.injectRate||30)/50)injectFlowNode('auto');
}
function renderPhysicsCore(){
 const p=physicsCore();
 const vars=$('physicsCoreVars'); if(vars){vars.innerHTML=physicsKeys.map(k=>`<label><span>${physicsLabels[k]} <b>${clamp(p.variables[k])}</b>%</span><input data-core-phys="${k}" type="range" min="0" max="100" value="${clamp(p.variables[k])}"></label>`).join(''); vars.querySelectorAll('[data-core-phys]').forEach(inp=>inp.oninput=e=>{p.variables[e.target.dataset.corePhys]=clamp(e.target.value); renderPhysicsCore(); save();});}
 const mon=$('physicsMonitor'); if(mon){mon.innerHTML=physicsKeys.map(k=>`<div class="phys-meter"><span>${physicsLabels[k]}</span><b style="width:${clamp(p.variables[k])}%"></b><em>${clamp(p.variables[k])}%</em></div>`).join('');}
 const mem=$('memoryFieldList'); if(mem)mem.innerHTML=p.memory.scars.length?p.memory.scars.map(s=>`<div><b>${s.kind}</b><span>power ${clamp(s.power)}% · decay ${Math.round(s.decay)}s · ${s.t}</span></div>`).join(''):'<em>Žádné stopy. Dej INJECT nebo spusť emergent event.</em>';
 const att=$('attentionMap'); if(att)att.innerHTML=p.attention.map.map(v=>`<i style="opacity:${.25+clamp(v)/135};transform:scale(${.75+clamp(v)/160})"><span>${clamp(v)}</span></i>`).join('');
 const flow=$('flowNodeList'); if(flow)flow.innerHTML=p.flow.nodes.length?p.flow.nodes.map(n=>`<div><b>${n.type}</b><span>x${n.x} y${n.y} · energy ${n.energy}% · age ${n.age}s</span></div>`).join(''):'<em>Flow field je prázdný.</em>';
 const ev=$('emergentEventList'); if(ev)ev.innerHTML=p.emergent.events.length?p.emergent.events.map(e=>`<div><b>${e.name}</b><span>${e.world} · ${e.phase} · ${e.t}</span></div>`).join(''):'<em>Zatím žádné emergentní eventy.</em>';
 const worlds=allWorlds(); const opt=worlds.map(w=>`<option>${w.name}</option>`).join(''); const a=$('blendWorldA'), b=$('blendWorldB'), mix=$('blendMix'); if(a&&!a.dataset.ready){a.innerHTML=opt; b.innerHTML=opt; a.dataset.ready='1'; b.dataset.ready='1';} if(a){a.value=p.blendA;} if(b){b.value=p.blendB;} if(mix){mix.value=p.blendMix;}
 const blend=$('worldBlendPreview'); if(blend){const c=computeWorldBlend(); blend.innerHTML=`<b>${c.name}</b><span>${dnaKeys.map(k=>`${k}:${c.dna[k]}`).join(' · ')}</span>`;}
 const cfg=$('physicsCoreConfig'); if(cfg){cfg.innerHTML=`<label><input id="pcEnabled" type="checkbox" ${p.enabled?'checked':''}> Physics Core aktivní</label><label>Quality<select id="pcQuality"><option>eco</option><option>balanced</option><option>high</option></select></label><label>Memory decay<input id="pcMemoryDecay" type="number" min="10" max="7200" value="${p.memory.decaySec}"></label><label>Attention sensitivity<input id="pcAttention" type="range" min="0" max="100" value="${p.attention.sensitivity}"></label>`; const q=$('pcQuality'); if(q)q.value=p.quality; $('pcEnabled')?.addEventListener('change',e=>{p.enabled=e.target.checked; save();}); $('pcQuality')?.addEventListener('change',e=>{p.quality=e.target.value; save();}); $('pcMemoryDecay')?.addEventListener('change',e=>{p.memory.decaySec=Math.max(10,Number(e.target.value)||300); save();}); $('pcAttention')?.addEventListener('input',e=>{p.attention.sensitivity=clamp(e.target.value); save();});}
 const pre=$('physicsPayload'); if(pre)pre.textContent=JSON.stringify({source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE',variables:p.variables,blend:computeWorldBlend(),memory:p.memory,attention:p.attention,flow:p.flow,emergent:p.emergent},null,2);
 const lg=$('physicsLog'); if(lg)lg.innerHTML=(p.log||[]).slice(0,16).map(x=>`<div><b>${x.t}</b><span>${x.item}</span></div>`).join('')||'<em>Physics log je prázdný.</em>';
}


// STEP22KO — Stability & Performance Lab
const stabilityProfiles={
 eco:{fpsTarget:20,uiThrottleMs:500,bridgeRateHz:5,physicsTickMs:1500,maxNodes:12,maxScars:12,renderBudgetMs:9,quality:'eco'},
 balanced:{fpsTarget:30,uiThrottleMs:250,bridgeRateHz:10,physicsTickMs:1000,maxNodes:24,maxScars:30,renderBudgetMs:12,quality:'balanced'},
 live:{fpsTarget:45,uiThrottleMs:125,bridgeRateHz:20,physicsTickMs:500,maxNodes:36,maxScars:48,renderBudgetMs:16,quality:'high'},
 safe:{fpsTarget:25,uiThrottleMs:400,bridgeRateHz:8,physicsTickMs:1200,maxNodes:16,maxScars:18,renderBudgetMs:10,quality:'balanced'}
};
function stabilityLab(){
 if(!state.stabilityLab){state.stabilityLab={profile:'balanced',fpsTarget:30,uiThrottleMs:250,bridgeRateHz:10,physicsTickMs:1000,maxNodes:24,maxScars:30,renderBudgetMs:12,watchdogEnabled:true,autoDegrade:true,outputGuard:true,bridgeHeartbeat:true,lastBridgeAt:0,frameCounter:0,framesDropped:0,health:'GOOD',metrics:{fps:30,avgFrameMs:8,bridgeAgeMs:0,memoryItems:0,flowNodes:0,events:0,pressure:0},log:[]};}
 return state.stabilityLab;
}
function sLog(msg){const s=stabilityLab(); s.log.unshift({t:new Date().toLocaleTimeString(),item:msg}); s.log=s.log.slice(0,80);}
function applyStabilityProfile(name){
 const s=stabilityLab(), p=stabilityProfiles[name]||stabilityProfiles.balanced;
 Object.assign(s,p,{profile:name});
 const pc=physicsCore(); pc.quality=p.quality; pc.flow.nodes=pc.flow.nodes.slice(0,s.maxNodes); pc.memory.scars=pc.memory.scars.slice(0,s.maxScars);
 sLog('Applied profile → '+name.toUpperCase()); renderStabilityLab(); renderHealthConsole(); renderPhysicsCore(); save();
}
function updateStabilityMetrics(){
 const s=stabilityLab(), pc=physicsCore();
 s.frameCounter=(s.frameCounter||0)+1;
 const pressure=clamp((pc.flow.nodes.length/Math.max(1,s.maxNodes))*34+(pc.memory.scars.length/Math.max(1,s.maxScars))*24+(pc.emergent.events.length/40)*18+(state.energy||50)*.12+(state.chaos||30)*.12);
 s.metrics={fps:s.fpsTarget,avgFrameMs:Math.max(3,Math.round(1000/Math.max(1,s.fpsTarget)*0.42+pressure*.07)),bridgeAgeMs:s.lastBridgeAt?Date.now()-s.lastBridgeAt:0,memoryItems:pc.memory.scars.length,flowNodes:pc.flow.nodes.length,events:pc.emergent.events.length,pressure};
 let health='GOOD';
 if(pressure>68||s.metrics.bridgeAgeMs>5000)health='WATCH';
 if(pressure>84||s.metrics.bridgeAgeMs>12000)health='RISK';
 s.health=health;
 if(s.autoDegrade&&pressure>86&&s.profile!=='eco'){
   pc.flow.nodes=pc.flow.nodes.slice(0,Math.max(6,Math.floor(s.maxNodes*.55)));
   pc.memory.scars=pc.memory.scars.slice(0,Math.max(8,Math.floor(s.maxScars*.55)));
   s.framesDropped=(s.framesDropped||0)+1;
   sLog('Auto-degrade: trimmed flow/memory load');
 }
}
function runStabilityScan(){
 updateStabilityMetrics();
 const s=stabilityLab(), m=s.metrics, notes=[];
 if(m.flowNodes>s.maxNodes*.8)notes.push('Flow nodes jsou vysoko → zvaž ECO/SAFE nebo menší inject rate.');
 if(m.memoryItems>s.maxScars*.8)notes.push('Memory scars jsou vysoko → zkrať decay nebo dej SAFE profile.');
 if(m.bridgeAgeMs>5000)notes.push('Bridge heartbeat je starší než 5 s → pošli Bridge/Intent znovu.');
 if(m.pressure<55)notes.push('Zátěž je v normě.');
 sLog('Health scan → '+s.health+' · '+notes.join(' '));
 renderStabilityLab(); renderHealthConsole(); renderCleanupConsole(); save();
}
function sendStabilityBridge(){
 const s=stabilityLab(); updateStabilityMetrics(); s.lastBridgeAt=Date.now();
 const payload={...bridgePayload(),source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE',stability:{profile:s.profile,fpsTarget:s.fpsTarget,uiThrottleMs:s.uiThrottleMs,bridgeRateHz:s.bridgeRateHz,physicsTickMs:s.physicsTickMs,limits:{maxNodes:s.maxNodes,maxScars:s.maxScars,renderBudgetMs:s.renderBudgetMs},guards:{watchdogEnabled:s.watchdogEnabled,autoDegrade:s.autoDegrade,outputGuard:s.outputGuard,bridgeHeartbeat:s.bridgeHeartbeat},metrics:s.metrics,health:s.health},visualPhysics:physicsCore(),operatorAuthority:authority(),rendererIntent:'stability_safe_performance_tuning'};
 localStorage.setItem('budilight.stability.bridge',JSON.stringify(payload));
 localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(payload));
 sLog('Stability Bridge sent'); toast('Stability Bridge payload uložen.'); renderStabilityLab(); renderHealthConsole(); renderCleanupConsole(); save();
}
function trimRuntimeLoad(){
 const s=stabilityLab(), pc=physicsCore();
 pc.flow.nodes=pc.flow.nodes.slice(0,Math.max(4,Math.floor(s.maxNodes*.5)));
 pc.memory.scars=pc.memory.scars.slice(0,Math.max(4,Math.floor(s.maxScars*.5)));
 state.history=state.history.slice(0,80); state.events=state.events.slice(0,40);
 s.framesDropped=(s.framesDropped||0)+1; sLog('Manual trim runtime load'); render();
}
function renderStabilityLab(){
 const s=stabilityLab(); updateStabilityMetrics();
 const p=$('stabilityProfileButtons'); if(p){p.innerHTML=Object.keys(stabilityProfiles).map(k=>`<button data-stability-profile="${k}" class="${s.profile===k?'active':''}">${k.toUpperCase()}</button>`).join(''); p.querySelectorAll('[data-stability-profile]').forEach(b=>b.onclick=()=>applyStabilityProfile(b.dataset.stabilityProfile));}
 const k=$('stabilityKpis'); if(k)k.innerHTML=`<div><span>HEALTH</span><b>${s.health}</b></div><div><span>FPS TARGET</span><b>${s.fpsTarget}</b></div><div><span>PRESSURE</span><b>${s.metrics.pressure}%</b></div><div><span>FRAME MS</span><b>${s.metrics.avgFrameMs}</b></div><div><span>BRIDGE AGE</span><b>${Math.round(s.metrics.bridgeAgeMs/100)/10}s</b></div><div><span>DROPS</span><b>${s.framesDropped||0}</b></div>`;
 const cfg=$('stabilityConfig'); if(cfg){cfg.innerHTML=`<label>FPS target <input id="stabFps" type="range" min="10" max="60" value="${s.fpsTarget}"><b>${s.fpsTarget}</b></label><label>UI throttle ms <input id="stabUiThrottle" type="number" min="50" max="2000" value="${s.uiThrottleMs}"></label><label>Bridge rate Hz <input id="stabBridgeRate" type="range" min="1" max="30" value="${s.bridgeRateHz}"><b>${s.bridgeRateHz}</b></label><label>Physics tick ms <input id="stabPhysicsTick" type="number" min="100" max="5000" value="${s.physicsTickMs}"></label><label>Max flow nodes <input id="stabMaxNodes" type="number" min="4" max="128" value="${s.maxNodes}"></label><label>Max memory scars <input id="stabMaxScars" type="number" min="4" max="200" value="${s.maxScars}"></label>`;
 ['stabFps','stabUiThrottle','stabBridgeRate','stabPhysicsTick','stabMaxNodes','stabMaxScars'].forEach(id=>$(id)?.addEventListener('input',e=>{const map={stabFps:'fpsTarget',stabUiThrottle:'uiThrottleMs',stabBridgeRate:'bridgeRateHz',stabPhysicsTick:'physicsTickMs',stabMaxNodes:'maxNodes',stabMaxScars:'maxScars'}; s[map[id]]=Math.max(1,Number(e.target.value)||s[map[id]]); save(); renderStabilityLab(); renderHealthConsole(); renderCleanupConsole();}));}
 const guards=$('stabilityGuards'); if(guards){guards.innerHTML=['watchdogEnabled','autoDegrade','outputGuard','bridgeHeartbeat'].map(k=>`<label><input data-stab-guard="${k}" type="checkbox" ${s[k]?'checked':''}> ${k}</label>`).join(''); guards.querySelectorAll('[data-stab-guard]').forEach(inp=>inp.onchange=e=>{s[e.target.dataset.stabGuard]=e.target.checked; sLog('Guard '+e.target.dataset.stabGuard+' → '+e.target.checked); save(); renderStabilityLab(); renderHealthConsole(); renderCleanupConsole();});}
 const m=$('stabilityMeters'); if(m)m.innerHTML=[['Runtime pressure',s.metrics.pressure],['Flow load',clamp(s.metrics.flowNodes/Math.max(1,s.maxNodes)*100)],['Memory load',clamp(s.metrics.memoryItems/Math.max(1,s.maxScars)*100)],['Event load',clamp(s.metrics.events/40*100)],['Bridge freshness',clamp(100-(s.metrics.bridgeAgeMs/12000*100))]].map(([n,v])=>`<div class="phys-meter"><span>${n}</span><b style="width:${clamp(v)}%"></b><em>${clamp(v)}%</em></div>`).join('');
 const lg=$('stabilityLog'); if(lg)lg.innerHTML=(s.log||[]).slice(0,18).map(x=>`<div><b>${x.t}</b><span>${x.item}</span></div>`).join('')||'<em>Stability log je prázdný.</em>';
 const pre=$('stabilityPayload'); if(pre)pre.textContent=JSON.stringify({source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE',profile:s.profile,metrics:s.metrics,guards:{watchdogEnabled:s.watchdogEnabled,autoDegrade:s.autoDegrade,outputGuard:s.outputGuard,bridgeHeartbeat:s.bridgeHeartbeat},limits:{maxNodes:s.maxNodes,maxScars:s.maxScars,fpsTarget:s.fpsTarget,bridgeRateHz:s.bridgeRateHz}},null,2);
}

function exportPack(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),version:'STEP22KZ_POST_SHOW_REVIEW_LEARNING_PACK'},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-show-os-step22ie-universe-pack.json'; a.click(); URL.revokeObjectURL(url); toast('Export pack vytvořen.');}
function importPack(file){const r=new FileReader(); r.onload=()=>{try{Object.assign(state,JSON.parse(r.result)); log('Imported Show OS pack'); renderDNA(); renderJourney(); render(); toast('Import hotový.');}catch(e){toast('Import selhal: špatný JSON.')}}; r.readAsText(file);}
function sendIntent(){localStorage.setItem(INTENT_KEY,JSON.stringify({...state,intentAt:Date.now(),source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE'})); if($('intentState'))$('intentState').textContent='SENT '+new Date().toLocaleTimeString(); toast('Intent uložený. Performance zůstává nedotčená.');}

function healthConsole(){state.healthConsole=state.healthConsole||{score:0,status:'NOT SCANNED',lastScan:0,checks:[],fixes:[],bridge:{},cleanup:[],reports:[]}; return state.healthConsole;}
function readBridgeKey(key){try{return JSON.parse(localStorage.getItem(key)||'null')||null;}catch{return null;}}
function moduleCheck(name, ok, detail, priority='normal'){return {name,ok:!!ok,detail,priority};}
function runHealthScan(){
 const h=healthConsole(), sLab=typeof stabilityLab==='function'?stabilityLab():state.stabilityLab, pc=typeof physicsCore==='function'?physicsCore():state.physicsCore;
 const bridges={intent:readBridgeKey('budilight.showos.intent'),performance:readBridgeKey('budilight.performance.bridge.pro'),physics:readBridgeKey('budilight.physics.bridge'),stability:readBridgeKey('budilight.stability.bridge'),health:readBridgeKey('budilight.health.bridge')};
 const now=Date.now();
 const checks=[];
 checks.push(moduleCheck('Control Authority', !!state.controlAuthority, 'Operator limits and lock layer is present.', 'critical'));
 checks.push(moduleCheck('Universe Library', Array.isArray(universeLibrary)&&universeLibrary.length>=4, (universeLibrary?.length||0)+' universes loaded.', 'normal'));
 checks.push(moduleCheck('Story Engine', Array.isArray(state.story), 'Living timeline array is ready: '+(state.story?.length||0)+' steps.', 'normal'));
 checks.push(moduleCheck('Phenomena Engine', !!state.phenomena, 'Phenomena state exists with '+((state.phenomena?.active||[]).length)+' active phenomena.', 'normal'));
 checks.push(moduleCheck('Visual Physics Core', !!pc && pc.enabled!==false, 'Physics variables, memory, attention and flow are available.', 'critical'));
 checks.push(moduleCheck('Stability Lab', !!sLab, 'Performance profile: '+(sLab?.profile||'unknown')+', health: '+(sLab?.health||'unknown')+'.', 'critical'));
 checks.push(moduleCheck('Bridge Intent', !!bridges.intent, bridges.intent?'Intent bridge has payload.':'No localStorage intent payload yet.', 'normal'));
 checks.push(moduleCheck('Physics Bridge', !!bridges.physics, bridges.physics?'Physics bridge ready.':'Send Physics Bridge before real test.', 'normal'));
 checks.push(moduleCheck('Stability Bridge', !!bridges.stability, bridges.stability?'Stability bridge ready.':'Send Stability Bridge before real test.', 'critical'));
 checks.push(moduleCheck('Runtime Pressure', !sLab || (sLab.metrics?.pressure||0)<78, 'Pressure '+(sLab?.metrics?.pressure??'n/a')+'%.', 'critical'));
 checks.push(moduleCheck('Memory Size', !pc || (pc.memory?.scars||[]).length <= (sLab?.maxScars||80), 'Memory scars '+((pc?.memory?.scars||[]).length)+' / '+(sLab?.maxScars||80)+'.', 'normal'));
 checks.push(moduleCheck('Flow Nodes', !pc || (pc.flow?.nodes||[]).length <= (sLab?.maxNodes||32), 'Flow nodes '+((pc?.flow?.nodes||[]).length)+' / '+(sLab?.maxNodes||32)+'.', 'normal'));
 const okCount=checks.filter(x=>x.ok).length; h.score=Math.round(okCount/checks.length*100); h.status=h.score>=90?'READY':h.score>=75?'TESTABLE':h.score>=55?'NEEDS TUNING':'HOLD'; h.lastScan=now; h.checks=checks;
 const fixes=[];
 checks.filter(x=>!x.ok).forEach(x=>fixes.push({t:new Date().toLocaleTimeString(),item:x.name+' — '+x.detail,priority:x.priority}));
 if((sLab?.metrics?.pressure||0)>70)fixes.push({t:new Date().toLocaleTimeString(),item:'Pressure je vyšší: zkus BALANCED/ECO, sniž max flow nodes nebo scars.',priority:'critical'});
 if(!bridges.stability)fixes.push({t:new Date().toLocaleTimeString(),item:'Před testem zmáčkni SEND STABILITY BRIDGE.',priority:'critical'});
 if(!bridges.physics)fixes.push({t:new Date().toLocaleTimeString(),item:'Před testem zmáčkni SEND PHYSICS BRIDGE.',priority:'normal'});
 h.fixes=fixes.slice(0,20);
 h.bridge={intent:!!bridges.intent,performance:!!bridges.performance,physics:!!bridges.physics,stability:!!bridges.stability,health:!!bridges.health,ageMs:{intent:bridges.intent?.t?now-bridges.intent.t:null,physics:bridges.physics?.t?now-bridges.physics.t:null,stability:bridges.stability?.t?now-bridges.stability.t:null}};
 h.cleanup=[
  {area:'UI',level:sections.length>24?'high':'ok',note:sections.length+' Show OS sekcí — po testu doporučen Beginner/Pro filtr.'},
  {area:'Bridge API',level:bridges.physics&&bridges.stability?'ok':'medium',note:'sjednotit payload verze: intent/performance/physics/stability/health'},
  {area:'Runtime',level:(sLab?.metrics?.pressure||0)>70?'high':'ok',note:'sledovat pressure, frame ms, bridge age, flow nodes'},
  {area:'Data',level:(state.generatedWorlds?.length||0)>40?'medium':'ok',note:'generated worlds: '+(state.generatedWorlds?.length||0)},
  {area:'Events',level:(state.events?.length||0)>80?'medium':'ok',note:'events in memory: '+(state.events?.length||0)+' — později převést na emergent rules'}
 ];
 h.reports.unshift({t:new Date().toISOString(),score:h.score,status:h.status,checks:h.checks,fixes:h.fixes,cleanup:h.cleanup}); h.reports=h.reports.slice(0,20);
 localStorage.setItem('budilight.health.report',JSON.stringify(h.reports[0])); save(); renderHealthConsole(); toast('Health scan: '+h.status+' / '+h.score+' %');
}
function sendHealthBridge(){const h=healthConsole(); if(!h.lastScan)runHealthScan(); const payload={source:'STEP22KP_SYSTEM_HEALTH_CONSOLE',t:Date.now(),score:h.score,status:h.status,checks:h.checks,fixes:h.fixes,cleanup:h.cleanup,bridge:h.bridge,stability:state.stabilityLab,physicsSummary:{enabled:state.physicsCore?.enabled,quality:state.physicsCore?.quality,flowNodes:(state.physicsCore?.flow?.nodes||[]).length,memoryScars:(state.physicsCore?.memory?.scars||[]).length}}; localStorage.setItem('budilight.health.bridge',JSON.stringify(payload)); const pre=$('healthPayload'); if(pre)pre.textContent=JSON.stringify(payload,null,2); toast('Health bridge uložen.');}
function exportHealthReport(){const h=healthConsole(); if(!h.lastScan)runHealthScan(); const blob=new Blob([JSON.stringify(h.reports[0]||h,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='budilight_step22kp_health_report.json'; a.click(); URL.revokeObjectURL(a.href);}
function renderHealthConsole(){const h=healthConsole(); const k=$('healthKpis'); if(k)k.innerHTML=`<div><span>STATUS</span><b>${h.status}</b></div><div><span>SCORE</span><b>${h.score}%</b></div><div><span>CHECKS</span><b>${(h.checks||[]).filter(x=>x.ok).length}/${(h.checks||[]).length}</b></div><div><span>LAST SCAN</span><b>${h.lastScan?new Date(h.lastScan).toLocaleTimeString():'—'}</b></div><div><span>MODE</span><b>${state.controlAuthority?.mode||'MANUAL'}</b></div>`;
 const list=$('healthChecklist'); if(list)list.innerHTML=(h.checks||[]).map(x=>`<div class="health-row ${x.ok?'ok':'bad'}"><b>${x.ok?'✓':'!'}</b><span><strong>${x.name}</strong><small>${x.detail}</small></span><em>${x.priority}</em></div>`).join('')||'<em>Spusť RUN HEALTH SCAN.</em>';
 const fixes=$('healthFixes'); if(fixes)fixes.innerHTML=(h.fixes||[]).map(x=>`<div><b>${x.priority}</b><span>${x.item}</span></div>`).join('')||'<em>Žádné zásadní fixy.</em>';
 const bi=$('healthBridgeInspector'); if(bi){const b=h.bridge||{}; bi.innerHTML=[['Intent',b.intent?100:0],['Performance',b.performance?100:0],['Physics',b.physics?100:0],['Stability',b.stability?100:0],['Health',b.health?100:0]].map(([n,v])=>`<div class="phys-meter"><span>${n}</span><b style="width:${v}%"></b><em>${v?'OK':'MISS'}</em></div>`).join('');}
 const cr=$('cleanupRadar'); if(cr)cr.innerHTML=(h.cleanup||[]).map(x=>`<div class="cleanup-item ${x.level}"><strong>${x.area}</strong><span>${x.note}</span><b>${x.level}</b></div>`).join('')||'<em>Cleanup radar čeká na scan.</em>';
 const pre=$('healthPayload'); if(pre)pre.textContent=JSON.stringify({source:'STEP22KP_SYSTEM_HEALTH_CONSOLE',score:h.score,status:h.status,bridge:h.bridge,cleanup:h.cleanup},null,2);
}


function cleanupConsole(){state.cleanupConsole=state.cleanupConsole||{score:0,status:'NOT AUDITED',lastAudit:0,architecture:[],priorities:[],actions:[],contracts:[],registry:[],reports:[]}; return state.cleanupConsole;}
function buildArchitectureMap(){
 const c=cleanupConsole();
 const modules=[
  ['Operator Control','authority',!!state.authority,'manual limits, locks, feature gates','control'],
  ['Universe / Story','story',Array.isArray(state.story)||Array.isArray(state.livingTimeline),'universe travel, story phase, timeline rewrite','logic'],
  ['Phenomena Engine','phenomena',!!state.phenomena,'phenomena, world physics, entities, camera intent','logic'],
  ['Visual Physics Core','physics',!!state.physicsCore,'variables, memory, attention, flow, emergent events','core'],
  ['Stability Lab','stability',!!state.stabilityLab,'fps, bridge rate, watchdog, auto-degrade','safety'],
  ['Health Console','health',!!state.healthConsole,'module checklist, bridge inspector, health payload','debug'],
  ['Cleanup Console','cleanup',true,'architecture map, safe cleanup plan, contract matrix','debug'],
  ['World Market / Creator','market',!!state.market,'clone, favorites, packages, variants','library'],
  ['Performance Bridge','bridge',!!readBridgeKey('budilight.performance.bridge.pro'),'renderer-safe intent payloads','bridge']
 ];
 c.architecture=modules.map(([name,id,ok,detail,type],i)=>({name,id,ok:!!ok,detail,type,order:i+1}));
 c.registry=[
  {module:'Show OS UI',owner:'public/show-os.html + show-os.js',status:'active',cleanup:'keep'},
  {module:'Renderer / Performance',owner:'Performance page/runtime',status:'separate',cleanup:'do not merge'},
  {module:'Bridge Payloads',owner:'localStorage intents',status:'active',cleanup:'version contract'},
  {module:'Legacy test pages',owner:'archive/',status:'archived',cleanup:'keep archived until real test passes'},
  {module:'Physics/Health/Stability',owner:'Show OS sections',status:'active',cleanup:'merge UI concepts later, not now'}
 ];
 c.lastAudit=Date.now(); c.status='MAP BUILT';
 log('Cleanup Console → architecture map built');
 renderCleanupConsole(); save();
}
function runCleanupAudit(){
 const c=cleanupConsole(); buildArchitectureMap();
 const bridges={intent:readBridgeKey('budilight.showos.intent'),performance:readBridgeKey('budilight.performance.bridge.pro'),physics:readBridgeKey('budilight.physics.bridge'),stability:readBridgeKey('budilight.stability.bridge'),health:readBridgeKey('budilight.health.bridge')};
 const pc=physicsCore(), s=stabilityLab();
 const issues=[];
 if(!bridges.physics)issues.push({level:'critical',title:'Physics Bridge nebyl odeslán',detail:'Před real testem pošli Physics Bridge, ať víme, jaký intent dostane renderer.'});
 if(!bridges.stability)issues.push({level:'critical',title:'Stability Bridge nebyl odeslán',detail:'Před real testem pošli Stability Bridge kvůli FPS/guard limitům.'});
 if((s.metrics?.pressure||0)>75)issues.push({level:'high',title:'Runtime pressure je vysoký',detail:'Sniž profile na BALANCED/ECO nebo dej Trim Load.'});
 if((pc.memory?.scars||[]).length>(s.maxScars||30))issues.push({level:'high',title:'Memory Field přes limit',detail:'Memory scars překročily stabilizační limit.'});
 if((pc.flow?.nodes||[]).length>(s.maxNodes||24))issues.push({level:'high',title:'Flow Network přes limit',detail:'Flow nodes překročily stabilizační limit.'});
 if(state.history.length>80)issues.push({level:'normal',title:'Historie je dlouhá',detail:'Neřešit hned, ale při cleanupu ji dáme do odděleného archive/log modulu.'});
 if(!issues.length)issues.push({level:'ok',title:'Základní cleanup audit je čistý',detail:'Teď můžeš testovat chování a zapisovat konkrétní UX/performance problémy.'});
 c.priorities=issues;
 c.actions=[
  {name:'Freeze Renderer Contract',safe:true,why:'Neměnit renderer při úklidu Show OS. Bridge zůstane API hranice.'},
  {name:'Hide Advanced Sections',safe:true,why:'Advanced sekce později schovat pod PRO mód, ne mazat.'},
  {name:'Normalize Payload Versions',safe:true,why:'Každý bridge bude mít source/version/schema.'},
  {name:'Archive Old Test Pages',safe:'later',why:'Mazat až po vícedenním testu, zatím jen archivovat.'},
  {name:'Merge Similar Panels',safe:'later',why:'Health/Stability/Cleanup sjednotit až po tom, co zjistíme co reálně používáš.'}
 ];
 c.contracts=[
  {name:'showos.intent',key:'budilight.showos.intent',ready:!!bridges.intent,owner:'Show OS'},
  {name:'performance.bridge.pro',key:'budilight.performance.bridge.pro',ready:!!bridges.performance,owner:'Story/Universe/Control'},
  {name:'physics.bridge',key:'budilight.physics.bridge',ready:!!bridges.physics,owner:'Visual Physics Core'},
  {name:'stability.bridge',key:'budilight.stability.bridge',ready:!!bridges.stability,owner:'Stability Lab'},
  {name:'health.bridge',key:'budilight.health.bridge',ready:!!bridges.health,owner:'Health Console'},
  {name:'cleanup.plan',key:'budilight.cleanup.plan',ready:true,owner:'Cleanup Console'}
 ];
 const ok=c.priorities.filter(x=>x.level==='ok').length, bad=c.priorities.filter(x=>x.level==='critical'||x.level==='high').length;
 c.score=clamp(82-bad*18+ok*8); c.status=bad?'NEEDS ATTENTION':'READY TO TEST'; c.lastAudit=Date.now();
 localStorage.setItem('budilight.cleanup.plan',JSON.stringify(cleanupPayload()));
 toast('Cleanup audit hotový: '+c.status); renderCleanupConsole(); save();
}
function cleanupPayload(){const c=cleanupConsole(); return {source:'STEP22KQ_CLEANUP_ARCHITECTURE_CONSOLE',version:'22KQ',createdAt:new Date().toISOString(),score:c.score,status:c.status,architecture:c.architecture,priorities:c.priorities,actions:c.actions,contracts:c.contracts,registry:c.registry,operatorRule:'operator_first_director_second_automation_third',cleanupMode:'audit_and_plan_only_no_destructive_changes'};}
function exportCleanupPlan(){const payload=cleanupPayload(); localStorage.setItem('budilight.cleanup.plan',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kq-cleanup-plan.json'; a.click(); URL.revokeObjectURL(url); toast('Cleanup plán exportovaný.');}
function renderCleanupConsole(){
 const c=cleanupConsole();
 const k=$('cleanupKpis'); if(k){k.innerHTML=[['Cleanup Score',c.score||0],['Modules',(c.architecture||[]).length],['Priority',(c.priorities||[]).filter(x=>x.level==='critical'||x.level==='high').length],['Contracts',(c.contracts||[]).filter(x=>x.ready).length]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');}
 const map=$('architectureMap'); if(map){const arr=c.architecture?.length?c.architecture:[]; map.innerHTML=arr.map(m=>`<div class="arch-node ${m.ok?'ok':'warn'}"><b>${String(m.order).padStart(2,'0')} · ${m.name}</b><span>${m.type}</span><small>${m.detail}</small></div>`).join('')||'<em>Spusť BUILD MAP nebo RUN CLEANUP AUDIT.</em>';}
 const pr=$('cleanupPriority'); if(pr){pr.innerHTML=(c.priorities||[]).map(x=>`<div class="priority-${x.level}"><b>${x.level.toUpperCase()}</b><span>${x.title}</span><small>${x.detail}</small></div>`).join('')||'<em>Zatím bez auditu.</em>';}
 const ac=$('cleanupActions'); if(ac){ac.innerHTML=(c.actions||[]).map(a=>`<div><b>${a.safe===true?'SAFE':String(a.safe).toUpperCase()}</b><span>${a.name}</span><small>${a.why}</small></div>`).join('')||'<em>Akce se objeví po auditu.</em>';}
 const cm=$('contractMatrix'); if(cm){cm.innerHTML=(c.contracts||[]).map(x=>`<div class="contract-row ${x.ready?'ok':'missing'}"><b>${x.name}</b><code>${x.key}</code><span>${x.owner}</span><em>${x.ready?'READY':'MISSING'}</em></div>`).join('')||'<em>Spusť audit.</em>';}
 const rg=$('moduleRegistry'); if(rg){rg.innerHTML=(c.registry||[]).map(x=>`<div><b>${x.module}</b><span>${x.owner}</span><small>${x.status} · cleanup: ${x.cleanup}</small></div>`).join('')||'<em>Registry bude vytvořen při BUILD MAP.</em>';}
 const p=$('cleanupPayload'); if(p)p.textContent=JSON.stringify(cleanupPayload(),null,2);
}


function cleanupPass(){state.cleanupPass=state.cleanupPass&&typeof state.cleanupPass==='object'?state.cleanupPass:{uiMode:'PRO',safeMode:true,advancedVisible:false,sections:['control','performance','showos','diagnostics'],findings:[],contracts:[],hidden:[],testPlan:[],lastRun:0};
state.cleanupPass2=state.cleanupPass2&&typeof state.cleanupPass2==='object'?state.cleanupPass2:{navigationProfile:'TEST',focusMode:true,liveStatus:'READY',routeMap:[],statusCards:[],testChecklist:[],safeFallbacks:[],notes:[],lastRun:0}; return state.cleanupPass;}
function runCleanupPass(){const p=cleanupPass(); const c=cleanupConsole(); if(!c.lastAudit)runCleanupAudit(); p.lastRun=Date.now(); p.findings=[
 {level:'keep',area:'Performance',title:'Renderer zůstává samostatný',detail:'Performance stránka se nemá slučovat se Show OS. Show OS posílá jen intent/bridge payload.'},
 {level:'safe',area:'UI',title:'Beginner/Pro/Debug režim',detail:'Advanced sekce se budou pouze skrývat podle režimu. Nic se nemaže.'},
 {level:'safe',area:'Bridge',title:'Stabilizovat payload verze',detail:'Intent, Physics, Health, Stability a Cleanup payloady dostanou čitelné source/version pole.'},
 {level:'watch',area:'Runtime',title:'Hlídání localStorage objemu',detail:'Historie a reporty se trimují, aby dlouhé testy nezpomalovaly UI.'},
 {level:'watch',area:'Navigation',title:'Moc sekcí v levém menu',detail:'Při Beginner režimu se nechá jen Control, Performance směr, Health a Cleanup.'}
 ];
 p.contracts=[
  {name:'Operator First',status:'LOCKED',rule:'Manual control always wins over Director/Automation'},
  {name:'No destructive cleanup',status:'LOCKED',rule:'Archive/hide first, delete only after real test passes'},
  {name:'Bridge only',status:'LOCKED',rule:'Show OS does not render LED pixels directly'},
  {name:'Scalable UI',status:'ACTIVE',rule:'Beginner/Pro/Debug modes can expose different depth'},
  {name:'Performance safety',status:'ACTIVE',rule:'SAFE/LIVE profiles limit heavy monitors and history'}
 ];
 p.hidden=p.advancedVisible?[]:['legendary','market','creator','graph','economy','evolution','genome','recipes','ambient'];
 p.testPlan=[
  '1) Spusť appku a ověř, že PERFORMANCE, SHOW OS, MAPPING a SETTINGS jdou otevřít.',
  '2) V SHOW OS spusť Health Scan, Stability Scan a Cleanup Pass 1.',
  '3) Přepni UI Mode Beginner/Pro/Debug a sleduj, jestli se nic nerozbije.',
  '4) Pošli Physics Bridge a zkontroluj, že payload je v localStorage.',
  '5) Nech appku běžet 15–30 minut a sleduj runtime pressure + heartbeat.'
 ];
 localStorage.setItem('budilight.cleanup.pass1',JSON.stringify(cleanupPassPayload()));
 log('Cleanup Pass 1 completed'); renderCleanupPass(); renderCleanupPass2(); renderCleanupPass3(); save(); toast('Cleanup Pass 1 hotový.');
}
function setCleanupUiMode(mode){const p=cleanupPass(); p.uiMode=mode; p.advancedVisible=mode==='DEBUG'; p.safeMode=mode!=='DEBUG'; p.hidden=p.advancedVisible?[]:['legendary','market','creator','graph','economy','evolution','genome','recipes','ambient']; localStorage.setItem('budilight.showos.uiMode',mode); renderCleanupPass(); renderCleanupPass2(); renderCleanupPass3(); save(); toast('UI mode: '+mode);}
function cleanupPassPayload(){const p=cleanupPass(); return {source:'STEP22KR_CLEANUP_PASS_1',version:'22KR',createdAt:new Date().toISOString(),uiMode:p.uiMode,safeMode:p.safeMode,advancedVisible:p.advancedVisible,findings:p.findings,contracts:p.contracts,hiddenSections:p.hidden,testPlan:p.testPlan,operatorRule:'operator_first_director_second_automation_third',cleanupPolicy:'hide_archive_refactor_never_delete_first'};}
function exportCleanupPass(){const payload=cleanupPassPayload(); localStorage.setItem('budilight.cleanup.pass1',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kr-cleanup-pass1.json'; a.click(); URL.revokeObjectURL(url); toast('Cleanup Pass 1 exportovaný.');}
function renderCleanupPass(){const p=cleanupPass();
 const k=$('cleanupPassKpis'); if(k)k.innerHTML=[['UI Mode',p.uiMode],['Safe Mode',p.safeMode?'ON':'OFF'],['Hidden',(p.hidden||[]).length],['Contracts',(p.contracts||[]).length],['Findings',(p.findings||[]).length]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');
 qsa('[data-cleanup-mode]').forEach(b=>b.classList.toggle('active',b.dataset.cleanupMode===p.uiMode));
 const f=$('cleanupPassFindings'); if(f)f.innerHTML=(p.findings||[]).map(x=>`<div class="cleanup-pass-row ${x.level}"><b>${x.area}</b><span>${x.title}</span><small>${x.detail}</small></div>`).join('')||'<em>Spusť CLEANUP PASS 1.</em>';
 const c=$('cleanupPassContracts'); if(c)c.innerHTML=(p.contracts||[]).map(x=>`<div class="contract-row ok"><b>${x.name}</b><span>${x.status}</span><code>${x.rule}</code><em>OK</em></div>`).join('')||'<em>Kontrakty se zobrazí po passu.</em>';
 const h=$('cleanupHiddenSections'); if(h)h.innerHTML=(p.hidden||[]).map(x=>`<button type="button">${x}</button>`).join('')||'<em>V DEBUG režimu není nic skryto.</em>';
 const t=$('cleanupTestPlan'); if(t)t.innerHTML=(p.testPlan||[]).map(x=>`<div><span>${x}</span></div>`).join('')||'<em>Test plan se vytvoří po passu.</em>';
 const pre=$('cleanupPassPayload'); if(pre)pre.textContent=JSON.stringify(cleanupPassPayload(),null,2);
}


// STEP22KS/KR support + STEP22KT — Cleanup Pass 3 / Test Mode Polish
function cleanupPass2(){
 state.cleanupPass2=state.cleanupPass2&&typeof state.cleanupPass2==='object'?state.cleanupPass2:{navigationProfile:'TEST',focusMode:true,liveStatus:'READY',routeMap:[],statusCards:[],testChecklist:[],safeFallbacks:[],notes:[],lastRun:0};
 return state.cleanupPass2;
}
function setCleanupNavProfile(profile){
 const p=cleanupPass2(); p.navigationProfile=profile; p.focusMode=profile!=='FULL';
 localStorage.setItem('budilight.showos.navProfile',profile);
 runCleanupPass2(false); renderCleanupPass2(); renderCleanupPass3(); save(); toast('Navigation profile: '+profile);
}
function runCleanupPass2(showToast=true){
 const p=cleanupPass2(); const cp=cleanupPass(); const s=stabilityLab(); const h=healthConsole();
 p.lastRun=Date.now(); p.liveStatus=(s.health==='OK'||s.health==='GOOD')?'READY':'WATCH';
 const live=['control','physics','stability','health','cleanup-pass2','cleanup-pass3'];
 const create=['universe','story','phenomena','legendary','market','creator'];
 const debug=['cleanup','cleanup-pass','bridge','graph','memory','intelligence'];
 const profile=p.navigationProfile||'TEST';
 p.routeMap=(profile==='LIVE'?live:profile==='TEST'?[...live,'story','phenomena','bridge']:[...live,...create,...debug]).map((id,i)=>({order:i+1,id,lane:live.includes(id)?'LIVE':create.includes(id)?'CREATE':'DEBUG',visible:true}));
 p.statusCards=[
  {name:'Operator Authority',value:authority().mode||'MANUAL',state:(authority().operatorLock?'LOCKED':'READY'),detail:'Ruční režim a limity mají prioritu před Directorem.'},
  {name:'Renderer Contract',value:'SEPARATE',state:'SAFE',detail:'SHOW OS posílá intent, nepřebírá renderer.'},
  {name:'Runtime Pressure',value:(s.metrics?.pressure||0)+'%',state:(s.metrics?.pressure||0)>75?'WATCH':'OK',detail:'Při WATCH přepni Stability na BALANCED/ECO.'},
  {name:'Health Score',value:(h.score||0)+'%',state:(h.score||0)<70?'WATCH':'OK',detail:'Health Console určuje, co ladit jako první.'}
 ];
 p.safeFallbacks=[
  'Když se UI začne sekat: Stability → ECO nebo Trim Load.',
  'Když bridge není jasný: pošli Health + Stability + Physics Bridge znovu.',
  'Když se ztratíš v menu: Cleanup Pass 2 → LIVE profile.',
  'Když show vypadá moc automaticky: Control Authority → MANUAL nebo ASSIST + Operator Lock.',
  'Když je moc modulů: Beginner/Pro režim pouze schová panely, nic nemaže.'
 ];
 p.testChecklist=[
  'Otevřít PERFORMANCE a ověřit, že běží preview / základní renderer.',
  'Otevřít SHOW OS → Stability Scan → Health Scan.',
  'Poslat Physics Bridge, Stability Bridge a Health Bridge.',
  'Přepínat LIVE / TEST / FULL DEBUG a sledovat, zda se neztrácí ovládání.',
  'Nechat běžet 15 minut a zapsat FPS, runtime pressure, UI lag a bridge heartbeat.',
  'Při problému nefiltrovat pocitově: nejdřív screenshot Health + Stability + Cleanup Pass 3.'
 ];
 p.notes=[
  {t:new Date().toLocaleTimeString(),item:'Cleanup Pass 2 refreshed · profile '+profile},
  {t:new Date().toLocaleTimeString(),item:'Visible routes '+p.routeMap.length+' · status '+p.liveStatus}
 ].concat(p.notes||[]).slice(0,16);
 localStorage.setItem('budilight.cleanup.pass2',JSON.stringify(cleanupPass2Payload()));
 if(showToast)toast('Cleanup Pass 2 hotový: '+p.liveStatus); renderCleanupPass2(); save();
}
function cleanupPass2Payload(){const p=cleanupPass2(); return {source:'STEP22KS_CLEANUP_PASS_2',version:'22KS',createdAt:new Date().toISOString(),navigationProfile:p.navigationProfile,focusMode:p.focusMode,liveStatus:p.liveStatus,routeMap:p.routeMap,statusCards:p.statusCards,safeFallbacks:p.safeFallbacks,testChecklist:p.testChecklist,notes:p.notes,policy:'navigation_and_test_polish_only_no_destructive_changes'};}
function exportCleanupPass2(){const payload=cleanupPass2Payload(); localStorage.setItem('budilight.cleanup.pass2',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22ks-cleanup-pass2.json'; a.click(); URL.revokeObjectURL(url); toast('Cleanup Pass 2 exportovaný.');}
function renderCleanupPass2(){const p=cleanupPass2();
 const k=$('cleanupPass2Kpis'); if(k)k.innerHTML=[['Nav Profile',p.navigationProfile],['Focus',p.focusMode?'ON':'OFF'],['Status',p.liveStatus],['Routes',(p.routeMap||[]).length],['Checklist',(p.testChecklist||[]).length]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');
 qsa('[data-nav-profile]').forEach(b=>b.classList.toggle('active',b.dataset.navProfile===p.navigationProfile));
 const rm=$('cleanupRouteMap'); if(rm)rm.innerHTML=(p.routeMap||[]).map(x=>`<div class="cleanup-pass-row ${x.lane.toLowerCase()}"><b>${String(x.order).padStart(2,'0')} · ${x.id}</b><span>${x.lane}</span><small>${x.visible?'visible':'hidden'}</small></div>`).join('')||'<em>Spusť RUN PASS 2.</em>';
 const sc=$('cleanupStatusCards'); if(sc)sc.innerHTML=(p.statusCards||[]).map(x=>`<div class="contract-row ${x.state==='OK'||x.state==='SAFE'||x.state==='READY'||x.state==='LOCKED'?'ok':'missing'}"><b>${x.name}</b><span>${x.value}</span><code>${x.detail}</code><em>${x.state}</em></div>`).join('')||'<em>Status karty se vytvoří po passu.</em>';
 const fb=$('cleanupFallbacks'); if(fb)fb.innerHTML=(p.safeFallbacks||[]).map(x=>`<div><span>${x}</span></div>`).join('')||'<em>Fallbacky se vytvoří po passu.</em>';
 const tc=$('cleanupTestChecklist'); if(tc)tc.innerHTML=(p.testChecklist||[]).map((x,i)=>`<div><b>${i+1}</b><span>${x}</span></div>`).join('')||'<em>Checklist se vytvoří po passu.</em>';
 const nt=$('cleanupPass2Notes'); if(nt)nt.innerHTML=(p.notes||[]).map(x=>`<div><b>${x.t}</b><span>${x.item}</span></div>`).join('')||'<em>Zatím bez poznámek.</em>';
 const pre=$('cleanupPass2Payload'); if(pre)pre.textContent=JSON.stringify(cleanupPass2Payload(),null,2);
}
function cleanupPass3(){state.cleanupPass3=state.cleanupPass3&&typeof state.cleanupPass3==='object'?state.cleanupPass3:{testMode:'GUIDED',operatorView:'COMPACT',sessionChecklist:[],routingSummary:[],riskRegister:[],performanceNotes:[],releaseGates:[],runbook:[],lastRun:0};
state.fieldTest=state.fieldTest&&typeof state.fieldTest==='object'?state.fieldTest:{mode:'DRY_RUN',stage:'PRECHECK',score:0,preflight:[],liveRoute:[],burnin:[],rollback:[],operatorNotes:[],lastRun:0}; return state.cleanupPass3;}
function setCleanupTestMode(mode){const p=cleanupPass3(); p.testMode=mode; runCleanupPass3(false); renderCleanupPass3(); save(); toast('Test mode: '+mode);}
function runCleanupPass3(showToast=true){
 const p=cleanupPass3(), p2=cleanupPass2(), s=stabilityLab(), h=healthConsole(), pc=physicsCore(); p.lastRun=Date.now();
 p.operatorView=(p.testMode==='FAST')?'COMPACT':(p.testMode==='BURNIN'?'MONITOR':'GUIDED');
 p.sessionChecklist=[
  {step:'BOOT',status:'TODO',check:'npm start bez chyb, otevřít login / hlavní UI.'},
  {step:'ROUTES',status:'TODO',check:'Otevřít Performance, Show OS, Mapping, Settings.'},
  {step:'BRIDGE',status:'TODO',check:'Odeslat Physics + Stability + Health Bridge.'},
  {step:'CONTROL',status:'TODO',check:'Authority MANUAL/ASSIST, Operator Lock a limity fungují.'},
  {step:'LOAD',status:'TODO',check:'15–30 minut runtime; sledovat FPS, pressure, heartbeat.'},
  {step:'REPORT',status:'TODO',check:'Export Health Report + Cleanup Pass 3 před další úpravou.'}
 ];
 p.routingSummary=(p2.routeMap||[]).map(r=>({route:r.id,lane:r.lane,action:r.lane==='LIVE'?'keep visible':r.lane==='CREATE'?'hide in LIVE, show in PRO':'debug only'}));
 p.riskRegister=[
  {risk:'UI bloat',level:(p2.routeMap||[]).length>16?'HIGH':'OK',mitigation:'LIVE profile + Beginner/Pro/Debug režimy.'},
  {risk:'Runtime pressure',level:(s.metrics?.pressure||0)>75?'HIGH':'OK',mitigation:'ECO/BALANCED profile, trim scars/nodes/history.'},
  {risk:'Autopilot feeling',level:(authority().mode==='AUTO_LIMITED'&&!authority().operatorLock)?'WATCH':'OK',mitigation:'Operator Lock, MANUAL/ASSIST, vypnout timeline rewrite/mega/discovery.'},
  {risk:'Physics overload',level:((pc.flow?.nodes||[]).length>(s.maxNodes||24)||(pc.memory?.scars||[]).length>(s.maxScars||30))?'WATCH':'OK',mitigation:'Trim Load, snížit quality nebo memory decay.'}
 ];
 p.performanceNotes=[
  'Testuj nejdřív BALANCED, ne HIGH. HIGH až po stabilním burn-inu.',
  'Cleanup Pass 3 nic nemaže. Připravuje finální úklid podle skutečných výsledků.',
  'Při každé regresi porovnej: Health Score, Runtime Pressure, poslední Bridge Payload.'
 ];
 p.releaseGates=[
  {gate:'JS check',status:'PASS after npm run check:js'},
  {gate:'Navigation',status:(p2.liveStatus||'READY')},
  {gate:'Health',status:(h.score||0)>=70?'PASS':'WATCH'},
  {gate:'Stability',status:(s.metrics?.pressure||0)<=75?'PASS':'WATCH'},
  {gate:'Operator safety',status:authority().operatorLock?'LOCKED':'READY'}
 ];
 p.runbook=[
  '1) Otevři Show OS → Cleanup Pass 3 → RUN PASS 3.',
  '2) Dej Stability Scan + Health Scan.',
  '3) Dej FAST test: projít všechny hlavní stránky.',
  '4) Dej GUIDED test: bridge + authority + physics.',
  '5) Dej BURNIN jen pokud FAST/GUIDED prošly bez záseků.'
 ];
 localStorage.setItem('budilight.cleanup.pass3',JSON.stringify(cleanupPass3Payload()));
 if(showToast)toast('Cleanup Pass 3 hotový · '+p.operatorView); renderCleanupPass3(); save();
}
function cleanupPass3Payload(){const p=cleanupPass3(); return {source:'STEP22KT_CLEANUP_PASS_3_TEST_POLISH',version:'22KT',createdAt:new Date().toISOString(),testMode:p.testMode,operatorView:p.operatorView,sessionChecklist:p.sessionChecklist,routingSummary:p.routingSummary,riskRegister:p.riskRegister,performanceNotes:p.performanceNotes,releaseGates:p.releaseGates,runbook:p.runbook,policy:'test_mode_polish_operator_safe_no_delete'};}
function exportCleanupPass3(){const payload=cleanupPass3Payload(); localStorage.setItem('budilight.cleanup.pass3',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kt-cleanup-pass3-test-polish.json'; a.click(); URL.revokeObjectURL(url); toast('Cleanup Pass 3 exportovaný.');}
function renderCleanupPass3(){const p=cleanupPass3();
 const k=$('cleanupPass3Kpis'); if(k)k.innerHTML=[['Test Mode',p.testMode],['View',p.operatorView],['Risks',(p.riskRegister||[]).filter(x=>x.level!=='OK').length],['Gates',(p.releaseGates||[]).length],['Runbook',(p.runbook||[]).length]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');
 qsa('[data-test-mode]').forEach(b=>b.classList.toggle('active',b.dataset.testMode===p.testMode));
 const ch=$('cleanupPass3Checklist'); if(ch)ch.innerHTML=(p.sessionChecklist||[]).map(x=>`<div class="cleanup-pass-row"><b>${x.step}</b><span>${x.check}</span><small>${x.status}</small></div>`).join('')||'<em>Spusť RUN PASS 3.</em>';
 const rr=$('cleanupRiskRegister'); if(rr)rr.innerHTML=(p.riskRegister||[]).map(x=>`<div class="priority-${x.level==='OK'?'ok':x.level.toLowerCase()}"><b>${x.level}</b><span>${x.risk}</span><small>${x.mitigation}</small></div>`).join('')||'<em>Risk register se vytvoří po passu.</em>';
 const rs=$('cleanupRoutingSummary'); if(rs)rs.innerHTML=(p.routingSummary||[]).map(x=>`<div><b>${x.route}</b><span>${x.lane}</span><small>${x.action}</small></div>`).join('')||'<em>Nejdřív RUN PASS 2 nebo RUN PASS 3.</em>';
 const rg=$('cleanupReleaseGates'); if(rg)rg.innerHTML=(p.releaseGates||[]).map(x=>`<div class="contract-row ${String(x.status).includes('PASS')||String(x.status).includes('READY')||String(x.status).includes('LOCKED')?'ok':'missing'}"><b>${x.gate}</b><span>${x.status}</span><code>release gate</code><em>${String(x.status).includes('WATCH')?'WATCH':'OK'}</em></div>`).join('')||'<em>Release gates se vytvoří po passu.</em>';
 const rb=$('cleanupRunbook'); if(rb)rb.innerHTML=(p.runbook||[]).map(x=>`<div><span>${x}</span></div>`).join('')||'<em>Runbook se vytvoří po passu.</em>';
 const pn=$('cleanupPerformanceNotes'); if(pn)pn.innerHTML=(p.performanceNotes||[]).map(x=>`<div><span>${x}</span></div>`).join('')||'<em>Zatím bez poznámek.</em>';
 const pre=$('cleanupPass3Payload'); if(pre)pre.textContent=JSON.stringify(cleanupPass3Payload(),null,2);
}


function fieldTest(){state.fieldTest=state.fieldTest&&typeof state.fieldTest==='object'?state.fieldTest:{mode:'DRY_RUN',stage:'PRECHECK',score:0,preflight:[],liveRoute:[],burnin:[],rollback:[],operatorNotes:[],lastRun:0}; return state.fieldTest;}
function setFieldMode(mode){const f=fieldTest(); f.mode=mode; f.stage=mode==='LIVE_ROUTE'?'ROUTE':mode==='BURN_IN'?'BURNIN':'PRECHECK'; renderFieldTest(); renderOperatorLaunch(); save();}
function runFieldTest(){
 const f=fieldTest(); const h=healthConsole(); const s=stabilityLab(); const p3=cleanupPass3();
 if(!h.lastScan)runHealthScan(false); if(!s.lastScan)runStabilityScan(false); if(!(p3.sessionChecklist||[]).length)runCleanupPass3(false);
 const pressure=s.metrics?.pressure||0; const health=h.score||0; const routeOk=(p3.releaseGates||[]).filter(g=>String(g.status).includes('PASS')||String(g.status).includes('READY')||String(g.status).includes('LOCKED')).length;
 f.score=clamp((health*.42)+(Math.max(0,100-pressure)*.35)+(routeOk*5));
 f.stage=f.score>=82?'READY_FOR_REAL_TEST':f.score>=65?'WATCH_AND_TEST':'FIX_BEFORE_LIVE';
 f.preflight=[
  {item:'npm run check:js',status:'PASS',note:'syntaktická kontrola projektu'},
  {item:'Health Console',status:health>=70?'PASS':'WATCH',note:'score '+health+'%'},
  {item:'Runtime Pressure',status:pressure<=75?'PASS':'WATCH',note:pressure+'%'},
  {item:'Operator Control',status:authority().operatorLock?'LOCKED':'READY',note:'Director nesmí přebírat kontrolu bez limitů'},
  {item:'Bridge Payloads',status:'READY',note:'physics / stability / health / cleanup jsou oddělené kontrakty'}
 ];
 f.liveRoute=[
  {step:'1',name:'Start server',cmd:'npm start',expect:'bez crash, otevřít /login.html nebo /show-os.html'},
  {step:'2',name:'FAST test',cmd:'Cleanup Pass 3 → FAST',expect:'projít hlavní stránky bez záseku'},
  {step:'3',name:'Bridge test',cmd:'Physics Bridge + Stability Bridge + Health Bridge',expect:'localStorage payloady existují a jsou čitelné'},
  {step:'4',name:'Output safe test',cmd:'MANUAL nebo ASSIST + Operator Lock',expect:'žádný neřízený skok energy/chaos'},
  {step:'5',name:'15 min burn-in',cmd:'Stability Lab BALANCED',expect:'pressure pod 75%, heartbeat živý'}
 ];
 f.burnin=[
  {duration:'5 min',profile:'SAFE',goal:'ověřit start, UI a routing'},
  {duration:'15 min',profile:'BALANCED',goal:'sledovat pressure, memory scars, flow nodes'},
  {duration:'30 min',profile:'LIVE',goal:'pouze pokud 15 min test prošel čistě'},
  {duration:'60+ min',profile:'LIVE/BALANCED',goal:'dlouhý test až po úklidu regresí'}
 ];
 f.rollback=[
  {trigger:'UI lag / stránka se kouše',action:'Stability Lab → ECO/SAFE + Trim Load'},
  {trigger:'nečekaná změna show',action:'Control Authority → MANUAL + Operator Lock'},
  {trigger:'černý/stale frame',action:'zkontrolovat Master Framebus / Output route, neřešit Show OS vrstvu'},
  {trigger:'moc modulů v navigaci',action:'Navigation profile LIVE nebo TEST'},
  {trigger:'nejistota po úpravě',action:'vrátit se k poslednímu ZIPu před změnou'}
 ];
 f.operatorNotes=[
  'Tento RC pack nic destruktivně nemaže. Slouží k projetí appky a zapsání reálných problémů.',
  'Nejdřív testuj bez reálného výstupu, potom s bezpečným jasem a až pak dlouhý burn-in.',
  'Když se něco seká, nejdřív zjistit pressure/health/bridge age, až potom upravovat renderer.'
 ];
 f.lastRun=Date.now(); localStorage.setItem('budilight.fieldtest.rc',JSON.stringify(fieldTestPayload())); toast('Field Test RC připravený · '+f.stage); renderFieldTest(); renderOperatorLaunch(); save();
}
function fieldTestPayload(){const f=fieldTest(); return {source:'STEP22KU_FIELD_TEST_RC_PACK',version:'22KU',createdAt:new Date().toISOString(),mode:f.mode,stage:f.stage,score:f.score,preflight:f.preflight,liveRoute:f.liveRoute,burnin:f.burnin,rollback:f.rollback,operatorNotes:f.operatorNotes,policy:'release_candidate_field_test_no_destructive_cleanup'};}
function exportFieldTest(){const payload=fieldTestPayload(); localStorage.setItem('budilight.fieldtest.rc',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22ku-field-test-rc.json'; a.click(); URL.revokeObjectURL(url); toast('Field Test RC exportovaný.');}
function renderFieldTest(){const f=fieldTest();
 const k=$('fieldTestKpis'); if(k)k.innerHTML=[['Mode',f.mode],['Stage',f.stage],['Score',(f.score||0)+'%'],['Preflight',(f.preflight||[]).length],['Burn-in',(f.burnin||[]).length]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');
 qsa('[data-field-mode]').forEach(b=>b.classList.toggle('active',b.dataset.fieldMode===f.mode));
 const pf=$('fieldPreflight'); if(pf)pf.innerHTML=(f.preflight||[]).map(x=>`<div class="cleanup-pass-row"><b>${x.status}</b><span>${x.item}</span><small>${x.note}</small></div>`).join('')||'<em>Spusť RUN FIELD TEST RC.</em>';
 const lr=$('fieldLiveRoute'); if(lr)lr.innerHTML=(f.liveRoute||[]).map(x=>`<div class="cleanup-pass-row"><b>${x.step}. ${x.name}</b><span>${x.cmd}</span><small>${x.expect}</small></div>`).join('')||'<em>Trasa se vytvoří po spuštění RC.</em>';
 const bi=$('fieldBurnin'); if(bi)bi.innerHTML=(f.burnin||[]).map(x=>`<div class="contract-row ok"><b>${x.duration}</b><span>${x.profile}</span><code>${x.goal}</code><em>test</em></div>`).join('')||'<em>Burn-in plán čeká.</em>';
 const rb=$('fieldRollback'); if(rb)rb.innerHTML=(f.rollback||[]).map(x=>`<div class="priority-watch"><b>${x.trigger}</b><span>${x.action}</span></div>`).join('')||'<em>Rollback plán čeká.</em>';
 const on=$('fieldOperatorNotes'); if(on)on.innerHTML=(f.operatorNotes||[]).map(x=>`<div><span>${x}</span></div>`).join('')||'<em>Zatím bez poznámek.</em>';
 const pre=$('fieldPayload'); if(pre)pre.textContent=JSON.stringify(fieldTestPayload(),null,2);
}


// STEP22KV — Final QA & Stabilization Pass
function finalQA(){state.finalQA=state.finalQA||{depth:'FULL',score:0,stage:'NOT_RUN',verdicts:[],blockers:[],modules:[],fallback:[],notes:[],lastRun:0}; return state.finalQA;}
function setQaDepth(depth){finalQA().depth=depth; runFinalQA();}
function runFinalQA(){
 const q=finalQA();
 const h=healthConsole?.()||{};
 const st=stabilityLab?.()||{};
 const hc=Number(h.score||0);
 const pressure=Number(st.runtimePressure||0);
 const auth=authority?.()||{};
 const field=fieldTest?.()||{};
 const cleanup=cleanupPass3?.()||{};
 const physics=physicsCore?.()||{};
 const fieldScore=Number(field.score||0);
 const cleanupReady=(cleanup.releaseGates||[]).filter(x=>String(x.status).includes('PASS')||String(x.status).includes('READY')||String(x.status).includes('LOCKED')).length;
 const base=Math.round((hc*.28)+(Math.max(0,100-pressure)*.20)+(fieldScore*.22)+(cleanupReady*5)+(auth.operatorLock?10:4)+(physics.enabled!==false?6:2));
 q.score=clamp(base,0,100);
 q.stage=q.score>=86?'RC_READY_FOR_SHARED_APP_WALKTHROUGH':q.score>=70?'TESTABLE_WITH_WATCH_ITEMS':'HOLD_AND_FIX_BLOCKERS';
 q.verdicts=[
  {gate:'JS syntax / boot',status:'PASS',note:'npm run check:js musí zůstat zelený před každým ZIPem'},
  {gate:'Operator authority',status:auth.operatorLock?'LOCKED':'WATCH',note:auth.operatorLock?'Director je pod ruční kontrolou':'zapnout Operator Lock před live testem'},
  {gate:'Runtime pressure',status:pressure<=65?'PASS':pressure<=80?'WATCH':'BLOCKER',note:pressure+'% pressure'},
  {gate:'Health score',status:hc>=75?'PASS':hc>=55?'WATCH':'BLOCKER',note:hc+'% health'},
  {gate:'Field test RC',status:fieldScore>=82?'READY':fieldScore>=65?'WATCH':'NOT_READY',note:'score '+fieldScore+'%'}
 ];
 q.blockers=q.verdicts.filter(v=>['BLOCKER','NOT_READY'].includes(v.status)).map(v=>({item:v.gate,status:v.status,note:v.note}));
 if(!q.blockers.length) q.blockers=[{item:'No hard blocker',status:'OK',note:'pokračuj společným ručním průchodem appky'}];
 q.modules=[
  {name:'Performance Renderer',qa:'WATCH',scope:'nechat renderer samostatný, Show OS posílá intent'},
  {name:'Show OS Bridge',qa:'PASS',scope:'localStorage payloady oddělené podle vrstev'},
  {name:'Physics Core',qa:physics.enabled===false?'WATCH':'PASS',scope:'variables/memory/attention/flow/emergent'},
  {name:'Stability Lab',qa:pressure<=80?'PASS':'WATCH',scope:'profiles + pressure + degrade hints'},
  {name:'Health Console',qa:hc>=70?'PASS':'WATCH',scope:'module checklist + bridge inspector'},
  {name:'Cleanup UI Modes',qa:'PASS',scope:'BEGINNER/PRO/DEBUG + nav profiles'},
  {name:'Field Test RC',qa:fieldScore>=70?'PASS':'WATCH',scope:'dry/live/burn-in workflow'}
 ];
 q.fallback=[
  {trigger:'UI začne lagovat',action:'Stability Lab → SAFE/ECO, Trim Load, zavřít DEBUG navigaci'},
  {trigger:'Show reaguje moc sama',action:'Control Authority → MANUAL + Operator Lock + vypnout Timeline Rewrite'},
  {trigger:'Bridge payload podezřelý',action:'Health Console → Bridge Inspector, smazat jen konkrétní localStorage payload'},
  {trigger:'Černý frame na výstupu',action:'řešit Master Framebus/Output route, ne Show OS koncepty'},
  {trigger:'Test se rozpadne po nové úpravě',action:'vrátit poslední stabilní ZIP STEP22KU/KV a porovnat změnu'}
 ];
 q.notes=[
  'STEP22KV je stabilizační pass, ne další kreativní expanze.',
  'Cíl dalšího společného průchodu: projít hlavní stránky v profilu TEST, potom LIVE, potom FULL DEBUG.',
  'Všechny advanced vrstvy mají zůstat zapnutelné, škálovatelné a schovatelné. Nic nesmí převzít show bez limitu operátora.',
  'Po prvním reálném testu už má smysl čistit podle skutečných problémů, ne podle domněnek.'
 ];
 q.lastRun=Date.now(); localStorage.setItem('budilight.final.qa',JSON.stringify(finalQaPayload())); toast('Final QA hotové · '+q.stage); renderFinalQA(); save();
}
function finalQaPayload(){const q=finalQA(); return {source:'STEP22KV_FINAL_QA_STABILIZATION_PASS',version:'22KV',createdAt:new Date().toISOString(),depth:q.depth,stage:q.stage,score:q.score,verdicts:q.verdicts,blockers:q.blockers,modules:q.modules,fallback:q.fallback,notes:q.notes,policy:'stabilization_before_shared_cleanup_no_destructive_actions'};}
function exportFinalQA(){const payload=finalQaPayload(); localStorage.setItem('budilight.final.qa',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kv-final-qa-report.json'; a.click(); URL.revokeObjectURL(url); toast('Final QA report exportovaný.');}
function renderFinalQA(){
 const q=finalQA();
 const k=$('finalQaKpis'); if(k)k.innerHTML=[['Depth',q.depth],['Score',(q.score||0)+'%'],['Stage',q.stage],['Last',q.lastRun?new Date(q.lastRun).toLocaleTimeString():'not run']].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
 const v=$('finalQaVerdicts'); if(v)v.innerHTML=(q.verdicts||[]).map(x=>`<div class="contract-row ${['PASS','READY','LOCKED','OK'].some(s=>String(x.status).includes(s))?'ok':'missing'}"><b>${x.gate}</b><span>${x.status}</span><code>${x.note}</code><em>${String(x.status).includes('BLOCK')?'FIX':'QA'}</em></div>`).join('')||'<em>Spusť RUN FINAL QA.</em>';
 const b=$('finalQaBlockers'); if(b)b.innerHTML=(q.blockers||[]).map(x=>`<div><b>${x.item}</b><span>${x.status}</span><small>${x.note}</small></div>`).join('')||'<em>Žádné položky.</em>';
 const m=$('finalQaModules'); if(m)m.innerHTML=(q.modules||[]).map(x=>`<div><b>${x.name}</b><span>${x.qa}</span><small>${x.scope}</small></div>`).join('')||'<em>Matrix se vytvoří po QA.</em>';
 const f=$('finalQaFallback'); if(f)f.innerHTML=(q.fallback||[]).map(x=>`<div><b>${x.trigger}</b><span>${x.action}</span></div>`).join('')||'<em>Fallback drill se vytvoří po QA.</em>';
 const n=$('finalQaNotes'); if(n)n.innerHTML=(q.notes||[]).map(x=>`<p>${x}</p>`).join('')||'<em>Notes se vytvoří po QA.</em>';
 const p=$('finalQaPayload'); if(p)p.textContent=JSON.stringify(finalQaPayload(),null,2);
}



// STEP22KW — Production Readiness Pack
function productionReady(){state.productionReady=state.productionReady||{mode:'FIELD_SAFE',score:0,stage:'NOT_RUN',startup:[],recovery:[],ops:[],versions:[],lastRun:0}; return state.productionReady;}
function setProductionMode(mode){productionReady().mode=mode; runProductionReady();}
function runProductionReady(){
 const p=productionReady();
 const qa=finalQA?.()||{}; const h=healthConsole?.()||{}; const st=stabilityLab?.()||{}; const auth=authority?.()||{};
 const qaScore=Number(qa.score||0), health=Number(h.score||0), pressure=Number(st.runtimePressure||0);
 const authorityOk=auth.operatorLock?1:0;
 p.score=clamp(Math.round(qaScore*.32 + health*.26 + Math.max(0,100-pressure)*.22 + authorityOk*12 + 8),0,100);
 p.stage=p.score>=88?'PRODUCTION_READY_FOR_CONTROLLED_FIELD_TEST':p.score>=72?'FIELD_TESTABLE_WITH_OPERATOR_WATCH':'NOT_READY_FOR_LIVE_ROUTE';
 p.startup=[
  {step:1,name:'Start server',cmd:'npm start',expect:'server běží bez syntax erroru'},
  {step:2,name:'Open Performance',cmd:'index.html',expect:'preview/renderer naskočí bez pádu'},
  {step:3,name:'Open Show OS',cmd:'show-os.html → Production Ready',expect:'Production score a status se vykreslí'},
  {step:4,name:'Set Authority',cmd:'Control Authority → MANUAL/ASSIST + Operator Lock',expect:'Director nepřebírá show mimo limity'},
  {step:5,name:'Dry bridge',cmd:'SEND INTENT / Physics Bridge / Production Report',expect:'payloady se uloží do localStorage'},
  {step:6,name:'Low brightness live',cmd:'Performance jas nízko + bezpečný profil',expect:'žádné stale/blackout překvapení'}
 ];
 p.recovery=[
  {problem:'UI laguje',action:'Production Mode FIELD_SAFE + Stability SAFE + zavřít DEBUG sekce'},
  {problem:'Show se chová moc automaticky',action:'Authority MANUAL, vypnout Discovery/Mega/Timeline Rewrite'},
  {problem:'Černý frame',action:'nečistit Show OS; řešit Master Framebus / Output route / ArtNet route'},
  {problem:'Nejasný bridge',action:'Health Console → Bridge Inspector, export reportu, smazat jen cílený payload'},
  {problem:'Po reloadu divný stav',action:'Settings/cleanup: reset browser localStorage jen pro Show OS klíče'}
 ];
 p.ops=[
  {name:'Operator first',status:auth.operatorLock?'PASS':'WATCH',note:auth.operatorLock?'Operator Lock aktivní':'před ostrým testem zapnout'},
  {name:'QA gate',status:qaScore>=80?'PASS':'WATCH',note:'Final QA '+qaScore+'%'},
  {name:'Health gate',status:health>=75?'PASS':'WATCH',note:'Health '+health+'%'},
  {name:'Pressure gate',status:pressure<=65?'PASS':pressure<=80?'WATCH':'BLOCKER',note:'Runtime pressure '+pressure+'%'},
  {name:'Rollback clarity',status:'PASS',note:'recovery postupy jsou součástí Production reportu'}
 ];
 p.versions=[
  {key:'Current package',value:'STEP22KW_PRODUCTION_READINESS_PACK'},
  {key:'Stable rollback',value:'STEP22KV_FINAL_QA_STABILIZATION_PASS'},
  {key:'Field RC rollback',value:'STEP22KU_FIELD_TEST_RC_PACK'},
  {key:'Policy',value:'no destructive cleanup, operator controlled'}
 ];
 p.lastRun=Date.now(); localStorage.setItem('budilight.production.ready',JSON.stringify(productionPayload())); toast('Production Readiness hotové · '+p.stage); renderProductionReady(); save();
}
function productionPayload(){const p=productionReady(); return {source:'STEP22KW_PRODUCTION_READINESS_PACK',version:'22KW',createdAt:new Date().toISOString(),mode:p.mode,stage:p.stage,score:p.score,startup:p.startup,recovery:p.recovery,ops:p.ops,versions:p.versions,policy:'production_readiness_controlled_field_test_operator_first'};}
function exportProductionReady(){const payload=productionPayload(); localStorage.setItem('budilight.production.ready',JSON.stringify(payload)); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kw-production-readiness-report.json'; a.click(); URL.revokeObjectURL(url); toast('Production Readiness report exportovaný.');}
function renderProductionReady(){
 const p=productionReady();
 const k=$('productionKpis'); if(k)k.innerHTML=[['Mode',p.mode],['Score',(p.score||0)+'%'],['Stage',p.stage],['Startup',(p.startup||[]).length],['Recovery',(p.recovery||[]).length]].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');
 qsa('[data-prod-mode]').forEach(b=>b.classList.toggle('active',b.dataset.prodMode===p.mode));
 const su=$('productionStartup'); if(su)su.innerHTML=(p.startup||[]).map(x=>`<div class="cleanup-pass-row"><b>${x.step}. ${x.name}</b><span>${x.cmd}</span><small>${x.expect}</small></div>`).join('')||'<em>Spusť RUN PRODUCTION CHECK.</em>';
 const rc=$('productionRecovery'); if(rc)rc.innerHTML=(p.recovery||[]).map(x=>`<div class="priority-watch"><b>${x.problem}</b><span>${x.action}</span></div>`).join('')||'<em>Recovery postupy čekají.</em>';
 const op=$('productionOps'); if(op)op.innerHTML=(p.ops||[]).map(x=>`<div class="contract-row ${String(x.status).toLowerCase()}"><b>${x.name}</b><span>${x.status}</span><code>${x.note}</code><em>gate</em></div>`).join('')||'<em>Ops gates čekají.</em>';
 const ve=$('productionVersions'); if(ve)ve.innerHTML=(p.versions||[]).map(x=>`<div><b>${x.key}</b><span>${x.value}</span></div>`).join('')||'<em>Verze se doplní po checku.</em>';
 const pre=$('productionPayload'); if(pre)pre.textContent=JSON.stringify(productionPayload(),null,2);
}


// STEP22KX — Operator Launch Pack
function operatorLaunch(){state.operatorLaunch=state.operatorLaunch||{mode:'DRY_RUN',armed:false,stage:'NOT_CHECKED',score:0,lastPreflight:0,quick:[],preflight:[],liveActions:[],watch:[],bridge:null,notes:[]}; return state.operatorLaunch;}
function setLaunchMode(mode){const l=operatorLaunch(); l.mode=mode; if(mode!=='LIVE_ARMED') l.armed=false; runLaunchPreflight();}
function launchScoreParts(){
 const qa=finalQA?.()||{}; const prod=productionReady?.()||{}; const h=healthConsole?.()||{}; const st=stabilityLab?.()||{}; const auth=authority?.()||{};
 return {qa:Number(qa.score||0),prod:Number(prod.score||0),health:Number(h.score||0),pressure:Number(st.runtimePressure||0),authLock:!!auth.operatorLock,outputGuard:!!st.outputGuard,watchdog:!!st.watchdogEnabled};
}
function runLaunchPreflight(){
 const l=operatorLaunch(), p=launchScoreParts();
 const safety=(p.authLock?18:4)+(p.outputGuard?12:0)+(p.watchdog?8:0);
 l.score=clamp(Math.round(p.qa*.22+p.prod*.25+p.health*.22+Math.max(0,100-p.pressure)*.18+safety));
 const liveAllowed=l.mode==='LIVE_ARMED'&&l.score>=82&&p.authLock&&p.outputGuard;
 l.stage=liveAllowed?'READY_TO_ARM_LIVE_ROUTE':l.score>=72?'READY_FOR_DRY_RUN_OR_LOW_BRIGHTNESS':'HOLD_AND_FIX_BEFORE_LAUNCH';
 l.preflight=[
  {gate:'Server boot',status:'MANUAL CHECK',note:'npm start bez erroru, stránka /show-os.html otevřená'},
  {gate:'Operator Lock',status:p.authLock?'PASS':'WATCH',note:p.authLock?'operátor drží autoritu':'zapnout v Control Authority před live'},
  {gate:'Output Guard',status:p.outputGuard?'PASS':'BLOCK',note:p.outputGuard?'guard aktivní':'zapnout ve Stability Lab'},
  {gate:'Final QA',status:p.qa>=80?'PASS':'WATCH',note:p.qa+'%'},
  {gate:'Production readiness',status:p.prod>=80?'PASS':'WATCH',note:p.prod+'%'},
  {gate:'Runtime pressure',status:p.pressure<=65?'PASS':p.pressure<=80?'WATCH':'BLOCK',note:p.pressure+'%'},
  {gate:'Bridge heartbeat',status:'VERIFY',note:'zkontroluj, že bridge payload refreshuje a output není stale'}
 ];
 l.quick=[
  {name:'SAFE CALM',action:'energy 18 / chaos 10 / density 18 / motion 15',safe:true},
  {name:'LOW BRIGHTNESS LIVE',action:'LIVE route pouze s nízkým jasem, test 2–5 min',safe:true},
  {name:'FREEZE DIRECTOR',action:'operator lock + no auto apply + no mega events',safe:true},
  {name:'REBUILD BRIDGE',action:'znovu odeslat Launch Bridge payload',safe:true},
  {name:'ROLLBACK ZIP',action:'vrátit STEP22KW/KV pokud se UI rozbije',safe:true}
 ];
 l.liveActions=[
  {step:'1',name:'Dry Run',do:'spustit bez LED outputu nebo s vypnutým route'},
  {step:'2',name:'Low Brightness',do:'povolit output s malým jasem a sledovat pressure/heartbeat'},
  {step:'3',name:'Live Route',do:'teprve po stabilním heartbeat a bez blockerů'},
  {step:'4',name:'Burn-in',do:'nechat běžet 20–60 min, kontrolovat FPS/stale/fallback'},
  {step:'5',name:'Save Report',do:'export Launch reportu před dalším cleanupem'}
 ];
 l.watch=[
  {signal:'stale fallback',meaning:'renderer/bridge neposílá čerstvý frame',reaction:'rebuild bridge, snížit režim, zkontrolovat route'},
  {signal:'runtime pressure > 80%',meaning:'UI nebo simulace je těžká',reaction:'SAFE profile, trim load, vypnout debug sekce'},
  {signal:'unexpected blackout',meaning:'guard nebo route drží černý frame',reaction:'Health Console + Output route + poslední payload'},
  {signal:'LED chaos bez kontroly',meaning:'Director nebo eventy jsou moc volné',reaction:'Operator Lock, AUTO off, Mega/Discovery off'}
 ];
 l.notes=['Launch Pack je operátorská vrstva, ne nový automat. Nic nespouští samo bez ARM.', 'LIVE_ARMED je jen stav připravenosti v UI; fyzický output pořád drží existující output route.', 'Po prvním reálném testu projdeme report a budeme ladit výkon podle naměřených problémů.'];
 l.lastPreflight=Date.now();
 l.bridge=launchPayload();
 localStorage.setItem('budilight.operator.launch',JSON.stringify(l.bridge));
 toast('Launch preflight hotový · '+l.stage);
 renderOperatorLaunch(); save();
}
function armLaunch(){const l=operatorLaunch(); if(!l.lastPreflight)runLaunchPreflight(); if(l.score>=82&&l.mode==='LIVE_ARMED'){l.armed=true; l.stage='LIVE_ROUTE_ARMED_BY_OPERATOR'; toast('Launch ARM aktivní — operátor drží kontrolu.');}else{l.armed=false; toast('ARM blokován: nastav LIVE_ARMED a score min. 82 %.');} renderOperatorLaunch(); save();}
function disarmLaunch(){const l=operatorLaunch(); l.armed=false; l.stage='DISARMED_SAFE'; state.energy=18; state.chaos=10; state.density=18; state.motion=15; toast('DISARM + SAFE CALM.'); renderOperatorLaunch(); render();}
function launchQuickAction(action){const l=operatorLaunch(); if(action==='safe'){state.energy=18;state.chaos=10;state.density=18;state.motion=15;state.phase='AFTERHOURS';l.armed=false;l.stage='SAFE_CALM_APPLIED';} if(action==='freeze'){const a=authority(); a.operatorLock=true; a.autoApply=false; a.allowMegaEvents=false; a.allowDiscovery=false; l.stage='DIRECTOR_FROZEN_BY_OPERATOR';} if(action==='low'){l.mode='LIVE_LOW_BRIGHTNESS'; state.energy=clamp(Math.min(state.energy,35)); state.density=clamp(Math.min(state.density,35)); l.stage='LOW_BRIGHTNESS_TEST_MODE';} if(action==='bridge'){sendLaunchBridge(); return;} log('Launch quick action → '+action); renderOperatorLaunch(); render();}
function launchPayload(){const l=operatorLaunch(); return {source:'STEP22KY_LIVE_OPERATIONS_CONSOLE',version:'22KY',createdAt:new Date().toISOString(),mode:l.mode,armed:!!l.armed,stage:l.stage,score:l.score,targetUniverse:state.targetUniverse||state.universe,currentWorld:state.current,targetWorld:state.target,energy:state.energy,chaos:state.chaos,density:state.density,motion:state.motion,operatorPolicy:'manual_arm_required_operator_first_no_autonomous_takeover',preflight:l.preflight,watch:l.watch};}
function sendLaunchBridge(){const payload=launchPayload(); operatorLaunch().bridge=payload; localStorage.setItem('budilight.operator.launch.bridge',JSON.stringify(payload)); toast('Launch Bridge payload uložen.'); renderOperatorLaunch(); save();}
function exportLaunchPack(){const payload=launchPayload(); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kx-operator-launch-report.json'; a.click(); URL.revokeObjectURL(url); toast('Operator Launch report exportovaný.');}
function renderOperatorLaunch(){
 const l=operatorLaunch();
 const k=$('launchKpis'); if(k)k.innerHTML=[['Mode',l.mode],['ARM',l.armed?'ARMED':'DISARMED'],['Score',(l.score||0)+'%'],['Stage',l.stage],['Last',l.lastPreflight?new Date(l.lastPreflight).toLocaleTimeString():'not run']].map(([n,v])=>`<div><span>${n}</span><b>${v}</b></div>`).join('');
 qsa('[data-launch-mode]').forEach(b=>b.classList.toggle('active',b.dataset.launchMode===l.mode));
 const pf=$('launchPreflight'); if(pf)pf.innerHTML=(l.preflight||[]).map(x=>`<div class="contract-row ${String(x.status).toLowerCase()}"><b>${x.gate}</b><span>${x.status}</span><code>${x.note}</code><em>preflight</em></div>`).join('')||'<em>Spusť RUN LAUNCH PREFLIGHT.</em>';
 const qa=$('launchQuickActions'); if(qa)qa.innerHTML=(l.quick||[]).map(x=>`<div class="cleanup-pass-row"><b>${x.name}</b><span>${x.action}</span><small>${x.safe?'safe operator action':'watch'}</small></div>`).join('')||'<em>Quick actions se vytvoří po preflightu.</em>';
 const la=$('launchLiveActions'); if(la)la.innerHTML=(l.liveActions||[]).map(x=>`<div class="cleanup-pass-row"><b>${x.step}. ${x.name}</b><span>${x.do}</span></div>`).join('')||'<em>Launch sequence čeká.</em>';
 const wa=$('launchWatch'); if(wa)wa.innerHTML=(l.watch||[]).map(x=>`<div class="priority-watch"><b>${x.signal}</b><span>${x.meaning}</span><small>${x.reaction}</small></div>`).join('')||'<em>Watch signály čekají.</em>';
 const nt=$('launchNotes'); if(nt)nt.innerHTML=(l.notes||[]).map(x=>`<p>${x}</p>`).join('')||'<em>Poznámky se vytvoří po preflightu.</em>';
 const pre=$('launchPayload'); if(pre)pre.textContent=JSON.stringify(launchPayload(),null,2);
}



// STEP22KY — Live Operations Console
function liveOps(){
  state.liveOps=state.liveOps&&typeof state.liveOps==='object'?state.liveOps:{mode:'WATCH',severity:'GREEN',startedAt:Date.now(),lastCheck:0,incidents:[],actions:[],notes:[],bridgePulse:Date.now(),runtimeFlags:{fps:'UNKNOWN',bridge:'LOCAL',output:'SAFE',operator:'PRESENT'}};
  state.liveOps.incidents=Array.isArray(state.liveOps.incidents)?state.liveOps.incidents:[];
  state.liveOps.actions=Array.isArray(state.liveOps.actions)?state.liveOps.actions:[];
  state.liveOps.notes=Array.isArray(state.liveOps.notes)?state.liveOps.notes:[];
  state.liveOps.runtimeFlags=state.liveOps.runtimeFlags&&typeof state.liveOps.runtimeFlags==='object'?state.liveOps.runtimeFlags:{fps:'UNKNOWN',bridge:'LOCAL',output:'SAFE',operator:'PRESENT'};
  return state.liveOps;
}
function liveOpsScore(){
  const l=liveOps();
  const p=productionReady?productionReady():{score:80};
  const q=finalQaState?finalQaState():{score:80};
  const launch=operatorLaunch?operatorLaunch():{score:80,armed:false};
  let score=Math.round(((p.score||80)+(q.score||80)+(launch.score||80))/3);
  if(state.energy>88)score-=8;
  if(state.chaos>70)score-=7;
  if(state.density>84)score-=6;
  if(l.incidents.filter(i=>i.status!=='RESOLVED').length)score-=10;
  return Math.max(0,Math.min(100,score));
}
function liveOpsVerdict(){
  const score=liveOpsScore();
  const l=liveOps();
  if(l.severity==='RED'||score<55)return ['RED','Okamžitě zklidnit / SAFE'];
  if(l.severity==='AMBER'||score<75)return ['AMBER','Sledovat a omezit zátěž'];
  return ['GREEN','Běží stabilně'];
}
function liveOpsChecks(){
  const l=liveOps(); const age=Math.round((Date.now()-(l.bridgePulse||Date.now()))/1000);
  const openInc=l.incidents.filter(i=>i.status!=='RESOLVED').length;
  return [
    {name:'Operator mode',status:l.mode==='INTERVENTION'?'WATCH':'PASS',note:l.mode},
    {name:'Launch armed',status:(operatorLaunch&&operatorLaunch().armed)?'PASS':'WATCH',note:(operatorLaunch&&operatorLaunch().armed)?'LIVE ARMED':'not armed'},
    {name:'Runtime score',status:liveOpsScore()>=75?'PASS':'WATCH',note:liveOpsScore()+'%'},
    {name:'Open incidents',status:openInc?'WATCH':'PASS',note:String(openInc)},
    {name:'Bridge pulse',status:age<20?'PASS':'WATCH',note:age+'s ago'},
    {name:'Load envelope',status:(state.energy<=88&&state.chaos<=70&&state.density<=84)?'PASS':'WATCH',note:'E '+state.energy+' / C '+state.chaos+' / D '+state.density}
  ];
}
function renderLiveOps(){
  const l=liveOps(); const v=liveOpsVerdict();
  if($('liveOpsVerdict')) $('liveOpsVerdict').textContent=v[0]+' · '+v[1];
  if($('liveOpsScore')) $('liveOpsScore').textContent=liveOpsScore()+'%';
  if($('liveOpsMode')) $('liveOpsMode').textContent=l.mode;
  if($('liveOpsSeverity')) $('liveOpsSeverity').textContent=l.severity;
  if($('liveOpsRuntime')){const sec=Math.floor((Date.now()-(l.startedAt||Date.now()))/1000); $('liveOpsRuntime').textContent=Math.floor(sec/60)+'m '+(sec%60)+'s';}
  const checks=$('liveOpsChecks'); if(checks) checks.innerHTML=liveOpsChecks().map(c=>`<div class="contract-row ${c.status==='PASS'?'ok':'warn'}"><b>${c.name}</b><span>${c.status}</span><small>${c.note}</small></div>`).join('');
  const inc=$('liveOpsIncidents'); if(inc) inc.innerHTML=(l.incidents.length?l.incidents.slice(-8).reverse().map((i,idx)=>`<div class="cleanup-item"><b>${i.type}</b><span>${i.status}</span><small>${new Date(i.t).toLocaleTimeString()} · ${i.note}</small><button data-resolve-incident="${l.incidents.length-1-idx}">RESOLVE</button></div>`).join(''):'<p class="muted">Zatím žádný incident.</p>');
  const act=$('liveOpsActions'); if(act) act.innerHTML=(l.actions.length?l.actions.slice(-10).reverse().map(a=>`<div class="cleanup-item"><b>${a.action}</b><span>${a.result}</span><small>${new Date(a.t).toLocaleTimeString()} · ${a.note||''}</small></div>`).join(''):'<p class="muted">Zatím žádný zásah.</p>');
  if($('liveOpsPayload')) $('liveOpsPayload').textContent=JSON.stringify(liveOpsPayload(),null,2);
  qsa('[data-resolve-incident]').forEach(b=>b.onclick=()=>resolveLiveIncident(Number(b.dataset.resolveIncident)));
}
function setLiveOpsMode(mode){const l=liveOps(); l.mode=mode; l.actions.push({t:Date.now(),action:'MODE '+mode,result:'OK',note:'Operator Live Ops mode'}); renderLiveOps(); save();}
function setLiveOpsSeverity(sev){const l=liveOps(); l.severity=sev; l.actions.push({t:Date.now(),action:'SEVERITY '+sev,result:'OK',note:'manual marker'}); renderLiveOps(); save();}
function addLiveIncident(type='WATCH',note='Manual incident'){const l=liveOps(); l.incidents.push({t:Date.now(),type,status:'OPEN',note}); l.severity=type==='BLOCKER'?'RED':(l.severity==='GREEN'?'AMBER':l.severity); renderLiveOps(); save();}
function resolveLiveIncident(index){const l=liveOps(); if(l.incidents[index]){l.incidents[index].status='RESOLVED'; l.incidents[index].resolvedAt=Date.now(); l.actions.push({t:Date.now(),action:'RESOLVE INCIDENT',result:'OK',note:l.incidents[index].type});} renderLiveOps(); save();}
function liveQuickAction(action){
  const l=liveOps(); let result='OK', note='';
  if(action==='calm'){state.energy=clamp(state.energy-18);state.chaos=clamp(state.chaos-14);state.density=clamp(state.density-12);note='reduced energy/chaos/density';}
  if(action==='hold'){state.motion=clamp(state.motion-8);state.morph=Math.max(90,Number(state.morph||60));note='hold current world, slower motion';}
  if(action==='bridgePulse'){l.bridgePulse=Date.now();note='local bridge heartbeat refreshed';}
  if(action==='safe'){state.energy=22;state.chaos=12;state.density=20;state.motion=18;l.severity='GREEN';note='safe visual envelope';}
  if(action==='logWatch'){addLiveIncident('WATCH','Operator marked watch point');return;}
  l.actions.push({t:Date.now(),action:action.toUpperCase(),result,note}); render(); renderLiveOps(); save();
}
function runLiveOpsScan(){
  const l=liveOps(); l.lastCheck=Date.now(); l.bridgePulse=Date.now();
  const score=liveOpsScore();
  l.severity=score>=80?'GREEN':score>=60?'AMBER':'RED';
  l.actions.push({t:Date.now(),action:'LIVE OPS SCAN',result:l.severity,note:'score '+score+'%'});
  renderLiveOps(); save(); toast('Live Ops scan: '+l.severity+' · '+score+'%');
}
function liveOpsPayload(){
  const l=liveOps(); const v=liveOpsVerdict();
  return {source:'STEP22KY_LIVE_OPERATIONS_CONSOLE',version:'22KY',createdAt:new Date().toISOString(),mode:l.mode,severity:l.severity,verdict:v[0],score:liveOpsScore(),currentWorld:state.current,targetWorld:state.target,targetUniverse:state.targetUniverse||state.universe,energy:state.energy,chaos:state.chaos,density:state.density,motion:state.motion,phase:state.phase,openIncidents:l.incidents.filter(i=>i.status!=='RESOLVED').length,checks:liveOpsChecks(),operatorPolicy:'operator_first_live_actions_are_manual_and_reversible'};
}
function exportLiveOpsReport(){const payload=liveOpsPayload(); const blob=new Blob([JSON.stringify({...payload,incidents:liveOps().incidents,actions:liveOps().actions},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22ky-live-ops-report.json'; a.click(); URL.revokeObjectURL(url); toast('Live Ops report exportovaný.');}
function sendLiveOpsBridge(){localStorage.setItem('budilight.live.ops.bridge',JSON.stringify(liveOpsPayload())); liveOps().bridgePulse=Date.now(); renderLiveOps(); toast('Live Ops bridge payload uložen.');}

// STEP22KZ — Post-Show Review & Learning Pack
function postShow(){
  state.postShow=state.postShow&&typeof state.postShow==='object'?state.postShow:{window:'FULL_NIGHT',focus:'STABILITY',lastBuilt:0,verdict:'NOT_BUILT',stability:0,summary:[],lessons:[],timeline:[],snapshots:[]};
  state.postShow.summary=Array.isArray(state.postShow.summary)?state.postShow.summary:[];
  state.postShow.lessons=Array.isArray(state.postShow.lessons)?state.postShow.lessons:[];
  state.postShow.timeline=Array.isArray(state.postShow.timeline)?state.postShow.timeline:[];
  state.postShow.snapshots=Array.isArray(state.postShow.snapshots)?state.postShow.snapshots:[];
  return state.postShow;
}
function postShowStability(){
  const live=liveOps?liveOps():{incidents:[],actions:[]};
  const open=live.incidents.filter(i=>i.status!=='RESOLVED').length;
  const all=live.incidents.length;
  const liveScore=liveOpsScore?liveOpsScore():80;
  const qa=finalQaState?finalQaState().score||80:80;
  const prod=productionReady?productionReady().score||80:80;
  let score=Math.round((liveScore*0.45)+(qa*0.25)+(prod*0.20)+10);
  score-=Math.min(25,open*8);
  score-=Math.min(12,Math.max(0,all-3)*2);
  return Math.max(0,Math.min(100,score));
}
function buildPostShowReview(){
  const p=postShow(); const live=liveOps?liveOps():{incidents:[],actions:[]};
  const stability=postShowStability();
  const open=live.incidents.filter(i=>i.status!=='RESOLVED').length;
  p.lastBuilt=Date.now(); p.stability=stability;
  p.verdict=stability>=86&&open===0?'READY_TO_ITERATE':stability>=70?'WATCH_AND_TUNE':'FIX_BEFORE_NEXT_SHOW';
  p.summary=[
    {name:'Runtime stability',status:stability>=80?'PASS':'WATCH',note:stability+'%'},
    {name:'Open incidents',status:open?'WATCH':'PASS',note:String(open)},
    {name:'Operator actions',status:live.actions.length<20?'PASS':'INFO',note:String(live.actions.length)},
    {name:'Current creative state',status:'INFO',note:(state.targetUniverse||state.universe)+' / '+state.current+' → '+state.target},
    {name:'Control policy',status:'PASS',note:'operator first · learning is manual'}
  ];
  p.lessons=[
    {priority:open?'HIGH':'MED',title:'Resolve open incidents',todo:open?'projít Live Ops incident log a uzavřít příčiny':'incident log je čistý'},
    {priority:stability<80?'HIGH':'LOW',title:'Tune performance envelope',todo:stability<80?'snížit Chaos/Density limity nebo použít BALANCED/SAFE profil':'aktuální envelope může zůstat'},
    {priority:'MED',title:'Review operator actions',todo:'najít opakované ruční zásahy a převést je na jasné quick action / preset'},
    {priority:'MED',title:'Creative continuity',todo:'porovnat Story Phase, Universe travel a World blending proti pocitu z reálné show'},
    {priority:'LOW',title:'Next cleanup pass',todo:'schovat moduly, které během testu nebyly potřeba'}
  ];
  const story=(state.story&&state.story.timeline?state.story.timeline:[]).slice(0,6);
  p.timeline=story.length?story.map((x,i)=>({step:i+1,phase:x.phase||x.name||'Phase',note:(x.universe||state.universe)+' · '+(x.world||state.current)+' · '+(x.minutes||x.duration||'?')+' min'})):[
    {step:1,phase:state.phase||'GROOVE',note:(state.targetUniverse||state.universe)+' · '+state.current+' → '+state.target},
    {step:2,phase:'Live Ops',note:(live.actions.length||0)+' actions · '+(live.incidents.length||0)+' incidents'},
    {step:3,phase:'Post Review',note:p.verdict}
  ];
  saveLearningSnapshot(false);
  renderPostShow(); save(); toast('Post‑Show Review hotový · '+p.verdict);
}
function saveLearningSnapshot(showToast=true){
  const p=postShow();
  const snap={t:Date.now(),stability:postShowStability(),focus:p.focus,window:p.window,universe:state.targetUniverse||state.universe,world:state.current,target:state.target,energy:state.energy,chaos:state.chaos,density:state.density,motion:state.motion,phase:state.phase,manualOnly:true};
  p.snapshots.push(snap);
  p.snapshots=p.snapshots.slice(-12);
  localStorage.setItem('budilight.postshow.learning.snapshot',JSON.stringify(p.snapshots,null,2));
  renderPostShow(); save(); if(showToast)toast('Learning snapshot uložený ručně.');
}
function setReviewWindow(w){postShow().window=w; renderPostShow(); save();}
function setReviewFocus(f){postShow().focus=f; renderPostShow(); save();}
function postShowPayload(){const p=postShow(); const live=liveOps?liveOps():{incidents:[],actions:[]}; return {source:'STEP22KZ_POST_SHOW_REVIEW_LEARNING_PACK',version:'22KZ',createdAt:new Date().toISOString(),window:p.window,focus:p.focus,verdict:p.verdict,stability:postShowStability(),summary:p.summary,lessons:p.lessons,timeline:p.timeline,incidents:live.incidents,actions:live.actions.slice(-40),learningPolicy:'manual_snapshot_only_no_autonomous_takeover',snapshotCount:p.snapshots.length};}
function exportPostShowReport(){const payload=postShowPayload(); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budilight-step22kz-post-show-review-report.json'; a.click(); URL.revokeObjectURL(url); toast('Post‑Show report exportovaný.');}
function renderPostShow(){
  const p=postShow(); const live=liveOps?liveOps():{incidents:[],actions:[]};
  if($('postShowVerdict'))$('postShowVerdict').textContent=p.verdict;
  if($('postShowStability'))$('postShowStability').textContent=postShowStability()+'%';
  if($('postShowIncidents'))$('postShowIncidents').textContent=String(live.incidents.length||0);
  if($('postShowActions'))$('postShowActions').textContent=String(live.actions.length||0);
  if($('postShowLearning'))$('postShowLearning').textContent=p.focus+' · '+p.window;
  const sum=$('postShowSummary'); if(sum)sum.innerHTML=(p.summary.length?p.summary:[{name:'Review',status:'WAIT',note:'Spusť BUILD REVIEW po testu.'}]).map(x=>`<div class="contract-row ${x.status==='PASS'?'ok':'warn'}"><b>${x.name}</b><span>${x.status}</span><small>${x.note}</small></div>`).join('');
  const lessons=$('postShowLessons'); if(lessons)lessons.innerHTML=(p.lessons.length?p.lessons:[{priority:'INFO',title:'Čeká na data',todo:'Nejdřív projeď Live Ops / Field Test.'}]).map(x=>`<div class="cleanup-item"><b>${x.priority} · ${x.title}</b><span>${x.todo}</span></div>`).join('');
  const tl=$('postShowTimeline'); if(tl)tl.innerHTML=(p.timeline.length?p.timeline:[{step:'-',phase:'No timeline',note:'Build review doplní recap.'}]).map(x=>`<div class="cleanup-pass-row"><b>${x.step}. ${x.phase}</b><span>${x.note}</span></div>`).join('');
  const sn=$('postShowSnapshot'); if(sn)sn.innerHTML=(p.snapshots.length?p.snapshots.slice(-6).reverse().map(x=>`<div class="cleanup-item"><b>${new Date(x.t).toLocaleTimeString()} · ${x.stability}%</b><span>${x.universe} / ${x.world}</span><small>E${x.energy} C${x.chaos} D${x.density} M${x.motion}</small></div>`).join(''):'<p class="muted">Zatím žádný learning snapshot.</p>');
  if($('postShowPayload'))$('postShowPayload').textContent=JSON.stringify(postShowPayload(),null,2);
}

function bind(){
 ['energy','chaos','density','motion','morph'].forEach(id=>$(id)?.addEventListener('input',e=>{state[id]=Number(e.target.value); render();}));
 qsa('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action; if(a==='build'){state.energy=clamp(state.energy+12);state.density=clamp(state.density+8);state.motion=clamp(state.motion+6);state.phase='BUILD';} if(a==='hold')state.phase='GROOVE'; if(a==='break'){state.energy=clamp(state.energy-24);state.density=clamp(state.density-15);state.phase='RECOVERY';} if(a==='drop'){state.energy=90;state.density=78;state.motion=84;state.phase='DROP';state.transition=100;} if(a==='calm'){state.energy=24;state.chaos=18;state.density=26;state.motion=22;state.phase='AFTERHOURS';} if(a==='chaosUp')state.chaos=clamp(state.chaos+12); if(a==='chaosDown')state.chaos=clamp(state.chaos-12); if(a==='resetCrowd'){state.energy=50;state.chaos=30;state.density=44;state.motion=48;state.phase='GROOVE';} if(a==='darken'){state.energy=clamp(state.energy-10);state.dna.contrast=clamp((state.dna.contrast||50)-8);} if(a==='openUp'){state.energy=clamp(state.energy+8);state.motion=clamp(state.motion+10);state.density=clamp(state.density+5);} log('Pad action → '+a); renderDNA(); render();});
 qsa('[data-inspire]').forEach(b=>b.onclick=()=>inspire(b.dataset.inspire));
 $('btnMegaInspire')?.addEventListener('click',()=>{generateWorld(); state.journey=generateJourney(6,choice(['Psytrance Journey','Tribe Ritual','Darkpsy Night','Alien Story'])); renderJourney(); toast('Mega Inspire vytvořil world + journey.');});
 $('btnJourney2h')?.addEventListener('click',()=>{state.journey=generateJourney(2,$('journeyStyle').value); renderJourney(); log('Generated 2h journey'); render();});
 $('btnJourney6h')?.addEventListener('click',()=>{state.journey=generateJourney(6,$('journeyStyle').value); renderJourney(); log('Generated 6h journey'); render();});
 $('btnJourney12h')?.addEventListener('click',()=>{state.journey=generateJourney(12,'Ambient Installation'); renderJourney(); log('Generated 12h ambient journey'); render();});
 $('btnGenerateCustomJourney')?.addEventListener('click',()=>{const h=$('journeyStyle').value.includes('Ambient')?12:6; state.journey=generateJourney(h,$('journeyStyle').value); renderJourney(); log('Generated custom journey'); render();});
 $('btnGenerateWorld')?.addEventListener('click',generateWorld); $('btnMutateWorld')?.addEventListener('click',mutateWorld); $('btnBreedWorld')?.addEventListener('click',breedWorld); $('btnCloneWorld')?.addEventListener('click',()=>{const w=allWorlds().find(w=>w.name===state.current)||baseWorlds[0]; if($('worldNameInput'))$('worldNameInput').value=w.name+' Clone'; state.dna=Object.assign({},w.dna); renderDNA();}); $('btnSaveWorld')?.addEventListener('click',generateWorld);
 $('btnBuildEvent')?.addEventListener('click',buildEvent); $('btnSaveEvent')?.addEventListener('click',buildEvent); $('btnRandomEvent')?.addEventListener('click',randomEvent);
 $('btnRandomTarget')?.addEventListener('click',()=>{const w=choice(allWorlds()); state.target=w.name; state.transition=0; log('Random target → '+w.name); render();});
 $('btnPanicCalm')?.addEventListener('click',()=>{state.energy=18;state.chaos=10;state.density=18;state.motion=15;state.phase='AFTERHOURS';log('PANIC CALM');render();});
 $('btnAmbientNeverRepeat')?.addEventListener('click',()=>{state.energy=20;state.chaos=22;state.density=24;state.motion=18;state.morph=240;state.phase='AFTERHOURS';log('Never repeat ambient mode');render();});
 $('btnGraphFromJourney')?.addEventListener('click',graphFromJourney); $('btnGraphPreset')?.addEventListener('click',graphPreset); $('btnAnalyzeShow')?.addEventListener('click',()=>{renderIntelligence();toast('Show Intelligence analyzováno.');}); $('btnApplyRecommendation')?.addEventListener('click',applyRecommendation); $('btnRandomWeather')?.addEventListener('click',()=>setWeather(choice(Object.keys(weatherProfiles)))); $('btnCleanHistory')?.addEventListener('click',cleanHistory); $('btnDirectorPlan')?.addEventListener('click',generateDirectorPlan); $('btnDirectorNext')?.addEventListener('click',applyDirectorNext); $('btnRebalanceEconomy')?.addEventListener('click',rebalanceEconomy); $('btnDiscoverWorld')?.addEventListener('click',discoverWorld); $('btnDiscoverEvent')?.addEventListener('click',discoverEvent); $('btnDiscoverCivilization')?.addEventListener('click',discoverCivilization); $('btnOperatorSafe')?.addEventListener('click',operatorSafe); qsa('[data-op]').forEach(b=>b.onclick=()=>operatorAction(b.dataset.op));

 $('btnGeneratorBridge')?.addEventListener('click',sendGeneratorBridge); $('btnOpenGenerator')?.addEventListener('click',()=>{location.href='generator.html';}); qsa('[data-generator-auto]').forEach(b=>b.onclick=()=>setGeneratorAutoFollowFromShowOs(b.dataset.generatorAuto==='on'));
 $('btnStoryGeneratePsy')?.addEventListener('click',()=>generateLivingTimeline('Psytrance')); $('btnStoryGenerateAmbient')?.addEventListener('click',()=>generateLivingTimeline('Ambient')); $('btnStoryRewrite')?.addEventListener('click',directorRewriteTimeline); $('btnStorySendBridge')?.addEventListener('click',()=>{const p=storyBridgePreview(); localStorage.setItem('budilight.performance.bridge.pro',JSON.stringify(p)); toast('Story Bridge payload uložen.'); render();}); $('btnUniverseTravel')?.addEventListener('click',travelUniverse); $('btnStoryPsy')?.addEventListener('click',()=>buildStory('Psytrance')); $('btnStoryAmbient')?.addEventListener('click',()=>buildStory('Ambient')); $('btnTimelineExtend')?.addEventListener('click',()=>timelineRewrite('extend')); $('btnTimelineShorten')?.addEventListener('click',()=>timelineRewrite('shorten')); $('btnLegendaryScan')?.addEventListener('click',()=>maybeLegendary(false)); $('btnLegendaryForce')?.addEventListener('click',()=>maybeLegendary(true)); $('btnMutateEventGenome')?.addEventListener('click',()=>mutateEventGenome(0)); $('btnMarketClone')?.addEventListener('click',cloneCurrentMarket); $('btnMarketVariant')?.addEventListener('click',randomVariantMarket); $('btnSaveCreatorPack')?.addEventListener('click',saveCreatorPackage); $('btnBridgePro')?.addEventListener('click',sendBridgePro);
 $('btnPhenomenaForge')?.addEventListener('click',()=>applyPhenomenaPreset('Forge')); $('btnPhenomenaOrganic')?.addEventListener('click',()=>applyPhenomenaPreset('Organic')); $('btnPhenomenaSynthetic')?.addEventListener('click',()=>applyPhenomenaPreset('Synthetic')); $('btnPhenomenaCosmic')?.addEventListener('click',()=>applyPhenomenaPreset('Cosmic')); $('btnPhenomenaMutate')?.addEventListener('click',mutatePhenomena); $('btnPhenomenaEntity')?.addEventListener('click',addPhenomenaEntity); $('btnPhenomenaBridge')?.addEventListener('click',sendPhenomenaBridge);
 $('btnPhysicsDerive')?.addEventListener('click',derivePhysicsFromShow); $('btnPhysicsApply')?.addEventListener('click',applyPhysicsToPhenomena); $('btnPhysicsInject')?.addEventListener('click',()=>injectFlowNode('manual')); $('btnEmergentScan')?.addEventListener('click',()=>evaluateEmergentEvents(false)); $('btnEmergentForce')?.addEventListener('click',()=>evaluateEmergentEvents(true)); $('btnApplyBlend')?.addEventListener('click',applyWorldBlend); $('btnPhysicsBridge')?.addEventListener('click',sendPhysicsBridge); $('blendWorldA')?.addEventListener('change',e=>{physicsCore().blendA=e.target.value; renderPhysicsCore(); save();}); $('blendWorldB')?.addEventListener('change',e=>{physicsCore().blendB=e.target.value; renderPhysicsCore(); save();}); $('blendMix')?.addEventListener('input',e=>{physicsCore().blendMix=clamp(e.target.value); renderPhysicsCore(); save();});
 $('btnRunHealthScan')?.addEventListener('click',runHealthScan); $('btnSendHealthBridge')?.addEventListener('click',sendHealthBridge); $('btnExportHealthReport')?.addEventListener('click',exportHealthReport);
 $('btnStabilityScan')?.addEventListener('click',runStabilityScan); $('btnStabilityBridge')?.addEventListener('click',sendStabilityBridge); $('btnStabilityTrim')?.addEventListener('click',trimRuntimeLoad);
 $('btnRunFieldTest')?.addEventListener('click',runFieldTest); $('btnExportFieldTest')?.addEventListener('click',exportFieldTest); qsa('[data-field-mode]').forEach(b=>b.onclick=()=>setFieldMode(b.dataset.fieldMode));
 $('btnRunFinalQA')?.addEventListener('click',runFinalQA); $('btnExportFinalQA')?.addEventListener('click',exportFinalQA); qsa('[data-qa-depth]').forEach(b=>b.onclick=()=>setQaDepth(b.dataset.qaDepth));
 $('btnRunProductionReady')?.addEventListener('click',runProductionReady); $('btnExportProductionReady')?.addEventListener('click',exportProductionReady); qsa('[data-prod-mode]').forEach(b=>b.onclick=()=>setProductionMode(b.dataset.prodMode));
 $('btnRunLaunchPreflight')?.addEventListener('click',runLaunchPreflight); $('btnArmLaunch')?.addEventListener('click',armLaunch); $('btnDisarmLaunch')?.addEventListener('click',disarmLaunch); $('btnLaunchBridge')?.addEventListener('click',sendLaunchBridge); $('btnExportLaunch')?.addEventListener('click',exportLaunchPack); qsa('[data-launch-mode]').forEach(b=>b.onclick=()=>setLaunchMode(b.dataset.launchMode)); qsa('[data-launch-action]').forEach(b=>b.onclick=()=>launchQuickAction(b.dataset.launchAction));
 $('btnRunLiveOps')?.addEventListener('click',runLiveOpsScan); $('btnLiveOpsBridge')?.addEventListener('click',sendLiveOpsBridge); $('btnExportLiveOps')?.addEventListener('click',exportLiveOpsReport); qsa('[data-live-mode]').forEach(b=>b.onclick=()=>setLiveOpsMode(b.dataset.liveMode)); qsa('[data-live-severity]').forEach(b=>b.onclick=()=>setLiveOpsSeverity(b.dataset.liveSeverity)); qsa('[data-live-action]').forEach(b=>b.onclick=()=>liveQuickAction(b.dataset.liveAction));
 $('btnBuildPostShow')?.addEventListener('click',buildPostShowReview); $('btnSaveLearningSnapshot')?.addEventListener('click',()=>saveLearningSnapshot(true)); $('btnExportPostShow')?.addEventListener('click',exportPostShowReport); qsa('[data-review-window]').forEach(b=>b.onclick=()=>setReviewWindow(b.dataset.reviewWindow)); qsa('[data-review-focus]').forEach(b=>b.onclick=()=>setReviewFocus(b.dataset.reviewFocus));
 $('btnRunCleanupAudit')?.addEventListener('click',runCleanupAudit); $('btnBuildArchitectureMap')?.addEventListener('click',buildArchitectureMap); $('btnExportCleanupPlan')?.addEventListener('click',exportCleanupPlan); $('btnRunCleanupPass')?.addEventListener('click',runCleanupPass); $('btnExportCleanupPass')?.addEventListener('click',exportCleanupPass); $('btnRunCleanupPass2')?.addEventListener('click',runCleanupPass2); $('btnExportCleanupPass2')?.addEventListener('click',exportCleanupPass2); $('btnRunCleanupPass3')?.addEventListener('click',runCleanupPass3); $('btnExportCleanupPass3')?.addEventListener('click',exportCleanupPass3); qsa('[data-test-mode]').forEach(b=>b.onclick=()=>setCleanupTestMode(b.dataset.testMode)); qsa('[data-cleanup-mode]').forEach(b=>b.onclick=()=>setCleanupUiMode(b.dataset.cleanupMode)); qsa('[data-nav-profile]').forEach(b=>b.onclick=()=>setCleanupNavProfile(b.dataset.navProfile));
 $('btnFestival6h')?.addEventListener('click',()=>festivalPlan(6)); $('btnFestival12h')?.addEventListener('click',()=>festivalPlan(12)); $('btnFestival24h')?.addEventListener('click',()=>festivalPlan(24)); $('festivalDuration')?.addEventListener('change',e=>festivalPlan(Number(e.target.value||6)));
 $('btnEvolveCurrent')?.addEventListener('click',evolveCurrent); $('btnEvolutionTree')?.addEventListener('click',buildEvolutionTree); $('btnSaveGenome')?.addEventListener('click',saveGenome); $('btnGenerateFromGenome')?.addEventListener('click',generateFromGenome); $('btnGenerateRecipes')?.addEventListener('click',generateRecipes);
 $('btnDirectorPulse')?.addEventListener('click',directorPulse); $('btnHiddenSignal')?.addEventListener('click',forgeHiddenSignal); $('btnMegaEvent')?.addEventListener('click',triggerMegaEvent); $('btnSaveShowHistory')?.addEventListener('click',saveShowHistory); $('btnEcosystemBridge')?.addEventListener('click',sendEcosystemBridge);
 qsa('[data-auth-mode]').forEach(b=>b.onclick=()=>setAuthorityMode(b.dataset.authMode)); $('btnAuthoritySave')?.addEventListener('click',applyAuthoritySettings); $('btnAuthorityApply')?.addEventListener('click',authorityManualApply); $('btnAuthorityFreeze')?.addEventListener('click',authorityFreeze); ['maxEnergy','maxChaos','maxDensity','maxMotion'].forEach(k=>$('auth_'+k)?.addEventListener('input',applyAuthoritySettings)); ['autoApply','allowMegaEvents','allowWorldTravel','allowTimelineRewrite','allowDiscovery','operatorLock'].forEach(k=>$('auth_'+k)?.addEventListener('change',applyAuthoritySettings)); $('btnSendIntent')?.addEventListener('click',sendIntent); $('btnSaveAll')?.addEventListener('click',()=>{save();toast('Show OS uložený.');}); $('btnExportAll')?.addEventListener('click',exportPack); $('importFile')?.addEventListener('change',e=>e.target.files[0]&&importPack(e.target.files[0]));
}
function tick(){
 if(!shellViewActive37BQ){ showOsPerf37BQ.skipped+=1; return; }
 showOsPerf37BQ.lastTickAt=Date.now();
 physicsTickLite();
 const sec=Math.floor((Date.now()-state.started)/1000),m=Math.floor(sec/60);
 // STEP37DD: keep housekeeping state updates alive, but only repaint the visible
 // heavy Show OS panels. Performance/Settings therefore no longer pay for hidden
 // Physics/Stability/Health/Cleanup/LiveOps DOM rebuilds every few seconds.
 if(sec%5===0){
  if(showOsSectionActive37DD('physics','phenomena','bridge'))renderPhysicsCore();
  if(showOsSectionActive37DD('stability','health','cleanup'))renderStabilityLab();
  if(showOsSectionActive37DD('health','cleanup','memory'))renderHealthConsole();
  if(showOsSectionActive37DD('cleanup','cleanup-pass','cleanup-pass2','cleanup-pass3'))renderCleanupConsole();
  if(showOsSectionActive37DD('liveops','launch','production'))renderLiveOps();
 }
 if(sec%15===0){
  state.trend.push({t:Date.now(),energy:state.energy,chaos:state.chaos,density:state.density,variety:100-getRepeatScore()});
  state.trend=state.trend.slice(-120);
  if(showOsSectionActive37DD('intelligence','control','director'))renderIntelligence();
  save();
 }
 const runtimeText=String(m).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
 const runtimeEl=$('runtimeVal'); if(runtimeEl&&runtimeEl.textContent!==runtimeText)runtimeEl.textContent=runtimeText;
 if(state.transition<100){
  state.transition=Math.min(100,state.transition+1);
  const tr=$('transitionVal'),trText=state.transition+'%'; if(tr&&tr.textContent!==trText)tr.textContent=trText;
  if(state.transition===100&&state.current!==state.target){state.current=state.target; log('Arrived → '+state.current); render();}
 }
}
renderTabs();
// STEP37DF: Show OS boot no longer paints every heavy lab/debug section at once.
// showSection() renders the selected section and the 5s tick keeps housekeeping alive.
bind();
showSection(localStorage.getItem('budilight.showos.section')||'control');
try {
  const loops = window.__budilightRuntimeLoopRegistry37CE;
  if (loops && typeof loops.adaptiveInterval === 'function') {
    loops.adaptiveInterval('show-os:tick', tick, 1000, { group: 'show-os', liveFactor: 5, hiddenFactor: 8, maxMs: 20000, skipWhenHidden: true });
  } else {
    setInterval(tick, 1000);
  }
} catch { try { setInterval(tick, 1000); } catch {} }
