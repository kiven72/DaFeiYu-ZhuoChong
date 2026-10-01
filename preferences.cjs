// Only local appearance and behavior preferences are persisted.
const defaults = { roam: 'calm', scale: 1.2, sound: true, theme: 'dark', paused: false, bubbles: true, skin: { figure: 'whale', scheme: 'deepseek' } };
function sanitize(raw = {}, previous = defaults) {
  const next = { ...previous };
  if (['off', 'calm', 'free'].includes(raw.roam)) next.roam = raw.roam;
  if (typeof raw.scale === 'number' && Number.isFinite(raw.scale)) next.scale = Math.min(2.5, Math.max(.6, raw.scale));
  if (['light', 'dark'].includes(raw.theme)) next.theme = raw.theme;
  for (const key of ['sound', 'paused', 'bubbles']) if (typeof raw[key] === 'boolean') next[key] = raw[key];
  if (raw.skin && typeof raw.skin === 'object') {
    const fields = ['figure', 'scheme', 'palette', 'head', 'side', 'glasses', 'neck'];
    next.skin = {};
    for (const key of fields) if (typeof raw.skin[key] === 'string') next.skin[key] = raw.skin[key].slice(0, 40);
    const colors = {};
    for (const slot of ['head', 'side', 'glasses', 'neck']) {
      if (!raw.skin.colors?.[slot]) continue;
      colors[slot] = {};
      for (const channel of ['main', 'acc']) {
        if (typeof raw.skin.colors[slot][channel] === 'string') colors[slot][channel] = raw.skin.colors[slot][channel].slice(0, 40);
      }
    }
    next.skin.colors = colors;
    next.skin.figure = 'whale';
    next.skin.head = next.skin.side = next.skin.glasses = next.skin.neck = 'none';
  }
  return next;
}
module.exports = { defaults, sanitize };
