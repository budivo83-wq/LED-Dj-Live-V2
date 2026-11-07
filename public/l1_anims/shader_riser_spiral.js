export const meta = { name: "Riser Spiral", description: "build-up spiral riser", params: ["Tension", "Speed", "Width", "Hue"] };
export const prewarm = { priority: 74, samplePoints: 128, warmOnSelect: true, warmNeighbors: true };
const TAU=Math.PI*2; function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const dx=x-.5,dy=y-.5,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx)/TAU; const tension=.4+(p[0]||.5)*3, speed=.25+(p[1]||.5)*3, width=.015+(p[2]||.5)*.08;
 const spiral=Math.abs((((a+r*tension-t*speed)%1)+.5)%1-.5); const line=Math.exp(-(spiral*spiral)/(width*width)); const lift=sat((Math.sin(t*speed*.9)*.5+.5)*1.2);
 const v=sat(line*(.45+lift*.9)*(1-r*.6)+Math.pow(lift,5)*.22); return hsv((p[3]||.5)+r*.35+t*.08,0.9,v);
}
