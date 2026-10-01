const host = window.petHost;
const section = document.createElement('section');
section.className = 'offline-controls';
section.innerHTML = `<h2>习惯</h2>
<label>走动程度 <select id="roam"><option value="off">安静待着</option><option value="calm">偶尔走动</option><option value="free">活泼走动</option></select></label>
<label>桌宠大小 <input id="scale" type="range" min="0.6" max="2.5" step="0.1"><output id="scaleValue"></output></label>
<label><input id="sound" type="checkbox"> 开启音效</label>
<label><input id="paused" type="checkbox"> 暂停动画</label>
<label><input id="autoStart" type="checkbox" disabled> 开机自动启动</label>
<p id="autoStartStatus" role="status">登录 Windows 后自动显示桌宠。</p>
<p>单击戳戳 · 在头上来回移动可摸头 · 按住拖拽可拎起和抛掷 · 双击跳跃 · 右键打开菜单。</p>
<p>大肥鱼离线版，无需账号或 API Key。设置保存在安装目录的 data 文件夹。</p>`;
document.querySelector('main').appendChild(section);
function sync(prefs) {
  for (const key of ['roam', 'scale']) document.getElementById(key).value = prefs[key];
  for (const key of ['sound', 'paused']) document.getElementById(key).checked = prefs[key];
  document.getElementById('scaleValue').textContent = Number(prefs.scale).toFixed(1) + ' 倍';
}
const autoStartControl = document.getElementById('autoStart');
const autoStartStatus = document.getElementById('autoStartStatus');
let changingAutoStart = false;
function syncAutoStart(state) {
  autoStartControl.checked = !!state?.enabled;
  autoStartControl.disabled = changingAutoStart || !state?.supported;
  autoStartStatus.textContent = state?.supported
    ? '登录 Windows 后自动显示桌宠。'
    : '当前启动方式不支持开机自动启动。';
}
async function readAutoStart() {
  if (changingAutoStart) return;
  try { syncAutoStart(await host.getAutoStart()); }
  catch { autoStartControl.disabled = true; autoStartStatus.textContent = '无法读取开机启动状态，请重新打开设置。'; }
}
host.onAutoStart(syncAutoStart);
autoStartControl.addEventListener('change', async () => {
  changingAutoStart = true;
  autoStartControl.disabled = true;
  try {
    const state = await host.setAutoStart(autoStartControl.checked);
    changingAutoStart = false;
    syncAutoStart(state);
    document.querySelector('#saved').textContent = state.enabled ? '已开启开机自动启动' : '已关闭开机自动启动';
  } catch {
    changingAutoStart = false;
    await readAutoStart();
    autoStartStatus.textContent = '未能修改开机启动，请重试。';
    document.querySelector('#saved').textContent = '保存失败';
  }
});
addEventListener('focus', readAutoStart);
await readAutoStart();
host.onPrefs(sync);
sync(await host.getPrefs());
for (const key of ['roam', 'scale', 'sound', 'paused']) {
  document.getElementById(key).addEventListener('change', async e => {
    const value = key === 'scale' ? Number(e.target.value) : ['sound', 'paused'].includes(key) ? e.target.checked : e.target.value;
    try { sync(await host.savePrefs({ [key]: value })); document.querySelector('#saved').textContent = '已保存'; }
    catch { document.querySelector('#saved').textContent = '保存失败'; }
  });
}
