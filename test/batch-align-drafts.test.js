import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignDraftBody,
  alignDraftIssue,
  detectDraftAmbiguity,
} from '../panel/core.ts';

test('detectDraftAmbiguity detects question marks, tbd, unclear, and question sentences', () => {
  const clear = detectDraftAmbiguity('Add login button', 'Implement oauth flow for GitHub.');
  assert.equal(clear.hasAmbiguity, false);
  assert.equal(clear.questions.length, 0);

  const ambiguousTitle = detectDraftAmbiguity('Should we use JWT or session cookies?', 'Need to decide.');
  assert.equal(ambiguousTitle.hasAmbiguity, true);
  assert.ok(ambiguousTitle.questions.length > 0);

  const ambiguousBody = detectDraftAmbiguity('Migrate database', 'Architecture is unclear. TBD which engine to use.');
  assert.equal(ambiguousBody.hasAmbiguity, true);
  assert.ok(ambiguousBody.questions.length >= 2);
});

test('alignDraftBody structures body with Overview, Scope, Acceptance Criteria', () => {
  const unformatted = 'Need a caching layer for Redis endpoints';
  const result = alignDraftBody('Add Redis cache', unformatted);

  assert.ok(result.body.includes('## Overview'));
  assert.ok(result.body.includes('## Scope'));
  assert.ok(result.body.includes('## Acceptance Criteria'));
  assert.ok(result.body.includes('Need a caching layer for Redis endpoints'));
  assert.equal(result.hasAmbiguity, false);
});

test('alignDraftBody adds Open Questions section when ambiguity exists', () => {
  const ambiguous = 'Should we use Redis or Memcached?';
  const result = alignDraftBody('Choose cache', ambiguous);

  assert.ok(result.body.includes('## Overview'));
  assert.ok(result.body.includes('## Scope'));
  assert.ok(result.body.includes('## Acceptance Criteria'));
  assert.ok(result.body.includes('## Open Questions'));
  assert.ok(result.body.includes('- [ ] Should we use Redis or Memcached?'));
  assert.equal(result.hasAmbiguity, true);
});

test('alignDraftIssue transitions status:draft to status:backlog and assigns priority:medium', () => {
  const issue = {
    number: 42,
    title: 'Refactor search input component',
    body: 'Clean up the debounce handling and event listeners.',
    labels: ['status:draft', 'frontend'],
  };

  const aligned = alignDraftIssue(issue);

  assert.ok(!aligned.labels.includes('status:draft'));
  assert.ok(aligned.labels.includes('status:backlog'));
  assert.ok(aligned.labels.includes('frontend'));
  assert.ok(aligned.labels.includes('priority:medium'));
  assert.ok(!aligned.labels.includes('needs:human'));
  assert.ok(aligned.body.includes('## Overview'));
  assert.ok(aligned.body.includes('## Scope'));
  assert.ok(aligned.body.includes('## Acceptance Criteria'));
});

test('alignDraftIssue preserves existing priority label', () => {
  const issue = {
    number: 43,
    title: 'Critical bug in payment webhook',
    body: 'Fix null check on payment payload.',
    labels: ['status:draft', 'priority:high', 'backend'],
  };

  const aligned = alignDraftIssue(issue);

  assert.ok(aligned.labels.includes('priority:high'));
  assert.ok(!aligned.labels.includes('priority:medium'));
  assert.ok(aligned.labels.includes('status:backlog'));
  assert.ok(aligned.labels.includes('backend'));
  assert.ok(!aligned.labels.includes('status:draft'));
});

test('alignDraftIssue applies needs:human label when ambiguity exists', () => {
  const issue = {
    number: 44,
    title: 'Should we deprecate the v1 API endpoint?',
    body: 'Not sure if mobile clients still rely on it. TBD.',
    labels: ['status:draft'],
  };

  const aligned = alignDraftIssue(issue);

  assert.equal(aligned.hasAmbiguity, true);
  assert.ok(aligned.labels.includes('needs:human'));
  assert.ok(aligned.labels.includes('status:backlog'));
  assert.ok(aligned.labels.includes('priority:medium'));
  assert.ok(aligned.body.includes('## Open Questions'));
});
