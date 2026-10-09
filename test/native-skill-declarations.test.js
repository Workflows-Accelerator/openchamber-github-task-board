import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveIssueSkills,
  buildLaunchSessionPayload,
  buildConsolidatedIssuePrompt,
} from '../panel/core.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(here, '..', 'panel', 'main.ts'), 'utf8');

test('resolveIssueSkills: maps standard labels to canonical skills and transclusions', () => {
  const bugIssue = { number: 1, title: 'Bug', labels: [{ name: 'bug' }] };
  const resBug = resolveIssueSkills(bugIssue);
  assert.deepEqual(resBug.skillNames, ['surgical-patch', 'debugging-and-error-recovery']);
  assert.equal(resBug.transclusions.length, 2);
  assert.ok(resBug.transclusions[0].includes('surgical-patch'));

  const featIssue = { number: 2, title: 'Feature', labels: [{ name: 'enhancement' }] };
  const resFeat = resolveIssueSkills(featIssue);
  assert.deepEqual(resFeat.skillNames, ['test-driven-development', 'lean-build']);

  const docIssue = { number: 3, title: 'Docs', labels: [{ name: 'documentation' }] };
  const resDoc = resolveIssueSkills(docIssue);
  assert.deepEqual(resDoc.skillNames, ['documentation-and-adrs']);

  const uiIssue = { number: 4, title: 'UI', labels: [{ name: 'ui' }] };
  const resUi = resolveIssueSkills(uiIssue);
  assert.deepEqual(resUi.skillNames, ['frontend-ui-engineering']);

  const apiIssue = { number: 5, title: 'API', labels: [{ name: 'api' }] };
  const resApi = resolveIssueSkills(apiIssue);
  assert.deepEqual(resApi.skillNames, ['api-and-interface-design']);

  const perfIssue = { number: 6, title: 'Perf', labels: [{ name: 'perf' }] };
  const resPerf = resolveIssueSkills(perfIssue);
  assert.deepEqual(resPerf.skillNames, ['performance-optimization']);

  const secIssue = { number: 7, title: 'Security', labels: [{ name: 'security' }] };
  const resSec = resolveIssueSkills(secIssue);
  assert.deepEqual(resSec.skillNames, ['security-and-hardening']);

  const refactorIssue = { number: 8, title: 'Refactor', labels: [{ name: 'refactor' }] };
  const resRefactor = resolveIssueSkills(refactorIssue);
  assert.deepEqual(resRefactor.skillNames, ['code-simplification', 'safe-refactor']);
});

test('resolveIssueSkills: handles theme prefix variants and explicit issue skills', () => {
  const themeDoc = { number: 10, title: 'Theme Doc', labels: [{ name: 'theme:documentation' }] };
  assert.deepEqual(resolveIssueSkills(themeDoc).skillNames, ['documentation-and-adrs']);

  const themeUi = { number: 11, title: 'Theme UI', labels: [{ name: 'theme:ui' }] };
  assert.deepEqual(resolveIssueSkills(themeUi).skillNames, ['frontend-ui-engineering']);

  const explicitSkillIssue = {
    number: 12,
    title: 'Custom skill',
    skills: ['custom-skill-one', 'custom-skill-two'],
    labels: [{ name: 'bug' }],
  };
  const res = resolveIssueSkills(explicitSkillIssue);
  assert.deepEqual(res.skillNames, ['custom-skill-one', 'custom-skill-two', 'surgical-patch', 'debugging-and-error-recovery']);
});

test('resolveIssueSkills: deduplicates across multiple issues and handles edge cases safely', () => {
  // Safe null/empty handling
  assert.deepEqual(resolveIssueSkills(null), { skillNames: [], transclusions: [] });
  assert.deepEqual(resolveIssueSkills(undefined), { skillNames: [], transclusions: [] });
  assert.deepEqual(resolveIssueSkills([]), { skillNames: [], transclusions: [] });
  assert.deepEqual(resolveIssueSkills({ number: 99 }), { skillNames: [], transclusions: [] });

  // Deduplication across array of issues
  const multiIssues = [
    { number: 101, labels: [{ name: 'bug' }, { name: 'ui' }] },
    { number: 102, labels: [{ name: 'type:bug' }, { name: 'feature' }] },
  ];
  const combined = resolveIssueSkills(multiIssues);
  assert.deepEqual(combined.skillNames, [
    'surgical-patch',
    'debugging-and-error-recovery',
    'frontend-ui-engineering',
    'test-driven-development',
    'lean-build',
  ]);
  // No duplicate transclusions
  const uniqueTransclusions = new Set(combined.transclusions);
  assert.equal(uniqueTransclusions.size, combined.transclusions.length);
});

test('buildLaunchSessionPayload: natively declares skill IDs at payload top-level and in metadata', () => {
  const bugIssue = {
    number: 42,
    title: 'Fix edge crash',
    html_url: 'https://github.com/org/repo/issues/42',
    labels: [{ name: 'bug' }],
  };

  const payload = buildLaunchSessionPayload({
    issue: bugIssue,
    projectId: 'proj-1',
    prompt: 'Fix it now',
  });

  // Turn-0 native availability at top level
  assert.deepEqual(payload.skills, ['surgical-patch', 'debugging-and-error-recovery']);
  // Turn-0 metadata persistence
  assert.deepEqual(payload.data.skills, ['surgical-patch', 'debugging-and-error-recovery']);
  assert.equal(payload.data.issueNumber, 42);

  // When explicit skills option is provided, it overrides
  const customPayload = buildLaunchSessionPayload({
    issue: bugIssue,
    projectId: 'proj-1',
    skills: ['custom-skill'],
  });
  assert.deepEqual(customPayload.skills, ['custom-skill']);
  assert.deepEqual(customPayload.data.skills, ['custom-skill']);

  // When no skills match, properties remain omitted
  const bareIssue = { number: 43, title: 'No labels' };
  const barePayload = buildLaunchSessionPayload({
    issue: bareIssue,
    projectId: 'proj-1',
  });
  assert.equal(barePayload.skills, undefined);
  assert.equal(barePayload.data.skills, undefined);
});

test('buildConsolidatedIssuePrompt: includes recommended skills alongside transclusion fallback', () => {
  const issuesWithLabels = [
    { number: 21, title: 'Fix CSS', labels: [{ name: 'ui' }] },
    { number: 22, title: 'Add API endpoint', labels: [{ name: 'api' }] },
  ];
  const prompt = buildConsolidatedIssuePrompt(issuesWithLabels);
  assert.ok(prompt.includes('### Recommended Skills:'));
  assert.ok(prompt.includes('frontend-ui-engineering'));
  assert.ok(prompt.includes('api-and-interface-design'));
  assert.ok(prompt.includes('Transclusion references for worker sessions:'));
  assert.ok(prompt.includes('[@.agents/skills/build/domain/frontend-ui-engineering/SKILL.md]'));

  // Issues without labels omit the section
  const bareIssues = [{ number: 30, title: 'Plain issue' }];
  const barePrompt = buildConsolidatedIssuePrompt(bareIssues);
  assert.equal(barePrompt.includes('### Recommended Skills:'), false);
});

test('panel/main.ts: all session launch surfaces declare native skills and retain transclusions', () => {
  // Packaged sessions declare native skills
  assert.ok(MAIN_TS.includes('const { skillNames: packageSkills } = resolveIssueSkills(selected);'));
  assert.ok(MAIN_TS.includes('...(packageSkills.length > 0 ? { skills: packageSkills } : {})'));

  // Batch separate sessions declare native skills
  assert.ok(MAIN_TS.includes('...(skillNames.length > 0 ? { skills: skillNames } : {})'));

  // AI drafting and alignment sessions declare issue-lifecycle
  assert.ok(MAIN_TS.includes("skills: ['issue-lifecycle']"));

  // Preflight prompt retains transclusion fallback
  assert.ok(MAIN_TS.includes('Transclusion references for worker sessions:'));
  assert.ok(MAIN_TS.includes('Transclusion fallback:'));
});
