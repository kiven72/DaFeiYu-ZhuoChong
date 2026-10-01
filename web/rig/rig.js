/**
 * A small Live2D-like renderer: textured grid meshes (parts) hang from a tree of deformers.
 *
 * Every coordinate is in one rig space (the pet's logo units: facing right, ground at y=256).
 * A part is a texture stretched over a box in that space, cut into a grid of quads. Each frame
 * the grid's rest points run through the part's deformer chain, innermost first:
 *   rot  – turn/scale/move about a pivot: p' = pivot + t + R(a)·S·(p − pivot)
 *   warp – a displacement field over a rect: p' = p + fn(u, v), u/v = p's place in the rect
 *            (points outside the rect take the field at the nearest edge)
 * Deformers are defined in rest space too, so a child always acts before its parent.
 *
 * A part may carry a second texture under `<tex>@mix` (same layout): `st.mix` (0..1) crossfades to it,
 * which is how a figure fades from one colour scheme to another.
 */

const VS = `#version 300 es
in vec2 aPos; in vec2 aUv;
uniform vec4 uView; // x0, y0, 1/w, 1/h
out vec2 vUv;
void main() {
  vec2 n = (aPos - uView.xy) * uView.zw;
  gl_Position = vec4(n.x * 2.0 - 1.0, 1.0 - n.y * 2.0, 0.0, 1.0);
  vUv = aUv;
}`;
const FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uTex2;
uniform float uMix;
uniform float uAlpha;
uniform vec4 uTint; // rgb multiply, a = mix toward it
out vec4 o;
void main() {
  vec4 c = mix(texture(uTex, vUv), texture(uTex2, vUv), uMix);
  c.rgb = mix(c.rgb, c.rgb * uTint.rgb, uTint.a);
  o = c * uAlpha;
}`;

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function createRig(canvas, model) {
  // the canvas lives in an SVG foreignObject, which the browser may repaint from the canvas at any time: keep the
  // drawing buffer, or a repaint between our frames shows an empty canvas (flicker, worst in screen recordings)
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('webgl2 unavailable');
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = {
    aPos: gl.getAttribLocation(prog, 'aPos'), aUv: gl.getAttribLocation(prog, 'aUv'),
    uView: gl.getUniformLocation(prog, 'uView'), uTex: gl.getUniformLocation(prog, 'uTex'),
    uAlpha: gl.getUniformLocation(prog, 'uAlpha'), uTint: gl.getUniformLocation(prog, 'uTint'),
    uTex2: gl.getUniformLocation(prog, 'uTex2'), uMix: gl.getUniformLocation(prog, 'uMix'),
  };

  const textures = new Map();
  const textureSizes = new Map();
  const stats = { backend: 'webgl2', frames: 0, missing: [], nonFinite: 0, parts: 0, drawn: [], textureUploads: 0, mipmapBuilds: 0, rotationPreparations: 0 };
  function upload(key, src) {
    let t = textures.get(key);
    const fresh = !t;
    if (fresh) { t = gl.createTexture(); textures.set(key, t); }
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const width = src.naturalWidth || src.videoWidth || src.width;
    const height = src.naturalHeight || src.videoHeight || src.height;
    const size = textureSizes.get(key);
    if (size && size.width === width && size.height === height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      textureSizes.set(key, { width, height });
    }
    // Keep the original mipmaps and sampling quality for every changed image.
    gl.generateMipmap(gl.TEXTURE_2D);
    if (fresh) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    stats.textureUploads++; stats.mipmapBuilds++;
    return t;
  }

  const defs = model.deformers;
  // parts: rest grid, uv, index buffer; `uvBox` picks a sub-rect of the texture (atlas), default whole
  const meshes = model.parts.map(p => {
    const [nx, ny] = p.grid || [6, 6];
    const [x, y, w, h] = p.box;
    const [u0, v0, u1, v1] = p.uvBox || [0, 0, 1, 1];
    const rest = new Float32Array((nx + 1) * (ny + 1) * 2), uv = new Float32Array(rest.length);
    let k = 0;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      rest[k] = x + w * i / nx; rest[k + 1] = y + h * j / ny;
      uv[k] = u0 + (u1 - u0) * i / nx; uv[k + 1] = v0 + (v1 - v0) * j / ny;
      k += 2;
    }
    const idx = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, rest.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0);
    const uvb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvb);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc.aUv);
    gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { part: p, rest, out: new Float32Array(rest.length), vao, pos, count: idx.length };
  });

  // deformer chain per part, innermost first
  const chainOf = id => { const c = []; for (let d = id; d; d = defs[d].parent) c.push(d); return c; };
  meshes.forEach(m => { m.chain = chainOf(m.part.parent); });

  // Rotation parameters are constant across all vertices within one render.
  // Keep the original arithmetic order; do not merge matrices across warps.
  const rotations = Object.entries(defs).filter(([, d]) => d.kind === 'rot')
    .map(([id, d]) => ({ id, kind: 'rot', px: d.pivot[0], py: d.pivot[1], active: false, c: 1, sn: 0, sx: 1, sy: 1, tx: 0, ty: 0 }));
  const rotationOf = Object.fromEntries(rotations.map(r => [r.id, r]));
  meshes.forEach(m => { m.preparedChain = m.chain.map(id => rotationOf[id] || { ...defs[id], id }); });
  function prepareRotations(st) {
    for (const r of rotations) {
      const s = st[r.id]; r.active = !!s;
      if (!s) continue;
      const a = (s.a || 0) * Math.PI / 180;
      r.c = Math.cos(a); r.sn = Math.sin(a);
      r.sx = s.sx ?? s.s ?? 1; r.sy = s.sy ?? s.s ?? 1;
      r.tx = s.tx || 0; r.ty = s.ty || 0;
      stats.rotationPreparations++;
    }
  }
  function applyPrepared(chain, st, x, y, out, offset) {
    for (const d of chain) {
      if (d.kind === 'rot') {
        const r = d;
        if (!r.active) continue;
        const lx = (x - r.px) * r.sx, ly = (y - r.py) * r.sy;
        x = r.px + r.tx + lx * r.c - ly * r.sn;
        y = r.py + r.ty + lx * r.sn + ly * r.c;
      } else {
        const s = st[d.id];
        if (!s || d.kind !== 'warp' || !s.fn) continue;
        const [x0, y0, x1, y1] = d.rect;
        const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))), v = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
        const q = s.fn(u, v, x, y);
        x += q[0]; y += q[1];
      }
    }
    out[offset] = x; out[offset + 1] = y;
    return Number.isFinite(x) && Number.isFinite(y);
  }
  const order = meshes.map((m, index) => ({ m, index, z: m.part.z }));

  /** Moves a rest point through deformer `id` and its ancestors, with this frame's states. */
  function applyChain(chain, st, x, y) {
    for (const id of chain) {
      const d = defs[id], s = st[id];
      if (!s) continue;
      if (d.kind === 'rot') {
        const [px, py] = d.pivot, a = (s.a || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
        const sx = s.sx ?? s.s ?? 1, sy = s.sy ?? s.s ?? 1;
        const lx = (x - px) * sx, ly = (y - py) * sy;
        x = px + (s.tx || 0) + lx * c - ly * sn;
        y = py + (s.ty || 0) + lx * sn + ly * c;
      } else if (d.kind === 'warp' && s.fn) {
        const [x0, y0, x1, y1] = d.rect;
        const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))), v = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
        const r = s.fn(u, v, x, y);
        x += r[0]; y += r[1];
      }
    }
    return [x, y];
  }

  let view = model.view; // [x0, y0, x1, y1]
  function render(st, opts = {}) {
    stats.frames++;stats.missing.length=0;stats.parts=0;stats.drawn.length=0;
    prepareRotations(st);
    const W = canvas.width, H = canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform4f(loc.uView, view[0], view[1], 1 / (view[2] - view[0]), 1 / (view[3] - view[1]));
    gl.uniform1i(loc.uTex, 0);
    gl.uniform1i(loc.uTex2, 1);
    const mixK = Math.min(1, Math.max(0, st.mix || 0));
    for (const entry of order) entry.z = st.z?.[entry.m.part.id] ?? entry.m.part.z;
    order.sort((a, b) => (a.z - b.z) || (a.index - b.index));
    for (const { m } of order) {
      const p = m.part, alpha = st.alpha?.[p.id] ?? p.alpha ?? 1;
      if (opts.hidden && opts.hidden[p.id]) continue;
      const tex = textures.get(p.tex);
      if (alpha <= 0.001) continue;
      if (!tex) { stats.missing.push(p.tex); continue; }
      let valid = true;
      for (let i = 0; i < m.rest.length; i += 2) {
        if (!applyPrepared(m.preparedChain, st, m.rest[i], m.rest[i + 1], m.out, i)) valid = false;
      }
      if (!valid) { stats.nonFinite++;continue; }
      stats.parts++;stats.drawn.push(p.id);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.out);
      const tex2 = mixK > 0 ? textures.get(p.tex + '@mix') : null;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex2 || tex);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1f(loc.uMix, tex2 ? mixK : 0);
      gl.uniform1f(loc.uAlpha, alpha);
      const tint = st.tint?.[p.id];
      gl.uniform4f(loc.uTint, ...(tint || [1, 1, 1, 0]));
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  return {
    gl, upload, render, stats, canvas,
    /** Where a rest point lands this frame (for overlays and hit tests). */
    point(deformer, st, x, y) { return applyChain(chainOf(deformer), st, x, y); },
    setView(v) { view = v; },
    get view() { return view; },
  };
}
