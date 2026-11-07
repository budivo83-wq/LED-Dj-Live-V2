export const meta = { name: "Melodic Waves", description: "layered melodic sine waves", params: ["Voices", "Speed", "Depth", "Hue"] };
export const prewarm = { priority: 70, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const TAU=Math.PI*2; function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const voices=2+Math.floor((p[0]||.5)*6), speed=.25+(p[1]||.5)*2.4, depth=.25+(p[2]||.5)*1.4; let v=0;
 for(let i=1;i<=voices;i++){ const freq=i*1.37; const yy=.5+.32*Math.sin((x*freq+t*speed*(.4+i*.18))*TAU+i); v+=Math.exp(-Math.pow((y-yy)*(7+i*1.5),2))*(1/i); }
 v=sat(v*depth); return hsv((p[3]||.5)+x*.16+y*.1+t*.025,0.78,v);
}
