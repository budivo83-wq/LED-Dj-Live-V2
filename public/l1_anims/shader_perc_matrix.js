export const meta = { name: "Perc Matrix", description: "percussion dot matrix", params: ["Density", "Speed", "Decay", "Hue"] };
export const prewarm = { priority: 73, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
function sat(v){return Math.max(0,Math.min(1,v));} function hash(n){return ((Math.sin(n*12.9898)*43758.5453)%1+1)%1;} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const density=5+Math.floor((p[0]||.5)*18), speed=.7+(p[1]||.5)*4.5, decay=.15+(p[2]||.5)*.85; const gx=Math.floor(x*density), gy=Math.floor(y*density), lx=(x*density)%1-.5, ly=(y*density)%1-.5;
 const step=Math.floor(t*speed*8), rnd=hash(gx*31+gy*57+step*13); const age=(t*speed*8)%1; const hit=rnd>decay?Math.pow(1-age,2.2):0; const dot=Math.exp(-(lx*lx+ly*ly)*35);
 const v=sat(dot*hit*(.8+rnd*.6)); return hsv((p[3]||.5)+rnd*.22+gy*.02,0.84,v);
}
