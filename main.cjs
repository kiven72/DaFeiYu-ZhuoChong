const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, session, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { defaults, sanitize } = require('./preferences.cjs');
const benchmarking = process.argv.includes('--benchmark');
const startupTesting = process.argv.includes('--startup-test');
const testing = process.argv.includes('--self-test') || benchmarking || startupTesting;
const autoStart = require('./autostart.cjs').createAutoStart(app, { testing });
// Use the author's GPU mesh renderer; keep a manual compatibility fallback.
if (process.argv.includes('--compatible')) app.disableHardwareAcceleration();
// Keep this window out of DirectComposition surfaces while retaining WebGL.
if (process.platform === 'win32') app.commandLine.appendSwitch('disable-direct-composition');
const root = __dirname;
const data = path.join(app.isPackaged ? path.dirname(process.execPath) : root, testing ? 'test-data' : 'data');
fs.mkdirSync(path.join(data, 'tmp'), { recursive: true });
app.setName('Coopanion 离线桌宠');
app.setPath('userData', data);
app.setPath('sessionData', path.join(data, 'browser'));
app.setPath('crashDumps', path.join(data, 'crashes'));
process.env.TEMP = process.env.TMP = path.join(data, 'tmp');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('lang', 'zh-CN');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND');
protocol.registerSchemesAsPrivileged([{ scheme: 'pet', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const prefsFile = path.join(data, 'preferences.json');
let prefs = { ...defaults };
try { prefs = sanitize(JSON.parse(fs.readFileSync(prefsFile, 'utf8'))); } catch {}
let pet = null, dress = null, tray = null, boundsRevision = 0, requestedPetSize = null;
const errors = [];
const requested = [];
const blocked = [];
function logError(message) {
  errors.push(message);
  fs.appendFileSync(path.join(data, 'errors.log'), `${new Date().toISOString()} ${message}\n`);
}
function trusted(event) {
  return [pet, dress].some(w => w && !w.isDestroyed() && w.webContents === event.sender);
}
function persist(patch) {
  const next = sanitize(patch, prefs);
  const temp = prefsFile + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(temp, prefsFile);
  prefs = next;
  for (const win of [pet, dress]) if (win && !win.isDestroyed()) win.webContents.send('pet:prefs', prefs);
  updateTray();
  return prefs;
}
function watch(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('pet://local/')) e.preventDefault(); });
  win.webContents.on('console-message', e => { if (e.level === 'error' || e.level === 3) logError(e.message); });
  win.webContents.on('did-fail-load', (_e, code, text, url) => logError(`Load ${code}: ${text} ${url}`));
  win.webContents.on('render-process-gone', (_e, details) => logError(JSON.stringify(details)));
}
function viewport() {
  const wa = screen.getPrimaryDisplay().workArea, b = pet?.getBounds() || wa;
  return { width: wa.width, height: wa.height, x: b.x - wa.x, y: b.y - wa.y, screenX: wa.x, screenY: wa.y, revision: boundsRevision };
}
function place() { if (pet && !pet.isDestroyed()) pet.webContents.send('pet:viewport', viewport()); }
function showPet() { if (pet && !pet.isDestroyed()) pet.showInactive(); }
function openDress() {
  if (dress && !dress.isDestroyed()) { dress.show(); dress.focus(); return; }
  dress = new BrowserWindow({ width: 1000, height: 800, minWidth: 750, minHeight: 550,
    title: '大肥鱼 · 配色与习惯', icon: path.join(root, 'icons/icon.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(root, 'preload.cjs'), contextIsolation: true, sandbox: true, spellcheck: false } });
  watch(dress);
  dress.on('closed', () => { dress = null; });
  dress.loadURL('pet://local/web/whale-dress.html');
}
function updateTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示桌宠', click: showPet },
    { label: '隐藏桌宠', click: () => pet?.hide() },
    { label: '配色与习惯…', click: openDress },
    { label: '暂停动画', type: 'checkbox', checked: prefs.paused, click: i => persist({ paused: i.checked }) },
    { type: 'separator' },
    { label: '退出离线桌宠', click: () => app.quit() },
  ]));
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', showPet);
  app.whenReady().then(async () => {
    await session.defaultSession.setProxy({ mode: 'direct' });
    await session.defaultSession.closeAllConnections();
    // Assets are read directly from disk. There is no HTTP server or model client.
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    protocol.handle('pet', req => {
      const url = new URL(req.url);
      requested.push(url.pathname);
      let file;
      try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { return new Response('', { status: 400 }); }
      if (url.hostname !== 'local' || !file.startsWith(root + path.sep) || !file.startsWith(path.join(root, 'web') + path.sep)) return new Response('', { status: 403 });
      try {
        return new Response(fs.readFileSync(file), { headers: { 'content-type': mime[path.extname(file)] || 'application/octet-stream',
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'" } });
      } catch { return new Response('', { status: 404 }); }
    });
    session.defaultSession.webRequest.onBeforeRequest((details, done) => {
      const allowed = /^(pet:\/\/local\/|data:|blob:|devtools:)/.test(details.url);
      if (!allowed) blocked.push(details.url);
      done({ cancel: !allowed });
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, done) => done(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    ipcMain.handle('pet:prefs', e => trusted(e) ? prefs : null);
    ipcMain.handle('pet:viewport', e => trusted(e) ? viewport() : null);
    ipcMain.handle('pet:render-mode', e => trusted(e) ? (app.isHardwareAccelerationEnabled() ? 'webgl2' : 'canvas2d') : null);
    ipcMain.handle('pet:autostart:get', e => trusted(e) ? autoStart.get() : null);
    ipcMain.handle('pet:autostart:set', (e, enabled) => {
      if (!trusted(e)) throw new Error('Untrusted startup request');
      const state = autoStart.set(enabled);
      for (const win of [pet, dress]) if (win && !win.isDestroyed()) win.webContents.send('pet:autostart', state);
      return state;
    });
    ipcMain.on('pet:bounds', (e, rect) => {
      if (!pet || e.sender !== pet.webContents || !rect || !['x','y','width','height'].every(k => Number.isFinite(rect[k]))) return;
      const wa = screen.getPrimaryDisplay().workArea;
      const width = Math.max(80, Math.min(wa.width, Math.ceil(rect.width)));
      const height = Math.max(80, Math.min(wa.height, Math.ceil(rect.height)));
      const x = wa.x + Math.max(0, Math.min(wa.width - width, Math.floor(rect.x)));
      const y = wa.y + Math.max(0, Math.min(wa.height - height, Math.floor(rect.y)));
      const old = pet.getBounds();
      boundsRevision = Number.isSafeInteger(rect.revision) ? Math.max(boundsRevision, rect.revision) : boundsRevision;
      const sameSize = requestedPetSize?.width === width && requestedPetSize?.height === height;
      if (sameSize && old.x === x && old.y === y) return;
      // Reapply the fixed requested size. setPosition() retains the rounded DIP
      // size on Windows and can accumulate that rounding on every move.
      pet.setBounds({ x, y, width, height }); requestedPetSize = {width, height};
      place();
    });
    ipcMain.handle('pet:save', (e, patch) => trusted(e) ? persist(patch || {}) : null);
    ipcMain.on('pet:interactive', (e, on) => { if (pet && e.sender === pet.webContents) pet.setIgnoreMouseEvents(!on, { forward: true }); });
    ipcMain.on('pet:dress', e => { if (trusted(e)) openDress(); });
    ipcMain.on('pet:hide', e => { if (trusted(e)) pet?.hide(); });
    ipcMain.on('pet:quit', e => { if (trusted(e)) app.quit(); });
    const wa = screen.getPrimaryDisplay().workArea;
    pet = new BrowserWindow({ x: wa.x + Math.floor(wa.width * .7 - 160), y: wa.y + wa.height - 360, width: 320, height: 360,
      transparent: true, frame: false, focusable: false, resizable: false, movable: false, minimizable: false, maximizable: false,
      fullscreenable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, show: false,
      title: 'Coopanion 离线桌宠', backgroundColor: '#00000000',
      webPreferences: { preload: path.join(root, 'preload.cjs'), contextIsolation: true, sandbox: true,
        backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
    // Clicking this desktop-sized overlay must not activate it or deactivate the video player.
    pet.setAlwaysOnTop(true, 'floating');
    pet.setIgnoreMouseEvents(true, { forward: true });
    watch(pet);
    pet.once('ready-to-show', showPet);
    pet.on('closed', () => { pet = null; });
    let last = '';
    const timer = setInterval(() => {
      // Tests inject reproducible screen samples; the user's live mouse must
      // not compete with those samples during an automated drag.
      if (testing || !pet || pet.isDestroyed() || !pet.isVisible()) return;
      const p = screen.getCursorScreenPoint(), b = screen.getPrimaryDisplay().workArea;
      const at = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height ? { x: p.x - b.x, y: p.y - b.y } : null;
      const key = JSON.stringify(at);
      if (key !== last) { last = key; pet.webContents.send('pet:cursor', at); }
    }, 16);
    app.on('before-quit', () => clearInterval(timer));
    for (const event of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(event, () => {
      if (pet && !pet.isDestroyed()) pet.webContents.send('pet:viewport', {...viewport(), force: true});
    });
    tray = new Tray(nativeImage.createFromPath(path.join(root, 'icons/tray.png')));
    tray.setToolTip('Coopanion 离线桌宠 · 无需 API');
    tray.on('click', showPet);
    updateTray();
    await pet.loadURL('pet://local/web/pet.html');
    if (testing) {
      try { await require(startupTesting ? './self-test-startup.cjs' : benchmarking ? './self-test-performance.cjs' : './self-test-v2.cjs').run({ app, pet, openDress, getDress: () => dress, persist, prefsFile, data, errors, requested, blocked, session, autoStart }); }
      catch (error) { logError(error.stack); app.exit(1); return; }
      app.exit(0);
    }
  }).catch(error => { logError(error.stack); app.exit(1); });
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
}
