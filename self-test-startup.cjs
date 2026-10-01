const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(wc,expr){for(let i=0;i<150;i++){if(await wc.executeJavaScript(expr))return;await delay(50);}throw Error('Timeout: '+expr);}
async function run({app,pet,openDress,getDress,data,autoStart,errors}){
 const report={checks:[]},check=name=>{report.checks.push(name);console.log('Verified:',name);};
 assert.equal(autoStart.get().enabled,false);
 const readItem=()=>app.getLoginItemSettings(autoStart.options).launchItems.find(item=>item.name===autoStart.name);
 let wc;
 try {
  openDress();wc=getDress().webContents;
  await until(wc,`document.querySelector('#autoStart') && !document.querySelector('#autoStart').disabled`);
  assert.equal(await wc.executeJavaScript(`document.querySelector('#autoStart').checked`),false);
  check('Startup checkbox reads the current Windows state');
  await wc.executeJavaScript(`document.querySelector('#autoStart').click()`);
  await until(wc,`document.querySelector('#autoStart').checked && !document.querySelector('#autoStart').disabled`);
  const item=readItem();assert(item && item.enabled && item.scope==='user');
  assert.equal(item.path.replace(/^"|"$/g,''),process.execPath);assert.deepEqual(item.args,[]);
  assert.equal(autoStart.get().enabled,true);
  check('Enabling in the UI creates an enabled user startup entry for the installed EXE');
  getDress().close();await delay(100);openDress();wc=getDress().webContents;
  await until(wc,`document.querySelector('#autoStart')?.checked && !document.querySelector('#autoStart').disabled`);
  check('Reopening settings preserves the Windows startup state');
  await wc.executeJavaScript(`document.querySelector('#autoStart').click()`);
  await until(wc,`document.querySelector('#autoStart') && !document.querySelector('#autoStart').checked && !document.querySelector('#autoStart').disabled`);
  assert.equal(autoStart.get().enabled,false);assert.equal(readItem(),undefined);
  check('Disabling in the UI removes the user startup entry');
  // A Windows-side change must be reflected when the settings window gains focus.
  autoStart.set(true);
  await wc.executeJavaScript(`window.dispatchEvent(new Event('focus'))`);
  await until(wc,`document.querySelector('#autoStart').checked`);
  autoStart.set(false);
  await wc.executeJavaScript(`window.dispatchEvent(new Event('focus'))`);
  await until(wc,`!document.querySelector('#autoStart').checked`);
  check('The switch follows startup changes made outside the settings window');
  assert(await wc.executeJavaScript(`window.petHost.setAutoStart('true').then(()=>false,()=>true)`));
  check('Invalid startup requests are rejected');
  await until(wc,`!!window.whalePreview && document.querySelectorAll('#optScheme button').length===8 && window.whalePreview.fig.renderStats?.drawn.includes('bangs')`);
  await until(wc,`[...document.querySelectorAll('#optScheme img')].every(image=>image.complete && image.naturalWidth>0)`);
  await wc.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  check('The character and eight color schemes still load alongside the startup control');
  assert.deepEqual(errors,[]);report.unexpectedErrors=[];
  let captured;for(let i=0;i<3;i++){try{captured=await wc.capturePage();break;}catch(e){if(i===2)throw e;await delay(150);}}
  fs.writeFileSync(path.join(data,'startup-settings-preview.png'),captured.toPNG());
 } finally {
  autoStart.set(false);
  assert.equal(readItem(),undefined);
 }
 report.testStartupRemoved=true;
 fs.writeFileSync(path.join(data,'startup-verification.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
module.exports={run};
