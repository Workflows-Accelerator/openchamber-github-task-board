import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, '.agents/run/board-lifecycle/verifications/clickthrough-2026-10-08/screenshots');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const PORT = 48937;

const mockIssues = [
  {
    id: 1021,
    number: 21,
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    title: 'feat(skill): implement unified issue-lifecycle skill and validation gates',
    body: `### Friendly Title: Universal Issue Lifecycle Skill

**Overview:** One canonical issue-lifecycle skill aligning the board, AI prompts, and Voice triage sessions.

### Human Tasks:
- [ ] Verify issue-lifecycle skill transclusions against live prompt
- [ ] Review external dependency in other-org/external-repo#99 before proceeding
- [ ] Track voice discussion at https://github.com/Workflows-Accelerator/chambervoice/issues/12

### Open Questions:
- [ ] Should archived issues be excluded from default voice agenda scans?
- [ ] Review cross-project query in other-org/external-repo#100

### Actionable Subtasks Checklist:
- [x] Standardize issue-body contract v1
- [x] Integrate multi-turn gate ledger`,
    state: 'open',
    labels: [
      { name: 'status:needs-human', color: 'ff9800' },
      { name: 'priority:high', color: 'e91e63' },
      { name: 'theme:lifecycle', color: '2196f3' }
    ],
    user: { login: 'agent-executor' },
    created_at: '2026-09-26T10:00:00Z',
    updated_at: '2026-10-08T09:00:00Z',
    comments: 2,
    html_url: 'https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/21'
  },
  {
    id: 1022,
    number: 22,
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    title: 'fix(core): resolve race condition on scratchpad debounce',
    body: `**Overview:** Scratchpad was saving simultaneously on rapid keydown bursts. Body intentionally lacks Friendly Title to verify D14 fallback.

### Actionable Subtasks Checklist:
- [x] Add flushScratchpadSave on blur and modal dismiss
- [x] Enforce 1000ms debounce timer`,
    state: 'open',
    labels: [
      { name: 'status:in-progress', color: '2196f3' },
      { name: 'priority:high', color: 'e91e63' },
      { name: 'theme:core', color: '9c27b0' }
    ],
    user: { login: 'agent-dev' },
    created_at: '2026-09-26T12:00:00Z',
    updated_at: '2026-10-08T09:10:00Z',
    comments: 1,
    html_url: 'https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/22'
  },
  {
    id: 1023,
    number: 23,
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    title: 'feat(board): implement simplified views and layout toggle',
    body: `### Friendly Title: Simplified Review and Intake Views

**Overview:** Deliver three simplified views (Human Tasks, All Tasks, Questions) for rapid human triage.

### Human Tasks:
- [ ] Review three simplified view layouts on integration preview
- [ ] Validate checkbox toggle behavior on human tasks queue

### Open Questions:
- [ ] Should completed human tasks remain visible in the queue with a strikethrough?

### Actionable Subtasks Checklist:
- [x] Create view mode toolbar buttons
- [x] Implement resolveSimplifiedViewTitle`,
    state: 'open',
    labels: [
      { name: 'status:needs-human', color: 'ff9800' },
      { name: 'priority:critical', color: 'f44336' },
      { name: 'theme:views', color: '00bcd4' }
    ],
    user: { login: 'agent-dev' },
    created_at: '2026-09-26T14:00:00Z',
    updated_at: '2026-10-08T09:20:00Z',
    comments: 4,
    html_url: 'https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/23'
  },
  {
    id: 1024,
    number: 24,
    repo: 'Workflows-Accelerator/openchamber-github-task-board',
    title: 'fix(repo): anchor repository selection to active session with easy switching',
    body: `### Friendly Title: Reliable Session Repository Discovery

**Overview:** Ensure repository selection follows the active session by default while keeping manual override and explicit switching clean.

### Open Questions:
- [ ] How should custom repositories not bound to OpenChamber projects be persisted?

### Actionable Subtasks Checklist:
- [x] Support V2 session location directory and item data
- [x] Add Current session anchor to repo popover`,
    state: 'open',
    labels: [
      { name: 'status:todo', color: '4caf50' },
      { name: 'priority:medium', color: 'ff9800' },
      { name: 'theme:repo', color: '795548' }
    ],
    user: { login: 'architect' },
    created_at: '2026-10-07T08:00:00Z',
    updated_at: '2026-10-08T09:30:00Z',
    comments: 0,
    html_url: 'https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/24'
  }
];

const mockChamberVoiceIssues = [
  {
    id: 2012,
    number: 12,
    repo: 'Workflows-Accelerator/chambervoice',
    title: 'feat(voice): streaming audio transcription buffer',
    body: `### Friendly Title: Streaming Voice Engine

**Overview:** Voice pipeline streaming buffer integration.

### Human Tasks:
- [ ] Verify latency bounds in production preview
- [ ] Coordinate with task board in Workflows-Accelerator/openchamber-github-task-board#21

### Open Questions:
- [ ] Should voice triage pause automatically on agent questions?`,
    state: 'open',
    labels: [
      { name: 'status:needs-human', color: 'ff9800' },
      { name: 'priority:high', color: 'e91e63' }
    ],
    user: { login: 'voice-agent' },
    created_at: '2026-10-07T10:00:00Z',
    updated_at: '2026-10-08T09:00:00Z',
    comments: 1,
    html_url: 'https://github.com/Workflows-Accelerator/chambervoice/issues/12'
  }
];

const mockParentScript = (params) => `
<script>
window.__MOCK_ISSUES__ = ${JSON.stringify(mockIssues)};
window.__MOCK_CHAMBERVOICE_ISSUES__ = ${JSON.stringify(mockChamberVoiceIssues)};

(function() {
  const mockStorageMap = new Map();
  mockStorageMap.set('repo_p1', 'Workflows-Accelerator/openchamber-github-task-board');
  mockStorageMap.set('repo_p2', 'Workflows-Accelerator/chambervoice');

  const mockProjects = [
    { id: 'p1', name: 'github-task-board', directory: '/workspace/extensions/github-task-board', linkedRepo: 'Workflows-Accelerator/openchamber-github-task-board' },
    { id: 'p2', name: 'chambervoice', directory: '/workspace/extensions/chambervoice', linkedRepo: 'Workflows-Accelerator/chambervoice' }
  ];

  const mockSessions = [
    {
      id: 'ses_main_23',
      title: 'Review Feedback Implementation',
      activity: 'waiting-permission',
      directory: '/workspace/extensions/github-task-board',
      items: [
        { id: '23', data: { issueNumber: 23, repo: 'Workflows-Accelerator/openchamber-github-task-board' } }
      ]
    }
  ];

  const mockParent = {
    isMockHost: true,
    postMessage: function(data) {
      if (!data || data.channel !== 'openchamber.sdk') return;

      const reply = (id, payload, ok = true, error = null) => {
        setTimeout(() => {
          const evt = new MessageEvent('message', {
            data: {
              channel: 'openchamber.sdk',
              v: 1,
              type: 'result',
              id: id,
              ok: ok,
              payload: payload,
              error: error
            }
          });
          Object.defineProperty(evt, 'source', { value: mockParent });
          window.dispatchEvent(evt);
        }, 5);
      };

      if (data.type === 'hello') {
        setTimeout(() => {
          const evt = new MessageEvent('message', {
            data: {
              channel: 'openchamber.sdk',
              v: 1,
              type: 'ready',
              payload: {
                surface: 'panel',
                directory: '/workspace/extensions/github-task-board',
                session: mockSessions[0],
                connection: { status: 'connected' },
                settings: {},
                theme: {
                  mode: 'dark',
                  tokens: {
                    font: 'system-ui, -apple-system, sans-serif',
                    foreground: '#e0e0e0',
                    background: '#121212'
                  }
                }
              }
            }
          });
          Object.defineProperty(evt, 'source', { value: mockParent });
          window.dispatchEvent(evt);
        }, 5);
      } else if (data.id) {
        if (data.type === 'workspace-read') {
          if (data.payload?.kind === 'projects') {
            reply(data.id, { kind: 'projects', state: 'ready', projects: mockProjects });
          } else if (data.payload?.kind === 'sessions') {
            reply(data.id, { kind: 'sessions', state: 'ready', sessions: mockSessions });
          } else if (data.payload?.kind === 'worktrees') {
            reply(data.id, { kind: 'worktrees', state: 'ready', worktrees: [] });
          } else {
            reply(data.id, { kind: data.payload?.kind, state: 'ready' });
          }
        } else if (data.type === 'workspace-subscribe') {
          reply(data.id, { subscribed: true });
        } else if (data.type === 'file-read') {
          const path = data.payload?.path || '';
          if (path.includes('.git/config')) {
            reply(data.id, { content: '[remote "origin"]\\n\\turl = git@github.com:Workflows-Accelerator/openchamber-github-task-board.git\\n' });
          } else {
            reply(data.id, { content: '' });
          }
        } else if (data.type === 'storage') {
          if (data.payload?.op === 'get') {
            reply(data.id, {
              storage: true,
              op: 'get',
              key: data.payload.key,
              found: mockStorageMap.has(data.payload.key),
              value: mockStorageMap.get(data.payload.key)
            });
          } else if (data.payload?.op === 'set') {
            mockStorageMap.set(data.payload.key, data.payload.value);
            reply(data.id, { storage: true, op: 'set', key: data.payload.key, value: data.payload.value });
          } else {
            reply(data.id, { storage: true, op: data.payload?.op });
          }
        } else if (data.type === 'request') {
          const empty = '${params.empty || ''}';
          const reqPath = data.payload?.path || '';
          if (empty === 'rate-limited') {
            reply(data.id, {
              status: 403,
              body: JSON.stringify({ message: 'API rate limit exceeded for Workflows-Accelerator/openchamber-github-task-board' }),
              headers: { 'x-ratelimit-remaining': '0' }
            }, true);
          } else if (empty === 'inaccessible') {
            reply(data.id, {
              status: 403,
              body: JSON.stringify({ message: 'Must have push access to repository (HTTP 403 Forbidden)' }),
              headers: { 'x-ratelimit-remaining': '4999' }
            });
          } else if (empty === 'failed') {
            reply(data.id, {
              status: 500,
              body: JSON.stringify({ message: 'Internal Server Error (HTTP 500)' }),
              headers: { 'x-ratelimit-remaining': '4999' }
            });
          } else if (empty === 'empty') {
            reply(data.id, {
              status: 200,
              body: JSON.stringify([]),
              headers: { 'x-ratelimit-remaining': '4999', etag: '"mock-etag-empty"' }
            });
          } else if (reqPath.includes('chambervoice')) {
            reply(data.id, {
              status: 200,
              body: JSON.stringify(window.__MOCK_CHAMBERVOICE_ISSUES__),
              headers: { 'x-ratelimit-remaining': '4999', etag: '"mock-etag-cv"' }
            });
          } else {
            reply(data.id, {
              status: 200,
              body: JSON.stringify(window.__MOCK_ISSUES__),
              headers: { 'x-ratelimit-remaining': '4999', etag: '"mock-etag-v1"' }
            });
          }
        } else {
          reply(data.id, {});
        }
      }
    }
  };

  try {
    Object.defineProperty(window, 'parent', { value: mockParent, configurable: true, writable: true });
  } catch(e) {
    console.error('Failed to set mock parent:', e);
  }

  window.addEventListener('load', () => {
    const mode = '${params.mode || ''}';
    const popover = '${params.popover || ''}';
    const empty = '${params.empty || ''}';
    const allProjects = '${params.allProjects || ''}';

    let interactionAttempted = false;

    const pollInterval = setInterval(() => {
      if (!interactionAttempted) {
        if (allProjects === 'true') {
          const popoverItems = document.querySelectorAll('#detectedReposList .popover-item');
          const allProj = document.querySelector('#detectedReposList .all-projects-option');
          if (allProj && popoverItems.length > 0) {
            interactionAttempted = true;
            allProj.click();
            setTimeout(() => {
              if (mode === 'human') {
                const btnH = document.getElementById('btnViewHuman');
                if (btnH) btnH.click();
              } else if (mode === 'questions') {
                const btnQ = document.getElementById('btnViewQuestions');
                if (btnQ) btnQ.click();
              }
            }, 50);
          }
        } else if (mode === 'human') {
          const btn = document.getElementById('btnViewHuman');
          if (btn) {
            btn.click();
            interactionAttempted = true;
          }
        } else if (mode === 'all-tasks') {
          const btn = document.getElementById('btnViewAllTasks');
          if (btn) {
            btn.click();
            interactionAttempted = true;
          }
        } else if (mode === 'questions') {
          const btn = document.getElementById('btnViewQuestions');
          if (btn) {
            btn.click();
            interactionAttempted = true;
          }
        } else if (mode === 'list') {
          const btn = document.getElementById('btnViewList');
          if (btn) {
            btn.click();
            interactionAttempted = true;
          }
        } else if (popover === 'repo') {
          const btn = document.getElementById('btnRepoSelect');
          if (btn) {
            btn.click();
            const vc = document.querySelector('.view-container');
            if (vc) vc.style.visibility = 'hidden';
            interactionAttempted = true;
          }
        } else {
          interactionAttempted = true;
        }
      }

      let isReady = false;
      if (empty === 'rate-limited') {
        const box = document.querySelector('.empty-box.empty-state-rate-limited');
        if (box) isReady = true;
      } else if (empty) {
        const box = document.querySelector('.empty-box');
        if (box) {
          if (empty === 'inaccessible' && box.classList.contains('empty-state-inaccessible')) isReady = true;
          else if (empty === 'failed' && box.classList.contains('empty-state-failed')) isReady = true;
          else if (empty === 'empty' && box.classList.contains('empty-state-empty')) isReady = true;
        }
      } else if (allProjects === 'true') {
        if (mode === 'human') {
          const grp = document.querySelector('.human-repo-group');
          if (grp) isReady = true;
        } else if (mode === 'questions') {
          const grp = document.querySelector('.questions-repo-group');
          if (grp) isReady = true;
        } else {
          const anyGroup = document.querySelector('.human-repo-group, .questions-repo-group, .task-group');
          if (anyGroup) isReady = true;
        }
      } else if (popover === 'repo') {
        const popoverEl = document.getElementById('repoPopover');
        const currentSessionOpt = document.querySelector('.current-session-option');
        if (popoverEl && popoverEl.classList.contains('active') && currentSessionOpt) {
          isReady = true;
        }
      } else if (mode === 'all-tasks') {
        const container = document.getElementById('allTasksViewContainer');
        if (container && container.querySelector('.all-task-card') && !container.textContent.includes('Connecting repo...')) {
          isReady = true;
        }
      } else if (mode === 'human') {
        const container = document.getElementById('humanViewContainer');
        if (container && container.querySelector('.human-issue-card') && !container.textContent.includes('Connecting repo...')) {
          isReady = true;
        }
      } else if (mode === 'questions') {
        const container = document.getElementById('questionsViewContainer');
        if (container && container.querySelector('.questions-issue-card') && !container.textContent.includes('Connecting repo...')) {
          isReady = true;
        }
      } else {
        const anyCard = document.querySelector('.all-task-card, .human-issue-card, .questions-issue-card, .issue-card');
        if (anyCard && !document.body.textContent.includes('Connecting repo...')) {
          isReady = true;
        }
      }

      if (isReady && interactionAttempted) {
        document.body.dataset.readyForCapture = 'true';
        clearInterval(pollInterval);
      }
    }, 50);
  });
})();
</script>
`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const rawIndex = fs.readFileSync(path.join(ROOT_DIR, 'panel/index.html'), 'utf8');
    const params = {
      mode: url.searchParams.get('mode'),
      popover: url.searchParams.get('popover'),
      empty: url.searchParams.get('empty'),
      allProjects: url.searchParams.get('allProjects'),
    };

    const injected = rawIndex.replace(
      '<script src="./main.js"></script>',
      mockParentScript(params) + '\n<script src="./main.js"></script>'
    );

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(injected);
    return;
  }

  if (url.pathname === '/main.js' || url.pathname === '/panel/main.js') {
    const content = fs.readFileSync(path.join(ROOT_DIR, 'panel/main.js'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(content);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Preview server running at http://127.0.0.1:${PORT}`);

  const captures = [
    {
      name: '01-all-tasks-d14-fallback.png',
      url: `http://127.0.0.1:${PORT}/?mode=all-tasks`,
      selector: 'body[data-ready-for-capture="true"] #allTasksViewContainer .all-task-card',
      desc: 'D14: All Tasks view with friendly titles where present and fallback directly to issue.title on issue #22 without placeholder',
    },
    {
      name: '02-human-tasks-view.png',
      url: `http://127.0.0.1:${PORT}/?mode=human`,
      selector: 'body[data-ready-for-capture="true"] #humanViewContainer .human-issue-card',
      desc: 'Human Tasks view populated with checklist items from issues #21 and #23, source badges, and session binding',
    },
    {
      name: '03-questions-view.png',
      url: `http://127.0.0.1:${PORT}/?mode=questions`,
      selector: 'body[data-ready-for-capture="true"] #questionsViewContainer .questions-issue-card',
      desc: 'Questions view populated with open questions extracted from issues #21, #23, and #24',
    },
    {
      name: '04-repo-popover-d15-picked-and-notice.png',
      url: `http://127.0.0.1:${PORT}/?popover=repo`,
      selector: 'body[data-ready-for-capture="true"] #repoPopover.active .current-session-option',
      desc: 'D15: Repository dropdown popover showing inline session repo, [picked] badge on active repo, and [active default] anchor',
    },
    {
      name: '05-all-projects-d16-grouping.png',
      url: `http://127.0.0.1:${PORT}/?mode=human&allProjects=true`,
      selector: 'body[data-ready-for-capture="true"] #humanViewContainer .human-repo-group',
      desc: 'D16: All Projects mode grouping Human Tasks by repository with full-URL cross-repo issue links',
    },
    {
      name: '06-empty-state-rate-limited.png',
      url: `http://127.0.0.1:${PORT}/?empty=rate-limited`,
      selector: 'body[data-ready-for-capture="true"] .empty-box.empty-state-rate-limited',
      desc: 'D15: Empty state for API Rate-Limited repository with clock icon and actionable Personal Access Token guidance',
    },
  ];

  try {
    for (const cap of captures) {
      const outPath = path.join(SCREENSHOTS_DIR, cap.name);
      console.log(`Capturing ${cap.name}...`);
      const cmd = `obscura fetch "${cap.url}" --allow-private-network --wait 10 --selector "${cap.selector}" -s "${outPath}"`;
      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) console.log(stdout.trim());
      if (stderr) console.error(stderr.trim());
      const stats = fs.statSync(outPath);
      console.log(`Saved ${cap.name} (${stats.size} bytes)`);
    }
    console.log('All verification screenshots captured successfully.');
  } catch (err) {
    console.error('Capture failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
