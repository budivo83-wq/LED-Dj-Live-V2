export const meta = { name: "Acid Arps", description: "sequenced acid arpeggio lanes", params: ["Density", "Speed", "Accent", "Color"] };
export const prewarm = { priority: 74, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const TAU = Math.PI * 2;
function sat(v){ return Math.max(0, Math.min(1, v)); }
function hash(n){ return Math.sin(n * 127.1) * 43758.5453123 % 1; }
function hsv(h,s,v){ h=((h%1)+1)%1; const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s); const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6]; return [a[0]*255,a[1]*255,a[2]*255]; }
export function render(x,y,t,p){
  const density=6+Math.floor((p[0]||0.5)*18), speed=0.7+(p[1]||0.5)*4.2, accent=0.2+(p[2]||0.5)*1.8;
  const step=Math.floor(t*speed*4 + x*density);
  const lane=Math.floor(y*8);
  const gate=((step+lane*3)%8===0)?1:0;
  const stripe=Math.pow(sat(1-Math.abs((x*density+t*speed*0.7)%1-0.5)*4),2.2);
  const arp=Math.pow(sat(1-Math.abs(Math.sin((x*12+y*18-t*speed)*TAU))*2.2),2.0);
  const v=sat(stripe*(0.25+gate*accent)+arp*0.45+Math.max(0,hash(step+lane)-0.65));
  return hsv((p[3]||0.5)+x*0.18+y*0.08+t*0.035,0.82,v);
}
