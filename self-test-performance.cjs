const fs=require('node:fs'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run({pet,persist,data}){
 const wc=pet.webContents;
 for(let i=0;i<400;i++){if(await wc.executeJavaScript('!!window.offlinePet?.figureReady && !window.offlinePet.ctl.busy()'))break;await delay(50);}
 persist({roam:'off',bubbles:false,scale:1.2,paused:false});await delay(200);
 const report={timestamp:new Date().toISOString(),phases:[]};
 for(const mode of ['idle','walk','drag']){
  const result=await wc.executeJavaScript(`(async()=>{
   const o=window.offlinePet,c=o.ctl;o.closeSpeech();document.querySelector('#menu').hidden=true;
   c.pointerUp();c.act('stand');c.pet.x=o.viewport.width*.25;c.pet.fy=o.viewport.height-2;c.render();
   if('${mode}'==='walk')c.walkTo(o.viewport.width*.85);
   if('${mode}'==='drag'){const p=c.toStage(128,140);c.pointerDown(p);c.pointerMove({x:p.x+40,y:p.y-200});}
   await new Promise(r=>setTimeout(r,300));
   const render=c.render,work=[],times=[];c.render=function(){const t=performance.now();const r=render.apply(this,arguments);work.push(performance.now()-t);times.push(performance.now());return r;};
   const start=performance.now();
   try{await new Promise(resolve=>{function sample(now){if('${mode}'==='drag')c.pointerMove({x:o.viewport.width*.3+(now-start)*.05,y:o.viewport.height*.5});if(now-start>=2500)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});}
   finally{c.render=render;}
   const ms=performance.now()-start,intervals=times.slice(1).map((t,i)=>t-times[i]),sorted=work.slice().sort((a,b)=>a-b);
   const result={mode:'${mode}',frames:work.length,fps:+(work.length*1000/ms).toFixed(1),renderMeanMs:+(work.reduce((a,b)=>a+b,0)/work.length).toFixed(2),renderP95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2),intervalP95Ms:+intervals.sort((a,b)=>a-b)[Math.floor(intervals.length*.95)].toFixed(2),canvas:[c.figure.renderCanvas.width,c.figure.renderCanvas.height],missing:c.figure.renderStats.missing,nonFinite:c.figure.renderStats.nonFinite};
   c.pointerUp();return result;
  })()`);
  report.phases.push(result);
 }
 await wc.executeJavaScript(`(()=>{const c=window.offlinePet.ctl;c.act('stand');c.setExpr('happy',10);c.render();})()`);
 const png=await wc.executeJavaScript('window.offlinePet.ctl.figure.renderCanvas.toDataURL("image/png")');
 fs.writeFileSync(path.join(data,'performance-preview.png'),Buffer.from(png.split(',')[1],'base64'));
 fs.writeFileSync(path.join(data,'performance.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
module.exports={run};
