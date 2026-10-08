import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchIssuePage,
  FULL_ISSUE_PAGE_SIZE,
  SMALL_ISSUE_PAGE_SIZE,
} from '../panel/core.ts';

const issues = (count) => Array.from({ length: count }, (_, i) => ({ number: i + 1 }));
const perPage = (path) => Number(new URL(path, 'https://api.github.com').searchParams.get('per_page'));

// A host that cuts a large answer off hands back text that fails JSON.parse.
const truncatingHost = (limit) => async (_method, path) => {
  const size = perPage(path);
  if (size > limit) JSON.parse('[{"body":"cut off');
  return issues(size);
};

test('reads the full page size when the host carries it', async () => {
  const sizes = new Map();
  const seen = [];
  const page = await fetchIssuePage('o/r', 1, async (_m, path) => { seen.push(path); return issues(3); }, sizes);
  assert.equal(page.pageSize, FULL_ISSUE_PAGE_SIZE);
  assert.equal(page.items.length, 3);
  assert.deepEqual(seen, ['/repos/o/r/issues?state=all&per_page=100&page=1']);
  assert.equal(sizes.has('o/r'), false);
});

test('a cut-off first page switches that repo to small pages and keeps them', async () => {
  const sizes = new Map();
  const shrunk = [];
  const request = truncatingHost(SMALL_ISSUE_PAGE_SIZE);
  const first = await fetchIssuePage('o/r', 1, request, sizes, (size) => shrunk.push(size));
  assert.equal(first.pageSize, SMALL_ISSUE_PAGE_SIZE);
  assert.equal(first.items.length, SMALL_ISSUE_PAGE_SIZE);
  assert.deepEqual(shrunk, [SMALL_ISSUE_PAGE_SIZE]);

  const second = await fetchIssuePage('o/r', 2, request, sizes);
  assert.equal(second.pageSize, SMALL_ISSUE_PAGE_SIZE);

  const other = await fetchIssuePage('o/other', 1, async () => issues(1), sizes);
  assert.equal(other.pageSize, FULL_ISSUE_PAGE_SIZE);
});

test('a host that refuses an oversized answer by code is handled the same way', async () => {
  const sizes = new Map();
  const request = async (_m, path) => {
    if (perPage(path) > SMALL_ISSUE_PAGE_SIZE) throw Object.assign(new Error('too large'), { code: 'RESPONSE_TOO_LARGE' });
    return issues(1);
  };
  const page = await fetchIssuePage('o/r', 1, request, sizes);
  assert.equal(page.pageSize, SMALL_ISSUE_PAGE_SIZE);
});

test('other failures, and oversized later pages, are not retried', async () => {
  const sizes = new Map();
  let calls = 0;
  const failing = async () => { calls++; throw new Error('GitHub API error: 500'); };
  await assert.rejects(fetchIssuePage('o/r', 1, failing, sizes), /500/);
  assert.equal(calls, 1);

  await assert.rejects(fetchIssuePage('o/r', 2, truncatingHost(SMALL_ISSUE_PAGE_SIZE), sizes), SyntaxError);
  assert.equal(sizes.has('o/r'), false);
});
