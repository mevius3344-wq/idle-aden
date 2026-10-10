// 稽核共用：整張原版大地圖上沿可走路線走到「村莊」或「野外」區（實際點地面走路，不瞬移）
// PATH_FN：注入頁面（__worldPath／__tapWorld）；walkRegion(ev, sleep, wantTown) → { plan, reached, map, trace }
"use strict";

const PATH_FN = `window.__worldPath=function(wantTown,maxR){
  const def=exploreActiveMapDef(), name=def.lin, L=linmapData(name);
  const t0=linmapTileAt(name,explorePlayerX(),explorePlayerY());
  const toW=(gx,gy)=>({x:(gx+gy)*24+L.ox-L.w/2,y:L.h/2-((gy-gx)*12+L.oy)});
  const cur=mapState.current, R=maxR||260, N=2*R+1, seen=new Int32Array(N*N).fill(-1);
  const key=(gx,gy)=>(gy-t0.gy+R)*N+(gx-t0.gx+R);
  const q=[[t0.gx,t0.gy]]; seen[key(t0.gx,t0.gy)]=-2;
  const D8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(let h=0;h<q.length;h++){
    const [gx,gy]=q[h], w=toW(gx,gy);
    const ids=linmapRegionAt(name,w.x,w.y)||[];
    const isTown=ids.some(i=>i.indexOf('town_')===0);
    const deep=()=>D8.every(([dx,dy])=>{const n=toW(gx+dx,gy+dy);const r=linmapRegionAt(name,n.x,n.y)||[];return mapdefWalkable(def,n.x,n.y)&&r[0]===ids[0];});
    if(ids.length&&ids.indexOf(cur)<0&&isTown===wantTown&&deep()){
      const pts=[]; let k=key(gx,gy), c=[gx,gy];
      while(true){pts.push(toW(c[0],c[1]));const p=seen[k];if(p<0)break;c=[(p%N)-R+t0.gx,Math.floor(p/N)-R+t0.gy];k=p;}
      pts.reverse(); for(let e=0;e<6;e++){const l=pts[pts.length-1];pts.push(l);}
      return {dest:ids[0],steps:pts};
    }
    for(const [dx,dy] of D8){
      const nx=gx+dx, ny=gy+dy;
      if(Math.abs(nx-t0.gx)>R||Math.abs(ny-t0.gy)>R)continue;
      const kk=key(nx,ny); if(seen[kk]!==-1)continue;
      const ww=toW(nx,ny);
      const good=mapdefWalkable(def,ww.x,ww.y)&&mapdefWalkable(def,(ww.x+w.x)/2,(ww.y+w.y)/2);
      if(!good){seen[kk]=-3;continue;}
      seen[kk]=key(gx,gy); q.push([nx,ny]);
    }
  }
  return null;
};
window.__tapWorld=function(wx,wy){
  const bv=document.getElementById('battle-view'), r=bv.getBoundingClientRect();
  exploreSetTapMoveFromScreen(r.left+r.width/2+(wx-exploreCamX()), r.top+r.height/2-(wy-exploreCamY())/0.9);
};1`;

async function walkRegion(ev, sleep, wantTown, maxR) {
  await ev(PATH_FN);
  const plan = await ev(`(()=>{const p=__worldPath(${!!wantTown},${maxR || 260});return p&&{dest:p.dest,n:p.steps.length,steps:p.steps}})()`);
  if (!plan || plan.__err) return { plan: null, reached: false, map: await ev("mapState.current"), trace: [] };
  let reached = false;
  const trace = [];
  for (let i = 0; i < plan.steps.length && !reached; i++) {
    const s = plan.steps[i];
    let st = null;
    for (let k = 0; k < 30; k++) {
      await ev(`__tapWorld(${s.x},${s.y})`);
      await sleep(120);
      st = await ev(`(()=>({m:mapState.current,d:Math.hypot(explorePlayerX()-(${s.x}),explorePlayerY()-(${s.y})),x:Math.round(explorePlayerX()),y:Math.round(explorePlayerY())}))()`);
      if (!st || st.__err) continue;
      if (st.m === plan.dest) { reached = true; break; }
      if (st.d < 14) break;
    }
    trace.push({ to: [s.x, s.y], at: st });
  }
  for (let k = 0; k < 20 && !reached; k++) {
    await sleep(150);
    reached = (await ev("mapState.current")) === plan.dest;
  }
  return { plan, reached, map: await ev("mapState.current"), trace };
}

module.exports = { PATH_FN, walkRegion };
