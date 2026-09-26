// backend/scripts/runPython.js
//
// Runs a Python script with whichever Python 3 this computer has:
// `python3` (Mac/Linux), `py -3` (Windows launcher) or `python`.
// Skips the Windows "Microsoft Store" placeholder, which isn't real Python.
//
//   node scripts/runPython.js database/import_recipes.py --limit 1000

const { spawnSync } = require('child_process');

const MIN_MINOR = 10; // Python 3.10+
const candidates = [
  ['python3'],
  ['py', '-3'],
  ['python'],
];

function findPython() {
  for (const [cmd, ...pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' });
    const m = /Python 3\.(\d+)/.exec(`${r.stdout || ''}${r.stderr || ''}`);
    if (r.status === 0 && m && Number(m[1]) >= MIN_MINOR) return [cmd, ...pre];
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error(
    '\nPython 3.10 or newer was not found.\n\n' +
      '  Windows:  winget install -e --id Python.Python.3.12\n' +
      '            (or python.org - tick "Add python.exe to PATH"), then open a NEW terminal\n' +
      '  Mac:      brew install python@3.12\n'
  );
  process.exit(1);
}

const [cmd, ...pre] = python;
const r = spawnSync(cmd, [...pre, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
