// CPU canvas renderer for the original textured meshes and deformer chains.
// No WebGL surface or GPU textures: every model layer is drawn from its decoded local PNG.
export function createRig(canvas, model) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const textures = new Map();
  const defs = model.deformers;
  const stats = { backend: 'canvas2d', frames: 0, missing: [], nonFinite: 0, parts: 0, drawn: [] };
  function chainOf(id) { const chain=[]; for(let d=id;d;d=defs[d].parent) chain.push(d); return chain; }
  function applyChain(chain, st, x, y) {
    for (const id of chain) {
      const d=defs[id], s=st[id]; if(!s) continue;
      if(d.kind==='rot') {
        const [px,py]=d.pivot, a=(s.a||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
        const lx=(x-px)*(s.sx??s.s??1),ly=(y-py)*(s.sy??s.s??1);
        x=px+(s.tx||0)+lx*c-ly*sn; y=py+(s.ty||0)+lx*sn+ly*c;
      } else if(d.kind==='warp' && s.fn) {
        const [x0,y0,x1,y1]=d.rect;
        const u=Math.max(0,Math.min(1,(x-x0)/(x1-x0))),v=Math.max(0,Math.min(1,(y-y0)/(y1-y0)));
        const q=s.fn(u,v,x,y); x+=q[0]; y+=q[1];
      }
    }
    return [x,y];
  }
  const meshes=model.parts.map(part=>{
    const grid=part.grid||[6,6],nx=Math.min(6,grid[0]),ny=Math.min(8,grid[1]);
    const [x,y,w,h]=part.box,[u0,v0,u1,v1]=part.uvBox||[0,0,1,1];
    const vertices=[];
    for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++) vertices.push([x+w*i/nx,y+h*j/ny,u0+(u1-u0)*i/nx,v0+(v1-v0)*j/ny]);
    const triangles=[];
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) {const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;triangles.push([a,b,c],[b,d,c]);}
    return {part,vertices,triangles,chain:chainOf(part.parent)};
  });
  let view=model.view;
  function triangle(image, dest, uv) {
    const sx1=uv[1][0]-uv[0][0],sy1=uv[1][1]-uv[0][1],sx2=uv[2][0]-uv[0][0],sy2=uv[2][1]-uv[0][1];
    const det=sx1*sy2-sx2*sy1; if(Math.abs(det)<1e-8) return;
    const dx1=dest[1][0]-dest[0][0],dy1=dest[1][1]-dest[0][1],dx2=dest[2][0]-dest[0][0],dy2=dest[2][1]-dest[0][1];
    const a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(sx1*dx2-sx2*dx1)/det,d=(sx1*dy2-sx2*dy1)/det;
    const e=dest[0][0]-a*uv[0][0]-c*uv[0][1],f=dest[0][1]-b*uv[0][0]-d*uv[0][1];
    ctx.save();ctx.beginPath();
    // Slight overlap avoids antialiasing seams at the mesh edges.
    const cx=dest.reduce((sum,p)=>sum+p[0],0)/3,cy=dest.reduce((sum,p)=>sum+p[1],0)/3;
    dest.forEach((p,i)=>{const dist=Math.hypot(p[0]-cx,p[1]-cy)||1,k=.35/dist;
      const x=p[0]+(p[0]-cx)*k,y=p[1]+(p[1]-cy)*k;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(image,0,0);ctx.restore();
  }
  function render(st, opts={}) {
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    const kx=canvas.width/(view[2]-view[0]),ky=canvas.height/(view[3]-view[1]);
    ctx.setTransform(kx,0,0,ky,-view[0]*kx,-view[1]*ky);
    ctx.imageSmoothingEnabled=true;
    stats.frames++;stats.missing=[];stats.parts=0;stats.drawn=[];
    const mix=Math.max(0,Math.min(1,st.mix||0));
    const ordered=meshes.filter(m=>!opts.hidden?.[m.part.id]).sort((a,b)=>(st.z?.[a.part.id]??a.part.z)-(st.z?.[b.part.id]??b.part.z));
    for(const mesh of ordered) {
      const p=mesh.part,alpha=st.alpha?.[p.id]??p.alpha??1;
      if(alpha<=.001) continue;
      const image=textures.get(p.tex);if(!image){stats.missing.push(p.tex);continue;}
      const warped=mesh.vertices.map(v=>applyChain(mesh.chain,st,v[0],v[1]));
      if(warped.some(p=>!p.every(Number.isFinite))){stats.nonFinite++;continue;}
      stats.parts++;
      stats.drawn.push(p.id);
      const second=mix>0?textures.get(p.tex+'@mix'):null;
      for(const [src,weight] of second?[[image,1-mix],[second,mix]]:[[image,1]]) {
        if(weight<.001) continue;
        ctx.globalAlpha=alpha*weight;
        const width=src.naturalWidth||src.width,height=src.naturalHeight||src.height;
        for(const t of mesh.triangles) triangle(src,t.map(i=>warped[i]),t.map(i=>[mesh.vertices[i][2]*width,mesh.vertices[i][3]*height]));
      }
    }
    ctx.globalAlpha=1;
  }
  return {upload:(key,src)=>textures.set(key,src),render,point:(id,st,x,y)=>applyChain(chainOf(id),st,x,y),
    setView:v=>{view=v;},get view(){return view;},stats,canvas,
    gl:{getExtension:()=>null}};
}
