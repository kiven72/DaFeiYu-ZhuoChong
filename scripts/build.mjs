import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { rcedit } from 'rcedit';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Build requires Windows x64.');
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--runtime')) throw Error('Usage: node scripts/build.mjs [--runtime <Electron directory>]');
const runtime = args.length ? path.resolve(args[1]) : path.dirname(require('electron'));
const output = path.join(root, 'dist', 'Coopanion-Offline-Windows-x64');
const exeName = '大肥鱼离线桌宠.exe';
if (fs.existsSync(output)) throw Error('Output already exists. Back up or move it before rebuilding: ' + output);
const expected = fs.readFileSync(path.join(runtime, 'version'), 'utf8').trim().replace(/^v/, '');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (expected !== pkg.devDependencies.electron) throw Error('Electron version mismatch: ' + expected);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.cpSync(runtime, output, { recursive: true });
fs.renameSync(path.join(output, 'electron.exe'), path.join(output, exeName));
fs.rmSync(path.join(output, 'resources/default_app.asar'), { force: true });
const localeDir = path.join(output, 'locales');
for (const file of fs.readdirSync(localeDir)) {
  if (!['en-US.pak', 'zh-CN.pak'].includes(file)) fs.unlinkSync(path.join(localeDir, file));
}
const appDir = path.join(output, 'resources/app');
fs.mkdirSync(appDir, { recursive: true });
for (const name of ['main.cjs', 'preload.cjs', 'preferences.cjs', 'autostart.cjs',
  'self-test-v2.cjs', 'self-test-performance.cjs', 'self-test-startup.cjs', 'web', 'icons', 'LICENSE']) {
  fs.cpSync(path.join(root, name), path.join(appDir, name), { recursive: true });
}
const runtimePkg = { ...pkg };
delete runtimePkg.devDependencies; delete runtimePkg.scripts; delete runtimePkg.engines;
fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(runtimePkg, null, 2));
for (const name of ['使用说明.txt', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(root, name), path.join(output, name));
fs.mkdirSync(path.join(output, 'docs'));
fs.copyFileSync(path.join(root, 'docs/UPSTREAM_THIRD_PARTY_NOTICES.md'), path.join(output, 'docs/UPSTREAM_THIRD_PARTY_NOTICES.md'));
fs.copyFileSync(path.join(root, 'scripts/视频兼容启动.cmd'), path.join(output, '视频兼容启动.cmd'));
await rcedit(path.join(output, exeName), {
  icon: path.join(root, 'icons/icon.ico'),
  'version-string': { ProductName: '大肥鱼离线桌宠', FileDescription: '大肥鱼离线桌宠',
    InternalName: 'Coopanion-Offline', OriginalFilename: exeName }
});
fs.writeFileSync(path.join(output, '来源与修改.txt'),
  'Original: https://github.com/Pal-AI-Lab/Coopanion\nCommit: 86d95d1ad1893144af9a34c5fdd3d64783d9c5f6\nLicense: MIT\nRuntime: Electron 44.5.1\nOffline derivative; no accounts, API clients or external services.\n');
const manifest = {};
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else manifest[path.relative(output, file).replaceAll(path.sep, '/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
}
scan(output);
fs.writeFileSync(path.join(output, 'file-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Portable build:', output);
