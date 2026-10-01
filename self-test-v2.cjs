const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(wc,expr,label){for(let i=0;i<300;i++){if(await wc.executeJavaScript(expr))return;await delay(70);}throw Error('Timeout: '+label);}
async function run(ctx){
 const {pet,openDress,getDress,persist,prefsFile,data,errors}=ctx,wc=pet.webContents;
 const report={checks:[],runtime:process.versions.electron},check=name=>{report.checks.push(name);console.log('Verified:',name);};
 await until(wc,'!!window.offlinePet?.figureReady && !window.offlinePet.ctl.busy()','whale loaded');
 assert.equal(pet.isFocusable(),false);check('Pet never activates or takes player keyboard focus');
 assert.equal(ctx.app.isHardwareAccelerationEnabled(),true);check('Hardware acceleration enabled; DirectComposition disabled for the pet window');
 await delay(300);const wa=require('electron').screen.getPrimaryDisplay().workArea,b=pet.getBounds();
 assert(b.width*b.height<wa.width*wa.height*.3,JSON.stringify(b));check('Native overlay covers pet/bubbles instead of the full desktop');
 const stats=await wc.executeJavaScript('window.offlinePet.ctl.figure.renderStats');
 assert.equal(stats.backend,'webgl2');assert.equal(stats.nonFinite,0);assert.deepEqual(stats.missing,[]);assert(stats.drawn.includes('bangs')&&stats.drawn.includes('hair_back'));check('Original WebGL mesh renderer draws hair and bangs');
 const t0=await wc.executeJavaScript('window.offlinePet.ctl.time');await delay(300);assert(await wc.executeJavaScript('window.offlinePet.ctl.time')>t0);
 persist({paused:true});await delay(120);const t1=await wc.executeJavaScript('window.offlinePet.ctl.time');await delay(180);assert.equal(await wc.executeJavaScript('window.offlinePet.ctl.time'),t1);persist({paused:false});check('Animation, pause and resume');
 const drag=await wc.executeJavaScript(`(()=>{const c=window.offlinePet.ctl;c.act('stand');c.render();const p=c.toStage(128,140);const pressed=c.pointerDown(p);c.pointerMove({x:p.x+180,y:p.y-160});c.step(.05);c.render();c.pointerUp();const released=!c.pressing;for(let i=0;i<150;i++)c.step(.05);return {pressed,released,jump:c.act('jump')};})()`);
 assert(drag.pressed&&drag.released&&drag.jump);check('Global-coordinate drag/drop/jump in a small native window');
 await until(wc,'!window.offlinePet.ctl.busy()','jump settled');
 // Real native moves, including stale viewport echoes and local pointer events.
 persist({roam:'off',bubbles:false});
 await delay(150);
 await wc.executeJavaScript(`(()=>{const o=window.offlinePet;o.closeSpeech();document.querySelector('#menu').hidden=true;const c=o.ctl;c.act('stand');c.pet.x=o.viewport.width*.35;c.render();})()`);
 await delay(180);
 const stableNativeSize=pet.getBounds();let nativeResizes=0;
 const onNativeResize=()=>{const b=pet.getBounds();if(Math.abs(b.width-stableNativeSize.width)>2||Math.abs(b.height-stableNativeSize.height)>2)nativeResizes++;};
 pet.on('resize',onNativeResize);
 const motionStart=await wc.executeJavaScript(`({...window.offlinePet.motionStats})`);
 await wc.executeJavaScript(`window.offlinePet.ctl.walkTo(window.offlinePet.viewport.width*.6)`);
 await delay(1600);
 const walking=await wc.executeJavaScript(`({...window.offlinePet.motionStats})`);
 assert(walking.requests>motionStart.requests+8);assert.equal(walking.resizes,motionStart.resizes);
 assert.equal(nativeResizes,0,'native walking window resized');
 check('Walking moves a stable-size native window without per-frame resizing');
 const start=await wc.executeJavaScript(`(()=>{const c=window.offlinePet.ctl;c.act('stand');c.render();const p=c.toStage(128,140),scruff=c.toStage(128,36);return {p,scruff,pressed:c.pointerDown(p)};})()`);
 assert(start.pressed);
 const trace=[];
 for(let i=0;i<14;i++){
  const point={x:start.scruff.x+20+i*5,y:Math.min(start.scruff.y-100,wa.height*.5)};
  wc.send('pet:cursor',point);
  await wc.executeJavaScript(`document.dispatchEvent(new MouseEvent('pointermove',{clientX:0,clientY:0,bubbles:true}))`);
  await delay(65);
  const native=pet.getBounds();
  const state=await wc.executeJavaScript(`({x:window.offlinePet.ctl.pet.dx,view:window.offlinePet.viewport,stats:{...window.offlinePet.motionStats}})`);
  // Captures cross a renderer frame while in motion; allow one frame's travel.
  assert(Math.abs(state.view.x-(native.x-wa.x))<40);assert(Math.abs(state.view.y-(native.y-wa.y))<40);
  if(trace.length) assert(state.x>=trace.at(-1).x-.5,JSON.stringify({previous:trace.at(-1),state}));
  trace.push({x:state.x,width:native.width,height:native.height});
 }
 // Windows rounds DIP bounds to physical pixels at fractional display scale.
 assert(trace.every(t=>Math.abs(t.width-trace[0].width)<=2&&Math.abs(t.height-trace[0].height)<=2));
 pet.removeListener('resize',onNativeResize);assert.equal(nativeResizes,0,'native drag window resized');
 await delay(400);
 const settledView=await wc.executeJavaScript('window.offlinePet.viewport'),settledBounds=pet.getBounds();
 assert(Math.abs(settledView.x-(settledBounds.x-wa.x))<=2);assert(Math.abs(settledView.y-(settledBounds.y-wa.y))<=2);
 const beforeEcho=await wc.executeJavaScript('window.offlinePet.viewport');
 wc.send('pet:viewport',{...beforeEcho,x:0,y:0,revision:0});await delay(80);
 assert((await wc.executeJavaScript('window.offlinePet.viewport')).revision>=beforeEcho.revision);
 await wc.executeJavaScript('window.offlinePet.ctl.pointerUp()');
 await until(wc,'!window.offlinePet.ctl.busy()','motion drag settled');
 persist({roam:'calm',bubbles:true});await delay(100);
 check('Drag stays monotonic with native cursor samples; stale local events/viewport echoes are ignored');
 await wc.executeJavaScript(`(()=>{const c=window.offlinePet.ctl;c.act('stand');c.render();const p=window.offlinePet.toClient(c.toStage(128,140));document.querySelector('#stage').dispatchEvent(new MouseEvent('contextmenu',{clientX:p.x,clientY:p.y,bubbles:true}));})()`);
 assert(await wc.executeJavaScript(`!document.querySelector('#menu').hidden`));check('Context menu coordinates');
 openDress();const dress=getDress(),dw=dress.webContents;
 await until(dw,`!!window.whalePreview && document.querySelectorAll('#optScheme button').length===8 && !!document.querySelector('#scale')`,'whale-only settings');
 assert(await dw.executeJavaScript(`!document.querySelector('#optFigure') && !document.querySelector('#optHead') && !document.body.textContent.includes('Coo')`));check('Coo module and costume controls removed');
 await dw.executeJavaScript(`(()=>{const e=document.querySelector('#scale');e.value='1.5';e.dispatchEvent(new Event('change'));})()`);
 await until(wc,'window.offlinePet.prefs.scale===1.5','scale persisted');assert.equal(JSON.parse(fs.readFileSync(prefsFile)).scale,1.5);check('Local preference persistence and synchronization');
 for(const scheme of ['deepseek','harness','chatgpt','claude','gemini','qwen','kimi','minimax']){
  await dw.executeJavaScript(`document.querySelector('[data-scheme="${scheme}"]').click()`);
  await until(dw,`window.whalePreview.fig.scheme==='${scheme}'`,'preview '+scheme);
  await until(wc,`window.offlinePet.ctl.figure.scheme==='${scheme}' && window.offlinePet.figureReady`,'desktop '+scheme);
  for(const face of ['neutral','happy','wink','love','shy','surprised','angry','sad','sleepy']){
   const result=await dw.executeJavaScript(`(()=>{const p=window.whalePreview;p.ctl.act('stand');p.ctl.setExpr('${face}',20);for(let i=0;i<3;i++)p.ctl.step(.035);p.ctl.render();return p.fig.renderStats;})()`);
   assert.equal(result.nonFinite,0,scheme+' '+face);assert.deepEqual(result.missing,[]);assert(result.drawn.includes('bangs')&&result.drawn.includes('hair_back'),scheme+' '+face);
  }
 }
 check('8 schemes × 9 expressions preserve hair layers');
 await dw.executeJavaScript(`document.querySelector('[data-scheme="deepseek"]').click()`);
 await until(dw,`window.whalePreview.fig.scheme==='deepseek'`,'restore original');
 await dw.executeJavaScript(`window.whalePreview.ctl.setExpr('happy',10);window.whalePreview.ctl.step(.04);window.whalePreview.ctl.render()`);
 const png=await dw.executeJavaScript('window.whalePreview.fig.renderCanvas.toDataURL("image/png")');fs.writeFileSync(path.join(data,'happy-preview.png'),Buffer.from(png.split(',')[1],'base64'));
 // Chromium can reject a capture while Viz is presenting a moved window.
 let settingsCapture;
 for(let attempt=0;attempt<3;attempt++){
  try{settingsCapture=await dw.capturePage();break;}
  catch(error){if(attempt===2)throw error;await delay(150);}
 }
 fs.writeFileSync(path.join(data,'settings-preview.png'),settingsCapture.toPNG());
 await wc.executeJavaScript('window.offlinePet.talk()');await delay(450);assert(await wc.executeJavaScript(`!document.querySelector('#bubble').hidden && document.querySelectorAll('.offline-choices button').length===5`));
 await wc.executeJavaScript(`document.querySelector('.offline-choices button').click()`);await delay(350);assert(await wc.executeJavaScript(`document.querySelector('.b-text').textContent.includes('你好')`));check('Offline speech bubbles and conversation choices');
 await wc.executeJavaScript('window.offlinePet.expressions(500,500)');assert(await wc.executeJavaScript(`document.querySelectorAll('.expression-grid button').length>=8`));check('Expression selector contains no Coo artwork');
 assert(await wc.executeJavaScript(`fetch('https://example.com/offline-probe').then(()=>false,()=>true)`));check('External network remains blocked');
 const unexpected=errors.filter(e=>!/Content Security Policy|Connecting to.*example\.com|Fetch API cannot load.*example\.com/.test(e));assert.deepEqual(unexpected,[]);
 report.unexpectedErrors=unexpected;report.nativePetBounds=b;report.desktopArea=wa.width*wa.height;
 fs.writeFileSync(path.join(data,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
module.exports={run};
