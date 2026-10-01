/**
 * The pet's body: geometry, faces, accessories, skin, synthesized sound, and the motion
 * simulation with pointer handling. Pages build on it: the desktop window (pet.html), the
 * dressing page (dress.html) and anything else that wants the same figure.
 *
 * Coordinates: the figure is drawn in logo units, facing right, ground at y=256. A stage places
 * it with translate(AX AY) rotate(rot) scale(kx ky) translate(-ax -ay); `toStage` maps a logo
 * point back to stage pixels for hit tests, particles and bubble placement.
 */

export const f = n => Math.round(n * 10) / 10;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const smooth = k => k * k * (3 - 2 * k);

/* ---------- figure geometry ---------- */
const HIPS = [[104, 212], [150, 212]];
const EYES = [[113, 117], [163, 117]];
const BODY_W = 36, LEG_W = 30;
// a foot's round cap touches the ground
const FOOT_Y = 256 - LEG_W / 2;
export const STAND = HIPS.map(h => [h[0], h[1], h[0], FOOT_Y]);
const DROP = 'M0 -9C4 -3 6 0 6 3.5A6 6 0 0 1 -6 3.5C-6 0 -4 -3 0 -9Z';
const pol = (a, r) => [128 + r * Math.cos(a * Math.PI / 180), 128 - r * Math.sin(a * Math.PI / 180)];
const pt = p => `${f(p[0])} ${f(p[1])}`;

function cPath(gt, gb) {
  return `M${pt(pol(gt, 84))}A84 84 0 1 0 ${pt(pol(-gb, 84))}`;
}
function ellipse(cx, cy, rx, ry) {
  if (ry < 1.6) return `M${f(cx - rx)} ${f(cy)}L${f(cx + rx)} ${f(cy)}`;
  return `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
}
export function heartD(cx, cy, s) {
  const p = (x, y) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return `M${p(0, 14)}C${p(-7, 8)} ${p(-19, 1)} ${p(-19, -6)}C${p(-19, -15)} ${p(-8, -18)} ${p(0, -9)}C${p(8, -18)} ${p(19, -15)} ${p(19, -6)}C${p(19, 1)} ${p(7, 8)} ${p(0, 14)}Z`;
}
function eyePath(e, cx, cy) {
  cx += e.dx || 0; cy += e.dy || 0;
  switch (e.shape) {
    case 'ring': return ellipse(cx, cy, e.rx, e.ry);
    case 'lid': return e.ry < 1.6 ? `M${f(cx - 16)} ${f(cy)}L${f(cx + 16)} ${f(cy)}` : `M${f(cx - 16)} ${f(cy)}A16 ${f(e.ry)} 0 0 0 ${f(cx + 16)} ${f(cy)}Z`;
    case 'up': return `M${f(cx - 15)} ${f(cy + 6)}Q${f(cx)} ${f(cy - 17)} ${f(cx + 15)} ${f(cy + 6)}`;
    case 'down': return `M${f(cx - 15)} ${f(cy - 3)}Q${f(cx)} ${f(cy + 15)} ${f(cx + 15)} ${f(cy - 3)}`;
    case 'gt': return `M${f(cx - 10)} ${f(cy - 13)}L${f(cx + 11)} ${f(cy)}L${f(cx - 10)} ${f(cy + 13)}`;
    case 'lt': return `M${f(cx + 10)} ${f(cy - 13)}L${f(cx - 11)} ${f(cy)}L${f(cx + 10)} ${f(cy + 13)}`;
    case 'heart': return heartD(cx, cy, e.s);
    case 'spiral': {
      let d = '';
      const max = Math.PI * 4.4;
      for (let i = 0; i <= 44; i++) {
        const a = max * i / 44, r = 2 + 15 * i / 44;
        d += (i ? 'L' : 'M') + f(cx + r * Math.cos(a + e.rot)) + ' ' + f(cy + r * Math.sin(a + e.rot));
      }
      return d;
    }
  }
  return '';
}

export const HEAD_TOP = { none: 12 };

/* ---------- faces ---------- */
const ring = o => ({ shape: 'ring', rx: 16, ry: 16, ...o });
const yawn = t => { const p = (t % 4.2) / 1.6; return p < 1 ? Math.sin(Math.PI * p) ** 2 : 0; };

export const FACES = {
  neutral:   { label: '平静', kao: '(0 0',  f: () => ({ gap: [50, 50], eyes: [ring(), ring()] }) },
  happy:     { label: '开心', kao: '(^ ^',  f: () => ({ gap: [58, 58], eyes: [{ shape: 'up' }, { shape: 'up' }], blush: .45 }) },
  wink:      { label: '眨眼', kao: '(0 ^',  f: () => ({ gap: [56, 52], eyes: [ring(), { shape: 'up' }] }) },
  love:      { label: '喜欢', kao: '(♡ ♡',  f: t => { const s = .8 + .08 * Math.sin(t * 9); return { gap: [56, 56], eyes: [{ shape: 'heart', s, sw: 8 }, { shape: 'heart', s, sw: 8 }], blush: .7, emit: 'heart' }; } },
  shy:       { label: '害羞', kao: '(o o *', f: () => ({ gap: [40, 40], eyes: [ring({ rx: 13, ry: 12, dx: -3, dy: 5 }), ring({ rx: 13, ry: 12, dx: -3, dy: 5 })], blush: 1, lookLock: true }) },
  surprised: { label: '惊讶', kao: '(O O',  f: () => ({ gap: [62, 62], eyes: [ring({ rx: 20, ry: 21 }), ring({ rx: 20, ry: 21 })], bang: true }) },
  angry:     { label: '生气', kao: '(ò ó',  f: () => ({ gap: [36, 36], eyes: [ring({ ry: 11, dy: 4 }), ring({ ry: 11, dy: 4 })], brows: 'angry', anger: true, shake: true }) },
  sad:       { label: '难过', kao: '(ó ò',  f: () => ({ gap: [34, 40], eyes: [ring({ ry: 14, dy: 4 }), ring({ ry: 14, dy: 4 })], brows: 'sad', emit: 'tear' }) },
  sleepy:    { label: '犯困', kao: '(- -',  f: t => { const y = yawn(t); return { gap: [50 + 14 * y, 50 + 14 * y], eyes: [{ shape: 'lid', ry: 9 - 7 * y }, { shape: 'lid', ry: 9 - 7 * y }] }; } },
  sleep:     { label: '睡着', kao: '(u u',  f: t => { const b = 40 + 6 * Math.sin(t * 1.7); return { gap: [b, b], eyes: [{ shape: 'down' }, { shape: 'down' }], emit: 'z' }; } },
  dizzy:     { label: '晕乎', kao: '(@ @',  f: t => ({ gap: [54 + 5 * Math.sin(t * 5), 48], eyes: [{ shape: 'spiral', rot: t * 7 }, { shape: 'spiral', rot: t * 7 + 1.4 }], orbit: true }) },
  dragged:   { label: '被拎起', kao: '(> <', f: t => { const g = 55 + 3 * Math.sin(t * 22); return { gap: [g, g], eyes: [{ shape: 'gt' }, { shape: 'lt' }], sweat: true }; } },
  content:   { label: '惬意', f: (t, p) => { const r = 11 - 9 * (p ? p.drowse : 0); return { gap: [46, 46], eyes: [{ shape: 'lid', ry: r }, { shape: 'lid', ry: r }] }; } },
  waking:    { label: '醒来', f: (t, p) => {
    const mt = p ? p.modeT : 1;
    const k = clamp(mt / .5, 0, 1), y = mt > .5 ? Math.sin(clamp((mt - .5) / .9, 0, 1) * Math.PI) : 0;
    const r = Math.max(0, 10 * k * (1 - .7 * y));
    return { gap: [50 + 12 * y, 50 + 12 * y], eyes: [{ shape: 'lid', ry: r }, { shape: 'lid', ry: r }] };
  } },
  squeeze:   { label: '回神', f: () => ({ gap: [44, 44], eyes: [{ shape: 'lid', ry: 0 }, { shape: 'lid', ry: 0 }] }) },
  listening: { label: '倾听', f: () => ({ gap: [44, 44], eyes: [ring({ rx: 17, ry: 18, dy: -1 }), ring({ rx: 17, ry: 18, dy: -1 })], listen: true }) },
  thinking:  { label: '思考', f: t => ({ gap: [46, 46], eyes: [ring({ rx: 14, ry: 15, dx: 3, dy: -4 }), ring({ rx: 14, ry: 15, dx: 3, dy: -4 })], think: true }) },
  run:       { label: '冲刺', f: t => { const g = 55 + 4 * Math.sin(t * 16); return { gap: [g, g], eyes: [ring(), ring()], sweat: true }; } },
};
export const GALLERY = ['neutral', 'happy', 'wink', 'love', 'shy', 'surprised', 'angry', 'sad', 'sleepy', 'sleep', 'dizzy', 'dragged'];

/** One frame of the figure as SVG markup, in logo units. */
// Only the whale model is supported; costume geometry and Coo drawing are removed.
export function defaultSkin() { return { figure:'whale',scheme:'deepseek',head:'none',side:'none',glasses:'none',neck:'none',colors:{} }; }
export function normalizeSkin(raw) { return { ...defaultSkin(),scheme:typeof raw?.scheme==='string' && /^[a-z0-9-]{1,32}$/.test(raw.scheme)?raw.scheme:'deepseek' }; }
export function skinCss(_skin,selector='html:root') { return selector+'{--skin-eye:#4d6bfe;--skin-ink:#eeeeff;}'; }

/* ---------- the pages' round buttons: icons (24 units, currentColor) and the theme switch ---------- */
const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  chat: icon('<path d="M6 4.5h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5v-3.5H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z"/>'),
  moon: icon('<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2.8v1.6M12 19.6v1.6M2.8 12h1.6M19.6 12h1.6M5.5 5.5l1.1 1.1M17.4 17.4l1.1 1.1M5.5 18.5l1.1-1.1M17.4 6.6l1.1-1.1"/>'),
  play: icon('<path d="M8 5.5v13l10.5-6.5z"/>'),
  pause: icon('<path d="M9 5.5v13M15 5.5v13"/>'),
  // eight flat teeth around a hub
  settings: icon(`<path d="${Array.from({ length: 32 }, (_, i) => {
    const a = (i - .5) * Math.PI / 16, r = i % 4 < 2 ? 9.6 : 7.2;
    return `${i ? 'L' : 'M'}${f(12 + r * Math.cos(a))} ${f(12 + r * Math.sin(a))}`;
  }).join('')}Z"/><circle cx="12" cy="12" r="3"/>`),
  power: icon('<path d="M12 3.5v8M7.2 6.3a8 8 0 1 0 9.6 0"/>'),
  mic: icon('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>'),
  // the same microphone struck through
  micOff: icon('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3M4 4l16 16"/>'),
  sound: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  // a T-shirt: the dressing page
  shirt: icon('<path d="M8.5 3.5 4 6l-1.5 4.5L6 12v8.5h12V12l3.5-1.5L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/>'),
  eye: icon('<path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="3"/>'),
  // a page that opens in the browser
  external: icon('<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  eyeOff: icon('<path d="M3 12s3.2-6 9-6c1.6 0 3 .4 4.2 1M21 12s-3.2 6-9 6c-1.6 0-3-.4-4.2-1"/><path d="M9.9 14.1a3 3 0 0 1 4.2-4.2M4 4l16 16"/>'),
  // how much the pet walks on its own, as a gauge: low, middle, high
  roam_off: icon('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16 7 13.2"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>'),
  roam_calm: icon('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16V10"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>'),
  roam_free: icon('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l5-2.8"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/><path d="M19.5 6.5l1.5-1.5M21 10h1.5"/>'),
};
/** Sets `theme` ('dark' | 'light') on the page; `button`, when given, shows the mode a click switches to. */
export function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  if (!button) return;
  const toLight = theme === 'dark';
  button.innerHTML = toLight ? ICONS.sun : ICONS.moon;
  button.title = toLight ? '切到白天模式' : '切到夜间模式';
  button.setAttribute('aria-label', button.title);
}

/* ---------- sound: synthesized with Web Audio, no files ---------- */
export function createSfx({ storageKey = 'cortico-pet.sound.v1', volume = .55 } = {}) {
  let ctx = null, master = null, unlocked = false, on = true, noiseBuf = null, gainValue = volume;
  try { on = localStorage.getItem(storageKey) !== 'off'; } catch (e) { /* default on */ }
  const R = (a, b) => a + Math.random() * (b - a);
  function ready() {
    if (!on || !unlocked || document.hidden) return null;
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain(); master.gain.value = gainValue;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone({ type = 'sine', f0 = 440, f1 = f0, dur = .1, vol = .2, at = 0, attack = .005, vib = 0, vibRate = 0, filter = 0 }) {
    const c = ready(); if (!c) return;
    const t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibRate; lg.gain.value = vib;
      l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + .05);
    }
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    let node = o;
    if (filter) { const bq = c.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = filter; o.connect(bq); node = bq; }
    node.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .03);
  }
  function noise({ type = 'bandpass', f0 = 1000, f1 = f0, q = 1, dur = .2, vol = .15, at = 0, attack = .01 }) {
    const c = ready(); if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + at, s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; bq.type = type; bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t0);
    bq.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(bq); bq.connect(g); g.connect(master);
    s.start(t0, Math.random() * .5); s.stop(t0 + dur + .03);
  }
  const api = {
    unlock() { unlocked = true; ready(); },
    isOn: () => on,
    set(v) { on = v; try { localStorage.setItem(storageKey, v ? 'on' : 'off'); } catch (e) { /* not persisted */ } },
    volume(v) { gainValue = v; if (master) master.gain.value = v; },
    step(run, i) {
      const k = run ? 1.25 : 1;
      tone({ f0: (i ? 520 : 440) * k, f1: (i ? 380 : 330) * k, dur: .06, vol: run ? .07 : .05 });
      if (run) noise({ f0: 2500, q: .8, dur: .05, vol: .03 });
    },
    skid() { noise({ type: 'highpass', f0: 1800, f1: 900, dur: .22, vol: .08 }); },
    jump() { tone({ type: 'triangle', f0: 200, f1: 720, dur: .24, vol: .22, vib: 40, vibRate: 22 }); },
    land(hard) {
      tone({ f0: hard ? 160 : 190, f1: 48, dur: hard ? .28 : .16, vol: hard ? .4 : .25 });
      noise({ type: 'lowpass', f0: hard ? 700 : 500, f1: 120, dur: .12, vol: hard ? .25 : .12 });
      if (hard) tone({ type: 'square', f0: 420, f1: 300, dur: .08, vol: .06, at: .02, filter: 1600 });
    },
    grab() { tone({ type: 'triangle', f0: 680, f1: 1500, dur: .14, vol: .18, vib: 60, vibRate: 30 }); },
    squeak() { tone({ type: 'triangle', f0: R(900, 1200), f1: R(1300, 1700), dur: .09, vol: .08, vib: 40, vibRate: 35 }); },
    whoosh() { noise({ f0: 300, f1: 2400, q: 1.4, dur: .38, vol: .22, attack: .08 }); },
    chirps() { for (let i = 0; i < 3; i++) tone({ f0: 2300 + i * 120, f1: 3200, dur: .06, vol: .06, at: i * .11 }); },
    shake() { for (let i = 0; i < 5; i++) tone({ type: 'square', f0: 180, f1: 160, dur: .05, vol: .05, at: i * .06, filter: 900 }); },
    hmm() { tone({ type: 'triangle', f0: 330, f1: 360, dur: .12, vol: .08 }); tone({ type: 'triangle', f0: 392, f1: 470, dur: .16, vol: .08, at: .14 }); },
    yawn() { tone({ type: 'triangle', f0: 520, f1: 240, dur: 1, vol: .1, vib: 12, vibRate: 5, filter: 1500, attack: .15 }); },
    snore() { noise({ type: 'lowpass', f0: 250, f1: 700, dur: .7, vol: .09, attack: .35 }); },
    purr() { tone({ type: 'sawtooth', f0: 62, f1: 58, dur: .9, vol: .08, vib: 6, vibRate: 24, filter: 320, attack: .1 }); },
    poke() { tone({ f0: 320, f1: 200, dur: .09, vol: .16 }); },
    nod() { tone({ type: 'triangle', f0: 520, f1: 440, dur: .07, vol: .08 }); tone({ type: 'triangle', f0: 520, f1: 440, dur: .07, vol: .08, at: .2 }); },
    spin() { tone({ type: 'triangle', f0: 300, f1: 1200, dur: .3, vol: .12, vib: 30, vibRate: 18 }); },
    happy() { tone({ type: 'triangle', f0: 660, f1: 700, dur: .1, vol: .14 }); tone({ type: 'triangle', f0: 990, f1: 1050, dur: .14, vol: .14, at: .09 }); },
    wink() { tone({ f0: 1760, dur: .5, vol: .1 }); tone({ f0: 2637, dur: .45, vol: .06, at: .04 }); },
    love() { tone({ f0: 480, f1: 820, dur: .1, vol: .14 }); tone({ f0: 600, f1: 1000, dur: .12, vol: .14, at: .13 }); },
    surprised() { tone({ f0: 380, f1: 1500, dur: .2, vol: .16, vib: 15, vibRate: 12 }); },
    angry() { tone({ type: 'sawtooth', f0: 120, f1: 95, dur: .5, vol: .12, vib: 12, vibRate: 14, filter: 700 }); },
    sad() { tone({ type: 'triangle', f0: 440, f1: 392, dur: .3, vol: .13, vib: 8, vibRate: 6 }); tone({ type: 'triangle', f0: 392, f1: 262, dur: .55, vol: .13, at: .3, vib: 10, vibRate: 5 }); },
    shy() { tone({ f0: 1300, f1: 1600, dur: .07, vol: .07 }); tone({ f0: 1450, f1: 1750, dur: .07, vol: .06, at: .1 }); },
    expr(n) {
      const m = { happy: 'happy', wink: 'wink', love: 'love', surprised: 'surprised', angry: 'angry', sad: 'sad', shy: 'shy', sleepy: 'yawn' };
      if (m[n]) api[m[n]]();
    },
    tick() { tone({ f0: 1200, f1: 1000, dur: .03, vol: .05 }); },
    pop() { tone({ f0: 240, f1: 720, dur: .07, vol: .14 }); },
    sparkle() { [1568, 2093, 2637].forEach((fr, i) => tone({ f0: fr, dur: .25, vol: .06, at: i * .06 })); },
    select() { tone({ type: 'triangle', f0: 520, f1: 1040, dur: .1, vol: .12 }); },
    babble(ch) {
      const fr = 330 + (ch.codePointAt(0) % 9) * 28;
      tone({ type: 'square', f0: fr, f1: fr * R(.85, 1.1), dur: .05, vol: .05, filter: 1800 });
    },
    blub() { tone({ f0: R(500, 700), f1: R(900, 1200), dur: .05, vol: .05 }); },
    listenStart() { tone({ f0: 880, dur: .12, vol: .1 }); tone({ f0: 1320, dur: .16, vol: .1, at: .1 }); },
    listenEnd() { tone({ f0: 1320, dur: .1, vol: .09 }); tone({ f0: 990, dur: .16, vol: .09, at: .09 }); },
  };
  return api;
}

/* ---------- actions the pet can be asked to do ---------- */
/** Expressions: a face held for a few seconds. */
export const EXPRESSIONS = ['neutral', 'happy', 'wink', 'love', 'shy', 'surprised', 'angry', 'sad', 'sleepy', 'thinking'];
/** Motions: things the body does. `sit` and `sleep` last until something else happens. */
export const MOTIONS = ['stand', 'jump', 'hop', 'look', 'turn', 'nod', 'shake', 'spin', 'sit', 'sleep', 'dizzy', 'walk', 'run'];

/* ---------- the live pet: simulation, rendering, pointer ---------- */
/**
 * `els`: { svg, petG, shadowEl, fxG } inside a stage element that receives pointer events.
 * `opts.bounds()` returns { W, H, floorY, S } in stage pixels.
 * `opts.onEvent(kind, detail)` reports what happened to the body: arrived, interrupted, touch, mode.
 * `opts.enter: 'drop'` starts the pet above the top edge, falling to the floor.
 * `opts.figure`, when given, draws the body instead of the built-in one: `figure.draw(petG, face, frame)` keeps
 * its own elements inside `petG` (same logo space, feet at y=256). Its frame adds the face's name, the mode,
 * how long the mode has run, the talk level, drowsiness and how far the body sits.
 * `figure.groupTilt(mode, tilt, lean)`, if present, returns the rotation (degrees) the whole group gets
 * instead of tilt + lean; the frame carries tilt, lean and that rotation (groupRot) so the figure can bend the rest.
 * `figure.colors.z`, if present, colours the sleep z's (otherwise they take the skin's eye colour).
 */
export function createPet(els, opts) {
  const { petG, shadowEl, fxG } = els;
  let custom = opts.figure || null;
  const sfx = opts.sfx;
  const onEvent = opts.onEvent || (() => {});
  let W = 0, H = 0, floorY = 0, S = .42, T = 0;
  let roam = opts.roam ?? 'free';
  let skin = opts.skin || defaultSkin();
  let hold = 0; // until T: an order from outside is in progress, free roaming waits
  const pet = {
    x: 260, fy: 0, vx: 0, vy: 0, facing: 1, faceVis: 1, mode: 'idle', modeT: 0, dur: 0, target: 0,
    speed: 0, stride: 0, lift: 0, bob: 0, phase: 0, lastHalf: 0, lean: 0, tilt: 0, tiltV: 0,
    sq: 0, sqv: 0, sitK: 0, stretch: 0, low: 0, gap: [50, 50], look: [0, 0], drowse: 0,
    feet: STAND.map(l => [l[2], l[3]]), blinkT: 1.5, blinkAge: 9, expr: null, exprUntil: 0,
    nextAt: 1.2, emitAt: 0, airKind: 'jump', turned: false, startle: false, lastAct: '',
    turnAcc: 0, dx: 0, dy: 0, jumpV: 700, jumpVx: 0, xf: null, blushK: 0,
    eyeSig: '', eyeCur: null, eyePrev: null, eyeDims: [[16, 16, 0, 0], [16, 16, 0, 0]], swapAge: 9,
    glance: [0, 0], glanceAt: 0, swing: 0, swingV: 0, prevA: null, velX: 0, talkK: 0, sfxAt: 0, skid: false, cue: 0,
    pulse: null, walkId: 0, listening: false, thinking: false, placed: false,
  };
  const pointer = { x: -1e4, y: -1e4, inside: false, vx: 0, samples: [] };
  let press = null, strokeAcc = 0, petCool = 0;
  const P = [];

  // points on the body in logo units: where the eyes look from, where tears, z's and hearts start, the bubble's spot
  const COO_ANCHORS = { gaze: [140, 117], tear: [166, 136], z: [196, 40], hearts: [90, 175, 34], bubble: [146, 0] };
  let A = { ...COO_ANCHORS, ...custom?.anchors };
  const minX = () => 104 * S + 8, maxX = () => W - 104 * S - 8;

  function resize() {
    const b = opts.bounds();
    W = b.W; H = b.H; floorY = b.floorY; S = b.S;
    if (!pet.placed && W > 0) {
      pet.x = opts.startX != null ? opts.startX : W * .7; pet.placed = true;
      if (opts.enter === 'drop') { pet.fy = -8; pet.vy = 0; pet.vx = 0; pet.airKind = 'drop'; setMode('air'); }
    }
    pet.x = clamp(pet.x, minX(), maxX());
    pet.target = clamp(pet.target, minX(), maxX());
    if (pet.mode !== 'air' && pet.mode !== 'drag') pet.fy = floorY;
  }

  function toStage(lx, ly) {
    const c = pet.xf;
    if (!c) return { x: pet.x, y: floorY };
    const x = (lx - c.ax) * c.kx, y = (ly - c.ay) * c.ky, r = c.rot * Math.PI / 180;
    return { x: c.AX + x * Math.cos(r) - y * Math.sin(r), y: c.AY + x * Math.sin(r) + y * Math.cos(r) };
  }
  function hitPet(p) {
    const c = toStage(128, 128);
    return Math.hypot(p.x - c.x, p.y - c.y) < 108 * S;
  }

  function setMode(m, o = {}) {
    const prev = pet.mode;
    if ((prev === 'walk' || prev === 'run') && m !== 'idle' && pet.walkId) {
      onEvent('interrupted', { walkId: pet.walkId, x: Math.round(pet.x), by: m });
      pet.walkId = 0;
    }
    pet.mode = m; pet.modeT = 0; pet.turned = false; pet.startle = false; pet.skid = false; pet.cue = 0;
    Object.assign(pet, o);
    if (prev !== m) onEvent('mode', { mode: m });
  }
  const busy = () => pet.mode === 'drag' || pet.mode === 'air' || pet.mode === 'crouch';
  function pickTarget(minDist) {
    for (let i = 0; i < 12; i++) {
      const x = rnd(minX(), maxX());
      if (Math.abs(x - pet.x) > minDist) return x;
    }
    return pet.x - minX() > maxX() - pet.x ? minX() : maxX();
  }

  /** Runs a motion. Returns false when the body cannot take it now (in the air, being dragged). */
  function act(a) {
    if (busy()) return false;
    pet.expr = null; pet.lastAct = a;
    const seated = pet.mode === 'sleep' || pet.mode === 'sit';
    switch (a) {
      case 'stand': setMode(seated ? 'wake' : 'idle', seated ? { startle: false } : {}); pet.nextAt = T + 3; break;
      case 'walk': setMode('walk', { target: pickTarget(160) }); break;
      case 'run': setMode('run', { target: pet.x < W / 2 ? maxX() - rnd(0, 30) : minX() + rnd(0, 30) }); break;
      case 'jump': setMode('crouch', { jumpV: 720, jumpVx: pet.facing * 40 }); break;
      case 'hop': setMode('crouch', { jumpV: 480, jumpVx: 0 }); break;
      case 'look': setMode('look'); break;
      case 'turn': if (!seated) setMode('idle'); pet.facing *= -1; sfx.tick(); break;
      case 'nod': pulse('nod', .7); sfx.nod(); break;
      case 'shake': pulse('shake', .7); sfx.shake(); break;
      case 'spin': if (!seated) setMode('idle'); pulse('spin', .6); sfx.spin(); break;
      case 'sit': setMode('sit', { dur: 1e9 }); break;
      case 'sleep': setMode('sleep', { dur: 1e9 }); break;
      case 'dizzy': setMode('dizzy'); break;
      default: return false;
    }
    return true;
  }
  function pulse(kind, dur) { pet.pulse = { kind, t0: T, dur }; }

  function setExpr(n, seconds) {
    if (n === 'sleep') { act('sleep'); return; }
    if (busy()) return;
    if (n === 'dragged') {
      pet.expr = null;
      pet.vy = -1150; pet.vx = rnd(-120, 120); pet.airKind = 'throw'; pet.sqv -= 3;
      sfx.whoosh(); sfx.jump();
      setMode('air'); return;
    }
    if (n === 'dizzy') { pet.expr = null; setMode('dizzy'); return; }
    if (pet.mode === 'look' || pet.mode === 'land') setMode('idle');
    pet.expr = n; pet.exprUntil = T + (seconds ?? (n === 'sleepy' ? 4.4 : 3.2));
    pet.nextAt = Math.max(pet.nextAt, pet.exprUntil + .6);
    pet.sqv += n === 'surprised' ? -2.2 : .8;
    sfx.expr(n);
    if (n === 'love') for (let i = 0; i < 4; i++) emitHeart();
  }

  /** Walks (or runs) to stage x. Resolves the walk through onEvent('arrived' | 'interrupted'). */
  function walkTo(x, run, walkId) {
    if (busy()) return false;
    if (pet.mode === 'sleep' || pet.mode === 'sit') setMode('wake', { startle: true });
    const target = clamp(x, minX(), maxX());
    pet.expr = null;
    if (Math.abs(target - pet.x) < 2) { onEvent('arrived', { walkId, x: Math.round(pet.x) }); return true; }
    setMode(run ? 'run' : 'walk', { target, walkId });
    return true;
  }

  function faceName() {
    const m = pet.mode;
    if (m === 'drag') return 'dragged';
    if (m === 'air' && pet.airKind === 'throw') return pet.vy < 0 ? 'dragged' : 'surprised';
    if (m === 'air' && pet.airKind === 'drop') return 'surprised';
    if (m === 'dizzy') return pet.modeT < 2.4 ? 'dizzy' : 'squeeze';
    if (m === 'wake') return pet.startle ? 'surprised' : 'waking';
    if (pet.listening && m !== 'sleep') return 'listening';
    if (m === 'sleep') return 'sleep';
    if (pet.expr && T < pet.exprUntil) return pet.expr;
    if (pet.thinking) return 'thinking';
    if (m === 'sit') return 'content';
    if (m === 'run') return 'run';
    return 'neutral';
  }

  function decide() {
    const calm = roam === 'calm';
    const opts2 = [['walk', calm ? 10 : 28], ['run', calm ? 0 : 12], ['look', 14], ['jump', calm ? 2 : 8], ['sit', 16], ['expr', 12], ['wait', calm ? 30 : 10]]
      .filter(o => o[1] > 0 && (o[0] !== pet.lastAct || o[0] === 'wait'));
    let r = Math.random() * opts2.reduce((a, o) => a + o[1], 0), pick = 'wait';
    for (const o of opts2) { if ((r -= o[1]) < 0) { pick = o[0]; break; } }
    if (pick === 'look') { setMode('look'); pet.lastAct = 'look'; }
    else if (pick === 'expr') { setExpr(['happy', 'wink', 'love', 'sleepy', 'surprised', 'shy'][Math.floor(Math.random() * 6)]); pet.lastAct = 'expr'; }
    else if (pick === 'sit') { setMode('sit', { dur: rnd(6, 9) }); pet.lastAct = 'sit'; }
    else if (pick !== 'wait') act(pick);
    if (pet.mode === 'idle' && T >= pet.nextAt) pet.nextAt = T + rnd(2, 4);
  }

  /* particles */
  function emit(type, p, o = {}) { P.push({ type, x: p.x, y: p.y, vx: 0, vy: 0, age: 0, life: 1, ...o }); }
  function emitHeart() {
    emit('heart', toStage(rnd(A.hearts[0], A.hearts[1]), A.hearts[2] + pet.low), { vx: rnd(-20, 20), vy: rnd(-70, -45), life: 1.6 });
  }
  function dustAt(lx, n, spread) {
    for (let i = 0; i < n; i++) {
      emit('dust', toStage(lx, 250), { vx: rnd(-spread, spread) - pet.facing * rnd(10, 40), vy: rnd(-30, -8), life: rnd(.4, .65) });
    }
  }

  function step(dt) {
    T += dt; pet.modeT += dt;
    const m = pet.mode, mt = pet.modeT;
    let sqT = 0, strideT = 0, liftT = 0, leanT = 0, sitT = 0, bobT = 0, rate = 0, lookT = [0, 0], tiltT = 0;
    let tk = 160, tc = 12, drowseT = 0;
    const free = roam !== 'off' && T > hold && !opts.dialogOpen?.();

    pet.blinkT -= dt; pet.blinkAge += dt;
    if (pet.blinkT <= 0) { pet.blinkAge = 0; pet.blinkT = Math.random() < .2 ? .28 : rnd(2.2, 5.2); }

    const head = toStage(A.gaze[0], A.gaze[1]);
    const pdx = pointer.x - head.x, pdy = pointer.y - head.y, pm = Math.hypot(pdx, pdy) || 1;
    const track = () => {
      if (!pointer.inside) {
        if (T > pet.glanceAt) { pet.glance = Math.random() < .45 ? [0, 0] : [rnd(-3, 5), rnd(-3, 3)]; pet.glanceAt = T + rnd(1.2, 3); }
        return pet.glance;
      }
      const k = Math.min(1, pm / 120);
      return [pdx * pet.facing / pm * 5 * k, pdy / pm * 4 * k];
    };

    switch (m) {
      case 'idle': {
        lookT = track();
        if (pointer.inside && !press && pdx * pet.facing < -50 && pm < 600) {
          pet.turnAcc += dt;
          if (pet.turnAcc > .9) { pet.facing *= -1; pet.turnAcc = 0; }
        } else pet.turnAcc = 0;
        if (pet.listening) { lookT = [3, -4]; tiltT = -7; leanT = -2; }
        if (free && !pet.listening && T > pet.nextAt && !(pet.expr && T < pet.exprUntil)) decide();
        break;
      }
      case 'walk': case 'run': {
        const run = m === 'run', d = pet.target - pet.x, dist = Math.abs(d), dir = Math.sign(d) || pet.facing;
        pet.facing = dir;
        const vMax = run ? 250 : 78;
        const vT = Math.min(vMax, run ? dist * 4 + 20 : dist * 3 + 14);
        strideT = run ? 17 : 10; liftT = run ? 15 : 8; bobT = run ? 7 : 3; rate = run ? 4.4 : 2.1;
        leanT = run ? (dist < 50 && pet.speed > 120 ? -6 : 11) : 4;
        if (leanT < 0 && !pet.skid) { pet.skid = true; sfx.skid(); }
        const ramp = Math.min(1, mt / (run ? .35 : .25));
        pet.speed = lerp(pet.speed, vT * smooth(ramp), ease(run ? 6 : 9, dt));
        pet.x += dir * Math.min(dist, pet.speed * dt);
        const k = clamp(pet.speed / vMax, 0, 1);
        strideT *= .4 + .6 * k; liftT *= .4 + .6 * k;
        pet.phase += Math.PI * 2 * rate * dt * Math.max(.35, k);
        lookT = [run ? 4 : 3, run ? 1 : 0];
        const half = Math.floor(pet.phase / Math.PI);
        if (half !== pet.lastHalf) {
          sfx.step(run, half & 1);
          if (run && pet.speed > 120) dustAt(128, dist < 50 ? 3 : 1, 20);
        }
        pet.lastHalf = half;
        if (dist < 1.5) {
          pet.speed = 0;
          const id = pet.walkId; pet.walkId = 0;
          setMode('idle'); pet.nextAt = T + rnd(1.2, 3.2);
          if (id) onEvent('arrived', { walkId: id, x: Math.round(pet.x) });
        }
        break;
      }
      case 'look': {
        if (!pet.cue) { pet.cue = 1; sfx.hmm(); }
        if (mt < .9) lookT = [4, -4];
        else if (mt < 1.8) { if (!pet.turned) { pet.turned = true; pet.facing *= -1; } lookT = [5, 0]; }
        else if (mt < 2.6) lookT = [1, 4];
        else { setMode('idle'); pet.nextAt = T + rnd(1, 2.5); }
        break;
      }
      case 'sit': {
        sitT = 1;
        lookT = track().map(v => v * (1 - pet.drowse));
        if (pet.listening) { lookT = [3, -4]; tiltT = -7; }
        drowseT = clamp((mt - 1.5) / Math.max(1, Math.min(pet.dur, 60) - 1.5), 0, free ? 1 : .45);
        if (pet.drowse > .5) leanT = 7 * pet.drowse * Math.pow(Math.max(0, Math.sin(T * 1.3)), 6);
        if (free && mt > pet.dur) {
          if (Math.random() < .6) setMode('sleep', { dur: rnd(8, 12) });
          else { setMode('idle'); pet.sqv -= 1.2; pet.nextAt = T + rnd(1.5, 3); }
        }
        break;
      }
      case 'sleep': {
        sitT = 1; drowseT = 1; leanT = 5;
        if (free && mt > pet.dur) setMode('wake');
        break;
      }
      case 'wake': {
        if (pet.startle) {
          sitT = 0; lookT = [3, -2];
          if (mt > .9) { setMode('idle'); pet.nextAt = T + rnd(1.5, 3); }
        } else {
          sitT = mt < 1.1 ? 1 : 0;
          if (mt > .5 && !pet.cue) { pet.cue = 1; sfx.yawn(); }
          sqT = mt > .5 && mt < 1.3 ? -.1 : 0;
          leanT = mt < .5 ? 5 : mt < 1.2 ? -5 : 0;
          lookT = mt > 1.2 ? track() : [0, 0];
          if (mt > 1.8) { setMode('idle'); pet.nextAt = T + rnd(1, 2); }
        }
        break;
      }
      case 'crouch': {
        sqT = .24; sitT = .3;
        if (mt > .16) {
          pet.vy = -pet.jumpV; pet.vx = pet.jumpVx; pet.airKind = 'jump'; pet.sqv -= 2.6;
          sfx.jump();
          setMode('air');
        }
        break;
      }
      case 'air': {
        pet.vy += 2300 * dt;
        pet.vx *= Math.exp(-dt * .4);
        pet.x += pet.vx * dt; pet.fy += pet.vy * dt;
        if (pet.x < minX()) { pet.x = minX(); pet.vx = Math.abs(pet.vx) * .55; pet.sqv += .6; }
        if (pet.x > maxX()) { pet.x = maxX(); pet.vx = -Math.abs(pet.vx) * .55; pet.sqv += .6; }
        if (pet.fy - 250 * S < 0 && pet.vy < 0) { pet.fy = 250 * S; pet.vy = Math.abs(pet.vy) * .3; }
        sqT = -Math.min(.12, Math.abs(pet.vy) / 6000);
        tiltT = clamp(pet.vx * .025, -30, 30);
        tk = 70; tc = 8;
        if (pet.fy >= floorY && pet.vy > 0) land();
        break;
      }
      case 'land': {
        sitT = .35 * (1 - smooth(clamp(mt / .35, 0, 1)));
        lookT = [2, 2];
        if (mt > .4) setMode('idle');
        break;
      }
      case 'dizzy': {
        sitT = mt < 2.6 ? 1 : 0;
        if (mt < 2.4 && T > pet.sfxAt) { sfx.chirps(); pet.sfxAt = T + .9; }
        if (mt >= 2.4 && !pet.cue) { pet.cue = 1; sfx.shake(); }
        if (mt < 2.4) tiltT = 8 * Math.sin(T * 4.5) * Math.min(1, mt * 2);
        else if (mt < 3) { const k = (mt - 2.4) / .6; tiltT = 12 * Math.sin(mt * 34) * (1 - k); }
        else { setMode('idle'); pet.sqv -= 1; pet.nextAt = T + rnd(1.5, 3); }
        break;
      }
      case 'drag': {
        pet.dx = lerp(pet.dx, pointer.x, ease(28, dt));
        pet.dy = lerp(pet.dy, Math.min(pointer.y, floorY - 245 * S), ease(28, dt));
        tiltT = clamp(pointer.vx * .035, -40, 40); tk = 90; tc = 5;
        if (Math.abs(pointer.vx) > 500 && T > pet.sfxAt) { sfx.squeak(); pet.sfxAt = T + rnd(.4, .7); }
        break;
      }
    }

    // short gestures layered over whatever the body is doing
    if (pet.pulse) {
      const k = (T - pet.pulse.t0) / pet.pulse.dur;
      if (k >= 1) pet.pulse = null;
      else if (pet.pulse.kind === 'nod') leanT += 9 * Math.abs(Math.sin(k * Math.PI * 2));
      else if (pet.pulse.kind === 'shake') tiltT += 10 * Math.sin(k * Math.PI * 6) * (1 - k);
      else if (pet.pulse.kind === 'spin' && k > .5 && !pet.pulse.flipped) { pet.pulse.flipped = true; pet.facing *= -1; }
      else if (pet.pulse.kind === 'spin' && k < .5 && !pet.pulse.first) { pet.pulse.first = true; pet.facing *= -1; pet.sqv -= 1; }
    }

    const fname = faceName(), fc = FACES[fname].f(T, pet);
    if (fc.lookLock || pet.mode === 'sleep' || pet.mode === 'drag') lookT = [0, 0];

    // eye shape changes hide under a quick blink; same-shape changes (ring size) ease
    const sig = fc.eyes.map(e => e.shape).join();
    if (sig !== pet.eyeSig) {
      if (pet.eyeCur) { pet.eyePrev = pet.eyeCur; pet.swapAge = 0; }
      pet.eyeSig = sig;
      fc.eyes.forEach((e, i) => { pet.eyeDims[i] = [e.rx ?? 16, e.ry ?? 16, e.dx || 0, e.dy || 0]; });
    }
    pet.swapAge += dt;
    pet.eyeCur = fc.eyes.map((e, i) => {
      if (e.shape !== 'ring' && e.shape !== 'lid') return e;
      const d = pet.eyeDims[i], tgt = [e.rx ?? 16, e.ry ?? 16, e.dx || 0, e.dy || 0];
      for (let j = 0; j < 4; j++) d[j] = lerp(d[j], tgt[j], ease(16, dt));
      return { ...e, rx: d[0], ry: d[1], dx: d[2], dy: d[3] };
    });
    pet.blushK = lerp(pet.blushK, fc.blush || 0, ease(6, dt));

    // springs & easing
    pet.sqv += ((sqT - pet.sq) * 280 - pet.sqv * 14) * dt;
    pet.sq = clamp(pet.sq + pet.sqv * dt, -.35, .45);
    pet.tiltV += ((tiltT - pet.tilt) * tk - pet.tiltV * tc) * dt;
    pet.tilt += pet.tiltV * dt;
    pet.lean = lerp(pet.lean, leanT, ease(7, dt));
    pet.sitK = lerp(pet.sitK, sitT, ease(m === 'land' ? 18 : 6, dt));
    pet.drowse = lerp(pet.drowse, drowseT, ease(m === 'sit' || m === 'sleep' ? 1.5 : 6, dt));
    pet.stretch = lerp(pet.stretch, m === 'drag' ? 1 : 0, ease(8, dt));
    pet.stride = lerp(pet.stride, strideT, ease(10, dt));
    pet.lift = lerp(pet.lift, liftT, ease(10, dt));
    pet.bob = lerp(pet.bob, bobT, ease(10, dt));
    pet.look[0] = lerp(pet.look[0], lookT[0], ease(9, dt));
    pet.look[1] = lerp(pet.look[1], lookT[1], ease(9, dt));
    pet.gap[0] = lerp(pet.gap[0], fc.gap[0], ease(8, dt));
    pet.gap[1] = lerp(pet.gap[1], fc.gap[1], ease(8, dt));
    // turning reads as a quick card flip rather than a mirror snap
    pet.faceVis = lerp(pet.faceVis, pet.facing, ease(15, dt));
    if (m !== 'walk' && m !== 'run') pet.phase = lerp(pet.phase, Math.round(pet.phase / Math.PI) * Math.PI, ease(6, dt));
    pointer.vx *= Math.exp(-dt * 6);

    // secondary motion for ears/antenna/scarf: lags behind horizontal movement
    const AX = pet.mode === 'drag' ? pet.dx : pet.x;
    if (pet.prevA != null) pet.velX = lerp(pet.velX, (AX - pet.prevA) / dt, .25);
    pet.prevA = AX;
    const swingT = clamp(-pet.velX * .06 * Math.sign(pet.faceVis || 1), -28, 28);
    pet.swingV += ((swingT - pet.swing) * 110 - pet.swingV * 7) * dt;
    pet.swing = clamp(pet.swing + pet.swingV * dt, -40, 40);

    pet.low = pet.sitK * 29 + pet.bob * Math.abs(Math.sin(pet.phase));
    pet.feet.forEach((ft, i) => {
      const hx = HIPS[i][0], hy = HIPS[i][1] + pet.low;
      let tx, ty;
      if (m === 'drag') { tx = hx + 7 * Math.sin(T * 11 + i * 2.2); ty = hy + 36; }
      else if (m === 'air') { tx = hx + (i ? 9 : -9); ty = hy + 33; }
      else {
        const ph = pet.phase + i * Math.PI;
        const sx = hx + pet.stride * Math.sin(ph), sy = FOOT_Y - pet.lift * Math.max(0, Math.cos(ph));
        tx = lerp(sx, hx + 26, pet.sitK); ty = lerp(sy, FOOT_Y, pet.sitK);
      }
      const r = m === 'drag' || m === 'air' ? 14 : 40;
      ft[0] = lerp(ft[0], tx, ease(r, dt)); ft[1] = lerp(ft[1], ty, ease(r, dt));
    });

    if (fc.emit && T > pet.emitAt) {
      if (fc.emit === 'heart') { emitHeart(); pet.emitAt = T + .45; }
      if (fc.emit === 'z') { emit('z', toStage(A.z[0], A.z[1] + pet.low), { vx: pet.facing * 16, vy: -26, life: 2.4 }); pet.emitAt = T + 1.3; sfx.snore(); }
      if (fc.emit === 'tear') { emit('drop', toStage(A.tear[0] + pet.look[0], A.tear[1] + pet.low), { vx: pet.facing * rnd(10, 30), vy: -20, life: 3 }); pet.emitAt = T + .8; }
    }
    strokeAcc *= Math.exp(-dt * 1.5);
    petCool -= dt;

    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'drop') { p.vy += 900 * dt; if (p.y > floorY) p.age = p.life; }
      if (p.type === 'dust') p.vx *= Math.exp(-dt * 4);
      if (p.age >= p.life) P.splice(i, 1);
    }
    pet.talkK *= Math.exp(-dt * 12);
    pet._fc = fc; pet._fname = fname;
  }

  function land() {
    const impact = pet.vy, kind = pet.airKind;
    pet.fy = floorY; pet.vy = 0; pet.vx = 0;
    pet.sqv += clamp(impact * .0024, .8, 4.5);
    sfx.land(kind !== 'jump' && impact > 1000);
    dustAt(128, impact > 900 ? 7 : 3, 70);
    if (kind === 'throw' && impact > 1000) { setMode('dizzy'); onEvent('touch', { kind: 'crash' }); return; }
    setMode('land');
    if (kind === 'throw') { pet.expr = 'surprised'; pet.exprUntil = T + .9; pet.nextAt = T + 2; }
    else if (kind === 'drop') { pet.expr = 'happy'; pet.exprUntil = T + 1.6; pet.nextAt = T + 2.6; }
    else pet.nextAt = T + rnd(.8, 2);
  }

  function render() {
    const fc = pet._fc || FACES.neutral.f(0), fname = pet._fname || 'neutral';
    const drag = pet.mode === 'drag';
    const br = Math.sin(T * (pet.mode === 'sleep' ? 1.7 : 2.4));
    const sx = (1 + pet.sq * .7) * (1 - .05 * pet.stretch) * (1 - .009 * br);
    const sy = (1 - pet.sq) * (1 + .09 * pet.stretch) * (1 + .016 * br);
    const ax = 128, ay = drag ? 36 : 256;
    let AX = drag ? pet.dx : pet.x, AY = drag ? pet.dy : pet.fy;
    if (fc.shake) AX += Math.sin(T * 60) * 1.4;
    // a custom figure may keep tilt and lean off the whole group and bend its own parts instead
    const kx = S * pet.faceVis * sx, ky = S * sy, lean = pet.lean * pet.faceVis;
    const rot = custom?.groupTilt ? custom.groupTilt(pet.mode, pet.tilt, lean) : pet.tilt + lean;
    pet.xf = { AX, AY, ax, ay, kx, ky, rot };
    petG.setAttribute('transform', `translate(${f(AX)} ${f(AY)}) rotate(${f(rot)}) scale(${kx.toFixed(4)} ${ky.toFixed(4)}) translate(${-ax} ${-ay})`);

    const legs = pet.feet.map((ft, i) => [HIPS[i][0], HIPS[i][1] + pet.low, ft[0], ft[1]]);
    const blink = pet.blinkAge < .16 ? Math.sin(Math.PI * pet.blinkAge / .16) : 0;
    let eyes = pet.eyeCur || fc.eyes, eyeClose = 0;
    if (pet.swapAge < .07 && pet.eyePrev) { eyes = pet.eyePrev; eyeClose = pet.swapAge / .07; }
    else if (pet.swapAge < .16) eyeClose = 1 - (pet.swapAge - .07) / .09;
    const face = { ...fc, eyes, gap: pet.gap.map(g => Math.min(64, g + pet.talkK * 12)), blush: pet.blushK };
    const frame = { look: pet.look, legs, low: pet.low, t: T, blink, eyeClose, acc: skin, swing: pet.swing };
    if (custom) custom.draw(petG, face, { ...frame, face: fname, mode: pet.mode, modeT: pet.modeT, talk: pet.talkK, drowse: pet.drowse, sit: pet.sitK, facing: pet.faceVis, tilt: pet.tilt, lean, groupRot: rot });
    else petG.textContent = ''; 

    const footY = drag ? pet.dy + 220 * S * 1.09 : pet.fy;
    const k = clamp(1 - (floorY - footY) / 420, .3, 1);
    shadowEl.setAttribute('cx', f(AX)); shadowEl.setAttribute('cy', f(floorY - 2));
    shadowEl.setAttribute('rx', f(72 * S * k * (1 + pet.sq * .5))); shadowEl.setAttribute('ry', f(10 * S * k + 1));
    shadowEl.setAttribute('opacity', f(k));

    let s = '';
    const sc = S / .48;
    // sleep z's take the eye colour, or the custom figure's own colour for them
    const zPaint = custom?.colors?.z ? `stroke="${custom.colors.z}"` : 'class="eye"';
    for (const p of P) {
      const a = p.age / p.life;
      if (p.type === 'z') {
        const op = a < .15 ? a / .15 : 1 - (a - .15) / .85, z = (.7 + .9 * a) * sc;
        s += `<path ${zPaint} fill="none" stroke-width="${f(3 / z)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f(op)}" transform="translate(${f(p.x + Math.sin(p.age * 2.5) * 6)} ${f(p.y)}) scale(${f(z)})" d="M-6 -7H6L-6 7H6"/>`;
      } else if (p.type === 'heart') {
        s += `<path class="p-heart" fill="none" stroke-width="5" stroke-linejoin="round" opacity="${f(1 - a * a)}" transform="translate(${f(p.x + Math.sin(p.age * 4) * 5)} ${f(p.y)}) scale(${f((.45 + .35 * a) * sc)})" d="${heartD(0, 0, 1)}"/>`;
      } else if (p.type === 'dust') {
        s += `<circle class="p-dust" fill="none" stroke-width="2" cx="${f(p.x)}" cy="${f(p.y)}" r="${f((3 + 8 * a) * sc)}" opacity="${f(.7 * (1 - a))}"/>`;
      } else if (p.type === 'drop') {
        s += `<path class="tearf" transform="translate(${f(p.x)} ${f(p.y)}) scale(${f(.9 * sc)})" d="${DROP}"/>`;
      }
    }
    fxG.innerHTML = s;
    return fname;
  }

  /* pointer: stage-pixel coordinates */
  function velocity() {
    const s = pointer.samples;
    if (s.length < 2) return { x: 0, y: 0 };
    const a = s[0], b = s[s.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
  function pointerDown(p) {
    Object.assign(pointer, p, { inside: true });
    if (!hitPet(p) || pet.mode === 'air') return false;
    press = { x: p.x, y: p.y, t: performance.now() };
    pointer.samples = [{ t: performance.now(), x: p.x, y: p.y }];
    return true;
  }
  /** Returns the cursor the stage should show. */
  function pointerMove(p) {
    const now = performance.now();
    const ddx = p.x - pointer.x, ddy = p.y - pointer.y;
    Object.assign(pointer, p, { inside: true });
    pointer.samples.push({ t: now, x: p.x, y: p.y });
    while (pointer.samples.length > 2 && now - pointer.samples[0].t > 110) pointer.samples.shift();
    pointer.vx = lerp(pointer.vx, velocity().x, .35);

    if (press && pet.mode !== 'drag' && Math.hypot(p.x - press.x, p.y - press.y) > 6) {
      const scruff = toStage(128, 36);
      pet.expr = null;
      setMode('drag', { dx: scruff.x, dy: scruff.y });
      sfx.grab();
      pet.sqv -= 1.2; pet.tiltV = 0;
      onEvent('touch', { kind: 'grab' });
    }
    if (press) return 'grabbing';
    const over = hitPet(p);
    if (over && ['idle', 'look', 'sit', 'sleep'].includes(pet.mode)) {
      strokeAcc += Math.hypot(ddx, ddy);
      if (strokeAcc > 320 && petCool <= 0) {
        strokeAcc = 0; petCool = 2.5;
        sfx.purr();
        if (pet.mode === 'sleep') emitHeart();
        else setExpr(Math.random() < .5 ? 'love' : 'shy');
        onEvent('touch', { kind: 'pet', asleep: pet.mode === 'sleep' });
      }
    }
    return over ? 'grab' : '';
  }
  function pointerUp() {
    if (!press) return;
    if (pet.mode === 'drag') {
      // hand over from the scruff anchor to the feet anchor without a visual jump
      const foot = toStage(128, 256);
      const v = velocity();
      pet.x = clamp(foot.x, minX(), maxX());
      pet.fy = Math.min(floorY, foot.y);
      pet.vx = clamp(v.x, -1800, 1800); pet.vy = clamp(v.y, -1800, 1400);
      pet.airKind = 'throw';
      const speed = Math.hypot(v.x, v.y);
      if (speed > 700) sfx.whoosh();
      setMode('air');
      onEvent('touch', { kind: speed > 700 ? 'throw' : 'drop', x: Math.round(pet.x) });
    } else if (performance.now() - press.t < 400) {
      if (pet.mode === 'sleep' || pet.mode === 'sit') {
        const wasAsleep = pet.mode === 'sleep';
        setMode('wake', { startle: true }); pet.sqv -= 2.2; pet.nextAt = T + 2.4;
        sfx.surprised();
        onEvent('touch', { kind: 'poke', woke: wasAsleep });
      } else if (pet.mode !== 'dizzy') {
        sfx.poke();
        const r = ['happy', 'wink', 'surprised', 'love', 'angry'][Math.floor(Math.random() * 5)];
        setExpr(r);
        if (Math.random() < .5 && pet.mode === 'idle') setMode('crouch', { jumpV: 480, jumpVx: 0 });
        onEvent('touch', { kind: 'poke' });
      }
    }
    press = null;
  }
  function pointerLeave() { if (!press) pointer.inside = false; }

  resize();
  return {
    pet, step, render, resize, act, setExpr, walkTo, toStage, hitPet, busy,
    pointerDown, pointerMove, pointerUp, pointerLeave,
    get pressing() { return !!press; },
    get time() { return T; },
    get bounds() { return { W, H, floorY, S, minX: minX(), maxX: maxX() }; },
    setSkin(s) { skin = s; },
    /** Swaps the body's drawing: a custom figure (see `opts.figure`) or null for the built-in Coo. */
    setFigure(fig) {
      if (fig === custom) return;
      custom = fig || null;
      A = { ...COO_ANCHORS, ...custom?.anchors };
      petG.textContent = '';
      render();
    },
    get figure() { return custom; },
    get skin() { return skin; },
    setRoam(r) { roam = r; if (r !== 'off') pet.nextAt = T + 1; },
    get roam() { return roam; },
    /** Outside orders keep free roaming quiet for `seconds`. */
    holdRoam(seconds) { hold = Math.max(hold, T + seconds); },
    talk() { pet.talkK = 1; },
    setListening(on) { pet.listening = on; if (on && (pet.mode === 'walk' || pet.mode === 'run')) setMode('idle'); },
    setThinking(on) { pet.thinking = on; },
    /** Head top in stage pixels, for placing a speech bubble. */
    anchor() { return toStage(A.bubble[0], (custom ? A.bubble[1] : (HEAD_TOP[skin.head] ?? 12) - 8) + pet.low); },
    emitHeart,
  };
}
