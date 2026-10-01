import { applyTheme, createPet, createSfx, normalizeSkin, skinCss, FACES } from './pet-core.js';
import { createWhaleFigure } from './whale/figure.js';
const host=window.petHost,$=s=>document.querySelector(s),preview=$('#preview');
const sfx=createSfx({volume:.3});
let prefs=await host.getPrefs(),theme=prefs.theme,skin=normalizeSkin({...prefs.skin,figure:'whale'});
const skinStyle=document.createElement('style');document.head.appendChild(skinStyle);
applyTheme(theme,$('#mode'));
const fig=await createWhaleFigure(undefined,{scheme:skin.scheme});
const ctl=createPet({petG:$('#pet'),shadowEl:$('#shadow'),fxG:$('#fx')},{sfx,figure:fig,roam:'off',startX:preview.clientWidth/2,bounds:()=>({W:preview.clientWidth,H:preview.clientHeight,floorY:preview.clientHeight-30,S:.5})});
let serial=Promise.resolve();
function apply(p){prefs=p;skin=normalizeSkin({...p.skin,figure:'whale'});theme=p.theme;applyTheme(theme,$('#mode'));ctl.setSkin(skin);skinStyle.textContent=skinCss(skin);serial=serial.then(()=>fig.setScheme(skin.scheme,{fade:0})).catch(console.error);render();}
function save(p){return host.savePrefs(p).then(next=>{apply(next);$('#saved').textContent='已保存';}).catch(()=>{$('#saved').textContent='保存失败';});}
function render(){
  const box=$('#optScheme');box.textContent='';const options=document.createElement('div');options.className='opts';
  for(const scheme of fig.schemes){const b=document.createElement('button');b.className='opt wide';b.dataset.scheme=scheme.id;b.setAttribute('aria-pressed',String(skin.scheme===scheme.id));b.innerHTML=`<img src="/web/whale/thumbs/${scheme.id}.png" alt=""><span>${scheme.brand||scheme.id}</span>`;b.onclick=()=>save({skin:{...skin,scheme:scheme.id,figure:'whale'}});options.appendChild(b);}box.appendChild(options);
}
$('#mode').onclick=()=>save({theme:theme==='dark'?'light':'dark'});
const faces=document.createElement('div');faces.className='offline-choices';
for(const id of ['neutral','happy','wink','love','shy','surprised','angry','sad','sleepy']){const b=document.createElement('button');b.textContent=FACES[id].label;b.dataset.face=id;b.onclick=()=>{ctl.act('stand');ctl.setExpr(id,10);};faces.appendChild(b);}$('#previewFaces').appendChild(faces);
const point=e=>{const r=preview.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
preview.onpointerdown=e=>{sfx.unlock();if(ctl.pointerDown(point(e)))preview.setPointerCapture(e.pointerId);};
preview.onpointermove=e=>{preview.style.cursor=ctl.pointerMove(point(e));};preview.onpointerup=()=>ctl.pointerUp();preview.onpointercancel=()=>ctl.pointerUp();
new ResizeObserver(()=>ctl.resize()).observe(preview);host.onPrefs(apply);apply(prefs);
window.whalePreview={ctl,fig,get skin(){return skin;},get settled(){return serial;}};
let last=performance.now();function frame(now){ctl.step(Math.min(.05,(now-last)/1000));last=now;ctl.render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
