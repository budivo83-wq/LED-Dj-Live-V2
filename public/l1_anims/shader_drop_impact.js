export const meta = { name: "Drop Impact", description: "hard drop shockwave", params: ["Impact", "Speed", "Rings", "Color"] };
export const prewarm = { priority: 80, samplePoints: 128, warmOnSelect: true, warmNeighbors: true };
const TAU=Math.PI*2; function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const speed=.35+(p[1]||.5)*2.2, impact=.4+(p[0]||.5)*1.8, rings=4+(p[2]||.5)*15; const phase=(t*speed)%1; const d=Math.hypot(x-.5,y-.5);
 const shock=Math.exp(-Math.pow((d-phase*.85)*18,2))*impact; const ring=.5+.5*Math.sin((d*rings-phase*8)*TAU); const flash=Math.pow(sat(1-phase*3),3)*impact;
 const v=sat(shock*(.55+ring*.75)+flash*Math.exp(-d*4)); const c=hsv((p[3]||.5)+d*.25,0.85,v); return [sat(c[0]/255+flash*.42)*255,sat(c[1]/255+flash*.42)*255,sat(c[2]/255+flash*.42)*255];
}
