/**
 * The DeepSeek whale maid as a pet-core figure: a sprite rig drawn with rig/rig.js.
 *
 * She stands the way Coo does, three-quarters on and facing right; pet-core mirrors the whole
 * group when she turns. pet-core runs the body (walking, jumping, dragging, faces); this file turns
 * each frame it hands over into rig parameters, runs springs for hair, skirt, tail, fins and ahoge,
 * paints the face (eyes, mouth, blush) into a live texture, and draws the rig into a canvas that
 * lives in the pet's own SVG group, so the stage's transform (position, squash, tilt, facing) applies.
 *
 * Every layer was cut from one master drawing, so at rest the parts line up pixel for pixel;
 * what each part hides (the dress under the arm, the hair behind the face, the legs under the
 * skirt) was painted in by edits of that same drawing.
 *
 * Rig space = pet-core's logo space: x=128 under the body, soles at y=256.
 * model.json keeps the master drawing's pixel frame for the face sprites; U/V convert.
 */
import { createRig as createWebGLRig } from '../rig/rig.js';
import { createRig as createCanvasRig } from '../rig/canvas-rig.js';

const f1 = n => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const bump = u => Math.sin(Math.PI * clamp(u, 0, 1));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const SVGNS = 'http://www.w3.org/2000/svg';

// the face texture covers this rect of the master drawing, one texel per master pixel
const FACE = { x: 520, y: 578, w: 390, h: 252 };
// the head's parallax warps act over this rect (rig units); the long hair below it stays put
const HEAD = [30, 12, 215, 168];

/* ---------- springs ---------- */
// `lim` bounds the output: a hard throw may overshoot, the hair must not fold over itself
function spring(k, c, lim = Infinity) {
  return {
    x: 0, v: 0,
    step(target, dt) {
      this.v += ((target - this.x) * k - this.v * c) * dt;
      this.x += this.v * dt;
      if (Math.abs(this.x) > lim) { this.x = Math.sign(this.x) * lim; this.v = 0; }
      return this.x;
    },
  };
}

function loadImage(url) {
  return new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = url; });
}

/**
 * Loads the model and textures; resolves to a figure object for createPet's `opts.figure`.
 * `opts.raster` shows each frame as an SVG <image> copied from the canvas instead of the canvas itself (slower;
 * for pages that are screen-recorded, where a WebGL canvas inside SVG is not always in the capture).
 * `opts.scheme` picks a colour scheme (model.schemes; default the original); `opts.model` (model.json
 * already parsed) and `opts.asset(path)` (a texture's URL) are for pages that bundle the files.
 */
export async function createWhaleFigure(base = new URL('./', import.meta.url), opts = {}) {
  const renderMode = window.petHost?.getRenderMode ? await window.petHost.getRenderMode() : 'webgl2';
  const createRig = renderMode === 'canvas2d' ? createCanvasRig : createWebGLRig;
  const model = opts.model || await (await fetch(new URL('model.json', base))).json();
  const asset = opts.asset || (p => new URL(p, base));
  const { S, X0, FEET } = model.units;
  const U = x => 128 + (x - X0) * S, V = y => 256 - (FEET - y) * S;
  const PV = model.pivots, feat = model.feat;
  const EYES = ['eyeL', 'eyeR'];  // near (left) eye, far (right) eye
  const featNames = [...Object.keys(feat.sprites), ...EYES.flatMap(k => ['lash', 'ball', 'iris', ...(feat.eyes[k].rim ? ['rim'] : [])].map(n => `${k}_${n}`))];
  // a scheme is a set of textures over the same geometry; the original's are at tex/ and feat/
  const SCHEMES = (model.schemes || [{ id: 'deepseek' }]).filter(sc => sc.ready !== false);
  const schemeInfo = id => SCHEMES.find(sc => sc.id === id) || SCHEMES[0];
  // the scheme's accent colours the listening arcs, thought bubbles and sleep z's
  const accent = () => schemeInfo(scheme).accent || '#4d6bfe';
  const loaded = {}, ready = {};
  function loadScheme(id) {
    if (loaded[id]) return loaded[id];
    const dir = id === SCHEMES[0].id ? '' : `schemes/${id}/`;
    const set = { tex: {}, img: {} };
    loaded[id] = Promise.all([
      ...model.parts.map(async p => { set.tex[p.tex] = await loadImage(asset(`${dir}tex/${p.tex}.png`)); }),
      ...featNames.map(async n => { set.img[n] = await loadImage(asset(`${dir}feat/${n}.png`)); }),
    ]).then(() => (ready[id] = set));
    return loaded[id];
  }
  let scheme = schemeInfo(opts.scheme).id;
  let { tex, img } = await loadScheme(scheme);
  const box = Object.fromEntries(model.parts.map(p => [p.id, p.box]));
  const rectOf = id => { const [x, y, w, h] = box[id]; return [x, y, x + w, y + h]; };

  /* deformers: each acts in rest space; parents act after children */
  const deformers = {
    body: { kind: 'rot', pivot: PV.body },
    skirt: { kind: 'warp', parent: 'body', rect: rectOf('skirt') },
    skirtSit: { kind: 'warp', parent: 'body', rect: rectOf('skirt_sit') },
    armNear: { kind: 'rot', parent: 'body', pivot: PV.armNear },
    armFar: { kind: 'rot', parent: 'body', pivot: PV.armFar },
    legBack: { kind: 'rot', parent: 'body', pivot: PV.legBack },
    legFront: { kind: 'rot', parent: 'body', pivot: PV.legFront },
    tail: { kind: 'rot', parent: 'body', pivot: PV.tail },
    tailBend: { kind: 'warp', parent: 'tail', rect: rectOf('tail') },
    neck: { kind: 'rot', parent: 'body', pivot: PV.neck },
    headBack: { kind: 'warp', parent: 'neck', rect: HEAD },
    headMid: { kind: 'warp', parent: 'neck', rect: HEAD },
    headFeat: { kind: 'warp', parent: 'neck', rect: HEAD },
    headFront: { kind: 'warp', parent: 'neck', rect: HEAD },
    hairSway: { kind: 'warp', parent: 'headBack', rect: rectOf('hair_back') },
    bangsSway: { kind: 'warp', parent: 'headFront', rect: rectOf('bangs') },
    finNear: { kind: 'rot', parent: 'headMid', pivot: PV.finNear },
    finFar: { kind: 'rot', parent: 'headBack', pivot: PV.finFar },
    ahoge: { kind: 'rot', parent: 'headFront', pivot: PV.ahoge },
  };
  const parts = model.parts.map(p => ({ ...p }));
  // the face features ride a little ahead of the face for the turn
  parts.push({ id: 'faceFx', tex: 'faceFx', box: [U(FACE.x), V(FACE.y), FACE.w * S, FACE.h * S], z: 9, parent: 'headFeat', grid: [4, 4] });
  // the brows lie on the skin under the fringe, and show through the hair: the same texture is drawn
  // again over the fringe, faint. Each brow lifts and tilts by the face (the warp below splits them).
  const brows = parts.find(p => p.id === 'brows');
  if (brows) {
    deformers.brows = { kind: 'warp', parent: 'headFeat', rect: rectOf('brows') };
    brows.parent = 'brows';
    parts.push({ ...brows, id: 'brows_through', z: 13.2, alpha: .4 });
  }
  // the lid creases follow each eye's upper lid down when the eye narrows, and go when it closes
  const creases = parts.find(p => p.id === 'eye_creases');
  if (creases) {
    deformers.creases = { kind: 'warp', parent: 'headFeat', rect: rectOf('eye_creases') };
    creases.parent = 'creases';
  }

  /* ---------- face painting (master pixels) ---------- */
  const faceCv = document.createElement('canvas');
  faceCv.width = FACE.w; faceCv.height = FACE.h;
  // while a scheme fades in, the face is painted a second time with the incoming scheme's sprites
  const faceCv2 = document.createElement('canvas');
  faceCv2.width = FACE.w; faceCv2.height = FACE.h;
  const fg1 = faceCv.getContext('2d'), fg2 = faceCv2.getContext('2d');
  let fg = fg1;
  const eyeCv = document.createElement('canvas');
  const INK = '#5a2330';
  const poly2 = (c, x) => c[0] * x * x + c[1] * x + c[2];

  // how far the lid travels to close: from the lid line down past the lower rim
  const EYE = Object.fromEntries(EYES.map(k => {
    const e = feat.eyes[k], [x0, , x1] = e.ball;
    let h = 0;
    for (let x = x0 + 4; x < x1 - 4; x += 2) h = Math.max(h, poly2(e.rimFit, x) - poly2(e.lidFit, x));
    const cx = (e.iris[0] + e.iris[2]) / 2;
    return [k, { ...e, travel: h + 2, cx, cy: poly2(e.lidFit, cx) }];
  }));

  /** The neutral eye with its lid at `open` (0 shut, 1 rest), iris moved by ix/iy, lid tilted by tilt (rad). */
  function paintOpenEye(k, open, ix, iy, tilt) {
    const e = EYE[k], [bx0, by0, bx1, by1] = e.ball, w = bx1 - bx0, h = by1 - by0;
    if (eyeCv.width !== w + 40 || eyeCv.height !== h + 40) { eyeCv.width = w + 40; eyeCv.height = h + 40; }
    const g = eyeCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 20 - bx0, 20 - by0);
    g.clearRect(bx0 - 20, by0 - 20, w + 40, h + 40);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(img[`${k}_ball`], bx0, by0);
    g.globalCompositeOperation = 'source-atop';
    g.drawImage(img[`${k}_iris`], e.iris[0] + ix, e.iris[1] + iy);
    // the eye's outline over the iris, so a shifted iris tucks under it
    if (e.rim) { g.globalCompositeOperation = 'source-over'; g.drawImage(img[`${k}_rim`], e.rim[0], e.rim[1]); }
    // the lid hides everything above it
    const d = (1 - clamp(open, 0, 1)) * e.travel, tn = Math.tan(tilt);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(bx0 - 20, by0 - 20);
    for (let x = bx0 - 20; x <= bx1 + 20; x += 3) g.lineTo(x, poly2(e.lidFit, clamp(x, bx0, bx1)) + d + tn * (x - e.cx) - 1);
    g.lineTo(bx1 + 20, by0 - 20);
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    fg.drawImage(eyeCv, bx0 - 20 - FACE.x, by0 - 20 - FACE.y);
    // the lashes ride down with the lid and flatten as they close
    const L = e.lash, sy = .55 + .45 * clamp(open, 0, 1);
    fg.save();
    fg.translate(e.cx - FACE.x, e.cy + d - FACE.y);
    fg.rotate(tilt);
    fg.scale(1, sy);
    fg.drawImage(img[`${k}_lash`], L[0] - e.cx, L[1] - e.cy);
    fg.restore();
  }

  /** A whole drawn sprite (an expression's eye or mouth) at its place, optionally scaled/rotated about its centre. */
  function sprite(name, o = {}) {
    const b = feat.sprites[name];
    if (!b) return;
    const cx = (b[0] + b[2]) / 2 + (o.dx || 0), cy = (b[1] + b[3]) / 2 + (o.dy || 0);
    fg.save();
    fg.globalAlpha = o.alpha ?? 1;
    fg.translate(cx - FACE.x, (o.anchorTop ? b[1] : cy) - FACE.y);
    if (o.rot) fg.rotate(o.rot);
    fg.scale(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1);
    fg.drawImage(img[name], b[0] - cx, (o.anchorTop ? 0 : b[1] - cy));
    fg.restore();
  }

  const CHEEKS = [[618, 770, 40, 20], [852, 762, 22, 15]];
  function paintBlush(a) {
    if (a < .02) return;
    for (const [x, y, rx, ry] of CHEEKS) {
      fg.save();
      fg.translate(x - FACE.x, y - FACE.y); fg.scale(1, ry / rx);
      const gr = fg.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(255,120,140,${f1(.55 * a)})`); gr.addColorStop(1, 'rgba(255,120,140,0)');
      fg.fillStyle = gr; fg.beginPath(); fg.arc(0, 0, rx, 0, Math.PI * 2); fg.fill();
      fg.restore();
    }
  }

  /** Small drawn mouths for the moods the sprites don't cover (form < 0 frowns). */
  function lineMouth(form, w = 1) {
    const cx = 766 - FACE.x, cy = 772 - FACE.y;
    fg.save(); fg.strokeStyle = INK; fg.lineWidth = 3; fg.lineCap = 'round';
    fg.beginPath(); fg.moveTo(cx - 9 * w, cy - form * 3); fg.quadraticCurveTo(cx, cy + form * 5, cx + 9 * w, cy - form * 3); fg.stroke();
    fg.restore();
  }

  const MOUTH = {
    neutral: 'neutral_mouth', happy: 'happy_mouth', wink: ['happy_mouth', .8], love: 'love_mouth', shy: ['drag_mouth', .7],
    surprised: 'surprised_mouth', sleepy: 'sleep_mouth', sleep: 'sleep_mouth', dizzy: 'dizzy_mouth', dragged: 'drag_mouth',
    content: 'neutral_mouth', waking: ['surprised_mouth', .6], squeeze: 'sleep_mouth', listening: 'neutral_mouth',
    thinking: 'sleep_mouth', run: ['happy_mouth', .7], angry: -1, sad: -1.2,
  };

  function paintFace(fc, face, o, t) {
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, FACE.w, FACE.h);
    paintBlush(fc.blush || 0);
    const shut = Math.max(o.blink || 0, o.eyeClose || 0);
    const lx = clamp(o.look[0], -6, 6), ly = clamp(o.look[1], -5, 5);
    const tilt = fc.brows === 'angry' ? .2 : fc.brows === 'sad' ? -.16 : 0;
    fc.eyes.forEach((e, i) => {
      const k = EYES[i], side = k === 'eyeL' ? 1 : -1;  // the near eye's inner corner is to its right
      const squash = { sy: 1 - .85 * (o.eyeClose || 0) };
      if (face === 'surprised' && e.shape === 'ring') { sprite(`surprised_${k}`, squash); return; }
      switch (e.shape) {
        case 'ring': case 'lid': {
          const open = (e.shape === 'ring' ? clamp(e.ry / e.rx, 0, 1) * (tilt ? .8 : 1) : clamp(e.ry / 16, 0, 1)) * (1 - shut);
          // the iris fills most of the eye: it only shifts a little, less in the foreshortened far eye,
          // so the white never shows past the eye's outline
          const gx = k === 'eyeL' ? 1 : .35;
          const ix = clamp((lx + (e.dx || 0)) * gx, -6 * gx, 6 * gx), iy = clamp(ly * .7 + (e.dy || 0) * .7, -3.5, 3.5);
          paintOpenEye(k, open, ix, iy + (e.shape === 'lid' ? 3 : 0), tilt * side);
          break;
        }
        case 'up': sprite(`happy_${k}`, squash); break;
        case 'down': sprite(`sleep_${k}`, squash); break;
        case 'gt': case 'lt': sprite(`drag_${k}`, { s: 1 + .03 * Math.sin(t * 22 + i) }); break;
        case 'heart': sprite(`love_${k}`, { s: .94 + .06 * (e.s ?? 1) / .8 }); break;
        case 'spiral': sprite(`dizzy_${k}`, { rot: (e.rot || 0) * .6 }); break;
      }
    });
    // mouth: talking opens the happy mouth from its top edge; otherwise the face's own
    const talk = o.talk || 0;
    const gapOpen = clamp((Math.max(fc.gap[0], fc.gap[1]) - 50) / 14, 0, 1);
    const m = MOUTH[face] ?? 'neutral_mouth';
    const open = Math.max(talk * (.45 + .45 * Math.abs(Math.sin(t * 17))), face === 'sleepy' || face === 'waking' ? gapOpen : 0);
    if (open > .12) sprite(face === 'surprised' ? 'surprised_mouth' : 'happy_mouth', { anchorTop: true, sy: .35 + .65 * open, sx: .85 + .15 * open });
    else if (typeof m === 'number') lineMouth(m);
    else if (Array.isArray(m)) sprite(m[0], { s: m[1] });
    else sprite(m);
  }

  // Only the face texture is cached: body/hair springs and SVG effects still
  // advance on every frame. Compare the actual paint commands, using only the
  // painter's existing rounding, including animated drag eyes and mouth.
  const faceInputs = [];
  const faceCache = { values: [], images: null }, mixFaceCache = { values: [], images: null };
  function prepareFaceInputs(fc, face, o, t) {
    faceInputs.length = 0;
    const blush = fc.blush || 0;
    // paintBlush already omits small blush and rounds its gradient alpha.
    faceInputs.push(face, blush < .02 ? null : f1(.55 * blush));
    const shut = Math.max(o.blink || 0, o.eyeClose || 0), sy = 1 - .85 * (o.eyeClose || 0);
    const lx = clamp(o.look[0], -6, 6), ly = clamp(o.look[1], -5, 5);
    const tilt = fc.brows === 'angry' ? .2 : fc.brows === 'sad' ? -.16 : 0;
    fc.eyes.forEach((e, i) => {
      faceInputs.push(e.shape);
      if (face === 'surprised' && e.shape === 'ring') { faceInputs.push(sy); return; }
      switch (e.shape) {
        case 'ring': case 'lid': {
          const open = (e.shape === 'ring' ? clamp(e.ry / e.rx, 0, 1) * (tilt ? .8 : 1) : clamp(e.ry / 16, 0, 1)) * (1 - shut);
          const gx = i === 0 ? 1 : .35;
          const ix = clamp((lx + (e.dx || 0)) * gx, -6 * gx, 6 * gx);
          const iy = clamp(ly * .7 + (e.dy || 0) * .7, -3.5, 3.5);
          faceInputs.push(open, ix, iy + (e.shape === 'lid' ? 3 : 0), tilt * (i === 0 ? 1 : -1));
          break;
        }
        case 'up': case 'down': faceInputs.push(sy); break;
        case 'gt': case 'lt': faceInputs.push(1 + .03 * Math.sin(t * 22 + i)); break;
        case 'heart': faceInputs.push(.94 + .06 * (e.s ?? 1) / .8); break;
        case 'spiral': faceInputs.push((e.rot || 0) * .6); break;
      }
    });
    const gapOpen = clamp((Math.max(fc.gap[0], fc.gap[1]) - 50) / 14, 0, 1);
    const open = Math.max((o.talk || 0) * (.45 + .45 * Math.abs(Math.sin(t * 17))), face === 'sleepy' || face === 'waking' ? gapOpen : 0);
    faceInputs.push(open > .12 ? open : 0);
  }
  function updateFaceTexture(key, context, source, cache, fc, face, o, t) {
    if (cache.images === img && cache.values.length === faceInputs.length &&
        faceInputs.every((value, i) => value === cache.values[i])) return;
    fg = context;
    paintFace(fc, face, o, t);
    rig.upload(key, source);
    cache.images = img;
    cache.values.length = faceInputs.length;
    for (let i = 0; i < faceInputs.length; i++) cache.values[i] = faceInputs[i];
  }

  /* ---------- mounting inside the pet's SVG group ---------- */
  const VIEW = model.view;
  let fo = null, canvas = null, fxG = null, rig = null, mountedIn = null, pxScale = 0, frameN = 0;
  function mount(petG) {
    petG.textContent = '';
    const box = (el) => { el.setAttribute('x', VIEW[0]); el.setAttribute('y', VIEW[1]); el.setAttribute('width', VIEW[2] - VIEW[0]); el.setAttribute('height', VIEW[3] - VIEW[1]); return el; };
    canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    if (opts.raster) {
      // each frame is copied into a plain SVG image: screenshots and recordings then always see it
      fo = box(document.createElementNS(SVGNS, 'image'));
    } else {
      fo = box(document.createElementNS(SVGNS, 'foreignObject'));
      canvas.style.cssText = 'width:100%;height:100%;display:block';
      fo.appendChild(canvas);
    }
    fxG = document.createElementNS(SVGNS, 'g');
    petG.append(fo, fxG);
    rig = createRig(canvas, { deformers, parts, view: VIEW });
    faceCache.images = mixFaceCache.images = null;
    for (const n in tex) rig.upload(n, tex[n]);
    if (fade) for (const n in fade.set.tex) rig.upload(n + '@mix', fade.set.tex[n]);
    mountedIn = petG; pxScale = 0;
  }
  // a fade in progress: the rig crossfades every part from `tex` to fade.set's textures over fade.dur seconds
  let fade = null;
  function endFade() {
    if (!fade) return;
    tex = fade.set.tex; img = fade.set.img; fade = null;
    if (rig) for (const n in tex) rig.upload(n, tex[n]);
  }
  /**
   * Switches the colour scheme: at once if its textures are loaded (see preload), else once they are.
   * `o.fade` (seconds) crossfades instead of cutting over; the clock is the frames' `t`, starting at `o.at`
   * (the pet's time now) or else at the next frame drawn.
   */
  function setScheme(id, o = {}) {
    const next = schemeInfo(id).id;
    const apply = set => {
      endFade();
      if (scheme === next && tex === set.tex) return;
      scheme = next;
      if (o.fade > 0 && rig) {
        fade = { set, dur: o.fade, t0: o.at ?? null };
        for (const n in set.tex) rig.upload(n + '@mix', set.tex[n]);
        return;
      }
      tex = set.tex; img = set.img;
      if (rig) for (const n in tex) rig.upload(n, tex[n]);
    };
    if (ready[next]) { apply(ready[next]); return Promise.resolve(); }
    return loadScheme(next).then(apply);
  }
  let decoded = null; // raster mode: settles once the last frame's image is decoded
  let fixedRes = 0; // canvas pixels per rig unit for a snapshot; 0 = follow the screen
  function fitCanvas() {
    const m = fixedRes ? null : mountedIn.getScreenCTM();
    if (!m && !fixedRes) return;
    // the vertical axis: turning round squeezes the horizontal one through zero, which would shrink the canvas to a few texels
    const k = fixedRes || Math.hypot(m.c, m.d) * (window.devicePixelRatio || 1) * 1.25;
    if (Math.abs(k - pxScale) / (pxScale || 1) < .08) return;
    pxScale = k;
    canvas.width = Math.max(16, Math.round((VIEW[2] - VIEW[0]) * Math.min(k, 6)));
    canvas.height = Math.max(16, Math.round((VIEW[3] - VIEW[1]) * Math.min(k, 6)));
  }

  /* ---------- per-frame state ---------- */
  const sp = {
    hair: spring(55, 7, 1.8), hairY: spring(50, 8, 1.2), bangs: spring(110, 10, 1.6),
    skirt: spring(100, 9, 1.6), skirtY: spring(90, 10, 1.1), tail: spring(40, 5, 32), fins: spring(90, 9, 30),
    ahoge: spring(140, 6, 38), head: spring(70, 10, 16), armN: spring(60, 9, 95), armF: spring(60, 9, 95),
  };
  let lastT = null, prevTilt = 0, prevLow = 0, headTilt = 0, fx = '';
  // pet-core tips Coo's whole round body to listen, nod, doze or wobble; she keeps her feet on the floor and
  // moves her head instead. Only flight, dragging and the jump's crouch and landing tip the whole group,
  // running keeps half its lean. The shares ease between modes so the group never snaps.
  const GROUP = { air: [1, 1], drag: [1, 1], crouch: [1, 1], land: [1, 1], walk: [1, .5], run: [1, .5] };
  let wTilt = 0, wLean = 0;
  const groupTilt = (mode, tilt, lean) => tilt * wTilt + lean * wLean;
  let finMood = 0, tailMood = 0, wagAmp = 0, sitK = 0;
  const st = { z: {}, alpha: {} };

  // fins and tail by face: fins up (+) or drooping (-), tail wag size
  const MOOD = {
    happy: [.8, 1], love: [.9, 1], wink: [.5, .7], surprised: [1, .2], angry: [.9, .15], sad: [-1, 0], shy: [-.5, .3],
    sleepy: [-.7, 0], sleep: [-.9, 0], dizzy: [-.3, 0], dragged: [.6, .6], content: [-.2, .25], listening: [.6, .2],
    thinking: [.1, .15], run: [.2, .4], waking: [-.4, 0], squeeze: [-.3, 0], neutral: [0, .25],
  };
  // brows by face, in master pixels: [lift of the whole brow, lift of its inner end (by the nose)];
  // a negative inner lift is the frown
  const BROW = {
    surprised: [6, 0], angry: [-1, -5], sad: [1, 5], shy: [1, 2.5], happy: [2, 0], love: [2, 0], wink: [1, 0],
    sleepy: [-1.5, 0], sleep: [-1.5, 0], dizzy: [1, 3], dragged: [2, 3.5], thinking: [0, 2], waking: [2, 1],
    listening: [1, 0], content: [-1, 0], squeeze: [-1, -2], run: [1, 0],
  };
  const BROW_SPLIT = U(765);  // the near brow is left of this, the far brow right of it
  let browLift = 0, browInner = 0;
  // how far an eye's upper lid sits below its rest line (master pixels), and whether it is an open eye at all
  // (the same openness paintFace gives the eye, over the lid's full travel; the crease keeps a little above the lid)
  const lidDrop = (e, k, tilt) => {
    const open = e.shape === 'ring' ? clamp((e.ry ?? 16) / (e.rx ?? 16), 0, 1) * (tilt ? .8 : 1) : e.shape === 'lid' ? clamp(e.ry / 16, 0, 1) : 1;
    return EYE[k].travel * (1 - open) * .75;
  };
  const lidOpen = e => e.shape === 'ring' || e.shape === 'lid' ? 1 : 0;
  const creaseDrop = [0, 0];
  let creaseA = 1;

  function draw(petG, fc, o) {
    if (mountedIn !== petG || !petG.contains(fo)) mount(petG);
    if (frameN++ % 20 === 0) fitCanvas();
    const t = o.t, dt = lastT == null ? 1 / 60 : clamp(t - lastT, 0, .05);
    lastT = t;
    const mode = o.mode || 'idle', face = o.face || 'neutral';
    const walking = mode === 'walk' || mode === 'run', held = mode === 'drag', airborne = mode === 'air';

    /* body: pet-core's `low` is how far the hips sink (sitting, the walk's bob), in these units */
    sitK = lerp(sitK, clamp(o.sit ?? 0, 0, 1), ease(12, dt));
    const low = o.low || 0;
    const lowV = (low - prevLow) / Math.max(dt, 1e-3); prevLow = low;
    const breath = Math.sin(t * (mode === 'sleep' ? 1.7 : 2.4));

    /* head: tilt toward what it looks at, nod with sleep, wobble with dizzy */
    let tiltT = o.look[0] * .7 + Math.sin(t * .9) * 1.2 - o.look[1] * .4;
    if (mode === 'sleep') tiltT += 6;
    if (face === 'shy') tiltT += 7;
    if (face === 'thinking') tiltT -= 8;
    if (face === 'dizzy') tiltT += 3 * Math.sin(t * 4.5);
    if (held) tiltT += o.swing * .25;
    headTilt = sp.head.step(tiltT, dt);
    // what pet-core meant for the whole body and the group did not take goes to the neck (forward +)
    const [gT, gL] = GROUP[mode] || [0, 0];
    const bend = (o.tilt ?? 0) * (1 - wTilt) + (o.lean ?? 0) * Math.sign(o.facing || 1) * (1 - wLean);
    wTilt = lerp(wTilt, gT, ease(10, dt)); wLean = lerp(wLean, gL, ease(10, dt));
    const tiltVel = (headTilt - prevTilt) / Math.max(dt, 1e-3); prevTilt = headTilt;
    const angleX = clamp(o.look[0] / 5, -1, 1) * .9;
    const angleY = clamp(-o.look[1] / 4, -1, 1) * .7 + (mode === 'sleep' ? -.8 : 0) + (face === 'sad' ? -.35 : 0);

    /* springs */
    const sway = clamp(o.swing / 26, -1.6, 1.6);
    const up = airborne || held ? 1 : 0;
    const hair = sp.hair.step(sway * 1.1 - tiltVel * .004 + (walking ? -.25 : 0), dt);
    const hairY = sp.hairY.step(up * -1 + lowV * .006, dt);
    const bangs = sp.bangs.step(sway * .7 - tiltVel * .004, dt);
    const skirt = sp.skirt.step(sway * .8 + (walking ? -.2 : 0), dt);
    const flare = sp.skirtY.step(up * .8 + sitK * .6 + clamp(-lowV * .01, -.3, .6), dt);
    const [fm, wg] = MOOD[face] || MOOD.neutral;
    finMood = lerp(finMood, fm, ease(6, dt));
    wagAmp = lerp(wagAmp, wg, ease(3, dt));
    tailMood = lerp(tailMood, mode === 'sleep' || face === 'sad' ? -1 : 0, ease(3, dt));
    const fins = sp.fins.step(finMood * 14 + sway * 10 + (face === 'angry' ? 3 * Math.sin(t * 40) : 0), dt);
    const ahoge = sp.ahoge.step(-tiltVel * .12 + sway * 18 + (face === 'surprised' ? -16 : 0) + (mode === 'sleep' ? 22 : 0) - hairY * 12, dt);
    const tail = sp.tail.step(sway * 14 + tailMood * 12, dt) + wagAmp * 13 * Math.sin(t * (4 + 5 * wagAmp)) + Math.sin(t * 1.3) * 3;

    /* legs: pet-core hands hip→foot segments sized for Coo; keep their angle (forward = foot to the right) */
    const legA = o.legs.map(l => -Math.atan2(l[2] - l[0], Math.max(4, l[3] - l[1])) * 180 / Math.PI);
    const lift = o.legs.map(l => clamp(29 - Math.hypot(l[2] - l[0], l[3] - l[1]), -8, 20));
    // sitting swaps the lower body for its own drawing (skirt spread on the floor, legs forward) in a
    // couple of frames halfway down, under a little squash; a long crossfade would show both skirts at once
    const sitIn = smooth(.44, .54, sitK), plop = Math.sin(Math.PI * smooth(.3, .8, sitK));

    /* arms: swing against the legs when walking, out in the air, flailing when held */
    let aN = 4, aF = -2;
    if (walking) { aN = -legA[0] * 1.3 + 4; aF = -legA[1] * 1.3 - 2; }
    if (airborne) { aN = 40; aF = -30; }
    if (held) { aN = 70 + 16 * Math.sin(t * 13); aF = -45 - 12 * Math.sin(t * 13 + 1.3); }
    if (sitK > .5 && !walking) { aN = lerp(aN, -4, sitK); aF = lerp(aF, -6, sitK); }
    if (face === 'happy' || face === 'love') { aN += 12 + 5 * Math.sin(t * 8); aF -= 8 + 4 * Math.sin(t * 8); }
    if (face === 'angry') { aN = 20 + 3 * Math.sin(t * 30); aF = -18 - 3 * Math.sin(t * 30); }
    const armN = sp.armN.step(aN, dt), armF = sp.armF.step(aF, dt);

    /* deformer states */
    // pet-core sinks the hips 29 when seated; the sitting drawing's lowest point is 19.4 above the soles
    st.body = { a: -sway * 1.2 + (held ? o.swing * .15 : 0), ty: low - 9.6 * sitK, sx: 1 + .006 * breath + .04 * plop, sy: 1 - .012 * breath - .06 * plop };
    st.skirt = {
      fn: (u, v) => {
        const k = v * v;
        // on the way down the hem spreads a little before the sitting skirt takes over
        return [skirt * 4 * k + flare * (u - .45) * 9 * v + sitK * (u - .45) * 10 * v, -flare * k * 3 - sitK * k * 8];
      },
    };
    // the sitting skirt breathes a little at its hem, and its front edge swings with the body
    st.skirtSit = { fn: (u, v) => [skirt * 1.5 * v * v, -Math.max(0, breath) * .4 * v] };
    st.alpha.skirt = st.alpha.waist_bow_front = 1 - sitIn;
    st.alpha.leg_back = st.alpha.leg_front = 1 - smooth(.42, .52, sitK);
    st.alpha.skirt_sit = st.alpha.waist_bow_sit_front = sitIn;
    st.armNear = { a: armN };
    st.armFar = { a: armF };
    st.legBack = { a: lerp(legA[0], -55, sitK), ty: -lift[0] * .9 * (1 - sitK) };
    st.legFront = { a: lerp(legA[1], -60, sitK), ty: -lift[1] * .9 * (1 - sitK) };
    st.tail = { a: tail - 10 * sitK };
    st.tailBend = { fn: u => [0, -tail * .5 * u * u] };
    st.neck = { a: headTilt + clamp(bend * .8, -10, 12), ty: (mode === 'sleep' ? 2.5 : 0) + breath * .35 };
    const parallax = (k, ky) => (u, v) => [angleX * k * bump(u) * (.4 + .6 * bump(v)), angleY * ky * bump(v) * (.4 + .6 * bump(u))];
    st.headFront = { fn: parallax(4.2, 2.8) };
    // the eyes and mouth move with the face: the eyes' outline is shared between the two layers
    st.headFeat = { fn: parallax(2, 1.4) };
    if (brows) {
      const [lift, inner] = BROW[face] || [0, 0];
      browLift = lerp(browLift, lift - 1.5 * (o.blink || 0), ease(14, dt));
      browInner = lerp(browInner, inner, ease(10, dt));
      const [bx0, , bx1] = deformers.brows.rect;
      st.brows = {
        fn: (u, v, x) => {
          // 0 at a brow's outer end, 1 at its inner end
          const k = x < BROW_SPLIT ? clamp((x - bx0) / (BROW_SPLIT - bx0), 0, 1) : clamp((bx1 - x) / (bx1 - BROW_SPLIT), 0, 1);
          return [0, -(browLift + browInner * k * k) * S];
        },
      };
    }
    if (creases) {
      fc.eyes.forEach((e, i) => { creaseDrop[i] = lerp(creaseDrop[i], lidDrop(e, EYES[i], fc.brows), ease(12, dt)); });
      creaseA = lerp(creaseA, (lidOpen(fc.eyes[0]) + lidOpen(fc.eyes[1])) / 2, ease(12, dt));
      st.alpha.eye_creases = creaseA;
      st.creases = { fn: (u, v, x) => [0, (x < BROW_SPLIT ? creaseDrop[0] : creaseDrop[1]) * S] };
    }
    st.headMid = { fn: parallax(2, 1.4) };
    st.headBack = { fn: parallax(-1.4, -1) };
    // the long hair hangs from the head but its lower half keeps to the body when the head tilts
    const nk = PV.neck, na = headTilt * Math.PI / 180;
    st.hairSway = {
      fn: (u, v, x, y) => {
        const w = smooth(.3, .8, v), a = -na * w, c = Math.cos(a), s = Math.sin(a);
        const dx = x - nk[0], dy = y - nk[1];
        const wv = Math.pow(v, 1.6);
        return [nk[0] + dx * c - dy * s - x + hair * 8 * wv + Math.sin(t * 1.6 + v * 3) * wv,
          nk[1] + dx * s + dy * c - y + hairY * 12 * wv * wv - Math.abs(hair) * 1.5 * wv];
      },
    };
    st.bangsSway = { fn: (u, v) => [bangs * 3.2 * v * v + Math.sin(t * 1.9 + u * 2) * .5 * v * v, hairY * 3 * v * v] };
    st.ahoge = { a: ahoge * .5 + Math.sin(t * 2.1) * 2 };
    st.finNear = { a: fins + Math.sin(t * 1.4) * 1.5 };
    st.finFar = { a: -fins * .8 - Math.sin(t * 1.4) * 1.2 };

    prepareFaceInputs(fc, face, o, t);
    updateFaceTexture('faceFx', fg1, faceCv, faceCache, fc, face, o, t);
    st.mix = 0;
    if (fade) {
      if (fade.t0 == null) fade.t0 = t;
      st.mix = smooth(0, 1, (t - fade.t0) / fade.dur);
      const own = img;
      img = fade.set.img;
      updateFaceTexture('faceFx@mix', fg2, faceCv2, mixFaceCache, fc, face, o, t);
      img = own; fg = fg1;
    }
    rig.render(st);
    if (opts.raster) { fo.setAttribute('href', canvas.toDataURL('image/png')); decoded = fo.decode ? fo.decode().catch(() => {}) : null; }
    if (fade && st.mix >= 1) endFade();
    drawFx(fc, t);
  }

  /* ---------- effects over the figure (SVG, like the built-in figure's) ---------- */
  const at = (x, y) => rig.point('neck', st, x, y);
  function drawFx(fc, t) {
    let s = '';
    const ac = accent();
    const top = at(124, 34), side = at(204, 52);
    if (fc.orbit) {
      for (let i = 0; i < 3; i++) {
        const a = t * 3.2 + i * 2.094, sn = Math.sin(a);
        s += `<path fill="#ffd23f" stroke="#3a2f7a" stroke-width="1.6" stroke-linejoin="round" opacity="${sn < 0 ? .55 : 1}" transform="translate(${f1(top[0] + 56 * Math.cos(a))} ${f1(top[1] - 4 + 10 * sn)}) scale(${sn < 0 ? .7 : 1})" d="M0 -7L2 -2L7 -2L3 1L4.5 6.5L0 3.3L-4.5 6.5L-3 1L-7 -2L-2 -2Z"/>`;
      }
    }
    if (fc.listen) {
      for (let i = 0; i < 3; i++) {
        const p = (t * .9 + i / 3) % 1, r = 36 - 24 * p, c = at(214, 116);
        s += `<path fill="none" stroke="${ac}" stroke-width="5" stroke-linecap="round" opacity="${f1(Math.sin(Math.PI * p))}" d="M${f1(c[0] + r * Math.cos(-.55))} ${f1(c[1] + r * Math.sin(-.55))}A${f1(r)} ${f1(r)} 0 0 1 ${f1(c[0] + r * Math.cos(.55))} ${f1(c[1] + r * Math.sin(.55))}"/>`;
      }
    }
    if (fc.think) {
      for (let i = 0; i < 3; i++) {
        const k = (t * .8 + i / 3) % 1;
        s += `<circle fill="#e8f0ff" stroke="${ac}" stroke-width="3" cx="${f1(side[0] + 10 * i)}" cy="${f1(side[1] - 20 * i - 6 * k)}" r="${4 + 3 * i}" opacity="${f1(.4 + .6 * Math.sin(Math.PI * k))}"/>`;
      }
    }
    if (fc.sweat) {
      const c = at(196, 88 + 3 * Math.sin(t * 7));
      s += `<path fill="#8fd0ff" stroke="#2f5fae" stroke-width="1.4" transform="translate(${f1(c[0])} ${f1(c[1])}) scale(1.4)" d="M0 -9C4 -3 6 0 6 3.5A6 6 0 0 1 -6 3.5C-6 0 -4 -3 0 -9Z"/>`;
    }
    if (fc.anger) {
      const c = at(190, 62), k = 1 + .12 * Math.sin(t * 10);
      s += `<g transform="translate(${f1(c[0])} ${f1(c[1])}) scale(${f1(k)})" fill="none" stroke="#e5484d" stroke-width="5" stroke-linecap="round"><path d="M-11 -3Q-3 -3 -3 -11M3 -11Q3 -3 11 -3M11 3Q3 3 3 11M-3 11Q-3 3 -11 3"/></g>`;
    }
    if (fc.bang) {
      const c = at(206, 36);
      s += `<g transform="translate(${f1(c[0])} ${f1(c[1])})"><path fill="none" stroke="#252049" stroke-width="8" stroke-linecap="round" d="M0 -16V3"/><circle fill="#252049" cx="0" cy="14" r="4.5"/></g>`;
    }
    if (fx !== s) { fxG.innerHTML = s; fx = s; }
  }

  return {
    draw,
    groupTilt,
    setScheme,
    /** Forgets the motion state (springs, clocks), for callers that replay a timeline from its start. */
    /**
     * Renders `frames` frames of one pose (face `fc`, frame fields `o`, its clock starting at o.t) at `res` canvas
     * pixels per rig unit, then gives up the WebGL context; returns an SVG <image> for the result in rig space.
     * For pages showing many still figures, which would otherwise hold a GPU context each.
     */
    snapshot(fc, o, res = 3, frames = 60) {
      fixedRes = res;
      const g = document.createElementNS(SVGNS, 'g');
      for (let i = 0; i < frames; i++) draw(g, fc, { ...o, t: (o.t || 0) + i / 60 });
      const href = canvas.toDataURL('image/png');
      rig.gl.getExtension('WEBGL_lose_context')?.loseContext();
      rig = null; mountedIn = null; fixedRes = 0;
      return `<image href="${href}" x="${VIEW[0]}" y="${VIEW[1]}" width="${VIEW[2] - VIEW[0]}" height="${VIEW[3] - VIEW[1]}"/>`;
    },
    reset() {
      endFade();
      for (const k in sp) { sp[k].x = 0; sp[k].v = 0; }
      lastT = null; prevTilt = 0; prevLow = 0; headTilt = 0; wTilt = 0; wLean = 0; finMood = 0; tailMood = 0; wagAmp = 0; sitK = 0;
    },
    /** Loads every scheme's textures, so later switches are immediate. */
    preload: () => Promise.all(SCHEMES.map(sc => loadScheme(sc.id))),
    get scheme() { return scheme; },
    /** Raster mode: a promise that settles once the last drawn frame is ready to be painted. */
    get painted() { return decoded || Promise.resolve(); },
    get colors() { return { z: accent() }; },
    schemes: SCHEMES,
    // points pet-core uses: eye tracking, tears, sleep z's, hearts [x from, x to, y], bubble
    anchors: {
      gaze: [U(745), V(690)], tear: [U(640), V(752)], z: [196, 44],
      hearts: [96, 176, 62], bubble: [128, 18],
    },
    model,
    get renderStats() { return rig?.stats || null; },
    get renderCanvas() { return canvas; },
  };
}
