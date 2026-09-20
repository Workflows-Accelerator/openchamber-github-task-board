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
  worktree?: string | { name?: string; branch?: string; directory?: string; status?: string } | null;
  directory?: string | null;
  items?: Array<{ id?: string; providerId?: string; data?: any }>;
}

export function extractWorktreeName(wt: any): string {
  if (!wt) return '';
  if (typeof wt === 'string') return wt;
  if (typeof wt === 'object') {
    return wt.name || wt.branch || wt.directory || '';
  }
  return '';
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
let userSelectedTab: boolean = false;
let showArchivedOnly: boolean = false;
let currentSort: 'newest' | 'oldest' | 'priority' | 'complexity' | 'subtasks' | 'title' = 'newest';
let filterPriority: string = 'all';
let filterTag: string = 'all';
let currentGroupBy: 'status' | 'priority' | 'tag' = 'status';
let isFilterBarOpen: boolean = false;
let selectedIssueNumbers = new Set<number>();
let userLayoutPreference: 'auto' | 'list' | 'kanban' = 'auto';
let isWideScreen: boolean = false;
let draggedIssueNumber: number | null = null;
let isLoading: boolean = false;

export function selectTab(tabId: TabId): void {
  activeTab = tabId;
  const bar = document.getElementById('statusTabBar');
  if (bar) {
    bar.querySelectorAll('.status-tab').forEach((tab) => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }
}

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

// Filter & Sort elements
const elBtnFilterToggle = document.getElementById('btnFilterToggle') as HTMLButtonElement | null;
const elFilterBar = document.getElementById('filterBar') as HTMLDivElement | null;
const elSelectSort = document.getElementById('selectSort') as HTMLSelectElement | null;
const elSelectGroupBy = document.getElementById('selectGroupBy') as HTMLSelectElement | null;
const elSelectFilterPriority = document.getElementById('selectFilterPriority') as HTMLSelectElement | null;
const elSelectFilterTag = document.getElementById('selectFilterTag') as HTMLSelectElement | null;
const elBtnStartTagIssues = document.getElementById('btnStartTagIssues') as HTMLButtonElement | null;
const elBtnResetFilters = document.getElementById('btnResetFilters') as HTMLButtonElement | null;

// Batch action bar elements
const elBatchActionBar = document.getElementById('batchActionBar') as HTMLDivElement | null;
const elBatchCountBadge = document.getElementById('batchCountBadge') as HTMLSpanElement | null;
const elBtnBatchPackage = document.getElementById('btnBatchPackage') as HTMLButtonElement | null;
const elBtnBatchStart = document.getElementById('btnBatchStart') as HTMLButtonElement | null;
const elBtnBatchAttach = document.getElementById('btnBatchAttach') as HTMLButtonElement | null;
const elBtnBatchDeselect = document.getElementById('btnBatchDeselect') as HTMLButtonElement | null;

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
const elBtnDrawerToggleClose = document.getElementById('btnDrawerToggleClose') as HTMLButtonElement | null;
const elDrawerIssueTitle = document.getElementById('drawerIssueTitle') as HTMLHeadingElement;
const elDrawerPrioritySelect = document.getElementById('drawerPrioritySelect') as HTMLSelectElement | null;
const elDrawerStatusSelect = document.getElementById('drawerStatusSelect') as HTMLSelectElement;
const elDrawerComplexitySelect = document.getElementById('drawerComplexitySelect') as HTMLSelectElement | null;
const elDrawerAlignmentWarning = document.getElementById('drawerAlignmentWarning') as HTMLDivElement | null;
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
const elDrawerRelatedIssuesContainer = document.getElementById('drawerRelatedIssuesContainer') as HTMLDivElement | null;
const elRelatedIssuesCountBadge = document.getElementById('relatedIssuesCountBadge') as HTMLSpanElement | null;
const elBtnDrawerAttachComposer = document.getElementById('btnDrawerAttachComposer') as HTMLButtonElement;
const elBtnDrawerArchive = document.getElementById('btnDrawerArchive') as HTMLButtonElement | null;
const elTxtDrawerArchive = document.getElementById('txtDrawerArchive') as HTMLSpanElement | null;
const elBtnDrawerOpenPreflight = document.getElementById('btnDrawerOpenPreflight') as HTMLButtonElement;

// Preflight modal elements
const elPreflightBackdrop = document.getElementById('preflightModalBackdrop') as HTMLDivElement;
const elModalPreflightTitle = document.getElementById('modalPreflightTitle') as HTMLHeadingElement;
const elPreflightWorktreeToggle = document.getElementById('preflightWorktreeToggle') as HTMLInputElement;
const elPreflightWorktreeSection = document.getElementById('preflightWorktreeSection') as HTMLDivElement;
const elRadioWorktreeTag = document.getElementById('radioWorktreeTag') as HTMLInputElement;
const elRadioWorktreeIssue = document.getElementById('radioWorktreeIssue') as HTMLInputElement;
const elPreflightTagPreview = document.getElementById('preflightTagPreview') as HTMLSpanElement;
const elPreflightIssuePreview = document.getElementById('preflightIssuePreview') as HTMLSpanElement;
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
      const prevSessions = sessions;
      sessions = (sessSnap.sessions as any[]) || [];
      renderViews();
      if (activeIssue) renderDrawer(activeIssue);

      // When a session finishes / becomes idle, bust issue cache and fetch fresh state from GitHub
      const becameIdle = sessions.some((s) => {
        const prev = prevSessions.find((p) => p.id === s.id);
        return s.activity === 'idle' && (!prev || prev.activity !== 'idle');
      });
      if (becameIdle && currentRepo) {
        issueCache.delete(currentRepo);
        void fetchIssues(true);
      }
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
  userSelectedTab = false;
  currentRepo = repo;
  clearSelection();
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
            ${isSelectedRepo ? '<span style="color: var(--succ); font-size: 11px; font-weight: 500;">[active]</span>' : ''}
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
      if (!userSelectedTab) {
        selectTab(resolveDefaultTab(issues));
      }
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
    if (!userSelectedTab) {
      selectTab(resolveDefaultTab(issues));
    }
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
  const prevLabels = [...issue.labels];
  const prevState = issue.state;

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
  if (currentRepo) {
    issueCache.delete(currentRepo);
  }
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
    // Revert optimistic update on failure
    issue.state = prevState;
    issue.labels = prevLabels;
    renderViews();
    if (activeIssue && activeIssue.number === issue.number) {
      renderDrawer(issue);
    }
    addLog(`Failed to move #${issue.number}: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to move #${issue.number}` });
  }
}

// ==========================================
// Quick Composer Chip & Status Helpers
// ==========================================

export function buildIssueAttachPayload(issue: Issue) {
  const numStr = String(issue.number);
  const title = `#${issue.number} ${issue.title || ''}`.slice(0, 150);
  const url = (issue.html_url || '').slice(0, 1000);
  const text = `Context from GitHub Issue #${issue.number}: ${issue.title || ''}\n\n${issue.body || ''}`.slice(0, 15000);
  return {
    providerId: 'github-task-board',
    id: numStr,
    title,
    url,
    text,
    ...(issue.user?.login ? { author: String(issue.user.login) } : {}),
    data: {
      issueNumber: issue.number,
    },
  };
}

export function isIssueClosed(issue: Issue): boolean {
  if (!issue) return false;
  if (typeof issue.state === 'string' && issue.state.toLowerCase() === 'closed') {
    return true;
  }
  if ((issue as any).state_reason === 'completed') {
    return true;
  }
  const labelNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (
    labelNames.includes('status:done') ||
    labelNames.includes('status:closed') ||
    labelNames.includes('closed') ||
    labelNames.includes('done')
  ) {
    return true;
  }
  return false;
}

export function isIssueArchived(issue: Issue): boolean {
  if (!issue || !issue.labels) return false;
  return issue.labels.some((l) => {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    return name === 'archived' || name === 'archive' || name === 'status:archived';
  });
}

export function getNextColumn(current: ColumnId): ColumnId {
  switch (current) {
    case 'backlog':
      return 'todo';
    case 'todo':
      return 'in-progress';
    case 'in-progress':
      return 'in-review';
    case 'in-review':
      return 'done';
    case 'done':
      return 'todo';
    default:
      return 'todo';
  }
}

export function getNextColumnAction(current: ColumnId): { label: string; target: ColumnId; icon: string } {
  switch (current) {
    case 'backlog':
      return { label: 'To Do', target: 'todo', icon: '→' };
    case 'todo':
      return { label: 'In Progress', target: 'in-progress', icon: '▶' };
    case 'in-progress':
      return { label: 'In Review', target: 'in-review', icon: '→' };
    case 'in-review':
      return { label: 'Done', target: 'done', icon: '✓' };
    case 'done':
      return { label: 'Reopen', target: 'todo', icon: '↺' };
    default:
      return { label: 'Next', target: 'todo', icon: '→' };
  }
}

async function toggleArchiveIssue(issue: Issue): Promise<void> {
  const isArch = isIssueArchived(issue);
  const prevLabels = [...issue.labels];
  const prevState = issue.state;

  const currentNames = issue.labels.map((l) => (typeof l === 'string' ? l : l.name || ''));
  const clean = currentNames.filter(
    (n) => !['archived', 'archive', 'status:archived'].includes(n.toLowerCase())
  );

  let newState: 'open' | 'closed' = issue.state;
  let targetCategory: ColumnId = 'todo';

  if (!isArch) {
    // Archiving: preserve the current category tag so unarchiving can restore it!
    const currentCategory = resolveIssueColumn(issue) || 'todo';
    if (!clean.some((n) => n.startsWith('status:'))) {
      clean.push(`status:${currentCategory}`);
    }
    clean.push('archived');
    newState = 'closed';
    targetCategory = currentCategory;
  } else {
    // Unarchiving: inspect preserved status:<cat> tag to bring it back to its original category!
    const statusLabel = clean.find((n) => n.startsWith('status:'));
    if (statusLabel) {
      targetCategory = (statusLabel.replace('status:', '').trim() || 'todo') as ColumnId;
    } else {
      targetCategory = 'todo';
      clean.push('status:todo');
    }
    newState = targetCategory === 'done' ? 'closed' : 'open';
  }

  issue.state = newState;
  issue.labels = clean.map((name) => ({ name }));
  if (currentRepo) {
    issueCache.delete(currentRepo);
  }
  renderViews();
  if (activeIssue && activeIssue.number === issue.number) {
    renderDrawer(issue);
  }

  try {
    await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
      state: newState,
      labels: clean,
    });
    await host.toast({
      kind: isArch ? 'info' : 'success',
      message: isArch ? `Unarchived #${issue.number} back to ${targetCategory}` : `Archived #${issue.number}`,
    });
    addLog(isArch ? `Unarchived #${issue.number} back to ${targetCategory}` : `Archived #${issue.number}`, 'succ');
  } catch (err: any) {
    issue.state = prevState;
    issue.labels = prevLabels;
    renderViews();
    if (activeIssue && activeIssue.number === issue.number) {
      renderDrawer(issue);
    }
    addLog(`Failed to update archive state: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to archive #${issue.number}: ${err.message}` });
  }
}

// ==========================================
// Priority, Complexity & Sorting Helpers
// ==========================================

export function getIssuePriority(issue: Issue): string | null {
  if (!issue || !issue.labels) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    if (name === 'priority:critical') return 'critical';
    if (name === 'priority:important') return 'important';
    if (name === 'priority:useful') return 'useful';
    if (name === 'priority:optional') return 'optional';
  }
  return null;
}

export function updatePriorityLabels(currentLabels: any[], newPriority: string | null): string[] {
  const cleanExisting = currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter((name) => !name.toLowerCase().startsWith('priority:'));

  if (newPriority && typeof newPriority === 'string' && newPriority.trim().toLowerCase() !== 'none') {
    cleanExisting.push(`priority:${newPriority.trim().toLowerCase()}`);
  }
  return cleanExisting;
}

export interface IssueGroup {
  id: string;
  title: string;
  issues: Issue[];
}

export function groupIssuesBy(issuesList: Issue[], groupBy: 'status' | 'priority' | 'tag'): IssueGroup[] {
  if (groupBy === 'priority') {
    const groups: IssueGroup[] = [
      { id: 'critical', title: 'Critical', issues: [] },
      { id: 'important', title: 'Important', issues: [] },
      { id: 'useful', title: 'Useful', issues: [] },
      { id: 'optional', title: 'Optional', issues: [] },
      { id: 'none', title: 'No Priority', issues: [] },
    ];
    const map = new Map(groups.map((g) => [g.id, g]));
    for (const issue of issuesList) {
      const p = getIssuePriority(issue) || 'none';
      map.get(p)?.issues.push(issue);
    }
    return groups;
  }

  if (groupBy === 'tag') {
    const tagMap = new Map<string, IssueGroup>();
    for (const issue of issuesList) {
      const tag = getIssuePrimaryTag(issue);
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { id: tag, title: tag, issues: [] });
      }
      tagMap.get(tag)!.issues.push(issue);
    }
    if (tagMap.size === 0) {
      tagMap.set('general', { id: 'general', title: 'General Tasks', issues: issuesList });
    }
    return Array.from(tagMap.values());
  }

  // Default: status
  const groups: IssueGroup[] = [
    { id: 'backlog', title: 'Backlog', issues: [] },
    { id: 'todo', title: 'To Do', issues: [] },
    { id: 'in-progress', title: 'In Progress', issues: [] },
    { id: 'in-review', title: 'In Review', issues: [] },
    { id: 'done', title: 'Done', issues: [] },
  ];
  const map = new Map(groups.map((g) => [g.id, g]));
  for (const issue of issuesList) {
    const col = resolveIssueColumn(issue);
    if (col && map.has(col)) {
      map.get(col)!.issues.push(issue);
    }
  }
  return groups;
}

export function getIssueComplexity(issue: Issue): string | null {
  if (!issue || !issue.labels) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
    if (name === 'complexity:xl') return 'XL';
    if (name === 'complexity:l') return 'L';
    if (name === 'complexity:m') return 'M';
    if (name === 'complexity:s') return 'S';
    if (name === 'complexity:xs') return 'XS';
  }
  return null;
}

const PRIORITY_WEIGHTS: Record<string, number> = { critical: 4, important: 3, useful: 2, optional: 1 };
const COMPLEXITY_WEIGHTS: Record<string, number> = { XL: 5, L: 4, M: 3, S: 2, XS: 1 };

export function sortIssuesList(list: Issue[], sortKey: string): Issue[] {
  const copy = [...list];
  switch (sortKey) {
    case 'newest':
      return copy.sort((a, b) => b.number - a.number);
    case 'oldest':
      return copy.sort((a, b) => a.number - b.number);
    case 'priority':
      return copy.sort((a, b) => {
        const pA = PRIORITY_WEIGHTS[getIssuePriority(a) || ''] || 0;
        const pB = PRIORITY_WEIGHTS[getIssuePriority(b) || ''] || 0;
        return pB !== pA ? pB - pA : b.number - a.number;
      });
    case 'complexity':
      return copy.sort((a, b) => {
        const cA = COMPLEXITY_WEIGHTS[getIssueComplexity(a) || ''] || 0;
        const cB = COMPLEXITY_WEIGHTS[getIssueComplexity(b) || ''] || 0;
        return cB !== cA ? cB - cA : b.number - a.number;
      });
    case 'subtasks':
      return copy.sort((a, b) => {
        const remA = a.subtasks.filter((s) => !s.completed).length;
        const remB = b.subtasks.filter((s) => !s.completed).length;
        return remB !== remA ? remB - remA : b.number - a.number;
      });
    case 'title':
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    default:
      return copy;
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
    const wtName = extractWorktreeName(s.worktree);
    if (wtName && wtName.includes(`issue-${issue.number}`)) {
      return true;
    }
    return false;
  });
  return match || null;
}

export function resolveIssueColumn(issue: Issue): ColumnId | null {
  if (isIssueClosed(issue)) {
    return 'done';
  }

  const labelNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labelNames.includes('status:done')) return 'done';
  if (labelNames.includes('status:in-review')) return 'in-review';

  // Check attached session activity
  const session = getIssueSession(issue);

  // If issue has explicit status:in-progress label
  if (labelNames.includes('status:in-progress')) {
    if (session && session.activity === 'idle') {
      // In-progress work has finished and agent session is idle -> transition to in-review
      return 'in-review';
    }
    return 'in-progress';
  }

  // Explicit status:todo label
  if (labelNames.includes('status:todo')) {
    if (session && (session.activity === 'running' || session.activity.startsWith('waiting'))) {
      return 'in-progress';
    }
    return 'todo';
  }

  // Explicit status:backlog label
  if (labelNames.includes('status:backlog')) {
    if (session && (session.activity === 'running' || session.activity.startsWith('waiting'))) {
      return 'in-progress';
    }
    return 'backlog';
  }

  // Dynamic session detection for issues without explicit status labels
  if (session) {
    if (session.activity === 'running' || session.activity.startsWith('waiting')) {
      return 'in-progress';
    }
    if (session.activity === 'idle') {
      return 'in-review';
    }
  }

  // Unknown status (only show in 'all' view)
  return null;
}

export function resolveDefaultTab(issues: Issue[]): TabId {
  if (!issues || issues.length === 0) return 'all';

  const hasReview = issues.some((i) => resolveIssueColumn(i) === 'in-review');
  if (hasReview) return 'in-review';

  const hasProgress = issues.some((i) => resolveIssueColumn(i) === 'in-progress');
  if (hasProgress) return 'in-progress';

  const hasTodo = issues.some((i) => resolveIssueColumn(i) === 'todo');
  if (hasTodo) return 'todo';

  const hasBacklog = issues.some((i) => resolveIssueColumn(i) === 'backlog');
  if (hasBacklog) return 'backlog';

  return 'all';
}

function updateBadgeCounts(): void {
  const counts: Record<ColumnId, number> = {
    'backlog': 0,
    'todo': 0,
    'in-progress': 0,
    'in-review': 0,
    'done': 0,
  };

  const visibleIssues = issues.filter((issue) => (showArchivedOnly ? isIssueArchived(issue) : !isIssueArchived(issue)));

  visibleIssues.forEach((issue) => {
    const col = resolveIssueColumn(issue);
    if (col && counts[col] !== undefined) {
      counts[col]++;
    }
  });

  const total = visibleIssues.length;

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
// Rendering: Dual View Engine & Archive
// ==========================================

function renderEmptyState(message: string): void {
  if (elListViewContainer) {
    elListViewContainer.innerHTML = `<div class="empty-box">${escapeHtml(message)}</div>`;
  }
  if (elKanbanViewContainer) {
    elKanbanViewContainer.innerHTML = `<div class="empty-box" style="margin: auto;">${escapeHtml(message)}</div>`;
  }
}

function renderArchiveView(archivedIssues: Issue[]): void {
  elListViewContainer.innerHTML = '';

  const banner = document.createElement('div');
  banner.className = 'archive-header-banner';
  banner.innerHTML = `
    <div class="archive-title-wrap">
      <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 5h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zm5 3v2h6v-2H9z"/></svg>
      <span>Archived Issues (${archivedIssues.length})</span>
    </div>
    <button class="btn btn-sm btn-secondary" id="btnExitArchive">Exit Archive</button>
  `;
  const btnExit = banner.querySelector('#btnExitArchive') as HTMLButtonElement;
  if (btnExit) {
    btnExit.addEventListener('click', () => {
      showArchivedOnly = false;
      const btn = document.getElementById('btnArchiveToggle');
      if (btn) btn.classList.remove('active');
      renderViews();
    });
  }
  elListViewContainer.appendChild(banner);

  if (archivedIssues.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-box';
    empty.innerHTML = `
      <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 5h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zm5 3v2h6v-2H9z"/></svg>
      <span>No archived issues in this repository.</span>
    `;
    elListViewContainer.appendChild(empty);
    return;
  }

  archivedIssues.forEach((issue) => {
    const card = buildCardElement(issue, false);
    elListViewContainer.appendChild(card);
  });
}

function renderViews(): void {
  updateBadgeCounts();

  // Populate dynamic tag filter
  if (elSelectFilterTag) {
    const existingTags = new Set<string>();
    issues.forEach((i) => {
      (i.labels || []).forEach((l) => {
        const name = typeof l === 'string' ? l : l.name || '';
        if (
          name &&
          !name.startsWith('status:') &&
          !name.startsWith('priority:') &&
          !name.startsWith('complexity:') &&
          name.toLowerCase() !== 'archived' &&
          name.toLowerCase() !== 'archive'
        ) {
          existingTags.add(name);
        }
      });
    });

    const currentVal = elSelectFilterTag.value;
    const sortedTags = Array.from(existingTags).sort();
    let optionsHtml = `<option value="all"${filterTag === 'all' ? ' selected' : ''}>All Tags</option>`;
    sortedTags.forEach((t) => {
      optionsHtml += `<option value="${escapeHtml(t)}"${filterTag === t ? ' selected' : ''}>${escapeHtml(t)}</option>`;
    });
    elSelectFilterTag.innerHTML = optionsHtml;
    if (sortedTags.includes(currentVal)) {
      elSelectFilterTag.value = currentVal;
    }
  }

  // Check if filters are active
  const hasActiveFilters = filterPriority !== 'all' || filterTag !== 'all' || currentSort !== 'newest';
  if (elBtnResetFilters) {
    elBtnResetFilters.style.display = hasActiveFilters ? 'inline-flex' : 'none';
  }
  if (elBtnFilterToggle) {
    elBtnFilterToggle.classList.toggle('active', hasActiveFilters || isFilterBarOpen);
  }
  if (elBtnStartTagIssues) {
    if (filterTag !== 'all') {
      elBtnStartTagIssues.style.display = 'inline-flex';
      elBtnStartTagIssues.textContent = `Select All with "${filterTag}"`;
    } else {
      elBtnStartTagIssues.style.display = 'none';
    }
  }

  // Filter issues
  const q = searchQuery.toLowerCase().trim();
  const filtered = issues.filter((issue) => {
    const isArch = isIssueArchived(issue);
    if (showArchivedOnly ? !isArch : isArch) return false;

    if (filterPriority !== 'all') {
      const p = getIssuePriority(issue);
      if (p !== filterPriority) return false;
    }

    if (filterTag !== 'all') {
      const hasTag = (issue.labels || []).some((l) => {
        const name = typeof l === 'string' ? l : l.name || '';
        return name === filterTag;
      });
      if (!hasTag) return false;
    }

    if (!q) return true;
    return (
      issue.title.toLowerCase().includes(q) ||
      String(issue.number).includes(q) ||
      issue.labels.some((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase().includes(q))
    );
  });

  // Sort issues
  const sorted = sortIssuesList(filtered, currentSort);

  // If in Archive Mode: render single flat list only (not standard categories)
  if (showArchivedOnly) {
    document.body.removeAttribute('data-layout');
    if (elStatusTabBar) elStatusTabBar.style.display = 'none';
    if (elKanbanViewContainer) elKanbanViewContainer.style.display = 'none';
    if (elListViewContainer) {
      elListViewContainer.style.display = 'flex';
      renderArchiveView(sorted);
    }
    return;
  }

  // Restore normal view layout
  if (elStatusTabBar) elStatusTabBar.style.display = '';
  if (elKanbanViewContainer) elKanbanViewContainer.style.display = '';
  if (elListViewContainer) elListViewContainer.style.display = '';

  // 1. Render Mode: List View
  renderListView(sorted);

  // 2. Render Mode: Kanban View
  renderKanbanView(sorted);

  // Sync batch bar & card selections
  updateBatchBar();

  // Auto layout check
  applyLayoutMode();
}

export function getIssueDescriptionPreview(body: string | null | undefined): string {
  if (!body || typeof body !== 'string') return '';
  const lines = body.split(/\r?\n/);
  const GENERIC_HEADERS = /^(overview|description|context|summary|details|background|goal|problem|about)$/i;
  let fallback = '';
  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('```') || line.startsWith('~~~')) continue;
    const isHeading = line.startsWith('#');
    line = line.replace(/^#+\s*/, '');
    line = line.replace(/^>\s*/, '');
    line = line.replace(/^[-*+]\s*\[[ xX]\]\s*/, '');
    line = line.replace(/^[-*+]\s+/, '');
    line = line.replace(/^\d+\.\s+/, '');
    line = line.replace(/(\*\*|__)(.*?)\1/g, '$2');
    line = line.replace(/(\*|_)(.*?)\1/g, '$2');
    line = line.replace(/`([^`]+)`/g, '$1');
    line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    line = line.replace(/<[^>]*>/g, '');
    line = line.trim();
    if (!line) continue;
    if (isHeading && GENERIC_HEADERS.test(line)) {
      if (!fallback) fallback = line;
      continue;
    }
    return line;
  }
  return fallback;
}

function buildCardElement(issue: Issue, inKanban: boolean): HTMLElement {
  const session = getIssueSession(issue);
  const card = document.createElement('div');
  const isSelected = selectedIssueNumbers.has(issue.number);
  card.className = `card ${isSelected ? 'is-selected' : ''}`;
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
  const wtTag = extractWorktreeName(session?.worktree);
  const worktreeHtml = wtTag
    ? `
      <div class="worktree-tag">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M7.05 13.05C6.46 12.4 5.54 12 4.5 12 2.57 12 1 13.57 1 15.5S2.57 19 4.5 19c1.04 0 1.96-.4 2.55-1.05l7.9 4.05V24h2v-4.5l-7.9-4.05c.59-.65 1.45-1.05 2.45-1.05 1.04 0 1.96.4 2.55 1.05L19.5 11.4V14h2V8h-6v2h2.6l-5.65 3.95c-.59-.65-1.45-1.05-2.45-1.05-1.04 0-1.96.4-2.55 1.05L7.05 13.05z"/></svg>
        <span>${escapeHtml(wtTag)}</span>
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

  const col = resolveIssueColumn(issue);
  const nextAction = col ? getNextColumnAction(col) : { label: 'To Do', target: 'todo' as ColumnId, icon: '→' };
  const isArch = isIssueArchived(issue);

  let archiveCategoryBadge = '';
  if (isArch) {
    const statusLabel = (issue.labels || []).find((l) => (typeof l === 'string' ? l : l.name || '').startsWith('status:'));
    const rawCat = statusLabel ? (typeof statusLabel === 'string' ? statusLabel : statusLabel.name || '').replace('status:', '') : '';
    const catLabel = rawCat === 'in-progress' ? 'In Progress' : rawCat === 'in-review' ? 'In Review' : rawCat === 'done' ? 'Done' : rawCat === 'backlog' ? 'Backlog' : 'To Do';
    archiveCategoryBadge = `<span class="archive-from-badge">From: ${escapeHtml(catLabel)}</span>`;
  }

  // Priority, Complexity & Alignment badges
  const priority = getIssuePriority(issue);
  const priorityHtml = priority
    ? `<span class="badge badge-priority badge-priority-${priority}">${priority}</span>`
    : '';

  const complexity = getIssueComplexity(issue);
  const complexityHtml = complexity
    ? `<span class="badge badge-complexity badge-complexity-${complexity.toLowerCase()}">${complexity}</span>`
    : '';

    const vague = isVagueIdea(issue);
  const vagueBadgeHtml = vague
    ? `<span class="badge badge-vague" title="Sparse task needing alignment">Needs Alignment</span>`
    : '';

  const descPreview = getIssueDescriptionPreview(issue.body);
  const descHtml = descPreview
    ? `<div class="card-desc" title="${escapeHtml(descPreview)}">${escapeHtml(descPreview)}</div>`
    : '';

  const nextStageButtonHtml = !inKanban && !showArchivedOnly
    ? `
      <button class="card-btn-next" data-issue="${issue.number}" data-target="${nextAction.target}" title="Move to ${nextAction.label}">
        <span>${nextAction.icon}</span>
        <span>${nextAction.label}</span>
      </button>
    `
    : '';

  const archiveButtonHtml = showArchivedOnly
    ? `
      <button class="btn btn-sm card-btn-archive is-archived" data-issue="${issue.number}" title="Unarchive issue (Restore to original category)">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>Unarchive</span>
      </button>
    `
    : (!inKanban
      ? `
        <button class="card-btn-archive ${isArch ? 'is-archived' : ''}" data-issue="${issue.number}" title="${isArch ? 'Unarchive issue' : 'Archive issue'}">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 5h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8zm5 3v2h6v-2H9z"/></svg>
        </button>
      `
      : '');

  const attachButtonHtml = `
    <button class="card-btn-attach" data-issue="${issue.number}" title="Attach issue chip to active prompt">
      <svg class="icon icon-sm icon-paperclip" viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6h-2v9.5a3.5 3.5 0 0 0 7 0V5a4.5 4.5 0 0 0-9 0v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-2z"/></svg>
      <svg class="icon icon-sm icon-check" style="display: none;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </button>
  `;

  card.innerHTML = `
    <div class="card-meta">
      <div class="card-id-wrap">
        <input type="checkbox" class="card-checkbox" data-issue="${issue.number}" ${isSelected ? 'checked' : ''} title="Select issue for batch actions" />
        <span class="card-id">#${issue.number}</span>
        ${priorityHtml}
        ${complexityHtml}
        ${vagueBadgeHtml}
        ${issue.user ? `<span style="color: var(--fg-muted); font-size: 11px;">@${escapeHtml(issue.user.login)}</span>` : ''}
        ${archiveCategoryBadge}
      </div>
      <div style="display: flex; align-items: center; gap: 5px;">
        ${nextStageButtonHtml}
        ${archiveButtonHtml}
        ${agentBadgeHtml}
      </div>
    </div>
    <div class="card-title">${escapeHtml(issue.title)}</div>
    ${descHtml}
    ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ''}
    <div class="card-footer">
      ${subtaskHtml}
      <div style="display: flex; align-items: center; gap: 6px;">
        ${worktreeHtml}
        ${attachButtonHtml}
      </div>
    </div>
  `;

  // Checkbox selection listener
  const cbSelect = card.querySelector('.card-checkbox') as HTMLInputElement | null;
  if (cbSelect) {
    cbSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleIssueSelection(issue.number);
    });
  }

  // Quick attach button
  const btnAttach = card.querySelector('.card-btn-attach') as HTMLButtonElement | null;
  if (btnAttach) {
    btnAttach.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const payload = buildIssueAttachPayload(issue);
        await host.attach(payload);
        btnAttach.classList.add('attached');
        await host.toast({ kind: 'success', message: `Attached #${issue.number} to composer chip` });
        setTimeout(() => {
          btnAttach.classList.remove('attached');
        }, 1500);
      } catch (err: any) {
        addLog(`Failed to attach issue #${issue.number}: ${err.message}`, 'error');
        await host.toast({ kind: 'error', message: `Failed to attach: ${err.message || 'Unknown error'}` });
      }
    });
  }

  // 1-Click Next Stage progression and Archive
  const btnNext = card.querySelector('.card-btn-next') as HTMLButtonElement | null;
  if (btnNext) {
    btnNext.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const target = btnNext.getAttribute('data-target') as ColumnId;
      if (target) {
        await updateIssueStatus(issue, target);
      }
    });
  }

  const btnArchive = card.querySelector('.card-btn-archive') as HTMLButtonElement | null;
  if (btnArchive) {
    btnArchive.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await toggleArchiveIssue(issue);
    });
  }

  // Open inspection drawer on card click
  card.addEventListener('click', (e) => {
    // If clicking a link, button, or input checkbox, skip drawer
    if ((e.target as HTMLElement).closest('button, a, select, input')) return;
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

  if (currentGroupBy === 'status') {
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
  } else {
    const groups = groupIssuesBy(filteredIssues, currentGroupBy);
    let totalRendered = 0;

    groups.forEach((grp) => {
      if (grp.issues.length === 0) return;
      totalRendered += grp.issues.length;

      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 4px 4px 4px; font-size: 11px; font-weight: 600; color: var(--fg-muted); border-bottom: 1px solid var(--border-subtle); margin-top: 4px;';
      header.innerHTML = `
        <span>${escapeHtml(grp.title)}</span>
        <span class="status-pill">${grp.issues.length}</span>
      `;
      elListViewContainer.appendChild(header);

      grp.issues.forEach((issue) => {
        const card = buildCardElement(issue, false);
        elListViewContainer.appendChild(card);
      });
    });

    if (totalRendered === 0) {
      elListViewContainer.innerHTML = `
        <div class="empty-box">
          <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"/></svg>
          <span>No issues match this view</span>
        </div>
      `;
    }
  }
}

function renderKanbanView(filteredIssues: Issue[]): void {
  elKanbanViewContainer.innerHTML = '';
  const groups = groupIssuesBy(filteredIssues, currentGroupBy);

  groups.forEach((grp) => {
    const colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.dataset.column = grp.id;
    colEl.innerHTML = `
      <div class="kanban-col-header">
        <span>${escapeHtml(grp.title)}</span>
        <span class="status-pill">${grp.issues.length}</span>
      </div>
      <div class="kanban-cards" data-column="${escapeHtml(grp.id)}"></div>
    `;

    const cardsContainer = colEl.querySelector('.kanban-cards') as HTMLDivElement;

    // Drag-over and drop handlers on column
    cardsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      cardsContainer.classList.add('drag-over');
    });
    cardsContainer.addEventListener('dragleave', () => {
      cardsContainer.classList.remove('drag-over');
    });
    cardsContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      cardsContainer.classList.remove('drag-over');
      const issueNum = draggedIssueNumber || Number(e.dataTransfer?.getData('text/plain'));
      if (!issueNum) return;
      const issue = issues.find((i) => i.number === issueNum);
      if (!issue) return;

      if (currentGroupBy === 'status') {
        await updateIssueStatus(issue, grp.id as ColumnId);
      } else if (currentGroupBy === 'priority') {
        const updatedLabels = updatePriorityLabels(issue.labels, grp.id);
        issue.labels = updatedLabels.map((name) => ({ name }));
        if (currentRepo) issueCache.delete(currentRepo);
        renderViews();
        try {
          await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
            labels: updatedLabels,
          });
          await host.toast({ kind: 'info', message: `Moved #${issue.number} to priority ${grp.title}` });
        } catch {}
      }
    });

    grp.issues.forEach((issue) => {
      const card = buildCardElement(issue, true);
      cardsContainer.appendChild(card);
    });

    elKanbanViewContainer.appendChild(colEl);
  });
}

function applyLayoutMode(): void {
  if (showArchivedOnly) {
    document.body.removeAttribute('data-layout');
    return;
  }
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
  elDrawerStatusSelect.value = col || 'none';

  if (elDrawerPrioritySelect) {
    elDrawerPrioritySelect.value = getIssuePriority(issue) || 'none';
  }

  if (elDrawerComplexitySelect) {
    elDrawerComplexitySelect.value = getIssueComplexity(issue) || 'none';
  }

  if (elDrawerAlignmentWarning) {
    elDrawerAlignmentWarning.style.display = isVagueIdea(issue) ? 'flex' : 'none';
  }

  if (elBtnDrawerArchive && elTxtDrawerArchive) {
    const isArch = isIssueArchived(issue);
    elTxtDrawerArchive.textContent = isArch ? 'Unarchive' : 'Archive';
    elBtnDrawerArchive.classList.toggle('active', isArch);
    elBtnDrawerArchive.title = isArch ? 'Unarchive issue' : 'Archive issue';
    elBtnDrawerArchive.onclick = () => {
      void toggleArchiveIssue(issue);
    };
  }

  if (elBtnDrawerToggleClose) {
    const isClosed = isIssueClosed(issue);
    elBtnDrawerToggleClose.textContent = isClosed ? 'Reopen Issue' : 'Close Issue';
    elBtnDrawerToggleClose.onclick = () => {
      void updateIssueStatus(issue, isClosed ? 'todo' : 'done');
    };
  }

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
    const wtName = extractWorktreeName(session.worktree);
    elDrawerWorktreeName.textContent = wtName || 'Project Root';
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
  renderRelatedIssues(issue);
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

export function findRelatedIssues(targetIssue: Issue, allIssues: Issue[], limit = 4): Issue[] {
  if (!targetIssue || !allIssues) return [];
  const targetNum = targetIssue.number;
  const targetLabels = new Set(
    (targetIssue.labels || [])
      .map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase())
      .filter((n) => !n.startsWith('status:') && n !== 'archived')
  );
  const targetWords = new Set(
    (targetIssue.title || '')
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((w) => w.length > 3)
  );

  const scored: Array<{ issue: Issue; score: number }> = [];
  for (const other of allIssues) {
    if (other.number === targetNum) continue;

    let score = 0;
    const otherLabels = (other.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
    for (const l of otherLabels) {
      if (targetLabels.has(l)) score += 3;
    }

    const otherText = `${other.title || ''} ${other.body || ''}`;
    if (otherText.includes(`#${targetNum}`)) score += 5;
    const targetText = `${targetIssue.title || ''} ${targetIssue.body || ''}`;
    if (targetText.includes(`#${other.number}`)) score += 5;

    const otherWords = (other.title || '').toLowerCase().split(/[^a-z0-9_-]+/);
    for (const w of otherWords) {
      if (w.length > 3 && targetWords.has(w)) score += 1;
    }

    if (score > 0) {
      scored.push({ issue: other, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.issue.number - a.issue.number);
  return scored.slice(0, limit).map((s) => s.issue);
}

function renderRelatedIssues(issue: Issue): void {
  if (!elDrawerRelatedIssuesContainer || !elRelatedIssuesCountBadge) return;
  const related = findRelatedIssues(issue, issues, 4);
  elRelatedIssuesCountBadge.textContent = String(related.length);
  elDrawerRelatedIssuesContainer.innerHTML = '';

  if (related.length === 0) {
    elDrawerRelatedIssuesContainer.innerHTML = '<div style="color: var(--fg-faint); font-size: 11.5px; padding: 2px 0;">No related issues found.</div>';
    return;
  }

  related.forEach((other) => {
    const item = document.createElement('div');
    item.className = 'related-issue-card';
    const otherComp = getIssueComplexity(other);
    const compHtml = otherComp ? `<span class="badge badge-complexity badge-complexity-${otherComp.toLowerCase()}">${otherComp}</span>` : '';
    item.innerHTML = `
      <div class="related-issue-title" title="${escapeHtml(other.title)}">#${other.number} ${escapeHtml(other.title)}</div>
      <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
        ${compHtml}
        <span class="status-pill" style="font-size: 10px;">${resolveIssueColumn(other) || 'all'}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      openDrawer(other);
    });
    elDrawerRelatedIssuesContainer.appendChild(item);
  });
}

// ==========================================
// Pre-Flight Worktree Config Modal
// ==========================================

export function getIssuePrimaryTag(issue: Issue): string {
  if (!issue || !issue.labels) return 'task';
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (
      name &&
      !name.startsWith('status:') &&
      !name.startsWith('priority:') &&
      !name.startsWith('complexity:') &&
      !name.startsWith('theme:') &&
      !['archived', 'archive'].includes(name.toLowerCase())
    ) {
      return name;
    }
  }
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (name.startsWith('theme:')) {
      return name.replace('theme:', '');
    }
  }
  return 'task';
}

export function buildWorktreeBranchName(options: {
  issue: Issue;
  mode: 'tag' | 'issue';
  customTag?: string;
}): string {
  if (options.mode === 'tag') {
    const tag = options.customTag || getIssuePrimaryTag(options.issue);
    return `worktree-tag-${slugify(tag || 'task')}`.slice(0, 80);
  }
  const branchSlug = slugify(options.issue.title || 'task');
  return `issue-${options.issue.number}-${branchSlug}`.slice(0, 80);
}

function updatePreflightBrief(): void {
  if (!activeIssue) return;
  const useWt = elPreflightWorktreeToggle.checked;
  let brief = `You are assigned to work on GitHub Issue #${activeIssue.number}: ${activeIssue.title}\n\n`;
  if (activeIssue.body) {
    brief += `### Description:\n${activeIssue.body}\n\n`;
  }
  if (activeIssue.subtasks.length > 0) {
    brief += `### Subtasks Checklist:\n`;
    activeIssue.subtasks.forEach((s) => {
      brief += `- [${s.completed ? 'x' : ' '}] ${s.text}\n`;
    });
    brief += '\n';
  }
  if (useWt) {
    brief += `Please inspect the codebase in this worktree, implement the solution, verify with tests, and report back.`;
  } else {
    brief += `Please inspect the codebase in this workspace, implement the solution, verify with tests, and report back.`;
  }
  elPreflightPromptInput.value = brief;
}

function syncPreflightBranchInput(): void {
  if (!activeIssue) return;
  const isTagMode = elRadioWorktreeTag.checked;
  const branchName = buildWorktreeBranchName({
    issue: activeIssue,
    mode: isTagMode ? 'tag' : 'issue',
  });
  elPreflightBranchInput.value = branchName;
}

function openPreflightModal(issue: Issue): void {
  activeIssue = issue;
  elModalPreflightTitle.textContent = `Start Agent Task on #${issue.number}`;

  // Default: no worktree (workspace-first)
  elPreflightWorktreeToggle.checked = false;
  elPreflightWorktreeSection.style.display = 'none';
  elRadioWorktreeIssue.checked = true;

  const tagBranch = buildWorktreeBranchName({ issue, mode: 'tag' });
  const issueBranch = buildWorktreeBranchName({ issue, mode: 'issue' });
  elPreflightTagPreview.textContent = tagBranch;
  elPreflightIssuePreview.textContent = issueBranch;
  elPreflightBranchInput.value = issueBranch;
  elPreflightBaseBranchInput.value = 'main';

  elBtnPreflightLaunch.textContent = 'Start Agent Session (Current Workspace)';

  updatePreflightBrief();
  elPreflightBackdrop.classList.add('active');
}

function closePreflightModal(): void {
  elPreflightBackdrop.classList.remove('active');
}

async function launchAgentSession(): Promise<void> {
  if (!activeIssue || !currentProject) return;

  const useWorktree = elPreflightWorktreeToggle.checked;
  const rawBranch = elPreflightBranchInput.value.trim();
  const cleanBranch = useWorktree
    ? rawBranch.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
    : undefined;
  const baseBranch = useWorktree ? (elPreflightBaseBranchInput.value.trim() || undefined) : undefined;
  const promptText = elPreflightPromptInput.value.trim().slice(0, 15000);
  const autoMove = elPreflightMoveInProgress.checked;

  elBtnPreflightLaunch.disabled = true;
  elBtnPreflightLaunch.textContent = 'Provisioning...';

  try {
    const targetDesc = useWorktree && cleanBranch ? `worktree "${cleanBranch}"` : 'workspace';
    addLog(`Starting session in ${targetDesc} on project ${currentProject.id}...`);

    const res = await host.startSession({
      projectId: currentProject.id,
      worktree: useWorktree && cleanBranch ? { kind: 'new', name: cleanBranch, baseBranch } : false,
      providerId: 'github-task-board',
      id: String(activeIssue.number),
      title: `#${activeIssue.number} ${activeIssue.title}`.slice(0, 150),
      url: activeIssue.html_url.slice(0, 1000),
      text: promptText,
      data: {
        issueNumber: activeIssue.number,
        ...(useWorktree && cleanBranch ? { branch: cleanBranch } : {}),
      },
    });

    closePreflightModal();

    if (autoMove) {
      void updateIssueStatus(activeIssue, 'in-progress');
    }

    await host.toast({
      kind: 'success',
      message: `Launched agent session in ${targetDesc}!`,
    });

    if (res.sessionId) {
      void host.openSession(res.sessionId);
    }
  } catch (err: any) {
    addLog(`Failed to start session: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to launch agent: ${err.message || 'Unknown error'}` });
  } finally {
    elBtnPreflightLaunch.disabled = false;
    elBtnPreflightLaunch.textContent = elPreflightWorktreeToggle.checked
      ? 'Launch Worktree & Agent'
      : 'Start Agent Session (Current Workspace)';
  }
}

// ==========================================
// Multi-Select & Batch Execution Engine
// ==========================================

export function buildConsolidatedIssuePrompt(selectedIssues: Issue[]): string {
  if (!selectedIssues || selectedIssues.length === 0) return '';
  const issueNumbers = selectedIssues.map((i) => `#${i.number}`).join(', ');
  let prompt = `You are assigned to work on multiple packaged GitHub Issues: ${issueNumbers}\n\n`;
  prompt += `### Packaged Tasks Summary (${selectedIssues.length} items):\n`;
  selectedIssues.forEach((issue) => {
    prompt += `- Issue #${issue.number}: ${issue.title}\n`;
  });
  prompt += '\n---\n\n';

  selectedIssues.forEach((issue, idx) => {
    prompt += `## Task ${idx + 1} of ${selectedIssues.length}: #${issue.number} ${issue.title}\n\n`;
    if (issue.body) {
      prompt += `### Overview & Context:\n${issue.body.trim()}\n\n`;
    }
    if (issue.subtasks && issue.subtasks.length > 0) {
      prompt += `### Actionable Subtasks Checklist:\n`;
      issue.subtasks.forEach((s) => {
        prompt += `- [${s.completed ? 'x' : ' '}] ${s.text}\n`;
      });
      prompt += '\n';
    }
    prompt += '---\n\n';
  });

  prompt += `Please inspect the codebase, address all packaged issues sequentially or in coordination, verify each with tests, and report back.`;
  return prompt;
}

function updateBatchBar(): void {
  const count = selectedIssueNumbers.size;
  if (count > 0) {
    document.body.classList.add('selection-active');
    if (elBatchActionBar) elBatchActionBar.style.display = 'flex';
    if (elBatchCountBadge) elBatchCountBadge.textContent = `${count} selected`;
  } else {
    document.body.classList.remove('selection-active');
    if (elBatchActionBar) elBatchActionBar.style.display = 'none';
  }

  document.querySelectorAll('.card').forEach((cardEl) => {
    const num = Number((cardEl as HTMLElement).dataset.issueNumber);
    const isSelected = selectedIssueNumbers.has(num);
    cardEl.classList.toggle('is-selected', isSelected);
    const cb = cardEl.querySelector('.card-checkbox') as HTMLInputElement | null;
    if (cb) cb.checked = isSelected;
  });
}

function clearSelection(): void {
  selectedIssueNumbers.clear();
  updateBatchBar();
}

function toggleIssueSelection(issueNumber: number): void {
  if (selectedIssueNumbers.has(issueNumber)) {
    selectedIssueNumbers.delete(issueNumber);
  } else {
    selectedIssueNumbers.add(issueNumber);
  }
  updateBatchBar();
}

async function launchPackagedSession(): Promise<void> {
  const selected = issues.filter((i) => selectedIssueNumbers.has(i.number));
  if (selected.length === 0 || !currentProject) return;

  const promptText = buildConsolidatedIssuePrompt(selected);
  const title = `Packaged Tasks (${selected.length}): ${selected.map((i) => `#${i.number}`).join(', ')}`.slice(0, 150);

  try {
    addLog(`Launching packaged session for ${selected.length} issues...`);
    const res = await host.startSession({
      projectId: currentProject.id,
      worktree: false,
      providerId: 'github-task-board',
      id: `package-${Date.now()}`,
      title,
      text: promptText,
      data: {
        packaged: true,
        issueNumbers: selected.map((i) => i.number),
      },
    });

    clearSelection();
    selected.forEach((issue) => {
      void updateIssueStatus(issue, 'in-progress');
    });
    await host.toast({
      kind: 'success',
      message: `Launched packaged session with ${selected.length} issues!`,
    });
    if (res.sessionId) {
      void host.openSession(res.sessionId);
    }
  } catch (err: any) {
    addLog(`Failed to start packaged session: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to package issues: ${err.message || 'Unknown error'}` });
  }
}

async function launchBatchSeparateSessions(): Promise<void> {
  const selected = issues.filter((i) => selectedIssueNumbers.has(i.number));
  if (selected.length === 0 || !currentProject) return;

  clearSelection();
  await host.toast({ kind: 'info', message: `Launching ${selected.length} agent sessions...` });

  let successCount = 0;
  for (const issue of selected) {
    try {
      const payload = {
        projectId: currentProject.id,
        worktree: false,
        providerId: 'github-task-board',
        id: String(issue.number),
        title: `#${issue.number} ${issue.title || ''}`.slice(0, 150),
        url: (issue.html_url || '').slice(0, 1000),
        text: `You are assigned to work on GitHub Issue #${issue.number}: ${issue.title}\n\n${issue.body ? `### Description:\n${issue.body}\n\n` : ''}Please inspect the codebase in this workspace, implement the solution, verify with tests, and report back.`,
        data: {
          issueNumber: issue.number,
        },
      };
      await host.startSession(payload);
      void updateIssueStatus(issue, 'in-progress');
      successCount++;
    } catch (err: any) {
      addLog(`Failed to start session for #${issue.number}: ${err.message}`, 'error');
    }
  }

  await host.toast({ kind: 'success', message: `Successfully launched ${successCount} of ${selected.length} sessions.` });
}

async function attachSelectedIssues(): Promise<void> {
  const selected = issues.filter((i) => selectedIssueNumbers.has(i.number));
  if (selected.length === 0) return;

  for (const issue of selected) {
    try {
      const payload = buildIssueAttachPayload(issue);
      await host.attach(payload);
    } catch {}
  }
  clearSelection();
  await host.toast({ kind: 'success', message: `Attached ${selected.length} issue chips to composer` });
}

// ==========================================
// AI Issue Drafting Prompt Store & Logic
// ==========================================

export const DEFAULT_AI_ISSUE_PROMPT = `You are an expert software engineer creating GitHub issues for repository "{repo}".

Input Objective / User Mind-Dump:
{userInput}

Instructions for the Agent:
1. Analyze the user's input. If the user described multiple independent tasks, bugs, or features, decompose them into distinct, well-scoped GitHub issues. If it describes a single topic, create one focused issue.
2. Ground all details in the actual codebase by inspecting relevant project files, function names, and architecture.
3. Every generated issue must follow this exact structure tailored for the OpenChamber Task Board:
   - Title: Conventional commit format (e.g. "feat(auth): add remember-me token refresh" or "fix(ui): prevent horizontal overflow in mobile table").
   - Overview: Clear description of the problem, motivation, or user value.
   - Files Impacted: List candidate file paths grounded in the codebase.
   - Actionable Subtasks Checklist: Mandatory interactive Markdown checkboxes (- [ ]) for each discrete implementation and verification step:
     - [ ] Reproduce with test / define contract
     - [ ] Implement core changes
     - [ ] Run test suite and verify green
   - Recommended Worktree Branch: Suggest an isolated git branch name following "issue-<number>-<slug>".
   - Labels: Recommend labels (e.g. "bug", "enhancement", "documentation").
4. If a GitHub token or gh CLI is available in the environment, you can create the issues directly using the GitHub API. Otherwise, present the complete, ready-to-copy issue titles and bodies for user review.`;

export function resolveAiIssuePrompt({
  repo,
  userInput,
  storedRepoPrompt,
  storedGlobalPrompt,
}: {
  repo: string;
  userInput: string;
  storedRepoPrompt?: string | null;
  storedGlobalPrompt?: string | null;
}): string {
  const template = storedRepoPrompt?.trim() || storedGlobalPrompt?.trim() || DEFAULT_AI_ISSUE_PROMPT;
  return template
    .replace(/\{repo\}/g, repo)
    .replace(/\{userInput\}/g, userInput.trim());
}

// Modal elements
const elNewIssueModalBackdrop = document.getElementById('newIssueModalBackdrop') as HTMLDivElement;
const elNewIssueRepoTarget = document.getElementById('newIssueRepoTarget') as HTMLDivElement;

// Segmented mode switches
const elBtnSwitchAI = document.getElementById('btnSwitchAI') as HTMLButtonElement;
const elBtnSwitchManual = document.getElementById('btnSwitchManual') as HTMLButtonElement;
const elPaneNewIssueAI = document.getElementById('paneNewIssueAI') as HTMLDivElement;
const elPaneNewIssueManual = document.getElementById('paneNewIssueManual') as HTMLDivElement;
const elFootNewIssueAI = document.getElementById('footNewIssueAI') as HTMLDivElement;
const elFootNewIssueManual = document.getElementById('footNewIssueManual') as HTMLDivElement;

// AI Mode elements (Single input!)
const elAiIssueInput = document.getElementById('aiIssueInput') as HTMLTextAreaElement;
const elBtnTogglePromptConfig = document.getElementById('btnTogglePromptConfig') as HTMLButtonElement;
const elAiActiveModelBadge = document.getElementById('aiActiveModelBadge') as HTMLSpanElement | null;
const elSelectAiModel = document.getElementById('selectAiModel') as HTMLSelectElement | null;
const elInputCustomAiModel = document.getElementById('inputCustomAiModel') as HTMLInputElement | null;
const elAiPromptConfigPanel = document.getElementById('aiPromptConfigPanel') as HTMLDivElement;
const elRadioScopeRepo = document.getElementById('radioScopeRepo') as HTMLInputElement;
const elRadioScopeGlobal = document.getElementById('radioScopeGlobal') as HTMLInputElement;
const elAiPromptTemplateTextarea = document.getElementById('aiPromptTemplateTextarea') as HTMLTextAreaElement;
const elBtnResetPromptToDefault = document.getElementById('btnResetPromptToDefault') as HTMLButtonElement;
const elBtnSavePromptConfig = document.getElementById('btnSavePromptConfig') as HTMLButtonElement;
const elBtnNewIssueAICancel = document.getElementById('btnNewIssueAICancel') as HTMLButtonElement;
const elBtnLaunchAISession = document.getElementById('btnLaunchAISession') as HTMLButtonElement;

// Manual Mode elements
const elNewIssueTitleInput = document.getElementById('newIssueTitleInput') as HTMLInputElement;
const elNewIssueComplexitySelect = document.getElementById('newIssueComplexitySelect') as HTMLSelectElement | null;
const elNewIssueBodyInput = document.getElementById('newIssueBodyInput') as HTMLTextAreaElement;
const elNewIssueSubtasksList = document.getElementById('newIssueSubtasksList') as HTMLDivElement | null;
const elInputNewIssueDraftSubtask = document.getElementById('inputNewIssueDraftSubtask') as HTMLInputElement | null;
const elBtnAddNewIssueDraftSubtask = document.getElementById('btnAddNewIssueDraftSubtask') as HTMLButtonElement | null;
const elDraftSubtasksCountBadge = document.getElementById('draftSubtasksCountBadge') as HTMLSpanElement | null;
const elBtnNewIssueSubmit = document.getElementById('btnNewIssueSubmit') as HTMLButtonElement;
const elBtnNewIssueCancel = document.getElementById('btnNewIssueCancel') as HTMLButtonElement;
const elBtnNewIssueClose = document.getElementById('btnNewIssueClose') as HTMLButtonElement;

let draftSubtasks: string[] = [];

type NewIssueMode = 'ai' | 'manual';
let currentNewIssueMode: NewIssueMode = 'ai';

function setNewIssueMode(mode: NewIssueMode): void {
  currentNewIssueMode = mode;

  elBtnSwitchAI.classList.toggle('active', mode === 'ai');
  elBtnSwitchManual.classList.toggle('active', mode === 'manual');

  elPaneNewIssueAI.style.display = mode === 'ai' ? 'flex' : 'none';
  elPaneNewIssueManual.style.display = mode === 'manual' ? 'flex' : 'none';

  elFootNewIssueAI.style.display = mode === 'ai' ? 'flex' : 'none';
  elFootNewIssueManual.style.display = mode === 'manual' ? 'flex' : 'none';

  if (mode === 'ai') {
    setTimeout(() => elAiIssueInput.focus(), 50);
  } else {
    setTimeout(() => elNewIssueTitleInput.focus(), 50);
  }
}

export function resolveAiDraftingModel({
  storedRepoModel,
  storedGlobalModel,
  defaultModel = 'default',
}: {
  storedRepoModel?: string | null;
  storedGlobalModel?: string | null;
  defaultModel?: string;
}): string {
  if (storedRepoModel && typeof storedRepoModel === 'string' && storedRepoModel.trim() && storedRepoModel.trim() !== 'default') {
    return storedRepoModel.trim();
  }
  if (storedGlobalModel && typeof storedGlobalModel === 'string' && storedGlobalModel.trim() && storedGlobalModel.trim() !== 'default') {
    return storedGlobalModel.trim();
  }
  return defaultModel;
}

function setModelEditorValue(modelValue: string): void {
  if (!elSelectAiModel) return;
  const standardOptions = ['default', 'gemini-2.5-flash', 'gemini-2.5-pro', 'claude-3-7-sonnet', 'gpt-4.1'];
  if (standardOptions.includes(modelValue)) {
    elSelectAiModel.value = modelValue;
    if (elInputCustomAiModel) elInputCustomAiModel.style.display = 'none';
  } else {
    elSelectAiModel.value = 'custom';
    if (elInputCustomAiModel) {
      elInputCustomAiModel.value = modelValue;
      elInputCustomAiModel.style.display = 'block';
    }
  }
}

function getSelectedModelFromEditor(): string {
  if (!elSelectAiModel) return 'default';
  if (elSelectAiModel.value === 'custom') {
    return elInputCustomAiModel?.value.trim() || 'default';
  }
  return elSelectAiModel.value;
}

async function updateActiveModelBadge(): Promise<void> {
  if (!elAiActiveModelBadge) return;
  const storedRepoModel = currentRepo ? await host.storage.get(`ai_issue_model_${currentRepo}`) : null;
  const storedGlobalModel = await host.storage.get('ai_issue_model_global');
  const activeModel = resolveAiDraftingModel({
    storedRepoModel: typeof storedRepoModel === 'string' ? storedRepoModel : null,
    storedGlobalModel: typeof storedGlobalModel === 'string' ? storedGlobalModel : null,
  });
  elAiActiveModelBadge.textContent = activeModel === 'default' ? 'Auto' : activeModel;
}

async function loadPromptConfigForEditor(): Promise<void> {
  const isRepoScope = elRadioScopeRepo.checked;
  if (isRepoScope) {
    const storedPrompt = await host.storage.get(`ai_issue_prompt_${currentRepo}`);
    elAiPromptTemplateTextarea.value = typeof storedPrompt === 'string' ? storedPrompt : DEFAULT_AI_ISSUE_PROMPT;
    const storedModel = await host.storage.get(`ai_issue_model_${currentRepo}`);
    setModelEditorValue(typeof storedModel === 'string' ? storedModel : 'default');
  } else {
    const storedPrompt = await host.storage.get('ai_issue_prompt_global');
    elAiPromptTemplateTextarea.value = typeof storedPrompt === 'string' ? storedPrompt : DEFAULT_AI_ISSUE_PROMPT;
    const storedModel = await host.storage.get('ai_issue_model_global');
    setModelEditorValue(typeof storedModel === 'string' ? storedModel : 'default');
  }
}

async function savePromptConfig(): Promise<void> {
  const isRepoScope = elRadioScopeRepo.checked;
  const text = elAiPromptTemplateTextarea.value.trim();
  const chosenModel = getSelectedModelFromEditor();
  if (!text) return;

  try {
    if (isRepoScope) {
      await host.storage.set(`ai_issue_prompt_${currentRepo}`, text);
      if (chosenModel && chosenModel !== 'default') {
        await host.storage.set(`ai_issue_model_${currentRepo}`, chosenModel);
      } else {
        await host.storage.delete(`ai_issue_model_${currentRepo}`);
      }
      addLog(`Saved prompt & model settings for repo ${currentRepo}`, 'succ');
      await host.toast({ kind: 'success', message: 'Saved settings for this repository' });
    } else {
      await host.storage.set('ai_issue_prompt_global', text);
      if (chosenModel && chosenModel !== 'default') {
        await host.storage.set('ai_issue_model_global', chosenModel);
      } else {
        await host.storage.delete('ai_issue_model_global');
      }
      addLog('Saved global prompt & model settings', 'succ');
      await host.toast({ kind: 'success', message: 'Saved global settings' });
    }
    await updateActiveModelBadge();
    elAiPromptConfigPanel.style.display = 'none';
  } catch (err: any) {
    addLog(`Failed to save prompt config: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: 'Failed to save settings' });
  }
}

async function resetPromptConfigToDefault(): Promise<void> {
  elAiPromptTemplateTextarea.value = DEFAULT_AI_ISSUE_PROMPT;
  setModelEditorValue('default');
  const isRepoScope = elRadioScopeRepo.checked;
  try {
    if (isRepoScope) {
      await host.storage.delete(`ai_issue_prompt_${currentRepo}`);
      await host.storage.delete(`ai_issue_model_${currentRepo}`);
    } else {
      await host.storage.delete('ai_issue_prompt_global');
      await host.storage.delete('ai_issue_model_global');
    }
    await updateActiveModelBadge();
    await host.toast({ kind: 'info', message: 'Reset prompt & model to default' });
  } catch {}
}

export function serializeDraftSubtasks(body: string, subtaskTexts: string[]): string {
  const cleanBody = (body || '').trim();
  const cleanTasks = (subtaskTexts || [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);

  if (cleanTasks.length === 0) {
    return cleanBody;
  }

  const checklistBlock = cleanTasks.map((t) => `- [ ] ${t}`).join('\n');
  if (!cleanBody) {
    return `### Actionable Subtasks Checklist:\n\n${checklistBlock}`;
  }
  if (cleanBody.includes('### Actionable Subtasks Checklist:')) {
    return `${cleanBody}\n${checklistBlock}`;
  }
  return `${cleanBody}\n\n### Actionable Subtasks Checklist:\n\n${checklistBlock}`;
}

export function isVagueIdea(issue: { title?: string; body?: string; subtasks?: any[]; labels?: any[] }): boolean {
  if (!issue) return true;
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labels.includes('status:needs-alignment')) {
    return true;
  }
  const subtaskCount = (issue.subtasks || []).length;
  const bodyText = (issue.body || '').trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  return subtaskCount === 0 && wordCount < 20;
}

export function updateComplexityLabel(currentLabels: any[], newComplexity: string | null): string[] {
  const cleanExisting = currentLabels
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter((name) => !name.toLowerCase().startsWith('complexity:'));

  if (newComplexity && typeof newComplexity === 'string' && newComplexity.trim().toLowerCase() !== 'none') {
    cleanExisting.push(`complexity:${newComplexity.trim().toUpperCase()}`);
  }
  return cleanExisting;
}

function renderDraftSubtasks(): void {
  if (!elNewIssueSubtasksList) return;
  elNewIssueSubtasksList.innerHTML = '';
  if (elDraftSubtasksCountBadge) {
    elDraftSubtasksCountBadge.textContent = `${draftSubtasks.length} ${draftSubtasks.length === 1 ? 'step' : 'steps'}`;
  }

  if (draftSubtasks.length === 0) {
    elNewIssueSubtasksList.innerHTML = `<div style="color: var(--fg-faint); font-size: 11px; padding: 2px 0;">No subtasks added yet.</div>`;
    return;
  }

  draftSubtasks.forEach((task, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '3px 6px';
    row.style.background = 'var(--surf-subtle)';
    row.style.borderRadius = 'var(--rad-sm)';
    row.style.fontSize = '11.5px';

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="color: var(--fg-muted); font-size: 10px; font-family: var(--font-mono);">${idx + 1}.</span>
        <span style="color: var(--fg);">${escapeHtml(task)}</span>
      </div>
      <button class="btn btn-icon btn-sm btn-del-draft-task" type="button" style="width: 18px; height: 18px; font-size: 11px; padding: 0;" title="Remove step">✕</button>
    `;

    const btnDel = row.querySelector('.btn-del-draft-task') as HTMLButtonElement | null;
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        draftSubtasks.splice(idx, 1);
        renderDraftSubtasks();
      });
    }

    elNewIssueSubtasksList.appendChild(row);
  });
}

function openNewIssueModal(): void {
  if (!currentRepo) {
    openRepoPopover();
    return;
  }
  elNewIssueRepoTarget.textContent = currentRepo;
  elNewIssueTitleInput.value = '';
  elNewIssueBodyInput.value = '';
  if (elNewIssueComplexitySelect) elNewIssueComplexitySelect.value = 'M';
  draftSubtasks = [];
  renderDraftSubtasks();
  if (elInputNewIssueDraftSubtask) elInputNewIssueDraftSubtask.value = '';
  elAiIssueInput.value = '';
  elAiPromptConfigPanel.style.display = 'none';

  setNewIssueMode('ai'); // AI Assisted is the first and default!
  void updateActiveModelBadge();
  elNewIssueModalBackdrop.classList.add('active');
  setTimeout(() => elAiIssueInput.focus(), 50);
}

function closeNewIssueModal(): void {
  elNewIssueModalBackdrop.classList.remove('active');
}

async function submitNewIssue(): Promise<void> {
  const title = elNewIssueTitleInput.value.trim();
  const rawBody = elNewIssueBodyInput.value.trim();
  if (!title) {
    elNewIssueTitleInput.focus();
    return;
  }
  const body = serializeDraftSubtasks(rawBody, draftSubtasks);
  const initialLabels = ['status:todo'];
  const complexity = elNewIssueComplexitySelect ? elNewIssueComplexitySelect.value : 'none';
  if (complexity && complexity !== 'none') {
    initialLabels.push(`complexity:${complexity.toUpperCase()}`);
  }

  // Alignment reflex: auto-flag vague idea if description is sparse and subtasks are empty
  if (isVagueIdea({ title, body, subtasks: draftSubtasks.map((t) => ({ text: t })), labels: [] })) {
    initialLabels.push('status:needs-alignment');
  }

  elBtnNewIssueSubmit.disabled = true;
  elBtnNewIssueSubmit.textContent = 'Creating...';
  try {
    addLog(`Creating issue in ${currentRepo}: "${title}"...`);
    const created: any = await githubRequest('POST', `/repos/${currentRepo}/issues`, {
      title,
      body,
      labels: initialLabels,
    });
    addLog(`Created issue #${created.number}: ${created.title}`, 'succ');
    await host.toast({ kind: 'success', message: `Created #${created.number} on GitHub` });
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

async function launchAiIssueSession(): Promise<void> {
  const userInput = elAiIssueInput.value.trim();
  if (!userInput) {
    elAiIssueInput.focus();
    return;
  }

  // Load custom prompt instructions
  const storedRepoPrompt = await host.storage.get(`ai_issue_prompt_${currentRepo}`);
  const storedGlobalPrompt = await host.storage.get('ai_issue_prompt_global');

  const promptText = resolveAiIssuePrompt({
    repo: currentRepo,
    userInput,
    storedRepoPrompt: typeof storedRepoPrompt === 'string' ? storedRepoPrompt : null,
    storedGlobalPrompt: typeof storedGlobalPrompt === 'string' ? storedGlobalPrompt : null,
  });

  const storedRepoModel = await host.storage.get(`ai_issue_model_${currentRepo}`);
  const storedGlobalModel = await host.storage.get('ai_issue_model_global');
  const activeModel = resolveAiDraftingModel({
    storedRepoModel: typeof storedRepoModel === 'string' ? storedRepoModel : null,
    storedGlobalModel: typeof storedGlobalModel === 'string' ? storedGlobalModel : null,
  });

  const firstLine = userInput.split('\n')[0].replace(/[^a-zA-Z0-9\s-_]/g, '').trim().slice(0, 50);

  elBtnLaunchAISession.disabled = true;
  elBtnLaunchAISession.textContent = 'Starting AI Session...';

  try {
    const modelDesc = activeModel === 'default' ? 'auto' : activeModel;
    addLog(`Launching AI issue drafting session (model: ${modelDesc})...`);
    const res = await host.startSession({
      projectId: currentProject?.id,
      worktree: false, // Issue drafting is administrative; no worktree churn
      model: activeModel !== 'default' ? activeModel : undefined,
      navigation: 'open',
      providerId: 'github-task-board',
      id: `draft-${Date.now()}`,
      title: `Draft: ${firstLine || 'GitHub Issues'}`,
      url: `https://github.com/${currentRepo}/issues`,
      text: promptText,
      data: {
        drafting: true,
        repo: currentRepo,
        ...(activeModel !== 'default' ? { model: activeModel } : {}),
      },
    });

    closeNewIssueModal();
    await host.toast({
      kind: 'success',
      message: 'Launched AI drafting session',
    });

    if (res.sessionId) {
      void host.openSession(res.sessionId);
    }
  } catch (err: any) {
    addLog(`Failed to start AI session: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to start session: ${err.message}` });
  } finally {
    elBtnLaunchAISession.disabled = false;
    elBtnLaunchAISession.textContent = 'Launch AI Drafting Session';
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

  // Archive Toggle
  const elBtnArchiveToggle = document.getElementById('btnArchiveToggle') as HTMLButtonElement | null;
  if (elBtnArchiveToggle) {
    elBtnArchiveToggle.addEventListener('click', () => {
      showArchivedOnly = !showArchivedOnly;
      elBtnArchiveToggle.classList.toggle('active', showArchivedOnly);
      elBtnArchiveToggle.title = showArchivedOnly
        ? 'Viewing Archived (Click to show active issues)'
        : 'Toggle Archived Issues View';
      renderViews();
      void host.toast({
        kind: 'info',
        message: showArchivedOnly ? 'Viewing archived issues' : 'Viewing active issues',
      });
    });
  }

  // Filter & Sort events
  if (elBtnFilterToggle && elFilterBar) {
    elBtnFilterToggle.addEventListener('click', () => {
      isFilterBarOpen = !isFilterBarOpen;
      elFilterBar.style.display = isFilterBarOpen ? 'flex' : 'none';
      elBtnFilterToggle.classList.toggle('active', isFilterBarOpen || filterPriority !== 'all' || filterTag !== 'all' || currentSort !== 'newest');
    });
  }

  if (elSelectSort) {
    elSelectSort.addEventListener('change', () => {
      currentSort = elSelectSort.value as any;
      renderViews();
    });
  }

  if (elSelectGroupBy) {
    elSelectGroupBy.addEventListener('change', () => {
      currentGroupBy = elSelectGroupBy.value as any;
      renderViews();
    });
  }

  if (elSelectFilterPriority) {
    elSelectFilterPriority.addEventListener('change', () => {
      filterPriority = elSelectFilterPriority.value;
      renderViews();
    });
  }

  if (elSelectFilterTag) {
    elSelectFilterTag.addEventListener('change', () => {
      filterTag = elSelectFilterTag.value;
      renderViews();
    });
  }

  if (elBtnResetFilters) {
    elBtnResetFilters.addEventListener('click', () => {
      currentSort = 'newest';
      filterPriority = 'all';
      filterTag = 'all';
      if (elSelectSort) elSelectSort.value = 'newest';
      if (elSelectFilterPriority) elSelectFilterPriority.value = 'all';
      if (elSelectFilterTag) elSelectFilterTag.value = 'all';
      renderViews();
    });
  }

  // New Issue Modal & Mode Tabs
  elBtnNewIssue.addEventListener('click', () => {
    openNewIssueModal();
  });

  elBtnNewIssueClose.addEventListener('click', closeNewIssueModal);
  elBtnNewIssueCancel.addEventListener('click', closeNewIssueModal);
  elBtnNewIssueSubmit.addEventListener('click', () => {
    void submitNewIssue();
  });

  // Segmented Mode Switch: AI Assisted (first) vs Manual (second)
  elBtnSwitchAI.addEventListener('click', () => setNewIssueMode('ai'));
  elBtnSwitchManual.addEventListener('click', () => setNewIssueMode('manual'));

  // AI Assisted controls
  elBtnNewIssueAICancel.addEventListener('click', closeNewIssueModal);
  elBtnLaunchAISession.addEventListener('click', () => {
    void launchAiIssueSession();
  });

  // Prompt Configuration Editor toggle & actions
  elBtnTogglePromptConfig.addEventListener('click', () => {
    const isHidden = elAiPromptConfigPanel.style.display === 'none';
    if (isHidden) {
      elAiPromptConfigPanel.style.display = 'flex';
      void loadPromptConfigForEditor();
    } else {
      elAiPromptConfigPanel.style.display = 'none';
    }
  });

  elRadioScopeRepo.addEventListener('change', () => {
    void loadPromptConfigForEditor();
  });
  elRadioScopeGlobal.addEventListener('change', () => {
    void loadPromptConfigForEditor();
  });

  elBtnSavePromptConfig.addEventListener('click', () => {
    void savePromptConfig();
  });
  elBtnResetPromptToDefault.addEventListener('click', () => {
    void resetPromptConfigToDefault();
  });

  if (elSelectAiModel && elInputCustomAiModel) {
    elSelectAiModel.addEventListener('change', () => {
      elInputCustomAiModel.style.display = elSelectAiModel.value === 'custom' ? 'block' : 'none';
      if (elSelectAiModel.value === 'custom') {
        elInputCustomAiModel.focus();
      }
    });
  }

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
      userSelectedTab = true;
      const targetTab = (tab.getAttribute('data-tab') as TabId) || 'all';
      selectTab(targetTab);
      renderListView(issues);
    });
  });

  // Drawer events
  elBtnDrawerClose.addEventListener('click', closeDrawer);
  elDrawerScrim.addEventListener('click', closeDrawer);

  if (elDrawerPrioritySelect) {
    elDrawerPrioritySelect.addEventListener('change', async () => {
      if (!activeIssue || !currentRepo) return;
      const val = elDrawerPrioritySelect.value;
      const updatedLabels = updatePriorityLabels(activeIssue.labels, val);
      activeIssue.labels = updatedLabels.map((name) => ({ name }));
      if (currentRepo) issueCache.delete(currentRepo);
      renderDrawer(activeIssue);
      renderViews();
      try {
        await githubRequest('PATCH', `/repos/${currentRepo}/issues/${activeIssue.number}`, {
          labels: updatedLabels,
        });
        await host.toast({ kind: 'info', message: `Updated priority on #${activeIssue.number} to ${val}` });
      } catch (err: any) {
        addLog(`Failed to update priority: ${err.message}`, 'error');
      }
    });
  }

  elDrawerStatusSelect.addEventListener('change', () => {
    if (activeIssue) {
      const val = elDrawerStatusSelect.value;
      if (val === 'none') {
        const filteredLabels = activeIssue.labels
          .map((l) => (typeof l === 'string' ? l : l.name || ''))
          .filter((name) => !name.startsWith('status:'));
        activeIssue.labels = filteredLabels.map((name) => ({ name }));
        if (currentRepo) issueCache.delete(currentRepo);
        renderViews();
        renderDrawer(activeIssue);
        void githubRequest('PATCH', `/repos/${currentRepo}/issues/${activeIssue.number}`, {
          labels: filteredLabels,
        });
      } else {
        const targetCol = val as ColumnId;
        void updateIssueStatus(activeIssue, targetCol);
      }
    }
  });

  if (elDrawerComplexitySelect) {
    elDrawerComplexitySelect.addEventListener('change', async () => {
      if (!activeIssue || !currentRepo) return;
      const val = elDrawerComplexitySelect.value;
      const updatedLabels = updateComplexityLabel(activeIssue.labels, val);
      activeIssue.labels = updatedLabels.map((name) => ({ name }));
      if (currentRepo) issueCache.delete(currentRepo);
      renderDrawer(activeIssue);
      renderViews();
      try {
        await githubRequest('PATCH', `/repos/${currentRepo}/issues/${activeIssue.number}`, {
          labels: updatedLabels,
        });
        await host.toast({ kind: 'info', message: `Updated complexity on #${activeIssue.number} to ${val}` });
      } catch (err: any) {
        addLog(`Failed to update complexity: ${err.message}`, 'error');
      }
    });
  }

  // Draft subtask adding in creator modal
  if (elBtnAddNewIssueDraftSubtask && elInputNewIssueDraftSubtask) {
    const addDraftStep = () => {
      const text = elInputNewIssueDraftSubtask.value.trim();
      if (!text) return;
      draftSubtasks.push(text);
      elInputNewIssueDraftSubtask.value = '';
      renderDraftSubtasks();
    };
    elBtnAddNewIssueDraftSubtask.addEventListener('click', addDraftStep);
    elInputNewIssueDraftSubtask.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDraftStep();
      }
    });
  }

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
    try {
      const payload = buildIssueAttachPayload(activeIssue);
      await host.attach(payload);
      await host.toast({ kind: 'success', message: `Attached #${activeIssue.number} to composer chip` });
    } catch (err: any) {
      await host.toast({ kind: 'error', message: `Failed to attach: ${err.message || 'Unknown error'}` });
    }
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

  if (elPreflightWorktreeToggle) {
    elPreflightWorktreeToggle.addEventListener('change', () => {
      const isChecked = elPreflightWorktreeToggle.checked;
      elPreflightWorktreeSection.style.display = isChecked ? 'flex' : 'none';
      elBtnPreflightLaunch.textContent = isChecked
        ? 'Launch Worktree & Agent'
        : 'Start Agent Session (Current Workspace)';
      updatePreflightBrief();
    });
  }

  if (elRadioWorktreeTag) {
    elRadioWorktreeTag.addEventListener('change', () => {
      syncPreflightBranchInput();
    });
  }

  if (elRadioWorktreeIssue) {
    elRadioWorktreeIssue.addEventListener('change', () => {
      syncPreflightBranchInput();
    });
  }

  // Floating Batch Action Bar events
  if (elBtnBatchPackage) {
    elBtnBatchPackage.addEventListener('click', () => {
      void launchPackagedSession();
    });
  }
  if (elBtnBatchStart) {
    elBtnBatchStart.addEventListener('click', () => {
      void launchBatchSeparateSessions();
    });
  }
  if (elBtnBatchAttach) {
    elBtnBatchAttach.addEventListener('click', () => {
      void attachSelectedIssues();
    });
  }
  if (elBtnBatchDeselect) {
    elBtnBatchDeselect.addEventListener('click', () => {
      clearSelection();
    });
  }
  if (elBtnStartTagIssues) {
    elBtnStartTagIssues.addEventListener('click', () => {
      if (filterTag === 'all') return;
      const taggedIssues = issues.filter((i) =>
        (i.labels || []).some((l) => (typeof l === 'string' ? l : l.name || '') === filterTag)
      );
      taggedIssues.forEach((i) => selectedIssueNumbers.add(i.number));
      updateBatchBar();
      void host.toast({ kind: 'info', message: `Selected ${taggedIssues.length} issues with tag "${filterTag}"` });
    });
  }

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
