const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies, 'Dependency lock does not match');
for (const file of ['main.cjs', 'preload.cjs', 'autostart.cjs', 'preferences.cjs', 'LICENSE',
  'README.md', 'THIRD_PARTY_NOTICES.md', 'icons/icon.ico', 'web/whale/model.json',
  'scripts/视频兼容启动.cmd', 'self-test-startup.cjs', 'self-test-performance.cjs', 'self-test-v2.cjs']) {
  assert(fs.existsSync(path.join(root, file)), 'Missing ' + file);
}
let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ['node_modules', 'dist', 'data', 'test-data', '.git'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else {
      assert(fs.statSync(file).size < 25 * 1024 * 1024, 'Not suitable for GitHub browser upload: ' + file);
      if (/\.(?:js|cjs|mjs)$/.test(file)) {
        const result = spawnSync(process.execPath, ['--check', file], { windowsHide: true, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      }
      count++;
    }
  }
}
walk(root);
console.log('Source files checked:', count, '; syntax, required files and dependency lock passed.');
