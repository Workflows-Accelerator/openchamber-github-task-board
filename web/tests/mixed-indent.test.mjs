import test from 'node:test';
import assert from 'node:assert/strict';
import { applyQuestionAnswer, buildBoardList, buildIssueDetail } from '../server/board.ts';
import { HttpSession, startBoard } from './helpers.mjs';
import { makeIssue, startFakeGitHub } from './fake-github.mjs';

for (const spaces of [1, 2, 3]) {
  const indent = ' '.repeat(spaces) + '\t';
  test(`R3: ${spaces} spaces plus tab is code in scanner, list and detail`, () => {
    const raw = makeIssue({ number: 1, body: `## Open Questions\n\n${indent}- [ ] Code?\n` });
    assert.deepEqual(buildBoardList([raw]).issues[0].counts.openQuestions, { total: 0, done: 0, open: 0 });
    assert.deepEqual(buildIssueDetail(raw).openQuestions, []);
  });
  test(`R3: ${spaces} spaces plus tab direct code target refuses before PATCH`, async () => {
    const body = `## Open Questions\r\n\r\n${indent}- [ ] Code?\r\n`;
    const raw = makeIssue({ number: 1, body });
    assert.throws(() => applyQuestionAnswer(raw, 0, 'must refuse'), /no longer answerable/);
    const fake = await startFakeGitHub({ issues: [raw] });
    const board = await startBoard(fake);
    try {
      const client = new HttpSession(board.url);
      assert.equal((await client.login()).status, 200);
      const detail = await client.request('/api/issues/1');
      const response = await client.request('/api/issues/1/questions/0/answer', {
        method: 'POST', body: { answer: 'must refuse', fingerprint: detail.json.issue.fingerprint },
      });
      assert.equal(response.status, 400);
      assert.equal(response.json.error, 'invalid_edit');
      assert.equal(fake.patchCalls.length, 0);
      assert.equal(fake.findIssue(1).body, body);
    } finally {
      await board.app.close();
      await fake.close();
    }
  });
  test(`R3: ${spaces} spaces plus tab stays byte-exact around real nested questions and CRLF`, async () => {
    const body = `## Open Questions\r\n- [x] Done? *(Answer: yes)*\r\n- [ ] First?\r\n\r\n${indent}- [ ] Code?\r\n\r\n  - [ ] Nested real?\r\n    continuation\r\n- [ ] Last?\r\n`;
    const expected = body.replace('  - [ ] Nested real?', '  - [x] Nested real? *(Answer: exact)*');
    const raw = makeIssue({ number: 1, body });
    assert.deepEqual(buildIssueDetail(raw).openQuestions.map((q) => [q.text, q.answerIndex]), [
      ['Done? *(Answer: yes)*', null], ['First?', 0], ['Nested real?', 1], ['Last?', 2],
    ]);
    assert.equal(applyQuestionAnswer(raw, 1, 'exact'), expected);
    const fake = await startFakeGitHub({ issues: [raw] });
    const board = await startBoard(fake);
    try {
      const client = new HttpSession(board.url);
      assert.equal((await client.login()).status, 200);
      const detail = await client.request('/api/issues/1');
      const response = await client.request('/api/issues/1/questions/1/answer', {
        method: 'POST', body: { answer: 'exact', fingerprint: detail.json.issue.fingerprint },
      });
      assert.equal(response.status, 200);
      assert.equal(fake.patchCalls.length, 1);
      assert.equal(fake.findIssue(1).body, expected);
    } finally {
      await board.app.close();
      await fake.close();
    }
  });
}
