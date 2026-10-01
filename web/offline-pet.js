import { applyTheme, createPet, createSfx, normalizeSkin, skinCss, clamp, GALLERY, FACES } from './pet-core.js';
const host = window.petHost;
document.body.classList.add('desk');
const stage = document.querySelector('#stage');
const menu = document.querySelector('#menu');
const bubble = document.querySelector('#bubble');
let view = await host.getViewport();
let boundsRevision = view.revision || 0;
function syncViewport(next, optimistic = false) {
  // Native echoes must not repaint with an older/rounded origin between frames.
  if (!optimistic && !next.force && boundsRevision > 0 && (next.revision || 0) <= boundsRevision) return;
  if (next.force) boundsRevision = next.revision || 0;
  view = next;
  stage.style.cssText = `position:absolute;inset:auto;left:${-view.x}px;top:${-view.y}px;width:${view.width}px;height:${view.height}px`;
  document.documentElement.style.setProperty('--offset-x', -view.x + 'px');
  document.documentElement.style.setProperty('--offset-y', -view.y + 'px');
  if (next.force) queueMicrotask(() => ctl.resize());
}
host.onViewport(syncViewport);
syncViewport(view);
const toWorld = e => e.isTrusted
  ? { x: e.screenX - view.screenX, y: e.screenY - view.screenY }
  : { x: e.clientX + view.x, y: e.clientY + view.y };
let speech = null;
let nextIdle = performance.now() + 45000;
const pick = items => items[Math.floor(Math.random() * items.length)];
const skinStyle = document.createElement('style');
document.head.appendChild(skinStyle);
const sfx = createSfx();
sfx.unlock();
let prefs = { roam: 'calm', scale: 1.2, sound: true, theme: 'dark', paused: false };
let cursor = null, interactive = null, figurePromise = null, wanted = 'coo';
let figureReady = false;
const ctl = createPet({ petG: document.querySelector('#pet'), shadowEl: document.querySelector('#shadow'), fxG: document.querySelector('#fx') }, {
  sfx, roam: prefs.roam,
  bounds: () => ({ W: view.width, H: view.height, floorY: view.height - 2, S: .42 * prefs.scale }),
  dialogOpen: () => !menu.hidden,
  enter: 'drop',
  onEvent: (kind, d) => {
    if (kind !== 'touch') return;
    if (d.kind === 'grab') { closeMenu(); closeSpeech(); return; }
    if (d.kind === 'poke') say(pick(['嘿嘿，你戳到我啦！', '我在呢～陪你一起看。', '轻一点嘛，痒痒的！']), 'happy');
    if (d.kind === 'pet') say(pick(['好舒服，再摸摸头～', '喜欢这样陪着你。', '收到一份摸摸，开心！']), 'love');
    if (d.kind === 'drop') say('安全落地！', 'surprised');
    if (d.kind === 'throw') say('哇——起飞啦！');
    if (d.kind === 'crash') say('转圈圈……让我缓一缓。');
  },
});
async function applyPrefs(next) {
  prefs = next;
  ctl.setRoam(prefs.roam);
  sfx.set(prefs.sound);
  applyTheme(prefs.theme);
  ctl.resize();
  const skin = normalizeSkin({ ...prefs.skin, figure: 'whale', head: 'none', side: 'none', glasses: 'none', neck: 'none' });
  ctl.setSkin(skin);
  skinStyle.textContent = skinCss(skin);
  wanted = skin.figure;
  figureReady = false;
  figurePromise ??= import('./whale/figure.js').then(m => m.createWhaleFigure(undefined, { scheme: skin.scheme }));
  const fig = await figurePromise;
  if (wanted !== 'whale') return;
  await fig.setScheme(skin.scheme, { fade: ctl.figure === fig ? .45 : 0, at: ctl.time });
  if (wanted !== 'whale') return;
  ctl.setFigure(fig);
  figureReady = true;
}
host.onPrefs(p => applyPrefs(p).catch(console.error));
await applyPrefs(await host.getPrefs());
function updateHit() {
  const ui = cursor && document.elementFromPoint(cursor.x - view.x, cursor.y - view.y)?.closest('.menu:not([hidden]), .bubble:not([hidden])');
  const on = ctl.pressing || !!(cursor && ctl.hitPet(cursor)) || !!ui;
  if (interactive !== on) { interactive = on; host.setInteractive(on); }
}
function move(p) {
  cursor = p;
  if (p) stage.style.cursor = ctl.pointerMove(p);
  else ctl.pointerLeave();
  updateHit();
}
host.onCursor(move);
// Native screen samples are the sole movement source: local pointer events
// may still refer to the previous native window position during a move.
document.addEventListener('pointerleave', () => { if (!ctl.pressing) updateHit(); });
stage.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  closeMenu();
  if (ctl.pointerDown(toWorld(e))) { stage.setPointerCapture(e.pointerId); e.preventDefault(); }
});
const release = () => { ctl.pointerUp(); stage.style.cursor = ''; updateHit(); };
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);
stage.addEventListener('dblclick', e => {
  if (!ctl.hitPet(toWorld(e))) return;
  ctl.setExpr('happy'); ctl.act('jump'); sfx.sparkle();
});
function closeMenu() { menu.hidden = true; updateHit(); }
function closeSpeech() { bubble.hidden = true; bubble.textContent = ''; speech = null; }
function say(text, expression, choices = false) {
  if (prefs.bubbles === false) return;
  closeSpeech();
  if (expression) ctl.setExpr(expression);
  speech = { text, shown: 0, acc: 0, until: performance.now() + (choices ? 25000 : 6500), choices };
  bubble.className = 'bubble pop offline-bubble';
  const close = document.createElement('button'); close.className = 'b-close'; close.textContent = '×'; close.title = '关闭';
  close.addEventListener('click', closeSpeech);
  const line = document.createElement('p'); line.className = 'b-text';
  bubble.append(close, line);
  if (choices) {
    const box = document.createElement('div'); box.className = 'offline-choices';
    for (const [label, reply, face, motion] of [
      ['你好呀', '你好～今天也一起慢慢过吧！', 'happy'],
      ['夸夸我', '能认真把事情做好就很棒啦，也记得休息哦。', 'love'],
      ['开心一点', '嘿嘿，送你一个大大的笑脸！', 'happy', 'jump'],
      ['一起看视频', '好呀，我在旁边安静陪你。', 'wink', 'sit'],
      ['去睡一会', '那我眯一会，醒来继续陪你～', 'sleepy', 'sleep'],
    ]) {
      const button = document.createElement('button'); button.textContent = label;
      button.addEventListener('click', () => { say(reply, face); if (motion) ctl.act(motion); });
      box.appendChild(button);
    }
    bubble.appendChild(box);
  }
  bubble.hidden = false;
  sfx.pop(); ctl.holdRoam(choices ? 25 : 5);
  updateHit();
}
function talk() { say('想聊什么呀？点一句，我就回应你～', 'happy', true); }
function expressions(x, y) {
  menu.textContent = '';
  const title = document.createElement('strong'); title.textContent = '选一个表情'; menu.appendChild(title);
  const grid = document.createElement('div'); grid.className = 'expression-grid';
  for (const face of GALLERY) {
    if (face === 'dragged' || face === 'dizzy') continue;
    const button = document.createElement('button');
    button.textContent = `${({neutral:'🙂',happy:'😊',wink:'😉',love:'😍',shy:'☺️',surprised:'😮',angry:'😠',sad:'😢',sleepy:'🥱',sleep:'😴'})[face] || '🙂'} ${FACES[face]?.label || face}`;
    button.addEventListener('click', () => { closeMenu(); ctl.act('stand'); ctl.setExpr(face, 6); say(FACES[face]?.label || face); });
    grid.appendChild(button);
  }
  menu.appendChild(grid); positionMenu(x, y);
}
function positionMenu(x, y) {
  menu.hidden = false;
  menu.style.left = clamp(x, 8, Math.max(8, view.width - menu.offsetWidth - 8)) + 'px';
  menu.style.top = clamp(y - menu.offsetHeight, 8, Math.max(8, view.height - menu.offsetHeight - 8)) + 'px';
  updateHit();
}
function action(label, run) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label;
  button.addEventListener('click', () => { closeMenu(); run(); });
  menu.appendChild(button);
}
function openMenu(x, y) {
  menu.innerHTML = '<strong>Coopanion · 离线桌宠</strong>';
  action('聊两句（离线台词）', talk);
  action('动态小表情…', () => expressions(x, y));
  action('配色与习惯…', () => host.openDress());
  action(prefs.paused ? '继续动画' : '暂停动画', () => host.savePrefs({ paused: !prefs.paused }));
  for (const [label, act] of [['跳一跳', 'jump'], ['转个圈', 'spin'], ['坐下来', 'sit'], ['睡一会', 'sleep']]) {
    action(label, () => { if (prefs.paused) host.savePrefs({ paused: false }); ctl.holdRoam(8); ctl.act(act); });
  }
  action(prefs.sound ? '关闭音效' : '打开音效', () => host.savePrefs({ sound: !prefs.sound }));
  action(prefs.bubbles === false ? '打开互动气泡' : '关闭互动气泡', () => { closeSpeech(); host.savePrefs({ bubbles: prefs.bubbles === false }); });
  action('隐藏桌宠', () => host.hide());
  action('退出', () => host.quit());
  positionMenu(x, y);
}
document.addEventListener('contextmenu', e => {
  e.preventDefault();
  const p = toWorld(e);
  if (ctl.hitPet(p)) openMenu(p.x, p.y);
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu')) closeMenu(); }, { capture: true });
addEventListener('blur', closeMenu);
// Cropping the native window does not resize the virtual desktop/physics.
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
// Exposes only rendering state, useful for reproducible local verification.
const motionStats = { requests: 0, resizes: 0 };
window.offlinePet = { ctl, talk, say, expressions, closeSpeech, motionStats, get viewport() { return {...view}; }, toClient: p => ({x:p.x-view.x,y:p.y-view.y}), get prefs() { return prefs; }, get figureReady() { return figureReady; } };
let lastBounds = null;
function cropWindow(now) {
  const S = .42 * prefs.scale, p = ctl.pet;
  const cx = p.mode === 'drag' ? p.dx : p.x;
  const cy = p.mode === 'drag' ? p.dy + 110*S : p.fy - 116*S;
  // Stable animation envelope: hair/body sway must not resize the window.
  const baseWidth = Math.ceil((240*S + 220)/32)*32;
  const baseHeight = Math.ceil((380*S + 210)/32)*32;
  let left = cx-baseWidth/2, right = cx+baseWidth/2;
  let top = cy-baseHeight/2, bottom = cy+baseHeight/2;
  for (const element of [menu, bubble]) {
    if (element.hidden) continue;
    const r = element.getBoundingClientRect();
    left = Math.min(left, r.left + view.x - 8); right = Math.max(right, r.right + view.x + 8);
    top = Math.min(top, r.top + view.y - 8); bottom = Math.max(bottom, r.bottom + view.y + 8);
  }
  const width = Math.min(view.width, Math.ceil((right-left-.001)/32)*32);
  const height = Math.min(view.height, Math.ceil((bottom-top-.001)/32)*32);
  const x = clamp(Math.round(left), 0, view.width-width);
  const y = clamp(Math.round(top), 0, view.height-height);
  const rect = {x,y,width,height};
  if (lastBounds && Object.keys(rect).every(k => lastBounds[k] === rect[k])) return;
  if (lastBounds && (width !== lastBounds.width || height !== lastBounds.height)) motionStats.resizes++;
  lastBounds = rect;
  motionStats.requests++;
  const revision = ++boundsRevision;
  // Paint with the requested origin in the same frame; the local drawing
  // stays still as Windows moves the window, without waiting for an IPC echo.
  syncViewport({...view,x,y,revision}, true);
  host.setBounds({...rect,revision});
}
let last = performance.now();
function frame(now) {
  // Follow display refresh. The former 30 ms gate skipped every other frame
  // on a 60 Hz display, including window movement and drag updates.
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!prefs.paused) ctl.step(dt);
  ctl.render();
  if (speech) {
    speech.acc += dt * 24;
    const shown = Math.min(speech.text.length, Math.floor(speech.acc));
    if (shown !== speech.shown) { speech.shown = shown; bubble.querySelector('.b-text').textContent = speech.text.slice(0, shown); if (!prefs.paused) ctl.talk(); }
    const anchor = ctl.anchor();
    bubble.style.left = clamp(anchor.x - bubble.offsetWidth / 2, 8, Math.max(8, view.width - bubble.offsetWidth - 8)) + 'px';
    bubble.style.top = Math.max(8, anchor.y - bubble.offsetHeight - 16) + 'px';
    if (now > speech.until) closeSpeech();
  }
  if (now > nextIdle) {
    nextIdle = now + 45000 + Math.random() * 25000;
    if (!prefs.paused && !ctl.busy() && menu.hidden && !speech && !['sleep', 'sit'].includes(ctl.pet.mode)) {
      say(pick(['我就在这里陪着你～', '记得眨眨眼，喝口水。', '今天也要好好照顾自己。']), pick(['happy', 'wink', 'shy']));
    }
  }
  // Roaming can move the figure away from a stationary pointer.
  updateHit();
  cropWindow(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
