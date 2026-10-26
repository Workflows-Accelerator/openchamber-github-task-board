// Builder audit of saved independent programs and their actual result records.
// Does not change product, payloads, assertions or index meanings.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = '.agents/run/task-centred-architecture/verifications/issue-33-last-correction';
const originalDirectory = directory.replace('issue-33-last-correction', 'issue-33-residual-review');
const results = [];
const hash = (text) => createHash('sha256').update(text).digest('hex');
for (const name of ['browser-matrix.mjs', 'residual-http.mjs', 'browser-baseline.mjs', 'browser-gateway.mjs', 'probes.mjs']) {
  const original = await readFile(`${originalDirectory}/${name}`, 'utf8');
  const adapted = await readFile(`${directory}/${name}`, 'utf8');
  assert.equal(adapted, original.replaceAll('verifications/issue-33-residual-review', 'verifications/issue-33-last-correction'), name);
  results.push({ name, sourceSha256: hash(original), adaptedSha256: hash(adapted), pass: true });
}
for (const [name, count] of [['final-browser-matrix', 84], ['final-residual-http', 36], ['browser-gateway', 19], ['browser-verification', 32], ['final-probes', 28]]) {
  const data = JSON.parse(await readFile(`${directory}/${name}.json`, 'utf8'));
  const entries = data.results || data.checks;
  assert.equal(entries.length, count, name);
  if (name === 'browser-gateway') {
    for (const entry of entries) {
      assert.equal(entry.committed, true);
      assert.equal(entry.patches, 1);
      assert.match(entry.text, /outcome unknown/i);
      assert.match(entry.text, /refresh/i);
    }
  } else assert.ok(entries.every((entry) => entry.pass), name);
  if (name === 'final-browser-matrix') {
    for (const entry of entries) {
      assert.equal(entry.originalStatus, 200);
      assert.equal(entry.committed, true);
      assert.equal(entry.patches, 1);
      assert.equal(entry.rawException, false);
      if (entry.name !== 'valid') {
        assert.equal(entry.preserved, true);
        assert.equal(entry.unknown, true);
      }
    }
  }
  if (name === 'final-residual-http') {
    for (const entry of entries.filter((entry) => entry.name.startsWith('F3.refusal'))) assert.equal(entry.patches, 0);
  }
  const logs = data.boardLogs || data.logs || [];
  for (const line of logs) {
    assert.match(line, /^(?:(?:GET|POST|PUT|DELETE|PATCH) \/[^ ]* \d{3} \d+ms|write issue=\d+ fields=(?:body|labels))$/);
    assert.doesNotMatch(line, /ghp_|board_session=|TypeError/);
  }
  if ('runtimeEvents' in data) assert.equal(data.runtimeEvents.length, 0);
  results.push({ name, count, logLines: logs.length, pass: true });
}
await writeFile(`${directory}/audit.json`, JSON.stringify({ results }, null, 2) + '\n');
console.log('PASS: original assertions preserved, 84/36/19/32/28 result records verified, one-PATCH writes and zero-PATCH refusals verified, browser logs/events audited');
