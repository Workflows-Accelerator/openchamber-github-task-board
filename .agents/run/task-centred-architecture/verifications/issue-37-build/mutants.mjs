// Reproducible discriminating mutations in disposable source copies, never worktrees.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const proof = path.resolve('.agents/run/task-centred-architecture/verifications/issue-37-build');
const scratch = mkdtempSync('/tmp/opencode/issue-37-mutant-');
try {
  for (const directory of ['web/server', 'web/public', 'web/tests', 'panel']) {
    cpSync(path.join(root, directory), path.join(scratch, directory), { recursive: true });
  }
  cpSync('package.json', path.join(scratch, 'package.json'));
  const cases = [
    ['identity', 'web/public/app.js',
      "return issue && issue.repository ? issue.repository.full + '#' + issue.number : '#' + (issue && issue.number);",
      "return '#' + (issue && issue.number);",
      'qualified overview drafts survive navigation', 'web/tests/multi-repo-client.test.mjs'],
    ['allowlist', 'web/server/app.ts',
      'try { return await repositories.resolve(owner, name); }',
      "try { return { owner, name, full: `${owner}/${name}`, id: null, archived: false, hasIssues: true, disabled: false, private: false, available: true, lastSeenAt: '' }; }",
      'fabricated, unknown and case-variant', 'web/tests/multi-repo.test.mjs'],
  ];
  for (const [name, file, old, replacement, pattern, test] of cases) {
    const target = path.join(scratch, file), source = readFileSync(target, 'utf8');
    assert.ok(source.includes(old), 'mutation anchor exists');
    writeFileSync(target, source.replace(old, replacement));
    const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=' + pattern, test], { cwd: scratch, encoding: 'utf8' });
    writeFileSync(path.join(proof, name + '-mutant-red.log'), result.stdout + result.stderr + '\nexit=' + result.status + '\n');
    assert.equal(result.status, 1, name + ' mutant must fail');
    writeFileSync(target, source);
    const green = spawnSync(process.execPath, ['--test', '--test-name-pattern=' + pattern, test], { cwd: scratch, encoding: 'utf8' });
    writeFileSync(path.join(proof, name + '-restored-green.log'), green.stdout + green.stderr + '\nexit=' + green.status + '\n');
    assert.equal(green.status, 0, name + ' restored must pass');
    console.log(name + ': mutant exit 1, restored exit 0');
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }
