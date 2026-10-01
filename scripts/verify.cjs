const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let exe;
const at = args.indexOf('--exe');
if (at >= 0) {
  if (!args[at + 1]) throw Error('--exe requires a path');
  exe = path.resolve(args[at + 1]); args.splice(at, 2);
}
if (args.some(a => !['--benchmark', '--startup-test'].includes(a)) || args.length > 1) throw Error('Unknown verification option');
const mode = args[0] || '--self-test';
if (mode === '--startup-test' && !exe) throw Error('Startup registration verification requires --exe pointing to a packaged build.');
const binary = exe || require('electron');
if (!fs.existsSync(binary)) throw Error('Executable does not exist: ' + binary);
const child = spawn(binary, exe ? [mode] : [root, mode], { cwd: root, windowsHide: true, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
