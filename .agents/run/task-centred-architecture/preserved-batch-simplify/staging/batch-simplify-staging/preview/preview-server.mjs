import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { createBoardServer } from '../../../../web/server/app.ts';
import { loadConfig } from '../../../../web/server/config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PID_FILE = path.join(__dirname, 'preview.pid');
const INFO_FILE = path.join(__dirname, 'preview-info.json');

const SESSION_FILE = '/tmp/antigravity/preview-sessions.json';
const PROJECT_NAMES_FILE = '/tmp/antigravity/preview-project-names.json';

const PREVIEW_PORT = parseInt(process.env.PREVIEW_PORT || '4040', 10);
const PREVIEW_HOST = process.env.PREVIEW_HOST || '0.0.0.0';

// Synthetic Multi-project fixtures
const repo1 = 'Workflows-Accelerator/openchamber-github-task-board';
const repo2 = 'Workflows-Accelerator/workflows-mobile-pwa';

const fakeGitHub = await startFakeGitHub({
  login: 'preview-user',
  repositories: [
    {
      repo: repo1,
      id: 101,
      issues: [
        makeIssue({
          number: 1,
          repo: repo1,
          title: 'Draft: Quick capture idea',
          body: 'Simple quick capture overview\n<!-- board-order: 1000 -->',
          labels: ['status:draft'],
          created_at: '2026-10-25T10:00:00Z',
          updated_at: '2026-10-25T10:00:00Z',
        }),
        makeIssue({
          number: 2,
          repo: repo1,
          title: 'Draft: Unordered brainstorm item',
          body: 'Brainstorm overview without explicit order marker',
          labels: ['status:draft'],
          created_at: '2026-10-20T08:00:00Z',
          updated_at: '2026-10-20T08:00:00Z',
        }),
        makeIssue({
          number: 3,
          repo: repo1,
          title: 'Draft: Second ordered item',
          body: 'Second item overview\n<!-- board-order: 2000 -->',
          labels: ['status:draft'],
          created_at: '2026-10-25T11:00:00Z',
          updated_at: '2026-10-25T11:00:00Z',
        }),
        makeIssue({
          number: 4,
          repo: repo1,
          title: 'Todo: Persist view options',
          body: '### Open Questions:\n- [ ] Which database should we use? (Postgres / SQLite)\n',
          labels: ['status:todo'],
          created_at: '2026-10-26T12:00:00Z',
          updated_at: '2026-10-26T12:00:00Z',
        }),
        makeIssue({
          number: 5,
          repo: repo1,
          title: 'In-Progress: Mobile responsiveness test',
          body: '### Actionable Subtasks Checklist:\n- [ ] Review phone layout\n- [ ] Test drawer focus restore\n',
          labels: ['status:in-progress'],
          created_at: '2026-10-27T09:00:00Z',
          updated_at: '2026-10-27T09:00:00Z',
        }),
      ],
    },
    {
      repo: repo2,
      id: 102,
      issues: [
        makeIssue({
          number: 1,
          repo: repo2,
          title: 'Todo: Service Worker cache upgrade',
          body: 'Update sw.js cache name to versioned format and purge workflows-board-v1',
          labels: ['status:todo'],
          created_at: '2026-10-26T14:00:00Z',
          updated_at: '2026-10-26T14:00:00Z',
        }),
        makeIssue({
          number: 2,
          repo: repo2,
          title: 'Draft: Push notification registration',
          body: 'Draft for web push registration',
          labels: ['status:draft'],
          created_at: '2026-10-27T10:00:00Z',
          updated_at: '2026-10-27T10:00:00Z',
        }),
      ],
    },
  ],
});

const config = loadConfig({
  BOARD_GITHUB_TOKEN: fakeGitHub.token,
  BOARD_GITHUB_LOGIN: 'preview-user',
  BOARD_REPO: repo1,
  BOARD_PASSWORD: 'correct horse battery staple',
  BOARD_SESSION_SECRET: 's'.repeat(48),
  BOARD_SESSION_FILE: SESSION_FILE,
  BOARD_PORT: PREVIEW_PORT,
  BOARD_HOST: PREVIEW_HOST,
  BOARD_PROJECT_NAMES_FILE: PROJECT_NAMES_FILE,
});

const app = await createBoardServer({
  config,
  githubApiBase: fakeGitHub.url,
  sessionFilePath: SESSION_FILE,
  logger: (line) => console.log(`[Preview Server] ${line}`),
});

const listening = await app.listen(PREVIEW_PORT, PREVIEW_HOST);

fs.writeFileSync(PID_FILE, String(process.pid));
fs.writeFileSync(
  INFO_FILE,
  JSON.stringify(
    {
      pid: process.pid,
      url: `http://${listening.host}:${listening.port}`,
      fakeGithubUrl: fakeGitHub.url,
      credentials: {
        username: 'preview-user',
        password: 'correct horse battery staple',
      },
      repositories: [repo1, repo2],
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(`[Preview Server] Ready at http://${listening.host}:${listening.port} (PID ${process.pid})`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('[Preview Server] Shutting down...');
  try {
    await app.close();
  } catch {}
  try {
    await fakeGitHub.close();
  } catch {}
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    if (fs.existsSync(INFO_FILE)) fs.unlinkSync(INFO_FILE);
  } catch {}
  console.log('[Preview Server] Stopped cleanly.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
