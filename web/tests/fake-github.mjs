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
  repo = 'owner/repo',
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
    html_url: `https://github.com/${repo}/issues/${number}`,
  };
  if (pull_request) issue.pull_request = { url: `https://api.github.com/repos/${repo}/pulls/${number}` };
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

function repositorySpec(input, index) {
  const repo = input.repo ?? 'owner/repo';
  return {
    repo,
    id: input.id ?? index + 1,
    archived: Boolean(input.archived),
    hasIssues: input.hasIssues !== false,
    private: Boolean(input.private),
    accessible: input.accessible !== false,
    failing: Boolean(input.failing),
    issues: (input.issues ?? []).map((issue) => structuredClone(issue)),
  };
}

/**
 * Starts a fake GitHub REST surface.
 *
 * options:
 *   token           expected bearer token
 *   login           account returned by /user
 *   repo            primary repository "owner/name"
 *   issues          raw issue array for the primary repository
 *   repositories    multi-repository fixtures:
 *                   [{ repo, issues, id, archived, hasIssues, accessible, failing }]
 *   repoAccessible  default true
 *   perPage         page size cap, default 100
 *   listDelayMs     artificial delay for issue-list responses
 */
export async function startFakeGitHub(options = {}) {
  const token = options.token ?? 'ghp_synthetic_fake_github_token';
  const login = options.login ?? 'board-owner';
  const repo = options.repo ?? options.repositories?.[0]?.repo ?? 'owner/repo';
  const specs = options.repositories?.length
    ? options.repositories.map(repositorySpec)
    : [
        repositorySpec(
          {
            repo,
            issues: options.issues ?? [],
            archived: options.archived,
            hasIssues: options.hasIssues,
            accessible: options.repoAccessible,
            id: options.repoId,
          },
          0,
        ),
      ];
  const primary = specs[0];
  const state = {
    requests: [],
    patchCalls: [],
    unknownRepoHits: [],
    failAll: false,
    failDiscovery: false,
    injectedResponse: null,
    discoveryResponse: null,
    honorIfMatch: options.honorIfMatch ?? false,
    beforePatchHook: options.beforePatchHook ?? null,
    patchHook: options.patchHook ?? null,
    listDelayMs: options.listDelayMs ?? 0,
    activeIssueLists: 0,
    maxActiveIssueLists: 0,
    repositories: specs,
  };
  Object.defineProperty(state, 'issues', {
    configurable: true,
    enumerable: true,
    get: () => primary.issues,
    set: (value) => {
      primary.issues = value;
    },
  });
  const perPage = options.perPage ?? 100;

  const findRepo = (full) => specs.find((spec) => spec.repo === full) ?? null;

  function summaryFor(spec) {
    const [owner, name] = spec.repo.split('/');
    return {
      id: spec.id,
      name,
      full_name: spec.repo,
      owner: { login: owner },
      archived: spec.archived,
      disabled: false,
      private: spec.private,
      has_issues: spec.hasIssues,
      permissions: { pull: true, push: true },
    };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    state.requests.push({ method: req.method, path: url.pathname, query: url.search });
    res.setHeader('content-type', 'application/json; charset=utf-8');

    const send = (status, payload, headers = {}) => {
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
      res.statusCode = status;
      res.end(payload === undefined ? '' : JSON.stringify(payload));
    };

    if (state.injectedResponse) {
      return send(state.injectedResponse.status, state.injectedResponse.payload, state.injectedResponse.headers);
    }

    if (state.failAll) {
      return send(500, { message: 'Injected synthetic failure' });
    }

    if (url.pathname === '/user/repos' && req.method === 'GET') {
      if (req.headers.authorization !== `Bearer ${token}`) {
        return send(401, { message: 'Bad credentials' });
      }
      if (state.failDiscovery) {
        return send(500, { message: 'Injected repository discovery failure' });
      }
      if (state.discoveryResponse) {
        return send(state.discoveryResponse.status, state.discoveryResponse.payload);
      }
      const requestedPerPage = Number(url.searchParams.get('per_page') ?? perPage);
      const size = requestedPerPage > 0 ? requestedPerPage : perPage;
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const visible = specs.filter((spec) => spec.accessible);
      const all = visible.map(summaryFor);
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

    if (url.pathname.startsWith('/repos/')) {
      const parts = url.pathname.split('/').filter(Boolean); // repos, owner, name, ...
      const pathRepo = `${parts[1] ?? ''}/${parts[2] ?? ''}`;
      const spec = findRepo(pathRepo);
      if (!spec) {
        state.unknownRepoHits.push(url.pathname);
        return send(404, { message: 'Not Found' });
      }
      if (!spec.accessible) {
        return send(404, { message: 'Not Found' });
      }
      if (req.headers.authorization !== `Bearer ${token}`) {
        return send(401, { message: 'Bad credentials' });
      }
      if (spec.failing) {
        return send(500, { message: 'Injected repository failure' });
      }

      if (req.method === 'GET' && url.pathname === `/repos/${spec.repo}`) {
        return send(200, summaryFor(spec));
      }

      if (url.pathname === `/repos/${spec.repo}/issues` && req.method === 'GET') {
        if (state.listDelayMs > 0) {
          state.activeIssueLists += 1;
          state.maxActiveIssueLists = Math.max(state.maxActiveIssueLists, state.activeIssueLists);
          await new Promise((resolve) => setTimeout(resolve, state.listDelayMs));
          state.activeIssueLists -= 1;
        }
        const requestedPerPage = Number(url.searchParams.get('per_page') ?? perPage);
        const size = requestedPerPage > 0 ? requestedPerPage : perPage;
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const all = spec.issues;
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

      const issueMatch = new RegExp(`^/repos/${spec.repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/issues/(\\d+)$`).exec(
        url.pathname,
      );
      if (issueMatch) {
        const number = Number(issueMatch[1]);
        const index = spec.issues.findIndex((issue) => issue.number === number);
        if (index === -1) return send(404, { message: 'Not Found' });
        const issue = spec.issues[index];

        if (req.method === 'GET') {
          return send(200, issue, { etag: etagFor(issue) });
        }

        if (req.method === 'PATCH') {
          const ifMatch = req.headers['if-match'];
          if (state.honorIfMatch && ifMatch && ifMatch !== etagFor(issue)) {
            return send(412, { message: 'Precondition Failed' });
          }
          let payload;
          try {
            payload = await readBody(req);
          } catch {
            return send(400, { message: 'Bad Request' });
          }
          state.patchCalls.push({ repo: spec.repo, number, payload, ifMatch });

          let applyPayload = true;
          if (state.patchHook) {
            const result = await state.patchHook(issue, payload, req, res, spec.repo);
            if (res.writableEnded) return;
            if (result && typeof result.status === 'number') {
              if (typeof result.rawBody === 'string') {
                for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
                res.statusCode = result.status;
                return res.end(result.rawBody);
              }
              return send(result.status, result.payload ?? {}, result.headers ?? {});
            }
            if (result && result.applyPayload === false) {
              applyPayload = false;
            }
          } else if (state.beforePatchHook) {
            await state.beforePatchHook(issue);
          }

          if (applyPayload) {
            if (payload && typeof payload.body === 'string') issue.body = payload.body;
            if (payload && Array.isArray(payload.labels)) {
              issue.labels = payload.labels.map((name) => ({ name, color: 'ededed' }));
            }
            if (payload && typeof payload.state === 'string') issue.state = payload.state;
          }
          issue.updated_at = new Date().toISOString();
          return send(200, issue, { etag: etagFor(issue) });
        }
      }

      return send(404, { message: 'Not Found' });
    }

    if (req.headers.authorization !== `Bearer ${token}`) {
      return send(401, { message: 'Bad credentials' });
    }

    if (req.method === 'GET' && url.pathname === '/user') {
      return send(200, { login, id: 1 });
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
      return primary.issues;
    },
    get repositories() {
      return specs;
    },
    get patchCalls() {
      return state.patchCalls;
    },
    get requests() {
      return state.requests;
    },
    findIssue(number, repository = primary.repo) {
      const spec = findRepo(repository);
      return spec?.issues.find((issue) => issue.number === number) ?? null;
    },
    setFailure(value) {
      state.failAll = Boolean(value);
    },
    setDiscoveryFailure(value) {
      state.failDiscovery = Boolean(value);
    },
    setDiscoveryResponse(status, payload = {}) {
      state.discoveryResponse = status ? { status, payload } : null;
    },
    setRepoAccessible(repository, value) {
      const spec = findRepo(repository);
      if (!spec) throw new Error(`no synthetic repository ${repository}`);
      spec.accessible = Boolean(value);
    },
    setRepoFailing(repository, value) {
      const spec = findRepo(repository);
      if (!spec) throw new Error(`no synthetic repository ${repository}`);
      spec.failing = Boolean(value);
    },
    setArchived(repository, value) {
      const spec = findRepo(repository);
      if (!spec) throw new Error(`no synthetic repository ${repository}`);
      spec.archived = Boolean(value);
    },
    setHasIssues(repository, value) {
      const spec = findRepo(repository);
      if (!spec) throw new Error(`no synthetic repository ${repository}`);
      spec.hasIssues = Boolean(value);
    },
    setHonorIfMatch(value) {
      state.honorIfMatch = Boolean(value);
    },
    setBeforePatchHook(fn) {
      state.beforePatchHook = fn;
    },
    setPatchHook(fn) {
      state.patchHook = fn;
    },
    setInjectedResponse(status, payload = {}, headers = {}) {
      state.injectedResponse = status ? { status, payload, headers } : null;
    },
    mutateIssue(number, mutate, repository = primary.repo) {
      const spec = findRepo(repository);
      if (!spec) throw new Error(`no synthetic repository ${repository}`);
      const index = spec.issues.findIndex((issue) => issue.number === number);
      if (index === -1) throw new Error(`no synthetic issue ${number} in ${repository}`);
      const next = structuredClone(spec.issues[index]);
      mutate(next);
      next.updated_at = new Date().toISOString();
      spec.issues[index] = next;
      return next;
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
