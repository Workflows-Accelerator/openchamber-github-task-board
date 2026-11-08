import fs from 'node:fs';
const [file, kind] = process.argv.slice(2);
const orig = '      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0) {';
const repl = {
  dropAvailable: '      if ((board.repositoriesLoaded ?? 0) === 0) {',
  dropLoaded: '      if (discovery.repositories.some((r) => r.available)) {',
  invert: '      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) !== 0) {',
}[kind];
const lines = fs.readFileSync(file, 'utf8').split('\n');
if (lines[1420] !== orig) throw new Error('line 1421 mismatch');
lines[1420] = repl;
fs.writeFileSync(file, lines.join('\n'));
