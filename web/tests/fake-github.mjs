// Synthetic GitHub API used by tests and the browser verification run.
// No real token, account, network or credential is involved.

import { createHash } from 'node:crypto';
import http from 'node:http';

export function makeIssue({
  number,
  title = `Synthetic issue ${number}`,
  body = '',
  state = 'open',
  labels = [],
  user = 'board-owner',
  updated_at = '2026-10-20T10:00:00Z',
  pull_request = false,
} = {}) {
  const issue = {
    number,
    title,
    body,
    state,
    labels: labels.map((label) =>
      typeof label === 'string' ? { name: label, color: 'ededed' } : label,
    ),
    user: { login: user, avatar_url: '' },
    assignees: [],
    comments: 0,
    created_at: '2026-10-01T09:00:00Z',
    updated_at,
    html_url: `https://github.com/owner/repo/issues/${number}`,
  };
  if (pull_request) issue.pull_request = { url: `https://api.github.com/repos/owner/repo/pulls/${number}` };
  return issue;
}

function etagFor(issue) {
  return `"${createHash('sha1').update(JSON.stringify(issue)).digest('hex')}"`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Starts a fake GitHub REST surface.
 *
 * options:
 *   token           expected bearer token
 *   login           account returned by /user
 *   repo            "owner/name"
 *   issues          raw issue array
 *   repoAccessible  default true
 *   perPage         page size cap, default 100
 */
export async function startFakeGitHub(options = {}) {
  const token = options.token ?? 'ghp_synthetic_fake_github_token';
  const login = options.login ?? 'board-owner';
  const repo = options.repo ?? 'owner/repo';
  const state = {
    issues: options.issues ? options.issues.map((issue) => structuredClone(issue)) : [],
    requests: [],
    patchCalls: [],
    unknownRepoHits: [],
    failAll: false,
  };
  const perPage = options.perPage ?? 100;
  const repoAccessible = options.repoAccessible !== false;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    state.requests.push({ method: req.method, path: url.pathname, query: url.search });
    res.setHeader('content-type', 'application/json; charset=utf-8');

    const send = (status, payload, headers = {}) => {
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
      res.statusCode = status;
      res.end(payload === undefined ? '' : JSON.stringify(payload));
    };

    if (state.failAll) {
      return send(500, { message: 'Injected synthetic failure' });
    }

    if (url.pathname.startsWith('/repos/')) {
      const parts = url.pathname.split('/').filter(Boolean); // repos, owner, name, ...
      const pathRepo = `${parts[1] ?? ''}/${parts[2] ?? ''}`;
      if (pathRepo !== repo) {
        state.unknownRepoHits.push(url.pathname);
        return send(404, { message: 'Not Found' });
      }
    }

    if (req.headers.authorization !== `Bearer ${token}`) {
      return send(401, { message: 'Bad credentials' });
    }

    if (req.method === 'GET' && url.pathname === '/user') {
      return send(200, { login, id: 1 });
    }

    if (req.method === 'GET' && url.pathname === `/repos/${repo}`) {
      if (!repoAccessible) return send(404, { message: 'Not Found' });
      return send(200, { full_name: repo, private: false, permissions: { pull: true, push: true } });
    }

    if (url.pathname === `/repos/${repo}/issues` && req.method === 'GET') {
      const requestedPerPage = Number(url.searchParams.get('per_page') ?? perPage);
      const size = requestedPerPage > 0 ? requestedPerPage : perPage;
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const all = state.issues;
      const start = (page - 1) * size;
      const items = all.slice(start, start + size);
      const headers = {};
      if (start + size < all.length) {
        const next = new URL(`http://${req.headers.host}${url.pathname}`);
        next.searchParams.set('per_page', String(size));
        next.searchParams.set('page', String(page + 1));
        headers.link = `<${next.toString()}>; rel="next"`;
      }
      return send(200, items, headers);
    }

    const issueMatch = new RegExp(`^/repos/${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/issues/(\\d+)$`).exec(
      url.pathname,
    );
    if (issueMatch) {
      const number = Number(issueMatch[1]);
      const index = state.issues.findIndex((issue) => issue.number === number);
      if (index === -1) return send(404, { message: 'Not Found' });
      const issue = state.issues[index];

      if (req.method === 'GET') {
        return send(200, issue, { etag: etagFor(issue) });
      }

      if (req.method === 'PATCH') {
        const ifMatch = req.headers['if-match'];
        if (ifMatch && ifMatch !== etagFor(issue)) {
          return send(412, { message: 'Precondition Failed' });
        }
        let payload;
        try {
          payload = await readBody(req);
        } catch {
          return send(400, { message: 'Bad Request' });
        }
        state.patchCalls.push({ number, payload, ifMatch });
        if (payload && typeof payload.body === 'string') issue.body = payload.body;
        if (payload && Array.isArray(payload.labels)) {
          issue.labels = payload.labels.map((name) => ({ name, color: 'ededed' }));
        }
        if (payload && typeof payload.state === 'string') issue.state = payload.state;
        issue.updated_at = new Date().toISOString();
        return send(200, issue, { etag: etagFor(issue) });
      }
    }

    return send(404, { message: 'Not Found' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    url: baseUrl,
    token,
    login,
    repo,
    state,
    get issues() {
      return state.issues;
    },
    get patchCalls() {
      return state.patchCalls;
    },
    get requests() {
      return state.requests;
    },
    findIssue(number) {
      return state.issues.find((issue) => issue.number === number) ?? null;
    },
    setFailure(value) {
      state.failAll = Boolean(value);
    },
    mutateIssue(number, mutate) {
      const index = state.issues.findIndex((issue) => issue.number === number);
      if (index === -1) throw new Error(`no synthetic issue ${number}`);
      const next = structuredClone(state.issues[index]);
      mutate(next);
      next.updated_at = new Date().toISOString();
      state.issues[index] = next;
      return next;
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
