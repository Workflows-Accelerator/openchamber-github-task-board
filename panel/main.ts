import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

// ==========================================
// Types & Interfaces
// ==========================================

export interface Subtask {
  id: string;
  lineIndex: number;
  text: string;
  completed: boolean;
  rawLine: string;
}

export interface Issue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: Array<{ name: string; color?: string }>;
  user?: { login: string; avatar_url?: string };
  assignees?: Array<{ login: string; avatar_url?: string }>;
  comments?: number;
  created_at: string;
  subtasks: Subtask[];
}

export interface SessionInfo {
  id: string;
  title: string;
  activity: string;
  outcome?: string | null;
  worktree?: string | null;
  directory?: string | null;
  items?: Array<{ id?: string; providerId?: string; data?: any }>;
}

export interface ProjectItem {
  id: string;
  name: string;
  directory: string;
  gitRepo: { owner: string; repo: string } | null;
  linkedRepo: string | null;
}

type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done';
type TabId = 'all' | ColumnId;

// ==========================================
// In-App Diagnostic Logger
// ==========================================

const logEntries: Array<{ time: string; msg: string; level: 'info' | 'warn' | 'error' | 'succ' }> = [];

function addLog(msg: string, level: 'info' | 'warn' | 'error' | 'succ' = 'info'): void {
  const d = new Date();
  const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  logEntries.push({ time: timeStr, msg, level });
  if (logEntries.length > 200) logEntries.shift();

  if (level === 'error') console.error(`[TaskBoard] ${msg}`);
  else if (level === 'warn') console.warn(`[TaskBoard] ${msg}`);
  else console.log(`[TaskBoard] ${msg}`);

  const streamEl = document.getElementById('logStream');
  if (streamEl) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-msg-${level}">${escapeHtml(msg)}</span>
    `;
    streamEl.appendChild(line);
    streamEl.scrollTop = streamEl.scrollHeight;
  }
}

// ==========================================
// State Store
// ==========================================

const host = connectHost();

let currentProject: ProjectItem | null = null;
let currentDirectory: string = '';
let currentRepo: string = '';
let allProjects: ProjectItem[] = [];
let isDiscoveringRepos: boolean = false;
let issues: Issue[] = [];
let sessions: SessionInfo[] = [];
let worktrees: any[] = [];
let activeIssue: Issue | null = null;
let searchQuery: string = '';
let activeTab: TabId = 'all';
let userLayoutPreference: 'auto' | 'list' | 'kanban' = 'auto';
let isWideScreen: boolean = false;
let draggedIssueNumber: number | null = null;
let isLoading: boolean = false;

// ==========================================
// DOM Elements
// ==========================================

const elBtnRepoSelect = document.getElementById('btnRepoSelect') as HTMLButtonElement;
const elTxtRepoLabel = document.getElementById('txtRepoLabel') as HTMLSpanElement;
const elRepoPopover = document.getElementById('repoPopover') as HTMLDivElement;
const elDetectedReposList = document.getElementById('detectedReposList') as HTMLDivElement;
const elInputCustomRepo = document.getElementById('inputCustomRepo') as HTMLInputElement;
const elBtnSaveCustomRepo = document.getElementById('btnSaveCustomRepo') as HTMLButtonElement;

const elSearchInput = document.getElementById('searchInput') as HTMLInputElement;
const elBtnLayoutToggle = document.getElementById('btnLayoutToggle') as HTMLButtonElement;
const elBtnRefresh = document.getElementById('btnRefresh') as HTMLButtonElement;
const elIconRefresh = document.getElementById('iconRefresh') as unknown as SVGElement;
const elBtnNewIssue = document.getElementById('btnNewIssue') as HTMLButtonElement;
const elBtnLogsToggle = document.getElementById('btnLogsToggle') as HTMLButtonElement;

const elStatusTabBar = document.getElementById('statusTabBar') as HTMLElement;
const elListViewContainer = document.getElementById('listViewContainer') as HTMLElement;
const elKanbanViewContainer = document.getElementById('kanbanViewContainer') as HTMLElement;

// Kanban column references
const kanbanCardContainers: Record<ColumnId, HTMLDivElement> = {
  'backlog': document.getElementById('kCardsBacklog') as HTMLDivElement,
  'todo': document.getElementById('kCardsTodo') as HTMLDivElement,
  'in-progress': document.getElementById('kCardsProgress') as HTMLDivElement,
  'in-review': document.getElementById('kCardsReview') as HTMLDivElement,
  'done': document.getElementById('kCardsDone') as HTMLDivElement,
};

// Drawer elements
const elDrawerScrim = document.getElementById('drawerScrim') as HTMLDivElement;
const elTaskDrawer = document.getElementById('taskDrawer') as HTMLElement;
const elBtnDrawerClose = document.getElementById('btnDrawerClose') as HTMLButtonElement;
const elDrawerIssueNumber = document.getElementById('drawerIssueNumber') as HTMLSpanElement;
const elDrawerIssueAuthor = document.getElementById('drawerIssueAuthor') as HTMLSpanElement;
const elDrawerGithubLink = document.getElementById('drawerGithubLink') as HTMLAnchorElement;
const elDrawerIssueTitle = document.getElementById('drawerIssueTitle') as HTMLHeadingElement;
const elDrawerStatusSelect = document.getElementById('drawerStatusSelect') as HTMLSelectElement;
const elDrawerLabelsContainer = document.getElementById('drawerLabelsContainer') as HTMLDivElement;
const elBtnAddLabelToggle = document.getElementById('btnAddLabelToggle') as HTMLButtonElement;
const elDrawerAddLabelRow = document.getElementById('drawerAddLabelRow') as HTMLDivElement;
const elInputNewTag = document.getElementById('inputNewTag') as HTMLInputElement;
const elRepoLabelsDatalist = document.getElementById('repoLabelsDatalist') as HTMLDataListElement;
const elBtnConfirmAddLabel = document.getElementById('btnConfirmAddLabel') as HTMLButtonElement;
const elBtnCancelAddLabel = document.getElementById('btnCancelAddLabel') as HTMLButtonElement;

const elDrawerAgentBadge = document.getElementById('drawerAgentBadge') as HTMLDivElement;
const elDrawerWorktreeName = document.getElementById('drawerWorktreeName') as HTMLSpanElement;
const elBtnDrawerJumpSession = document.getElementById('btnDrawerJumpSession') as HTMLButtonElement;
const elChecklistProgressText = document.getElementById('checklistProgressText') as HTMLSpanElement;
const elChecklistProgressFill = document.getElementById('checklistProgressFill') as HTMLDivElement;
const elDrawerChecklistContainer = document.getElementById('drawerChecklistContainer') as HTMLDivElement;
const elInputAddSubtask = document.getElementById('inputAddSubtask') as HTMLInputElement;
const elBtnAddSubtask = document.getElementById('btnAddSubtask') as HTMLButtonElement;

// Dual-mode description elements
const elDrawerDescriptionViewBox = document.getElementById('drawerDescriptionViewBox') as HTMLDivElement;
const elDrawerDescriptionCollapsible = document.getElementById('drawerDescriptionCollapsible') as HTMLDivElement;
const elDrawerDescriptionContent = document.getElementById('drawerDescriptionContent') as HTMLDivElement;
const elDrawerDescriptionToggleRow = document.getElementById('drawerDescriptionToggleRow') as HTMLDivElement;
const elBtnToggleCollapse = document.getElementById('btnToggleCollapse') as HTMLButtonElement;
const elDrawerDescriptionEditBox = document.getElementById('drawerDescriptionEditBox') as HTMLDivElement;
const elDrawerDescriptionTextarea = document.getElementById('drawerDescriptionTextarea') as HTMLTextAreaElement;
const elBtnEditDescription = document.getElementById('btnEditDescription') as HTMLButtonElement;
const elBtnSaveDescription = document.getElementById('btnSaveDescription') as HTMLButtonElement;
const elBtnCancelDescription = document.getElementById('btnCancelDescription') as HTMLButtonElement;

const elDrawerCommentsContainer = document.getElementById('drawerCommentsContainer') as HTMLDivElement;
const elCommentCountBadge = document.getElementById('commentCountBadge') as HTMLSpanElement;
const elBtnDrawerAttachComposer = document.getElementById('btnDrawerAttachComposer') as HTMLButtonElement;
const elBtnDrawerOpenPreflight = document.getElementById('btnDrawerOpenPreflight') as HTMLButtonElement;

// Preflight modal elements
const elPreflightBackdrop = document.getElementById('preflightModalBackdrop') as HTMLDivElement;
const elModalPreflightTitle = document.getElementById('modalPreflightTitle') as HTMLHeadingElement;
const elPreflightBranchInput = document.getElementById('preflightBranchInput') as HTMLInputElement;
const elPreflightBaseBranchInput = document.getElementById('preflightBaseBranchInput') as HTMLInputElement;
const elPreflightPromptInput = document.getElementById('preflightPromptInput') as HTMLTextAreaElement;
const elPreflightMoveInProgress = document.getElementById('preflightMoveInProgress') as HTMLInputElement;
const elBtnPreflightCancel = document.getElementById('btnPreflightCancel') as HTMLButtonElement;
const elBtnPreflightClose = document.getElementById('btnPreflightClose') as HTMLButtonElement;
const elBtnPreflightLaunch = document.getElementById('btnPreflightLaunch') as HTMLButtonElement;

// Logs drawer
const elLogDrawer = document.getElementById('logDrawer') as HTMLElement;
const elBtnLogDrawerClose = document.getElementById('btnLogDrawerClose') as HTMLButtonElement;
const elBtnCopyLogs = document.getElementById('btnCopyLogs') as HTMLButtonElement;
const elBtnClearLogs = document.getElementById('btnClearLogs') as HTMLButtonElement;

// ==========================================
// Banner Helpers
// ==========================================

function showBanner(text: string, actionLabel?: string, onAction?: () => void): void {
  const elBanner = document.getElementById('boardBanner') as HTMLDivElement;
  const elBannerText = document.getElementById('boardBannerText') as HTMLDivElement;
  const elBannerActions = document.getElementById('boardBannerActions') as HTMLDivElement;
  if (!elBanner || !elBannerText || !elBannerActions) return;

  elBannerText.textContent = text;
  elBannerActions.innerHTML = '';
  if (actionLabel && onAction) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-primary';
    btn.textContent = actionLabel;
    btn.onclick = onAction;
    elBannerActions.appendChild(btn);
  }
  elBanner.style.display = 'flex';
}

function hideBanner(): void {
  const elBanner = document.getElementById('boardBanner');
  if (elBanner) elBanner.style.display = 'none';
}

// ==========================================
// Subtask & Markdown Parsing
// ==========================================

const checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;

function parseSubtasks(body: string): Subtask[] {
  if (!body) return [];
  const lines = body.split('\n');
  const subtasks: Subtask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(checklistRegex);
    if (match) {
      subtasks.push({
        id: `task-${i}`,
        lineIndex: i,
        completed: match[2].toLowerCase() === 'x',
        text: match[4].trim(),
        rawLine: line,
      });
    }
  }
  return subtasks;
}

function updateSubtaskInMarkdown(body: string, lineIndex: number, completed: boolean): string {
  const lines = body.split('\n');
  if (lineIndex >= 0 && lineIndex < lines.length) {
    const match = lines[lineIndex].match(checklistRegex);
    if (match) {
      const mark = completed ? 'x' : ' ';
      lines[lineIndex] = `${match[1]}${mark}${match[3]}${match[4]}`;
    }
  }
  return lines.join('\n');
}

function appendSubtaskToMarkdown(body: string, text: string): string {
  const cleanText = text.trim();
  if (!cleanText) return body;
  const suffix = `\n- [ ] ${cleanText}`;
  return body ? `${body.trimEnd()}${suffix}` : `- [ ] ${cleanText}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 30);
}

function sanitizeHexColor(color?: string): string | null {
  if (!color) return null;
  const clean = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3,8}$/.test(clean)) {
    return `#${clean}`;
  }
  return null;
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// Git Remote & Repo Parser
// ==========================================

export function parseGitHubRemoteUrl(raw: string): { owner: string; repo: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const val = raw.trim();

  // SCP format: git@github.com:OWNER/REPO.git
  const scpMatch = val.match(/^(?:git@|ssh:\/\/git@)github\.com[:/]([^\s/]+)\/([^\s/.]+?)(\.git)?$/);
  if (scpMatch) return { owner: scpMatch[1], repo: scpMatch[2] };

  // HTTPS or standard URL format
  try {
    const url = new URL(val);
    if (url.hostname === 'github.com') {
      const parts = url.pathname.replace(/^\/+|\.git$/g, '').split('/');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { owner: parts[0], repo: parts[1] };
      }
    }
  } catch {}
  return null;
}

export function parseGitRemoteFromConfig(configContent: string): { owner: string; repo: string } | null {
  if (!configContent || typeof configContent !== 'string') return null;
  const match = configContent.match(/\[remote\s+["\w-]+\][^\[]*?url\s*=\s*([^\r\n]+)/);
  if (match) {
    return parseGitHubRemoteUrl(match[1]);
  }
  return null;
}

// Caching stores
const dirGitCache = new Map<string, { owner: string; repo: string } | null>();
const issueCache = new Map<string, { timestamp: number; issues: Issue[] }>();
const ISSUE_CACHE_TTL_MS = 60000; // 60s cache

// Subscription manager: watch only the active project (avoids 32 limit)
let unsubSessions: (() => void) | null = null;
let unsubWorktrees: (() => void) | null = null;
let activeWatchedProjectId: string | null = null;

async function watchActiveProject(projectId: string): Promise<void> {
  if (activeWatchedProjectId === projectId) return;
  activeWatchedProjectId = projectId;

  if (unsubSessions) {
    unsubSessions();
    unsubSessions = null;
  }
  if (unsubWorktrees) {
    unsubWorktrees();
    unsubWorktrees = null;
  }

  try {
    unsubSessions = await host.onSessions(projectId, (sessSnap) => {
      sessions = (sessSnap.sessions as any[]) || [];
      renderViews();
      if (activeIssue) renderDrawer(activeIssue);
    });
    unsubWorktrees = await host.onWorktrees(projectId, (wtSnap) => {
      worktrees = (wtSnap.worktrees as any[]) || [];
    });
  } catch (err: any) {
    addLog(`Project watcher error on ${projectId}: ${err.message}`, 'warn');
  }
}

// ==========================================
// Deep Multi-Source Repo Discovery
// ==========================================

async function inspectGitConfigInDir(dir: string): Promise<{ owner: string; repo: string } | null> {
  const cleanDir = dir.replace(/\/+$/, '');
  if (dirGitCache.has(cleanDir)) {
    return dirGitCache.get(cleanDir)!;
  }

  let found: { owner: string; repo: string } | null = null;

  try {
    // 1. Try reading .git/config (standard repository)
    const res = await host.readFile(`${cleanDir}/.git/config`);
    if (res && res.content) {
      found = parseGitRemoteFromConfig(res.content);
    }
  } catch {
    // .git might be a file (worktree)
  }

  if (!found) {
    try {
      // 2. Check if .git is a worktree pointer file
      const gitFileRes = await host.readFile(`${cleanDir}/.git`);
      if (gitFileRes && gitFileRes.content) {
        const match = gitFileRes.content.match(/^gitdir:\s*(.+)$/m);
        if (match) {
          const gitdir = match[1].trim();
          const targetPath = gitdir.startsWith('/') ? gitdir : `${cleanDir}/${gitdir}`;
          try {
            const wtConfig = await host.readFile(`${targetPath}/config`);
            if (wtConfig?.content) {
              found = parseGitRemoteFromConfig(wtConfig.content);
            }
          } catch {}
          if (!found) {
            try {
              const parentConfig = await host.readFile(`${targetPath}/../../config`);
              if (parentConfig?.content) {
                found = parseGitRemoteFromConfig(parentConfig.content);
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  dirGitCache.set(cleanDir, found);
  return found;
}

async function discoverWorkspaceRepositories(): Promise<void> {
  if (isDiscoveringRepos) return;
  isDiscoveringRepos = true;
  addLog('Scanning OpenChamber projects for Git repositories...');

  try {
    const snap = await host.listProjects();
    const rawProjects = snap.projects || [];

    // Deduplicate projects by ID
    const uniqueProjects = Array.from(new Map(rawProjects.map((p) => [p.id, p])).values());

    // Parallel inspection with Promise.all
    const inspected = await Promise.all(
      uniqueProjects.map(async (p) => {
        if (!p.directory) return null;
        const detected = await inspectGitConfigInDir(p.directory);
        const storedLink = await host.storage.get(`repo_${p.id}`);
        const linkedRepo = typeof storedLink === 'string' && storedLink.includes('/') ? storedLink.trim() : null;

        return {
          id: p.id,
          name: p.name || p.directory.split('/').pop() || p.id,
          directory: p.directory,
          gitRepo: detected,
          linkedRepo: linkedRepo || (detected ? `${detected.owner}/${detected.repo}` : null),
        };
      })
    );

    allProjects = inspected.filter(Boolean) as ProjectItem[];

    allProjects.forEach((p) => {
      if (p.gitRepo) {
        addLog(`Project "${p.name}" has Git repo: ${p.gitRepo.owner}/${p.gitRepo.repo}`, 'succ');
      } else {
        addLog(`Project "${p.name}" (${p.directory}) has no Git remote`, 'info');
      }
    });

    renderRepoPopoverList();
    await autoResolveRepoForActiveContext();
  } catch (err: any) {
    addLog(`Project scan error: ${err.message}`, 'warn');
  } finally {
    isDiscoveringRepos = false;
  }
}

async function autoResolveRepoForActiveContext(): Promise<void> {
  // Longest-prefix match: sort by directory path length descending
  const sorted = [...allProjects].sort((a, b) => (b.directory?.length || 0) - (a.directory?.length || 0));

  let targetProject = sorted.find((p) => {
    if (!p.directory) return false;
    const cleanP = p.directory.replace(/\/+$/, '');
    const cleanT = currentDirectory.replace(/\/+$/, '');
    return cleanP === cleanT || cleanT.startsWith(cleanP + '/');
  }) || (allProjects.length > 0 ? allProjects[0] : null);

  currentProject = targetProject || null;

  if (!targetProject) {
    elTxtRepoLabel.textContent = 'Select Repo';
    return;
  }

  // Watch active project sessions
  void watchActiveProject(targetProject.id);

  addLog(`Active conversation project: "${targetProject.name}" (${targetProject.directory})`);

  // Step 2: Native Git remote in directory or project has HIGHEST precedence over stale storage
  if (currentDirectory) {
    const dirRemote = await inspectGitConfigInDir(currentDirectory);
    if (dirRemote) {
      const full = `${dirRemote.owner}/${dirRemote.repo}`;
      targetProject.gitRepo = dirRemote;
      targetProject.linkedRepo = full;
      setRepository(full, `directory: ${targetProject.name}`);
      return;
    }
  }

  if (targetProject.gitRepo) {
    const full = `${targetProject.gitRepo.owner}/${targetProject.gitRepo.repo}`;
    setRepository(full, `project-git: ${targetProject.name}`);
    return;
  }

  // Step 3: Check stored link for this specific project
  const storedLink = await host.storage.get(`repo_${targetProject.id}`);
  if (typeof storedLink === 'string' && storedLink.includes('/')) {
    setRepository(storedLink.trim(), `stored-project-link: ${targetProject.name}`);
    return;
  }

  // Step 4: Check if any session in this project has linked items
  if (sessions && sessions.length > 0) {
    for (const sess of sessions) {
      if (sess.items) {
        for (const it of sess.items) {
          if (it.url && it.url.includes('github.com/')) {
            const m = it.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (m) {
              setRepository(`${m[1]}/${m[2]}`, `session-item: ${sess.title}`);
              return;
            }
          }
        }
      }
    }
  }

  // Step 5: If this project has no repo linked:
  elTxtRepoLabel.textContent = `${targetProject.name} (No Repo)`;
  elTxtRepoLabel.title = `Project "${targetProject.name}" has no GitHub repository linked. Click to link.`;

  const otherRepos = allProjects.filter((p) => p.linkedRepo || p.gitRepo);
  const actionText = otherRepos.length > 0
    ? `Project "${targetProject.name}" has no Git remote. Click to choose or link:`
    : `Project "${targetProject.name}" has no Git remote. Enter a repository:`;

  showBanner(actionText, 'Select Repo', () => {
    openRepoPopover();
  });
  renderEmptyState(`No GitHub repository linked to project "${targetProject.name}". Click "Select Repo" above to link a repository.`);
}

function setRepository(repo: string, source: string, force: boolean = false): void {
  if (!force && currentRepo === repo) {
    // Guard against redundant re-render loops
    return;
  }
  currentRepo = repo;
  elTxtRepoLabel.textContent = repo.split('/')[1] || repo;
  elTxtRepoLabel.title = `Project: ${currentProject?.name || 'Workspace'} • Repo: ${repo} (via ${source})`;
  addLog(`Switched repository to ${repo} [${source}]`, 'succ');
  hideBanner();
  void host.storage.set('selected_repo', repo);
  if (currentProject) {
    void host.storage.set(`repo_${currentProject.id}`, repo);
    currentProject.linkedRepo = repo;
  }
  if (!elRepoPopover.classList.contains('active')) {
    renderRepoPopoverList();
  }
  void fetchIssues();
}

function renderRepoPopoverList(): void {
  if (allProjects.length === 0) {
    elDetectedReposList.innerHTML = `
      <div style="padding: 10px; color: var(--fg-faint); font-size: 11px;">
        No workspace projects found. Enter custom repo below.
      </div>
    `;
    return;
  }

  elDetectedReposList.innerHTML = allProjects
    .map((p) => {
      const isCurrentProject = p.id === currentProject?.id;
      const repoName = p.linkedRepo || (p.gitRepo ? `${p.gitRepo.owner}/${p.gitRepo.repo}` : null);
      const isSelectedRepo = repoName && repoName === currentRepo;

      return `
        <div class="popover-item" data-project-id="${escapeHtml(p.id)}" data-repo="${escapeHtml(repoName || '')}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span class="popover-item-title">${escapeHtml(p.name)}</span>
              ${isCurrentProject ? '<span class="status-pill" style="font-size: 9px; padding: 0 4px;">active</span>' : ''}
            </div>
            ${isSelectedRepo ? '<span style="color: var(--succ); font-size: 11px;">✓ active</span>' : ''}
          </div>
          <span class="popover-item-sub">${repoName ? escapeHtml(repoName) : '<span style="color: var(--warn); font-style: italic;">No repo linked • click to link</span>'}</span>
        </div>
      `;
    })
    .join('');

  elDetectedReposList.querySelectorAll('.popover-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const projId = item.getAttribute('data-project-id');
      const repo = item.getAttribute('data-repo');
      const proj = allProjects.find((p) => p.id === projId);

      if (repo) {
        if (currentProject) {
          await host.storage.set(`repo_${currentProject.id}`, repo);
          currentProject.linkedRepo = repo;
        }
        setRepository(repo, `selected from ${proj?.name || 'project'}`);
        closeRepoPopover();
      } else {
        const entered = window.prompt(`Enter GitHub repository (owner/repo) to link to project "${proj?.name || 'project'}":`);
        if (entered && entered.includes('/')) {
          const clean = entered.trim();
          if (proj) {
            proj.linkedRepo = clean;
            await host.storage.set(`repo_${proj.id}`, clean);
          }
          if (currentProject && currentProject.id === proj?.id) {
            setRepository(clean, `linked-to-${proj?.name}`);
          } else {
            renderRepoPopoverList();
          }
          closeRepoPopover();
        }
      }
    });
  });
}

function openRepoPopover(): void {
  elRepoPopover.classList.add('active');
}
function closeRepoPopover(): void {
  elRepoPopover.classList.remove('active');
}

let workspaceGitToken: string | null = null;

async function getWorkspaceGitToken(): Promise<string | null> {
  if (workspaceGitToken) return workspaceGitToken;
  try {
    const creds = await host.readFile('/workspace/.git-credentials');
    if (creds && creds.content) {
      const match = creds.content.match(/https:\/\/(?:[^:]+?:)?(gh[pousr]_[A-Za-z0-9_]+)@github\.com/) || creds.content.match(/gh[pousr]_[A-Za-z0-9_]+/);
      if (match) {
        workspaceGitToken = match[1] || match[0];
        addLog('Loaded authenticated GitHub PAT from workspace credentials', 'succ');
        return workspaceGitToken;
      }
    }
  } catch {}
  try {
    const cfg = await host.readFile('/workspace/.gitconfig');
    if (cfg && cfg.content) {
      const match = cfg.content.match(/gh[pousr]_[A-Za-z0-9_]+/);
      if (match) {
        workspaceGitToken = match[0];
        return workspaceGitToken;
      }
    }
  } catch {}
  return null;
}

// ==========================================
// GitHub API Client Layer
// ==========================================

async function githubRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: any,
  query?: Record<string, string>
): Promise<any> {
  addLog(`API ${method} ${path}`);

  // 1. Resolve available PAT token if available (workspace .git-credentials or stored token)
  const pat = (await getWorkspaceGitToken()) || (await host.storage.get('custom_github_token'));

  // 2. If PAT exists and path is repository operations, use direct PAT to avoid GitHub Org OAuth 403 restrictions
  if (pat && typeof pat === 'string') {
    try {
      const url = new URL(path, 'https://api.github.com/');
      if (query) {
        Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
      }
      const directRes = await fetch(url.toString(), {
        method,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${pat.trim()}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (directRes.ok) {
        addLog(`API ${method} ${path} -> ${directRes.status} OK (via workspace PAT)`, 'succ');
        hideBanner();
        return directRes.json();
      }
      addLog(`PAT request returned HTTP ${directRes.status}, attempting host proxy...`, 'warn');
    } catch (err: any) {
      addLog(`Direct PAT fetch failed (${err.message}), falling back to host proxy...`, 'warn');
    }
  }

  // 3. Fallback to host.request proxy
  try {
    const res = await host.request({
      method,
      path,
      query,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status >= 200 && res.status < 300) {
      addLog(`API ${method} ${path} -> ${res.status}`, 'succ');
      hideBanner();
      return typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    }
    if (res.status === 401 || res.status === 403) {
      addLog(`API auth error HTTP ${res.status}: OAuth access restricted or missing`, 'error');
      showBanner(
        'GitHub authentication required. Please connect in Settings → Integrations or enter a Personal Access Token.',
        'Enter Token',
        promptCustomToken
      );
      throw new Error(`GitHub auth failed (${res.status})`);
    }
    throw new Error(`GitHub API error: ${res.status}`);
  } catch (err: any) {
    addLog(`GitHub request failed: ${err.message}`, 'error');
    if (err.message && (err.message.includes('NO_INTEGRATION') || err.message.includes('DISCONNECTED'))) {
      showBanner(
        'GitHub integration is not connected. Open Settings → Integrations or enter a token directly.',
        'Enter Token',
        promptCustomToken
      );
    }
    throw err;
  }
}

async function promptCustomToken(): Promise<void> {
  const token = window.prompt('Enter GitHub Personal Access Token (with repo access):');
  if (token && token.trim()) {
    await host.storage.set('custom_github_token', token.trim());
    await host.toast({ kind: 'success', message: 'Saved token! Refreshing...' });
    void fetchIssues();
  }
}

async function fetchIssues(force: boolean = false): Promise<void> {
  if (!currentRepo) return;

  // 1. Instant cache check (0ms UI latency)
  if (!force && issueCache.has(currentRepo)) {
    const cached = issueCache.get(currentRepo)!;
    if (Date.now() - cached.timestamp < ISSUE_CACHE_TTL_MS) {
      issues = cached.issues;
      renderViews();
      addLog(`Rendered ${issues.length} issues from cache for ${currentRepo}`);
      return;
    }
  }

  isLoading = true;
  if (elIconRefresh) elIconRefresh.style.animation = 'spin 1s linear infinite';

  try {
    addLog(`Fetching issues for ${currentRepo}...`);
    // Query search API with is:issue to exclude pull requests and return real issues
    const res: any = await githubRequest(
      'GET',
      `/search/issues?q=repo:${currentRepo}+is:issue&sort=updated&per_page=100`
    );

    const rawIssues = res.items || (Array.isArray(res) ? res : []);

    issues = rawIssues
      .filter((item: any) => !item.pull_request)
      .map((item: any) => ({
        number: item.number,
        title: item.title,
        body: item.body || '',
        state: item.state,
        html_url: item.html_url,
        labels: item.labels || [],
        user: item.user,
        assignees: item.assignees || [],
        comments: item.comments || 0,
        created_at: item.created_at,
        subtasks: parseSubtasks(item.body || ''),
      }));

    // Cache results
    issueCache.set(currentRepo, {
      timestamp: Date.now(),
      issues,
    });

    addLog(`Loaded ${issues.length} issues successfully for ${currentRepo}`, 'succ');
    renderViews();
  } catch (err: any) {
    addLog(`Failed to fetch issues: ${err.message}`, 'error');
    renderEmptyState(`Failed to load issues for ${currentRepo}: ${err.message || 'Check GitHub integration tokens'}`);
  } finally {
    isLoading = false;
    if (elIconRefresh) elIconRefresh.style.animation = '';
  }
}

async function updateIssueBody(issue: Issue, newBody: string): Promise<void> {
  issue.body = newBody;
  issue.subtasks = parseSubtasks(newBody);
  renderViews();
  if (activeIssue && activeIssue.number === issue.number) {
    renderDrawer(issue);
  }

  try {
    await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
      body: newBody,
    });
    await host.toast({ kind: 'info', message: `Updated subtasks on #${issue.number}` });
  } catch (err: any) {
    addLog(`Failed to sync body: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to update #${issue.number} on GitHub` });
  }
}

async function updateIssueStatus(issue: Issue, targetColumn: ColumnId): Promise<void> {
  const currentLabels = issue.labels.map((l) => l.name);
  const filteredLabels = currentLabels.filter((name) => !name.startsWith('status:'));

  let newState: 'open' | 'closed' = 'open';
  if (targetColumn === 'done') {
    newState = 'closed';
    filteredLabels.push('status:done');
  } else {
    filteredLabels.push(`status:${targetColumn}`);
  }

  issue.state = newState;
  issue.labels = filteredLabels.map((name) => ({ name }));
  renderViews();
  if (activeIssue && activeIssue.number === issue.number) {
    renderDrawer(issue);
  }

  try {
    await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
      state: newState,
      labels: filteredLabels,
    });
    await host.toast({ kind: 'success', message: `Moved #${issue.number} to ${targetColumn}` });
    addLog(`Moved #${issue.number} to ${targetColumn}`, 'succ');
  } catch (err: any) {
    addLog(`Failed to move #${issue.number}: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to move #${issue.number}` });
  }
}

// ==========================================
// Session & Worktree Reconciler
// ==========================================

function getIssueSession(issue: Issue): SessionInfo | null {
  const issueNumStr = String(issue.number);
  const match = sessions.find((s) => {
    if (s.items && s.items.some((it) => it.id === issueNumStr || it.data?.issueNumber === issue.number)) {
      return true;
    }
    if (s.title && s.title.includes(`#${issue.number}`)) {
      return true;
    }
    if (s.worktree && s.worktree.includes(`issue-${issue.number}`)) {
      return true;
    }
    return false;
  });
  return match || null;
}

function resolveIssueColumn(issue: Issue): ColumnId {
  if (issue.state === 'closed') {
    return 'done';
  }

  const labelNames = issue.labels.map((l) => l.name.toLowerCase());
  if (labelNames.includes('status:done')) return 'done';
  if (labelNames.includes('status:in-review')) return 'in-review';
  if (labelNames.includes('status:in-progress')) return 'in-progress';
  if (labelNames.includes('status:todo')) return 'todo';
  if (labelNames.includes('status:backlog')) return 'backlog';

  // Dynamic promotion: if an agent is working on this issue, promote to in-progress
  const session = getIssueSession(issue);
  if (session && (session.activity === 'running' || session.activity.startsWith('waiting'))) {
    return 'in-progress';
  }

  return 'backlog';
}

function updateBadgeCounts(): void {
  const counts: Record<ColumnId, number> = {
    'backlog': 0,
    'todo': 0,
    'in-progress': 0,
    'in-review': 0,
    'done': 0,
  };

  issues.forEach((issue) => {
    const col = resolveIssueColumn(issue);
    counts[col]++;
  });

  const total = issues.length;

  // Tab counts
  const setTxt = (id: string, val: number) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  setTxt('tabCountAll', total);
  setTxt('tabCountBacklog', counts['backlog']);
  setTxt('tabCountTodo', counts['todo']);
  setTxt('tabCountProgress', counts['in-progress']);
  setTxt('tabCountReview', counts['in-review']);
  setTxt('tabCountDone', counts['done']);

  // Kanban counts
  setTxt('kCountBacklog', counts['backlog']);
  setTxt('kCountTodo', counts['todo']);
  setTxt('kCountProgress', counts['in-progress']);
  setTxt('kCountReview', counts['in-review']);
  setTxt('kCountDone', counts['done']);

  // Blocked agent badge for OpenChamber sidebar rail
  const blockedCount = sessions.filter(
    (s) => s.activity === 'waiting-permission' || s.activity === 'waiting-question'
  ).length;
  void host.setBadge(blockedCount > 0 ? blockedCount : null);
}

// ==========================================
// Rendering: Dual View Engine
// ==========================================

function renderEmptyState(message: string): void {
  elListViewContainer.innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
  (Object.keys(kanbanCardContainers) as ColumnId[]).forEach((col) => {
    kanbanCardContainers[col].innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
  });
}

function renderViews(): void {
  updateBadgeCounts();

  // Filter issues
  const q = searchQuery.toLowerCase().trim();
  const filtered = issues.filter((issue) => {
    if (!q) return true;
    return (
      issue.title.toLowerCase().includes(q) ||
      String(issue.number).includes(q) ||
      issue.labels.some((l) => l.name.toLowerCase().includes(q))
    );
  });

  // 1. Render Mode: List View
  renderListView(filtered);

  // 2. Render Mode: Kanban View
  renderKanbanView(filtered);

  // Auto layout check
  applyLayoutMode();
}

function buildCardElement(issue: Issue, inKanban: boolean): HTMLElement {
  const session = getIssueSession(issue);
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = inKanban;
  card.dataset.issueNumber = String(issue.number);

  const totalSubtasks = issue.subtasks.length;
  const completedSubtasks = issue.subtasks.filter((s) => s.completed).length;
  const pct = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Agent status pill
  let agentBadgeHtml = '';
  if (session) {
    let dotClass = 'dot-idle';
    let actLabel = 'Agent Idle';
    if (session.activity === 'running') {
      dotClass = 'dot-running';
      actLabel = 'Running';
    } else if (session.activity === 'waiting-permission') {
      dotClass = 'dot-waiting';
      actLabel = 'Needs Permission';
    } else if (session.activity === 'waiting-question') {
      dotClass = 'dot-waiting';
      actLabel = 'Needs Input';
    }
    agentBadgeHtml = `
      <div class="agent-pill">
        <span class="dot ${dotClass}"></span>
        <span>${actLabel}</span>
      </div>
    `;
  }

  // Worktree tag
  const worktreeHtml = session?.worktree
    ? `
      <div class="worktree-tag">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M7.05 13.05C6.46 12.4 5.54 12 4.5 12 2.57 12 1 13.57 1 15.5S2.57 19 4.5 19c1.04 0 1.96-.4 2.55-1.05l7.9 4.05V24h2v-4.5l-7.9-4.05c.59-.65 1.45-1.05 2.45-1.05 1.04 0 1.96.4 2.55 1.05L19.5 11.4V14h2V8h-6v2h2.6l-5.65 3.95c-.59-.65-1.45-1.05-2.45-1.05-1.04 0-1.96.4-2.55 1.05L7.05 13.05z"/></svg>
        <span>${escapeHtml(session.worktree)}</span>
      </div>
    `
    : '';

  // Labels
  const labelsHtml = issue.labels
    .filter((l) => !l.name.startsWith('status:'))
    .map((l) => {
      const hex = sanitizeHexColor(l.color);
      const bg = hex ? `${hex}18` : 'var(--surf-muted)';
      const fg = hex || 'var(--fg-muted)';
      return `<span class="badge" style="background: ${bg}; color: ${fg}; border: 1px solid ${fg}33;">${escapeHtml(l.name)}</span>`;
    })
    .join('');

  // Subtask progress
  const subtaskHtml = totalSubtasks > 0
    ? `
      <div class="subtask-prog" title="${completedSubtasks} of ${totalSubtasks} subtasks completed">
        <span>${completedSubtasks}/${totalSubtasks}</span>
        <div class="micro-bar"><div class="micro-fill" style="width: ${pct}%;"></div></div>
      </div>
    `
    : '<span></span>';

  card.innerHTML = `
    <div class="card-meta">
      <div class="card-id-wrap">
        <span class="card-id">#${issue.number}</span>
        ${issue.user ? `<span style="color: var(--fg-muted); font-size: 11px;">@${escapeHtml(issue.user.login)}</span>` : ''}
      </div>
      ${agentBadgeHtml}
    </div>
    <div class="card-title">${escapeHtml(issue.title)}</div>
    ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ''}
    <div class="card-footer">
      ${subtaskHtml}
      <div style="display: flex; align-items: center; gap: 8px;">
        ${worktreeHtml}
      </div>
    </div>
  `;

  // Open inspection drawer on card click
  card.addEventListener('click', (e) => {
    // If clicking a link or button, skip drawer
    if ((e.target as HTMLElement).closest('button, a, select')) return;
    openDrawer(issue);
  });

  if (inKanban) {
    card.addEventListener('dragstart', (e) => {
      draggedIssueNumber = issue.number;
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', String(issue.number));
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    card.addEventListener('dragend', () => {
      draggedIssueNumber = null;
      card.classList.remove('dragging');
    });
  }

  return card;
}

function renderListView(filteredIssues: Issue[]): void {
  elListViewContainer.innerHTML = '';

  const listItems = activeTab === 'all'
    ? filteredIssues
    : filteredIssues.filter((i) => resolveIssueColumn(i) === activeTab);

  if (listItems.length === 0) {
    elListViewContainer.innerHTML = `
      <div class="empty-box">
        <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"/></svg>
        <span>No issues match this view</span>
      </div>
    `;
    return;
  }

  listItems.forEach((issue) => {
    const card = buildCardElement(issue, false);
    elListViewContainer.appendChild(card);
  });
}

function renderKanbanView(filteredIssues: Issue[]): void {
  (Object.keys(kanbanCardContainers) as ColumnId[]).forEach((col) => {
    kanbanCardContainers[col].innerHTML = '';
  });

  filteredIssues.forEach((issue) => {
    const col = resolveIssueColumn(issue);
    const container = kanbanCardContainers[col];
    if (!container) return;

    const card = buildCardElement(issue, true);
    container.appendChild(card);
  });
}

function applyLayoutMode(): void {
  isWideScreen = window.innerWidth >= 680;
  let useKanban = false;

  if (userLayoutPreference === 'kanban') useKanban = true;
  else if (userLayoutPreference === 'list') useKanban = false;
  else useKanban = isWideScreen;

  if (useKanban) {
    document.body.setAttribute('data-layout', 'kanban');
    elBtnLayoutToggle.title = 'Switch to List View';
  } else {
    document.body.removeAttribute('data-layout');
    elBtnLayoutToggle.title = 'Switch to Kanban View';
  }
}

// ==========================================
// Slide-Over Drawer Inspection UI
// ==========================================

function openDrawer(issue: Issue): void {
  activeIssue = issue;
  renderDrawer(issue);
  elDrawerScrim.classList.add('active');
  elTaskDrawer.classList.add('active');
}

function closeDrawer(): void {
  activeIssue = null;
  elDrawerScrim.classList.remove('active');
  elTaskDrawer.classList.remove('active');
}

// ==========================================
// Markdown Renderer & Label Helpers
// ==========================================

export function renderMarkdown(raw: string): string {
  if (!raw || typeof raw !== 'string') return '<p style="color: var(--fg-muted); font-style: italic;">No description provided.</p>';

  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Code blocks
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Headings
  html = html.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1 ↗</a>');

  // Paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote')) {
        return trimmed;
      }
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return html;
}

let repoLabelsCache = new Map<string, Array<{ name: string; color?: string }>>();

async function loadRepoLabels(): Promise<void> {
  if (!currentRepo) return;
  if (repoLabelsCache.has(currentRepo)) {
    populateLabelsDatalist(repoLabelsCache.get(currentRepo)!);
    return;
  }
  try {
    const list: any[] = await githubRequest('GET', `/repos/${currentRepo}/labels?per_page=100`);
    if (Array.isArray(list)) {
      repoLabelsCache.set(currentRepo, list);
      populateLabelsDatalist(list);
    }
  } catch {}
}

function populateLabelsDatalist(labels: Array<{ name: string; color?: string }>): void {
  elRepoLabelsDatalist.innerHTML = labels
    .map((l) => `<option value="${escapeHtml(l.name)}"></option>`)
    .join('');
}

function renderDrawerLabels(issue: Issue): void {
  elDrawerLabelsContainer.innerHTML = '';
  const nonStatusLabels = issue.labels.filter((l) => !l.name.startsWith('status:'));

  if (nonStatusLabels.length === 0) {
    elDrawerLabelsContainer.innerHTML = `<span style="font-size: 11px; color: var(--fg-faint); font-style: italic;">No labels</span>`;
  } else {
    nonStatusLabels.forEach((l) => {
      const hex = sanitizeHexColor(l.color);
      const bg = hex ? `${hex}18` : 'var(--surf-muted)';
      const fg = hex || 'var(--fg-muted)';

      const pill = document.createElement('span');
      pill.className = 'label-pill';
      pill.style.background = bg;
      pill.style.color = fg;
      pill.style.border = `1px solid ${fg}33`;

      pill.innerHTML = `
        <span>${escapeHtml(l.name)}</span>
        <span class="label-pill-remove" title="Remove label">×</span>
      `;

      pill.querySelector('.label-pill-remove')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await removeTagFromIssue(issue, l.name);
      });

      elDrawerLabelsContainer.appendChild(pill);
    });
  }
}

async function addTagToIssue(issue: Issue, tagName: string): Promise<void> {
  const clean = tagName.trim();
  if (!clean) return;
  const currentNames = issue.labels.map((l) => l.name);
  if (currentNames.some((n) => n.toLowerCase() === clean.toLowerCase())) return;

  const newNames = [...currentNames, clean];
  issue.labels.push({ name: clean });
  renderDrawerLabels(issue);
  renderViews();

  try {
    addLog(`Adding label "${clean}" to #${issue.number}...`);
    await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
      labels: newNames,
    });
    await host.toast({ kind: 'success', message: `Added label "${clean}" to #${issue.number}` });
  } catch (err: any) {
    addLog(`Failed to add label: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to add label: ${err.message}` });
  }
}

async function removeTagFromIssue(issue: Issue, tagName: string): Promise<void> {
  const target = tagName.trim().toLowerCase();
  const newLabels = issue.labels.filter((l) => l.name.toLowerCase() !== target);
  issue.labels = newLabels;
  renderDrawerLabels(issue);
  renderViews();

  try {
    addLog(`Removing label "${tagName}" from #${issue.number}...`);
    await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
      labels: newLabels.map((l) => l.name),
    });
    await host.toast({ kind: 'info', message: `Removed label "${tagName}" from #${issue.number}` });
  } catch (err: any) {
    addLog(`Failed to remove label: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to remove label: ${err.message}` });
  }
}

function renderDrawer(issue: Issue): void {
  elDrawerIssueNumber.textContent = `#${issue.number}`;
  elDrawerIssueAuthor.textContent = issue.user ? `by @${issue.user.login}` : '';
  elDrawerGithubLink.href = issue.html_url;
  elDrawerIssueTitle.textContent = issue.title;

  const col = resolveIssueColumn(issue);
  elDrawerStatusSelect.value = col;

  // Render labels
  renderDrawerLabels(issue);
  void loadRepoLabels();

  const session = getIssueSession(issue);
  if (session) {
    let dotClass = 'dot-idle';
    let label = 'Agent Idle';
    if (session.activity === 'running') {
      dotClass = 'dot-running';
      label = 'Agent Working...';
    } else if (session.activity === 'waiting-permission') {
      dotClass = 'dot-waiting';
      label = 'Waiting for Permission';
    } else if (session.activity === 'waiting-question') {
      dotClass = 'dot-waiting';
      label = 'Waiting for User Input';
    }

    elDrawerAgentBadge.innerHTML = `
      <span class="dot ${dotClass}"></span>
      <span>${label}</span>
    `;
    elDrawerWorktreeName.textContent = session.worktree || 'Project Root';
    elBtnDrawerJumpSession.style.display = 'inline-flex';
    elBtnDrawerJumpSession.onclick = () => {
      void host.openSession(session.id);
    };
  } else {
    elDrawerAgentBadge.innerHTML = `
      <span class="dot dot-idle"></span>
      <span>No session active</span>
    `;
    elDrawerWorktreeName.textContent = 'None';
    elBtnDrawerJumpSession.style.display = 'none';
  }

  // Render subtasks checklist
  renderChecklist(issue);

  // Render Markdown Description (View Mode)
  elDrawerDescriptionContent.innerHTML = renderMarkdown(issue.body);
  elDrawerDescriptionViewBox.style.display = 'block';
  elDrawerDescriptionEditBox.style.display = 'none';

  requestAnimationFrame(() => {
    if (elDrawerDescriptionContent.scrollHeight > 220) {
      elDrawerDescriptionCollapsible.classList.remove('expanded');
      elDrawerDescriptionToggleRow.style.display = 'block';
      elBtnToggleCollapse.textContent = 'Show more';
    } else {
      elDrawerDescriptionCollapsible.classList.add('expanded');
      elDrawerDescriptionToggleRow.style.display = 'none';
    }
  });

  void loadComments(issue.number);
}

function renderChecklist(issue: Issue): void {
  const total = issue.subtasks.length;
  const completed = issue.subtasks.filter((s) => s.completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  elChecklistProgressText.textContent = `${completed} / ${total} (${pct}%)`;
  elChecklistProgressFill.style.width = `${pct}%`;

  elDrawerChecklistContainer.innerHTML = '';
  if (total === 0) {
    elDrawerChecklistContainer.innerHTML = `
      <div style="color: var(--fg-faint); font-size: 12px; padding: 4px 0;">
        No markdown subtasks found. Use "- [ ] task" in description or add one below.
      </div>
    `;
    return;
  }

  issue.subtasks.forEach((subtask) => {
    const itemEl = document.createElement('div');
    itemEl.className = `check-item ${subtask.completed ? 'done' : ''}`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = subtask.completed;

    const span = document.createElement('span');
    span.textContent = subtask.text;

    cb.addEventListener('change', () => {
      const updatedBody = updateSubtaskInMarkdown(issue.body, subtask.lineIndex, cb.checked);
      void updateIssueBody(issue, updatedBody);
    });

    itemEl.appendChild(cb);
    itemEl.appendChild(span);
    elDrawerChecklistContainer.appendChild(itemEl);
  });
}

async function loadComments(issueNumber: number): Promise<void> {
  elDrawerCommentsContainer.innerHTML = '<div style="color: var(--fg-muted); font-size: 11.5px;">Loading comments...</div>';
  try {
    const comments: any[] = await githubRequest('GET', `/repos/${currentRepo}/issues/${issueNumber}/comments`);
    elCommentCountBadge.textContent = String(comments.length);

    if (!comments || comments.length === 0) {
      elDrawerCommentsContainer.innerHTML = '<div style="color: var(--fg-faint); font-size: 12px;">No comments yet.</div>';
      return;
    }

    elDrawerCommentsContainer.innerHTML = comments
      .map((c) => {
        const author = c.user ? c.user.login : 'user';
        const date = new Date(c.created_at).toLocaleDateString();
        return `
          <div class="check-item" style="flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; width: 100%; font-size: 11px; color: var(--fg-muted);">
              <strong>@${escapeHtml(author)}</strong>
              <span>${date}</span>
            </div>
            <div style="font-size: 12px; white-space: pre-wrap;">${escapeHtml(c.body)}</div>
          </div>
        `;
      })
      .join('');
  } catch {
    elDrawerCommentsContainer.innerHTML = '<div style="color: var(--fg-faint); font-size: 12px;">Comments unavailable.</div>';
  }
}

// ==========================================
// Pre-Flight Worktree Config Modal
// ==========================================

function openPreflightModal(issue: Issue): void {
  const branchSlug = slugify(issue.title);
  elModalPreflightTitle.textContent = `Launch Agent Worktree on #${issue.number}`;
  elPreflightBranchInput.value = `issue-${issue.number}-${branchSlug}`;
  elPreflightBaseBranchInput.value = 'main';

  let brief = `You are assigned to work on GitHub Issue #${issue.number}: ${issue.title}\n\n`;
  if (issue.body) {
    brief += `### Description:\n${issue.body}\n\n`;
  }
  if (issue.subtasks.length > 0) {
    brief += `### Subtasks Checklist:\n`;
    issue.subtasks.forEach((s) => {
      brief += `- [${s.completed ? 'x' : ' '}] ${s.text}\n`;
    });
    brief += '\n';
  }
  brief += `Please inspect the codebase in this worktree, implement the solution, verify with tests, and report back.`;

  elPreflightPromptInput.value = brief;
  elPreflightBackdrop.classList.add('active');
}

function closePreflightModal(): void {
  elPreflightBackdrop.classList.remove('active');
}

async function launchAgentSession(): Promise<void> {
  if (!activeIssue || !currentProject) return;

  const rawBranch = elPreflightBranchInput.value.trim();
  const cleanBranch = rawBranch.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  const baseBranch = elPreflightBaseBranchInput.value.trim() || undefined;
  const promptText = elPreflightPromptInput.value.trim().slice(0, 15000);
  const autoMove = elPreflightMoveInProgress.checked;

  elBtnPreflightLaunch.disabled = true;
  elBtnPreflightLaunch.textContent = 'Provisioning...';

  try {
    addLog(`Starting session with worktree "${cleanBranch}" on project ${currentProject.id}...`);
    const res = await host.startSession({
      projectId: currentProject.id,
      worktree: cleanBranch ? { kind: 'new', name: cleanBranch, baseBranch } : false,
      providerId: 'github-task-board',
      id: String(activeIssue.number),
      title: `#${activeIssue.number} ${activeIssue.title}`.slice(0, 150),
      url: activeIssue.html_url.slice(0, 1000),
      text: promptText,
      data: {
        issueNumber: activeIssue.number,
        branch: cleanBranch,
      },
    });

    closePreflightModal();

    if (autoMove) {
      void updateIssueStatus(activeIssue, 'in-progress');
    }

    await host.toast({
      kind: 'success',
      message: `Launched worktree "${cleanBranch}" and agent session!`,
    });

    if (res.sessionId) {
      void host.openSession(res.sessionId);
    }
  } catch (err: any) {
    addLog(`Failed to start session: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to launch agent: ${err.message || 'Unknown error'}` });
  } finally {
    elBtnPreflightLaunch.disabled = false;
    elBtnPreflightLaunch.textContent = 'Launch Worktree & Agent';
  }
}

// Quick Create Issue Modal elements
const elNewIssueModalBackdrop = document.getElementById('newIssueModalBackdrop') as HTMLDivElement;
const elNewIssueRepoTarget = document.getElementById('newIssueRepoTarget') as HTMLDivElement;
const elNewIssueTitleInput = document.getElementById('newIssueTitleInput') as HTMLInputElement;
const elNewIssueBodyInput = document.getElementById('newIssueBodyInput') as HTMLTextAreaElement;
const elBtnNewIssueSubmit = document.getElementById('btnNewIssueSubmit') as HTMLButtonElement;
const elBtnNewIssueCancel = document.getElementById('btnNewIssueCancel') as HTMLButtonElement;
const elBtnNewIssueClose = document.getElementById('btnNewIssueClose') as HTMLButtonElement;
const elLinkOpenGithubNew = document.getElementById('linkOpenGithubNew') as HTMLAnchorElement;

function openNewIssueModal(): void {
  if (!currentRepo) {
    openRepoPopover();
    return;
  }
  elNewIssueRepoTarget.textContent = currentRepo;
  elNewIssueTitleInput.value = '';
  elNewIssueBodyInput.value = '';
  elLinkOpenGithubNew.href = `https://github.com/${currentRepo}/issues/new`;
  elNewIssueModalBackdrop.classList.add('active');
  setTimeout(() => elNewIssueTitleInput.focus(), 50);
}

function closeNewIssueModal(): void {
  elNewIssueModalBackdrop.classList.remove('active');
}

async function submitNewIssue(): Promise<void> {
  const title = elNewIssueTitleInput.value.trim();
  const body = elNewIssueBodyInput.value.trim();
  if (!title) {
    elNewIssueTitleInput.focus();
    return;
  }
  elBtnNewIssueSubmit.disabled = true;
  elBtnNewIssueSubmit.textContent = 'Creating...';
  try {
    addLog(`Creating issue in ${currentRepo}: "${title}"...`);
    const created: any = await githubRequest('POST', `/repos/${currentRepo}/issues`, { title, body });
    addLog(`Created issue #${created.number}: ${created.title}`, 'succ');
    await host.toast({ kind: 'success', message: `Created #${created.number} on GitHub!` });
    closeNewIssueModal();
    issueCache.delete(currentRepo);
    void fetchIssues(true);
  } catch (err: any) {
    addLog(`Failed to create issue: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to create issue: ${err.message || 'Unknown error'}` });
  } finally {
    elBtnNewIssueSubmit.disabled = false;
    elBtnNewIssueSubmit.textContent = 'Create Issue';
  }
}

// ==========================================
// Setup Drag & Drop Handlers
// ==========================================

function setupDragAndDrop(): void {
  (Object.keys(kanbanCardContainers) as ColumnId[]).forEach((colId) => {
    const container = kanbanCardContainers[colId];

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');

      const issueNum = draggedIssueNumber || Number(e.dataTransfer?.getData('text/plain'));
      if (!issueNum) return;

      const issue = issues.find((i) => i.number === issueNum);
      if (issue) {
        void updateIssueStatus(issue, colId);
      }
    });
  });
}

// ==========================================
// Event Wiring & Bootstrapping
// ==========================================

function initEvents(): void {
  // Repo dropdown toggle
  elBtnRepoSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    if (elRepoPopover.classList.contains('active')) {
      closeRepoPopover();
    } else {
      openRepoPopover();
    }
  });

  document.addEventListener('click', (e) => {
    if (!elRepoPopover.contains(e.target as Node) && !elBtnRepoSelect.contains(e.target as Node)) {
      closeRepoPopover();
    }
  });

  elBtnSaveCustomRepo.addEventListener('click', () => {
    const custom = elInputCustomRepo.value.trim();
    if (custom && custom.includes('/')) {
      setRepository(custom, 'custom-input');
      closeRepoPopover();
    }
  });

  // Search input
  elSearchInput.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderViews();
  });

  // Layout toggle (List <-> Kanban)
  elBtnLayoutToggle.addEventListener('click', () => {
    if (document.body.getAttribute('data-layout') === 'kanban') {
      userLayoutPreference = 'list';
    } else {
      userLayoutPreference = 'kanban';
    }
    applyLayoutMode();
  });

  // Window resize handler for responsive view adaptivity
  window.addEventListener('resize', () => {
    if (userLayoutPreference === 'auto') {
      applyLayoutMode();
    }
  });

  // Refresh
  elBtnRefresh.addEventListener('click', () => {
    void fetchIssues();
    void discoverWorkspaceRepositories();
  });

  // New Issue
  elBtnNewIssue.addEventListener('click', () => {
    openNewIssueModal();
  });

  elBtnNewIssueClose.addEventListener('click', closeNewIssueModal);
  elBtnNewIssueCancel.addEventListener('click', closeNewIssueModal);
  elBtnNewIssueSubmit.addEventListener('click', () => {
    void submitNewIssue();
  });

  // Logs toggle
  elBtnLogsToggle.addEventListener('click', () => {
    elLogDrawer.classList.toggle('active');
  });
  elBtnLogDrawerClose.addEventListener('click', () => {
    elLogDrawer.classList.remove('active');
  });
  elBtnClearLogs.addEventListener('click', () => {
    logEntries.length = 0;
    const streamEl = document.getElementById('logStream');
    if (streamEl) streamEl.innerHTML = '';
  });
  elBtnCopyLogs.addEventListener('click', () => {
    const text = logEntries.map((e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.msg}`).join('\n');
    void host.writeClipboard(text);
    void host.toast({ kind: 'info', message: 'Copied logs to clipboard' });
  });

  // Status Tab Bar clicks
  elStatusTabBar.querySelectorAll('.status-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      elStatusTabBar.querySelectorAll('.status-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = (tab.getAttribute('data-tab') as TabId) || 'all';
      renderListView(issues);
    });
  });

  // Drawer events
  elBtnDrawerClose.addEventListener('click', closeDrawer);
  elDrawerScrim.addEventListener('click', closeDrawer);

  elDrawerStatusSelect.addEventListener('change', () => {
    if (activeIssue) {
      const targetCol = elDrawerStatusSelect.value as ColumnId;
      void updateIssueStatus(activeIssue, targetCol);
    }
  });

  // Description Edit & Collapse events
  elBtnEditDescription.addEventListener('click', () => {
    if (!activeIssue) return;
    elDrawerDescriptionTextarea.value = activeIssue.body || '';
    elDrawerDescriptionViewBox.style.display = 'none';
    elDrawerDescriptionEditBox.style.display = 'flex';
    elDrawerDescriptionTextarea.focus();
  });

  elBtnCancelDescription.addEventListener('click', () => {
    elDrawerDescriptionEditBox.style.display = 'none';
    elDrawerDescriptionViewBox.style.display = 'block';
  });

  elBtnSaveDescription.addEventListener('click', async () => {
    if (!activeIssue) return;
    const newBody = elDrawerDescriptionTextarea.value;
    elDrawerDescriptionEditBox.style.display = 'none';
    elDrawerDescriptionViewBox.style.display = 'block';
    await updateIssueBody(activeIssue, newBody);
  });

  elBtnToggleCollapse.addEventListener('click', () => {
    const isExpanded = elDrawerDescriptionCollapsible.classList.toggle('expanded');
    elBtnToggleCollapse.textContent = isExpanded ? 'Show less' : 'Show more';
  });

  // Label management events
  elBtnAddLabelToggle.addEventListener('click', () => {
    elDrawerAddLabelRow.style.display = 'flex';
    elInputNewTag.value = '';
    elInputNewTag.focus();
    void loadRepoLabels();
  });

  elBtnCancelAddLabel.addEventListener('click', () => {
    elDrawerAddLabelRow.style.display = 'none';
  });

  elBtnConfirmAddLabel.addEventListener('click', async () => {
    if (activeIssue && elInputNewTag.value.trim()) {
      const val = elInputNewTag.value.trim();
      elDrawerAddLabelRow.style.display = 'none';
      await addTagToIssue(activeIssue, val);
    }
  });

  elInputNewTag.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elBtnConfirmAddLabel.click();
    if (e.key === 'Escape') elBtnCancelAddLabel.click();
  });

  elBtnAddSubtask.addEventListener('click', () => {
    if (activeIssue && elInputAddSubtask.value.trim()) {
      const newBody = appendSubtaskToMarkdown(activeIssue.body, elInputAddSubtask.value);
      elInputAddSubtask.value = '';
      void updateIssueBody(activeIssue, newBody);
    }
  });

  elInputAddSubtask.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elBtnAddSubtask.click();
  });

  elBtnDrawerAttachComposer.addEventListener('click', async () => {
    if (!activeIssue) return;
    await host.attach({
      providerId: 'github-task-board',
      id: String(activeIssue.number),
      title: `#${activeIssue.number} ${activeIssue.title}`.slice(0, 150),
      url: activeIssue.html_url.slice(0, 1000),
      text: `Context from GitHub Issue #${activeIssue.number}: ${activeIssue.title}\n\n${activeIssue.body}`.slice(0, 15000),
    });
    await host.toast({ kind: 'success', message: `Attached #${activeIssue.number} to composer chip` });
  });

  elBtnDrawerOpenPreflight.addEventListener('click', () => {
    if (activeIssue) openPreflightModal(activeIssue);
  });

  // Preflight modal events
  elBtnPreflightCancel.addEventListener('click', closePreflightModal);
  elBtnPreflightClose.addEventListener('click', closePreflightModal);
  elBtnPreflightLaunch.addEventListener('click', () => {
    void launchAgentSession();
  });

  setupDragAndDrop();
}

// ==========================================
// Host Lifecycle Subscriptions
// ==========================================

host.onReady(async (ctx) => {
  addLog(`Host ready. Surface: ${ctx.surface}, Directory: ${ctx.directory || 'none'}`);

  // Apply native theme and surface attributes to documentElement
  applyHostReady(ctx, document.documentElement);

  currentDirectory = ctx.directory || '';

  // Handle settings override
  if (ctx.settings && ctx.settings.repo) {
    currentRepo = ctx.settings.repo.trim();
    elTxtRepoLabel.textContent = currentRepo.split('/')[1] || currentRepo;
    addLog(`Repo set from extension settings: ${currentRepo}`, 'info');
  }

  // Run deep workspace repo discovery and auto-watch active project
  await discoverWorkspaceRepositories();
});

// React to directory change (when user switches projects, worktrees, or chats)
host.onDirectory(async (dir) => {
  addLog(`Directory changed: ${dir}`);
  currentDirectory = dir || '';
  if (dir) {
    await autoResolveRepoForActiveContext();
  }
});

// React to session change (when user switches chat sessions)
host.onSession(async (sess) => {
  if (sess) {
    addLog(`Active session: "${sess.title}" (${sess.id})`);
    const matched = sessions.find((s) => s.id === sess.id);
    if (matched && matched.directory && matched.directory !== currentDirectory) {
      currentDirectory = matched.directory;
      await autoResolveRepoForActiveContext();
    }
  }
});

initEvents();
