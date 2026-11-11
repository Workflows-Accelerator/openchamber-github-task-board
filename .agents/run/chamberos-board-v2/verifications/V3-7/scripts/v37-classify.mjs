// V3-7 hostile review: classification matrix for issue writes.
import path from 'node:path';
const ROOT = process.argv[2];
const { startFakeGitHub, makeIssue } = await import(path.join(ROOT, 'web/tests/fake-github.mjs'));
const { startBoard, HttpSession } = await import(path.join(ROOT, 'web/tests/helpers.mjs'));

const REPO = 'owner/alpha';
const fake = await startFakeGitHub({ repo: REPO, issues: [makeIssue({ number: 1, title: 'T', body: 'Body\n\n<!-- board-order: 1000 -->', labels: ['status:in-progress'], repo: REPO })] });
const board = await startBoard(fake);
const client = new HttpSession(board.url);
await client.login();
const fp = async () => (await client.request('/api/issues/1')).json.issue.fingerprint;

const cases = [
  { name: '400 conditional header', status: 400, payload: { message: 'Bad Request', errors: ['Conditional request headers are not allowed in unsafe requests unless supported by the endpoint'] } },
  { name: '400 bad label', status: 400, payload: { message: 'Bad Request', errors: ['Invalid label name'] } },
  { name: '400 HTML (no JSON)', status: 400, rawBody: '<html>Bad Request</html>', headers: { 'content-type': 'text/html' } },
  { name: '401 token rejected', status: 401, payload: { message: 'Bad credentials' } },
  { name: '403 forbidden', status: 403, payload: { message: 'Resource not accessible by integration' } },
  { name: '403 rate limit', status: 403, payload: { message: 'API rate limit exceeded' }, headers: { 'x-ratelimit-remaining': '0' } },
  { name: '404 vanished', status: 404, payload: { message: 'Not Found' } },
  { name: '409 locked/conflict', status: 409, payload: { message: 'Conflict' } },
  { name: '412 precondition', status: 412, payload: { message: 'Precondition Failed' } },
  { name: '422 validation', status: 422, payload: { message: 'Validation Failed', errors: [{ resource: 'Issue', field: 'labels', code: 'invalid' }] } },
  { name: '422 gateway-ish', status: 422, payload: { message: 'Unprocessable' } },
  { name: '429 rate limited', status: 429, payload: { message: 'Too Many Requests' }, headers: { 'x-ratelimit-remaining': '0' } },
  { name: '500 server', status: 500, payload: { message: 'Internal Server Error' } },
  { name: '502 gateway html', status: 502, rawBody: '<h1>Bad Gateway</h1>', headers: { 'content-type': 'text/html' } },
];

const rows = [];
for (const c of cases) {
  fake.setPatchHook(() => ({ status: c.status, payload: c.payload, rawBody: c.rawBody, headers: c.headers }));
  const res = await client.request('/api/issues/1/canvas', { method: 'PUT', body: { x: 7, y: 9, fingerprint: await fp() } });
  rows.push({
    upstream: c.name,
    serverStatus: res.status,
    serverError: res.json?.error ?? null,
    serverMessage: res.json?.message ?? res.text?.slice(0, 80),
    clientCode: res.status === 401 ? 'unauthenticated'
      : res.json?.error === 'github_forbidden' ? 'github_forbidden'
      : res.status >= 500 ? 'write_outcome_unknown'
      : res.json?.error ?? 'request_failed',
  });
}
fake.setPatchHook(null);

// note path (isCardMove false): the client shows err.message for EN
fake.setPatchHook(() => ({ status: 422, payload: { message: 'Validation Failed', errors: [{ resource: 'Issue', field: 'body', code: 'invalid' }] } }));
const noteRes = await client.request('/api/issues/1/canvas', { method: 'PUT', body: { fingerprint: await fp(), notes: [{ id: 'n1', x: 1, y: 1, text: 'note' }] } });
fake.setPatchHook(null);

console.log(JSON.stringify({ rows, note422: { status: noteRes.status, error: noteRes.json?.error, message: noteRes.json?.message } }, null, 2));
await board.app.close();
await fake.close();
