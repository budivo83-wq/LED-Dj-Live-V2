export const meta = { name: "Rolling Bass Grid", description: "rolling offbeat bass grid", params: ["Grid", "Roll", "Pressure", "Color"] };
export const prewarm = { priority: 76, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
function sat(v){return Math.max(0,Math.min(1,v));} function hsv(h,s,v){h=((h%1)+1)%1;const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);const a=[[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i%6];return[a[0]*255,a[1]*255,a[2]*255];}
export function render(x,y,t,p){
 const grid=4+(p[0]||0.5)*12, roll=0.6+(p[1]||0.5)*3.5, pressure=0.4+(p[2]||0.5)*1.6;
 const bx=(x*grid+t*roll)%1, by=(y*grid-t*roll*0.55)%1; const line=Math.pow(sat(1-Math.min(Math.abs(bx-0.5),Math.abs(by-0.5))*9),2.5);
 const bass=Math.pow(sat(1-((t*roll*2)%1)*2.2),1.8); const diag=0.5+0.5*Math.sin((x-y)*18+t*roll*5);
 const v=sat(line*(0.25+pressure*bass)+diag*0.22*bass); return hsv((p[3]||0.5)+x*.12-y*.08+t*.025,0.9,v);
}
