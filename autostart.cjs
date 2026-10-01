// Windows owns this setting, so changes in Windows Startup apps remain visible.
function createAutoStart(app, { testing = false } = {}) {
  const name = testing ? `CoopanionOffline.Test.${process.pid}` : 'CoopanionOffline';
  const options = { path: process.execPath, args: [] };
  const supported = process.platform === 'win32' && app.isPackaged;
  function get() {
    if (!supported) return { supported: false, enabled: false };
    const settings = app.getLoginItemSettings(options);
    const item = settings.launchItems?.find(item => item.name === name && item.scope === 'user');
    // openAtLogin only inspects Electron's default value name, not our custom
    // name. launchItems also reports whether Windows has disabled this entry.
    return { supported: true, enabled: !!item?.enabled };
  }
  function set(enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('Invalid startup value');
    if (!supported) throw new Error('Startup is unavailable in this build');
    app.setLoginItemSettings({ ...options, name, openAtLogin: enabled, enabled: true });
    const state = get();
    if (state.enabled !== enabled) throw new Error('Windows did not apply the startup setting');
    return state;
  }
  return { get, set, name, options };
}
module.exports = { createAutoStart };
