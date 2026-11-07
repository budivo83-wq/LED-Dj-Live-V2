export const meta = { name: "Breakbeat Slicer", description: "jumpy rhythmic slice shutter", params: ["Slices", "Speed", "Cut", "Hue"] };
export const prewarm = { priority: 75, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
function sat(v){return Math.max(0,Math.min(1,v));} function hash(n){return (Math.sin(n*91.73)*43758.5453)%1;} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const slices=5+Math.floor((p[0]||0.5)*18), speed=0.8+(p[1]||0.5)*5, cut=0.2+(p[2]||0.5)*0.72;
 const step=Math.floor(t*speed*8); const row=Math.floor(y*slices); const phase=hash(row*37+step); const open=(phase%1)>cut?1:0;
 const edge=Math.pow(sat(1-Math.abs(fract(y*slices)-0.5)*7),2); const tex=0.5+0.5*Math.sin(x*26 + y*11 + t*speed*4 + phase*6.28);
 return hsv((p[3]||0.5)+phase*0.18+x*.18,0.88,sat(open*(tex*0.55+edge*0.7)));
}
function fract(v){return v-Math.floor(v);}
