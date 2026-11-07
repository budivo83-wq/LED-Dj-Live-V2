export const meta = { name: "Psy Kaleido Kick", description: "kaleidoscopic kick flower", params: ["Petals", "Speed", "Kick", "Color"] };
export const prewarm = { priority: 78, samplePoints: 128, warmOnSelect: true, warmNeighbors: true };
const TAU=Math.PI*2; function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const dx=x-.5,dy=y-.5; const r=Math.hypot(dx,dy); let a=Math.atan2(dy,dx); const petals=4+Math.floor((p[0]||.5)*12), speed=.45+(p[1]||.5)*3.2; const kick=Math.pow(sat(1-((t*speed*2)%1)*2.8),2)*(0.4+(p[2]||.5)*1.8);
 a=Math.abs(((a/TAU*petals+t*speed)%1)-.5)*2; const flower=Math.pow(sat(1-a*2.2),1.6); const rings=Math.pow(sat(.5+.5*Math.sin((r*12-kick*1.8-t*speed)*TAU)),2.4);
 const v=sat((flower*rings)*(1.1-r)+kick*Math.exp(-r*5)); return hsv((p[3]||.5)+r*.45+t*.03,0.93,v);
}
