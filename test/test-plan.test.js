import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTestPlan,
  updateTestItemInMarkdown,
  appendTestItemToMarkdown,
  serializeTestPlan,
  getIssueBatch,
  isBatchReadyForReview,
} from '../panel/core.ts';

test('a) parseTestPlan parses both (Issue) and (Batch) sections cleanly', () => {
  const markdown = [
    '# Feature RFC: User Authentication',
    '',
    'Some initial description.',
    '',
    '### Actionable Subtasks Checklist:',
    '- [ ] Implement OAuth controller',
    '',
    '## Test Plan (Issue)',
    '- [ ] Unit test: validate OAuth token format',
    '- [x] Unit test: reject expired credentials',
    '',
    '## Test Plan (Batch)',
    '- [ ] Integration test: e2e login flow across services',
    '- [x] Regression test: legacy session cookie still works',
    '',
    '## Notes',
    'Follow up later.',
  ].join('\n');

  const result = parseTestPlan(markdown);

  assert.equal(result.issueTests.length, 2);
  assert.equal(result.issueTests[0].text, 'Unit test: validate OAuth token format');
  assert.equal(result.issueTests[0].completed, false);
  assert.equal(result.issueTests[0].scope, 'issue');
  assert.equal(result.issueTests[0].lineIndex, 8);

  assert.equal(result.issueTests[1].text, 'Unit test: reject expired credentials');
  assert.equal(result.issueTests[1].completed, true);
  assert.equal(result.issueTests[1].scope, 'issue');
  assert.equal(result.issueTests[1].lineIndex, 9);

  assert.equal(result.batchTests.length, 2);
  assert.equal(result.batchTests[0].text, 'Integration test: e2e login flow across services');
  assert.equal(result.batchTests[0].completed, false);
  assert.equal(result.batchTests[0].scope, 'batch');
  assert.equal(result.batchTests[0].lineIndex, 12);

  assert.equal(result.batchTests[1].text, 'Regression test: legacy session cookie still works');
  assert.equal(result.batchTests[1].completed, true);
  assert.equal(result.batchTests[1].scope, 'batch');
  assert.equal(result.batchTests[1].lineIndex, 13);

  // Edge cases: null, undefined, empty string, or no test plans
  assert.deepEqual(parseTestPlan(null), { issueTests: [], batchTests: [] });
  assert.deepEqual(parseTestPlan(undefined), { issueTests: [], batchTests: [] });
  assert.deepEqual(parseTestPlan(''), { issueTests: [], batchTests: [] });
  assert.deepEqual(parseTestPlan('Just plain body text with no checklists'), { issueTests: [], batchTests: [] });
});

test('b) updateTestItemInMarkdown toggles completion cleanly', () => {
  const body = [
    '## Test Plan (Issue)',
    '- [ ] Item A',
    '- [ ] Item B',
    '',
    '## Test Plan (Batch)',
    '- [ ] Item C',
  ].join('\n');

  // Toggle Item A (lineIndex 1) from false to true
  const updated1 = updateTestItemInMarkdown(body, 1, true);
  const parsed1 = parseTestPlan(updated1);
  assert.equal(parsed1.issueTests[0].completed, true);
  assert.equal(parsed1.issueTests[1].completed, false);
  assert.equal(parsed1.batchTests[0].completed, false);

  // Toggle Item A back to false
  const updated2 = updateTestItemInMarkdown(updated1, 1, false);
  const parsed2 = parseTestPlan(updated2);
  assert.equal(parsed2.issueTests[0].completed, false);

  // Toggle Item C in batch (lineIndex 5)
  const updated3 = updateTestItemInMarkdown(body, 5, true);
  const parsed3 = parseTestPlan(updated3);
  assert.equal(parsed3.batchTests[0].completed, true);
  assert.equal(parsed3.issueTests[0].completed, false);

  // Non-existent lineIndex leaves body untouched
  assert.equal(updateTestItemInMarkdown(body, 999, true), body);
});

test('c) appendTestItemToMarkdown appends under correct section', () => {
  // 1. Appending to body without existing sections creates the section
  const initial = '### Overview\nFeature overview details.';
  const withIssueTest = appendTestItemToMarkdown(initial, 'Verify API response 200', 'issue');
  assert.ok(withIssueTest.includes('## Test Plan (Issue)'));
  assert.ok(withIssueTest.includes('- [ ] Verify API response 200'));

  const parsed1 = parseTestPlan(withIssueTest);
  assert.equal(parsed1.issueTests.length, 1);
  assert.equal(parsed1.issueTests[0].text, 'Verify API response 200');
  assert.equal(parsed1.batchTests.length, 0);

  // 2. Appending batch test appends under Test Plan (Batch)
  const withBatchTest = appendTestItemToMarkdown(withIssueTest, 'Run end-to-end suite', 'batch');
  assert.ok(withBatchTest.includes('## Test Plan (Batch)'));
  assert.ok(withBatchTest.includes('- [ ] Run end-to-end suite'));

  const parsed2 = parseTestPlan(withBatchTest);
  assert.equal(parsed2.issueTests.length, 1);
  assert.equal(parsed2.batchTests.length, 1);
  assert.equal(parsed2.batchTests[0].text, 'Run end-to-end suite');

  // 3. Appending a second item under existing section does not create duplicate headers
  const withSecondIssueTest = appendTestItemToMarkdown(withBatchTest, 'Check error codes', 'issue');
  const issueHeaderCount = (withSecondIssueTest.match(/## Test Plan \(Issue\)/gi) || []).length;
  assert.equal(issueHeaderCount, 1);

  const parsed3 = parseTestPlan(withSecondIssueTest);
  assert.equal(parsed3.issueTests.length, 2);
  assert.equal(parsed3.issueTests[0].text, 'Verify API response 200');
  assert.equal(parsed3.issueTests[1].text, 'Check error codes');
  assert.equal(parsed3.batchTests.length, 1);

  // 4. Edge cases: empty text, empty body
  assert.equal(appendTestItemToMarkdown(initial, '   ', 'issue'), initial);
  const fromEmpty = appendTestItemToMarkdown('', 'Initial item', 'issue');
  assert.ok(fromEmpty.includes('## Test Plan (Issue)'));
  assert.ok(fromEmpty.includes('- [ ] Initial item'));
});

test('serializeTestPlan formats items into markdown test plan section', () => {
  const items = [
    { text: 'Unit test auth', completed: true },
    { text: 'Integration test tokens', completed: false },
  ];

  const serializedIssue = serializeTestPlan(items, 'issue');
  assert.ok(serializedIssue.includes('## Test Plan (Issue)'));
  assert.ok(serializedIssue.includes('- [x] Unit test auth'));
  assert.ok(serializedIssue.includes('- [ ] Integration test tokens'));

  const serializedBatch = serializeTestPlan(items, 'batch');
  assert.ok(serializedBatch.includes('## Test Plan (Batch)'));
  assert.ok(serializedBatch.includes('- [x] Unit test auth'));
  assert.ok(serializedBatch.includes('- [ ] Integration test tokens'));

  // Round-trip verification
  const roundTrip = parseTestPlan(serializedIssue);
  assert.equal(roundTrip.issueTests.length, 2);
  assert.equal(roundTrip.issueTests[0].text, 'Unit test auth');
  assert.equal(roundTrip.issueTests[0].completed, true);
  assert.equal(roundTrip.issueTests[1].text, 'Integration test tokens');
  assert.equal(roundTrip.issueTests[1].completed, false);
});

test('d) getIssueBatch extracts batch name', () => {
  // Label object format
  const issueWithBatch = {
    number: 1,
    title: 'Task 1',
    body: '',
    state: 'open',
    html_url: '',
    labels: [{ name: 'frontend' }, { name: 'batch:checkout-v2' }, { name: 'priority:high' }],
    created_at: '',
    subtasks: [],
  };
  assert.equal(getIssueBatch(issueWithBatch), 'checkout-v2');

  // String label format
  const issueWithStringLabels = {
    number: 2,
    title: 'Task 2',
    body: '',
    state: 'open',
    html_url: '',
    labels: ['bug', 'batch:auth-migration'],
    created_at: '',
    subtasks: [],
  };
  assert.equal(getIssueBatch(issueWithStringLabels), 'auth-migration');

  // Case insensitive prefix
  const issueUpper = {
    number: 3,
    title: 'Task 3',
    body: '',
    state: 'open',
    html_url: '',
    labels: [{ name: 'Batch:payment-flow' }],
    created_at: '',
    subtasks: [],
  };
  assert.equal(getIssueBatch(issueUpper), 'payment-flow');

  // No batch label returns null
  const issueNoBatch = {
    number: 4,
    title: 'Task 4',
    body: '',
    state: 'open',
    html_url: '',
    labels: [{ name: 'enhancement' }, { name: 'theme:core' }],
    created_at: '',
    subtasks: [],
  };
  assert.equal(getIssueBatch(issueNoBatch), null);

  // Empty / null issue returns null
  assert.equal(getIssueBatch(null), null);
  assert.equal(getIssueBatch({ labels: [] }), null);
});

test('e) isBatchReadyForReview accurately computes readiness and reports outstanding issue numbers', () => {
  const issues = [
    {
      number: 101,
      title: 'Sub-feature A',
      state: 'open',
      labels: [{ name: 'batch:billing-revamp' }, { name: 'status:in-review' }],
    },
    {
      number: 102,
      title: 'Sub-feature B',
      state: 'open',
      labels: [{ name: 'batch:billing-revamp' }, { name: 'status:in-progress' }],
    },
    {
      number: 103,
      title: 'Sub-feature C',
      state: 'open',
      labels: [{ name: 'batch:billing-revamp' }, { name: 'status:todo' }],
    },
    {
      number: 104,
      title: 'Sub-feature D',
      state: 'closed', // closed counts as done
      labels: [{ name: 'batch:billing-revamp' }],
    },
    {
      number: 201,
      title: 'Unrelated issue',
      state: 'open',
      labels: [{ name: 'batch:other-batch' }, { name: 'status:todo' }],
    },
  ];

  // Incomplete batch: #102 is in-progress, #103 is todo
  const status1 = isBatchReadyForReview('billing-revamp', issues);
  assert.equal(status1.ready, false);
  assert.equal(status1.total, 4); // #101, #102, #103, #104
  assert.equal(status1.inReview, 1); // #101
  assert.deepEqual(status1.outstandingIssues, [102, 103]);

  // When all non-done issues reach 'in-review' (or 'done')
  const issuesAllReady = [
    {
      number: 101,
      title: 'Sub-feature A',
      state: 'open',
      labels: [{ name: 'batch:billing-revamp' }, { name: 'status:in-review' }],
    },
    {
      number: 102,
      title: 'Sub-feature B',
      state: 'open',
      labels: [{ name: 'batch:billing-revamp' }, { name: 'status:in-review' }],
    },
    {
      number: 103,
      title: 'Sub-feature C',
      state: 'open',
      labels: [{ name: 'batch:billing-revamp' }, { name: 'status:done' }],
    },
    {
      number: 104,
      title: 'Sub-feature D',
      state: 'closed',
      labels: [{ name: 'batch:billing-revamp' }],
    },
  ];

  const status2 = isBatchReadyForReview('billing-revamp', issuesAllReady);
  assert.equal(status2.ready, true);
  assert.equal(status2.total, 4);
  assert.equal(status2.inReview, 2);
  assert.deepEqual(status2.outstandingIssues, []);

  // Unknown batch returns not ready with 0 totals
  const status3 = isBatchReadyForReview('non-existent-batch', issues);
  assert.equal(status3.ready, false);
  assert.equal(status3.total, 0);
  assert.equal(status3.inReview, 0);
  assert.deepEqual(status3.outstandingIssues, []);
});

test('f) panel/index.html defines .badge-awaiting-batch, .test-plan-section, and drawer elements', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const indexHtml = fs.readFileSync(path.join(here, '..', 'panel', 'index.html'), 'utf8');

  // CSS classes exist
  assert.ok(indexHtml.includes('.badge-awaiting-batch'), 'Must define .badge-awaiting-batch in CSS');
  assert.ok(indexHtml.includes('.test-plan-section'), 'Must define .test-plan-section in CSS');

  // Drawer containers and inputs exist
  assert.ok(indexHtml.includes('id="drawerIssueTestsContainer"'), 'Must have drawerIssueTestsContainer');
  assert.ok(indexHtml.includes('id="inputAddIssueTest"'), 'Must have inputAddIssueTest');
  assert.ok(indexHtml.includes('id="btnAddIssueTest"'), 'Must have btnAddIssueTest');
  assert.ok(indexHtml.includes('id="issueTestsProgressText"'), 'Must have issueTestsProgressText');

  assert.ok(indexHtml.includes('id="drawerBatchTestsContainer"'), 'Must have drawerBatchTestsContainer');
  assert.ok(indexHtml.includes('id="inputAddBatchTest"'), 'Must have inputAddBatchTest');
  assert.ok(indexHtml.includes('id="btnAddBatchTest"'), 'Must have btnAddBatchTest');
  assert.ok(indexHtml.includes('id="batchTestsProgressText"'), 'Must have batchTestsProgressText');
});

test('g) card badge rendering produces awaiting-batch badge when issue is in-review but batch has outstanding items', () => {
  const issues = [
    { number: 10, state: 'open', labels: [{ name: 'batch:auth' }, { name: 'status:in-review' }] },
    { number: 11, state: 'open', labels: [{ name: 'batch:auth' }, { name: 'status:in-progress' }] },
    { number: 12, state: 'open', labels: [{ name: 'batch:auth' }, { name: 'status:todo' }] },
  ];

  function renderBatchBadge(targetIssue, col, allIssues) {
    const batchName = getIssueBatch(targetIssue);
    if (col === 'in-review' && batchName) {
      const res = isBatchReadyForReview(batchName, allIssues);
      if (!res.ready && res.outstandingIssues.length > 0) {
        return `<span class="badge-awaiting-batch" title="Waiting on #${res.outstandingIssues.join(', #')} before batch testing">Awaiting Batch</span>`;
      }
    }
    return '';
  }

  // Issue 10 is in-review, batch members 11 and 12 are outstanding
  const badge10 = renderBatchBadge(issues[0], 'in-review', issues);
  assert.equal(badge10, '<span class="badge-awaiting-batch" title="Waiting on #11, #12 before batch testing">Awaiting Batch</span>');

  // Issue 11 is in-progress (not in-review), should NOT show awaiting-batch badge
  const badge11 = renderBatchBadge(issues[1], 'in-progress', issues);
  assert.equal(badge11, '');

  // When all batch members are in-review
  const allReady = [
    { number: 10, state: 'open', labels: [{ name: 'batch:auth' }, { name: 'status:in-review' }] },
    { number: 11, state: 'open', labels: [{ name: 'batch:auth' }, { name: 'status:in-review' }] },
    { number: 12, state: 'open', labels: [{ name: 'batch:auth' }, { name: 'status:in-review' }] },
  ];
  const badgeReady = renderBatchBadge(allReady[0], 'in-review', allReady);
  assert.equal(badgeReady, '');
});
