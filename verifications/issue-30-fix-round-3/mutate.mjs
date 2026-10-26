import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const kind = process.argv[2] || 'baseline';
const scratch = `/tmp/opencode/issue30-r3-proof-${kind}`;
const preflight = `  elPreflightPromptInput.value = renderSingleIssueBrief(activeIssue, {
    useWorktree: Boolean(useWt || existingThemeWorktree),
  });`;
const batch = '      const prompt = renderBatchLaunchPrompt(issue);';
const mutations = {
  A: [preflight, '  elPreflightPromptInput.value = DEFAULT_WORK_INSTRUCTIONS;'],
  B: [preflight, ''],
  C: [batch, '      const prompt = DEFAULT_WORK_INSTRUCTIONS;'],
  D: [batch, ''],
  E: [preflight, preflight.split('\n').map((line) => `// ${line}`).join('\n')],
  F: [preflight, preflight.replace('  });', '  }) + DEFAULT_WORK_INSTRUCTIONS;')],
  G: [batch, batch.replace('(issue);', '(issue) + DEFAULT_WORK_INSTRUCTIONS;')],
  H: [batch, `// ${batch}`],
};
if (kind !== 'baseline' && !mutations[kind]) throw new Error(`Unknown mutation: ${kind}`);
fs.rmSync(scratch, { recursive: true, force: true });
fs.mkdirSync(scratch, { recursive: true });
for (const entry of ['panel', 'test', 'docs', 'package.json']) {
  fs.cpSync(path.join(root, entry), path.join(scratch, entry), { recursive: true });
}
if (kind !== 'baseline') {
  const filename = path.join(scratch, 'panel/main.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const [before, after] = mutations[kind];
  if (source.split(before).length !== 2) throw new Error(`Mutation ${kind} must have exactly one target`);
  fs.writeFileSync(filename, source.replace(before, after));
}
const files = [
  'test/issue-30-work-type.test.js',
  'test/drafting-and-skills-audit.test.js',
  'test/native-skill-declarations.test.js',
];
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: scratch, encoding: 'utf8' });
fs.writeFileSync(path.join(scratch, 'tests.log'), result.stdout + result.stderr);
console.log(`mutation=${kind}; scratch=${scratch}; exit=${result.status}`);
console.log(result.stdout.split('\n').filter((line) => /^not ok|^# (tests|pass|fail)/.test(line)).join('\n'));
if (result.error) throw result.error;
process.exitCode = result.status ?? 2;
