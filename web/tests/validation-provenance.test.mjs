import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubClient, GitHubError } from '../server/github.ts';
import { HttpSession, startBoard } from './helpers.mjs';
import { makeIssue, startFakeGitHub } from './fake-github.mjs';

const validationError = { resource: 'Issue', field: 'body', code: 'invalid' };
const cases = [
  ['empty gateway errors', { message: 'Gateway lost upstream', errors: [] }],
  ['gateway string errors', { message: 'Gateway lost upstream', errors: ['connection reset'] }],
  ['gateway validation substring', { message: 'Gateway validation failed while relaying committed response' }],
  ['gateway with shaped errors', { message: 'Gateway lost upstream', errors: [validationError] }],
  ['exact message alone', { message: 'Validation Failed' }],
  ['exact message empty errors', { message: 'Validation Failed', errors: [] }],
  ['exact message scalar errors', { message: 'Validation Failed', errors: ['connection reset'] }],
  ['exact message null entry', { message: 'Validation Failed', errors: [null] }],
  ['exact message partial entry', { message: 'Validation Failed', errors: [{}] }],
  ['exact message missing resource', { message: 'Validation Failed', errors: [{ field: 'body', code: 'invalid' }] }],
  ['exact message wrong field', { message: 'Validation Failed', errors: [{ ...validationError, field: {} }] }],
  ['exact message empty resource', { message: 'Validation Failed', errors: [{ ...validationError, resource: '' }] }],
  ['exact message transport code', { message: 'Validation Failed', errors: [{ ...validationError, code: 'connection reset' }] }],
  ['exact message mixed errors', { message: 'Validation Failed', errors: [validationError, 'connection reset'] }],
  ['recognisable validation', { message: 'Validation Failed', errors: [validationError] }, true],
];

for (const kind of ['section', 'question', 'status']) {
  for (const [name, payload, definitive = false] of cases) {
    test(`R2 ${kind}: ${name} is ${definitive ? 'definitive rejection' : 'UNKNOWN after commit'}`, async () => {
      const originalBody = '## Overview\nOriginal\n\n## Open Questions\n- [ ] Question?\n';
      const fake = await startFakeGitHub({ issues: [makeIssue({ number: 1, body: originalBody, labels: ['status:todo'] })] });
      const board = await startBoard(fake);
      try {
        const client = new HttpSession(board.url);
        assert.equal((await client.login()).status, 200);
        const detail = await client.request('/api/issues/1');
        fake.setPatchHook((issue, patch, request, response) => {
          if (!definitive) {
            if (patch.body !== undefined) issue.body = patch.body;
            if (patch.labels !== undefined) issue.labels = patch.labels.map((name) => ({ name }));
          }
          response.writeHead(422, { 'content-type': 'application/json' });
          response.end(JSON.stringify(payload));
        });
        const route = kind === 'section' ? '/section' : kind === 'question' ? '/questions/0/answer' : '/status';
        const response = await client.request('/api/issues/1' + route, {
          method: kind === 'section' ? 'PUT' : 'POST',
          body: { fingerprint: detail.json.issue.fingerprint, sectionId: 'overview', text: 'Committed', answer: 'Committed', status: 'status:in-review' },
        });
        assert.equal(response.status, definitive ? 400 : 502);
        assert.equal(response.json.error, definitive ? 'invalid_request' : 'write_outcome_unknown');
        assert.equal(fake.patchCalls.length, 1, 'one dispatched PATCH, no repeat');
        const current = fake.findIssue(1);
        const committed = kind === 'status' ? current.labels.some((label) => label.name === 'status:in-review') : current.body.includes('Committed');
        assert.equal(committed, !definitive);
        if (definitive) assert.equal(current.body, originalBody);
      } finally {
        await board.app.close();
        await fake.close();
      }
    });
  }
}

test('R2: reads keep exact validation-message mapping without inferring a write outcome', async () => {
  for (const message of ['Validation Failed', 'Validation failed']) {
    const client = new GitHubClient({
      apiBase: 'http://127.0.0.1:1', token: 'synthetic', repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
      fetchImpl: async () => new Response(JSON.stringify({ message }), { status: 422 }),
    });
    await assert.rejects(client.getIssue(1), (error) => error instanceof GitHubError && error.kind === 'invalid');
  }
});

test('R2: GitHubError retains parsed response provenance for UNKNOWN and validation', async () => {
  for (const [name, data, definitive = false] of cases) {
    const client = new GitHubClient({
      apiBase: 'http://127.0.0.1:1', token: 'synthetic', repo: { owner: 'owner', name: 'repo', full: 'owner/repo' },
      fetchImpl: async () => new Response(JSON.stringify(data), { status: 422 }),
    });
    await assert.rejects(client.updateIssue(1, { body: 'test' }), (error) => {
      assert.ok(error instanceof GitHubError, name);
      assert.equal(error.status, 422, name);
      assert.equal(error.jsonParsed, true, name);
      assert.deepEqual(error.data, data, name);
      assert.equal(error.kind, definitive ? 'invalid' : 'server', name);
      return true;
    });
  }
});
