export const meta = { name: "Triplet Comets", description: "three-note comet chase", params: ["Length", "Speed", "Spread", "Hue"] };
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const len=0.04+(p[0]||.5)*0.16, speed=.3+(p[1]||.5)*2.7, spread=.1+(p[2]||.5)*.8; let v=0;
 for(let i=0;i<3;i++){ const pos=(t*speed+i/3)%1; const d=Math.abs(((x+ y*spread - pos + .5)%1)-.5); v+=Math.exp(-d*d/(len*len))*Math.exp(-Math.abs(y-(i+1)/4)*3.2); }
 const tail=.25+.75*Math.sin((x*16+y*8-t*speed*7)); v=sat(v*(.65+.35*tail)); return hsv((p[3]||.5)+x*.2+t*.04,0.86,v);
}
