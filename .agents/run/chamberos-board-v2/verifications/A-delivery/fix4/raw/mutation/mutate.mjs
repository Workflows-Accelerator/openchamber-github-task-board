import fs from 'node:fs';
const [,, src, dst, line, kind] = process.argv;
const lines = fs.readFileSync(src, 'utf8').split('\n');
const i = Number(line) - 1;
const orig = '      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0) {';
if (lines[i] !== orig) throw new Error('anchor mismatch at ' + line + ': ' + lines[i]);
const rep = {
  dropAvailable: '      if ((board.repositoriesLoaded ?? 0) === 0) {',
  dropLoaded: '      if (discovery.repositories.some((r) => r.available)) {',
  invert: '      if (discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) !== 0) {',
}[kind];
lines[i] = rep;
fs.writeFileSync(dst, lines.join('\n'));
