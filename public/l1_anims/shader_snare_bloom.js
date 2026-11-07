export const meta = { name: "Snare Bloom", description: "white snare blooms with colored decay", params: ["Bloom", "Speed", "Snap", "Hue"] };
export const prewarm = { priority: 73, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const TAU=Math.PI*2; function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const speed=0.6+(p[1]||0.5)*3.4, beat=t*speed; const sn=Math.max(0,1-((beat*2+0.5)%1)*5); const cx=0.5+Math.sin(Math.floor(beat)*1.9)*0.22, cy=0.5+Math.cos(Math.floor(beat)*1.3)*0.18;
 const d=Math.hypot(x-cx,y-cy); const ring=Math.exp(-Math.pow((d-(0.08+(p[0]||0.5)*0.35+sn*0.22))*18,2)); const flash=Math.pow(sn,2.4)*(0.5+(p[2]||0.5)*1.5);
 const wave=0.25+0.75*Math.sin((d*12-t*speed*3)*TAU); const v=sat(ring*(0.25+flash)+flash*0.38+wave*ring*0.35);
 const col=hsv((p[3]||0.5)+d*0.25-t*0.02,0.55,v); return [sat(col[0]/255+flash*0.55)*255,sat(col[1]/255+flash*0.55)*255,sat(col[2]/255+flash*0.55)*255];
}
