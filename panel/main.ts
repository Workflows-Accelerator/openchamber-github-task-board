import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';
import { setupCustomDropdown, initAllCustomDropdowns } from './dropdown.js';
import { escapeHtml, slugify, sanitizeHexColor, addLog, logEntries } from './utils.js';
import { renderMarkdown, getIssueDescriptionPreview } from './markdown.js';
import {
  isSystemLabel,
  filterDisplayLabels,
  getIssuePriority,
  updatePriorityLabels,
  getIssueComplexity,
  updateComplexityLabel,
  sortIssuesList,
  findRelatedIssues,
  STATUS_DRAFT,
  STATUS_BACKLOG,
  STATUS_TODO,
  STATUS_PLANNED,
  STATUS_IN_PROGRESS,
  STATUS_NEEDS_HUMAN,
  STATUS_IN_REVIEW,
  STATUS_DONE,
  STATUS_LABELS,
  STATUS_METADATA,
  STATUS_COLUMNS,
  StatusReconciler,
} from './labels.js';
import {
  parseGitHubRemoteUrl,
  parseGitRemoteFromConfig,
  extractGitHubTokenFromCredentials,
  parseGitdirContent,
  extractParentRepoRootFromGitdir,
  resolveParentRemoteFromGitdir,
} from './git.js';

export {
  escapeHtml,
  slugify,
  sanitizeHexColor,
  addLog,
  renderMarkdown,
  getIssueDescriptionPreview,
  isSystemLabel,
  filterDisplayLabels,
  getIssuePriority,
  updatePriorityLabels,
  getIssueComplexity,
  updateComplexityLabel,
  sortIssuesList,
  findRelatedIssues,
  parseGitHubRemoteUrl,
  parseGitRemoteFromConfig,
  extractGitHubTokenFromCredentials,
  parseGitdirContent,
  extractParentRepoRootFromGitdir,
  resolveParentRemoteFromGitdir,
  STATUS_DRAFT,
  STATUS_BACKLOG,
  STATUS_TODO,
  STATUS_PLANNED,
  STATUS_IN_PROGRESS,
  STATUS_NEEDS_HUMAN,
  STATUS_IN_REVIEW,
  STATUS_DONE,
  STATUS_LABELS,
  STATUS_METADATA,
  STATUS_COLUMNS,
  StatusReconciler,
};
import type {
  Subtask,
  Issue,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  SessionInfo,
  ProjectItem,
  ColumnId,
  TabId,
  IssueGroup,
  NewIssueMode,
} from './types.js';
import { extractWorktreeName } from './types.js';
export type { SessionInfo, ProjectItem, ColumnId, TabId, IssueGroup, NewIssueMode };
export { extractWorktreeName };
import {
  parseOpenQuestions,
  parseSubtasks,
  updateSubtaskInMarkdown,
  updateOpenQuestionInMarkdown,
  answerOpenQuestionInMarkdown,
  appendSubtaskToMarkdown,
  appendOpenQuestionToMarkdown,
  serializeDraftQuestions,
  isVagueIdea,
  formatQuestionBadge,
  getIssueTheme,
  extractTaskThemes,
  parseScratchPadThemes,
  DEFAULT_AI_ISSUE_PROMPT,
  resolveAiIssuePrompt,
  DEFAULT_AI_ALIGNMENT_PROMPT,
  resolveAiAlignmentPrompt,
  buildIssueAttachPayload,
  buildMultiIssueAttachPayload,
  buildConsolidatedIssuePrompt,
  serializeDraftSubtasks,
  parseIssueDependencies,
  addDependencyToMarkdown,
  removeDependencyFromMarkdown,
  renderBlockerChip,
  renderBlockerChips,
  extractIssueReferences,
  buildDependencyGraph,
  calculateEdgePath,
  detectCycle,
  buildSessionIndex,
  scopeDoneIssues,
  normalizeGithubIssues,
  mergeIssuePages,
} from './core.js';
export { buildSessionIndex, scopeDoneIssues, normalizeGithubIssues, mergeIssuePages, renderBlockerChip, renderBlockerChips };

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
let sessionIndex: Map<number, SessionInfo> = new Map();
let worktrees: any[] = [];
let activeIssue: Issue | null = null;
let searchQuery: string = '';
let activeTab: TabId = 'all';
let userSelectedTab: boolean = false;
let showArchivedOnly: boolean = false;
let showAllDoneIssues: boolean = false;
let currentSort: 'newest' | 'oldest' | 'priority' | 'complexity' | 'subtasks' | 'title' = 'newest';
let filterPriority: string = 'all';
let filterTag: string = 'all';
let currentGroupBy: 'theme' | 'priority' | 'none' | 'status' | 'tag' = 'theme';
let isFilterBarOpen: boolean = false;
let selectedIssueNumbers = new Set<number>();
let userLayoutPreference: 'auto' | 'list' | 'kanban' | 'graph' = 'auto';
let graphSelectedTheme: string = 'all';
let graphShowDone: boolean = false;
let isDraggingEdge: boolean = false;
let dragSourceNum: number | null = null;
let currentGraph: DependencyGraph | null = null;
let isWideScreen: boolean = false;
let draggedIssueNumber: number | null = null;
let isLoading: boolean = false;
let currentRenderedLayout: 'list' | 'kanban' | 'graph' | null = null;
let lastRateLimitRemaining: number | null = null;
let activeStreamEpoch = 0;
let collapsedGroupKeys = new Set<string>();

export function toggleGroupCollapse(key: string): boolean {
  if (collapsedGroupKeys.has(key)) {
    collapsedGroupKeys.delete(key);
  } else {
    collapsedGroupKeys.add(key);
  }
  if (host?.storage) {
    void host.storage.set('collapsed_groups', Array.from(collapsedGroupKeys));
  }
  return collapsedGroupKeys.has(key);
}

export function isGroupCollapsed(key: string): boolean {
  return collapsedGroupKeys.has(key);
}

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
const elBtnLayoutToggle = document.getElementById('btnLayoutToggle') as HTMLButtonElement | null;
const elBtnGraphToggle = document.getElementById('btnGraphToggle') as HTMLButtonElement | null;
const elBtnViewList = document.getElementById('btnViewList') as HTMLButtonElement | null;
const elBtnViewKanban = document.getElementById('btnViewKanban') as HTMLButtonElement | null;
const elBtnViewGraph = document.getElementById('btnViewGraph') as HTMLButtonElement | null;
const elMenuItemToggleGraph = document.getElementById('menuItemToggleGraph') as HTMLDivElement | null;
const elTxtMenuGraph = document.getElementById('txtMenuGraph') as HTMLSpanElement | null;

const elGraphViewContainer = document.getElementById('graphViewContainer') as HTMLElement | null;
const elGraphThemePills = document.getElementById('graphThemePills') as HTMLDivElement | null;
const elChkGraphShowDone = document.getElementById('chkGraphShowDone') as HTMLInputElement | null;
const elGraphStatFrontier = document.getElementById('graphStatFrontier') as HTMLSpanElement | null;
const elGraphStatBlocked = document.getElementById('graphStatBlocked') as HTMLSpanElement | null;
const elGraphStatDone = document.getElementById('graphStatDone') as HTMLSpanElement | null;
const txtGraphStatFrontier = document.getElementById('txtGraphStatFrontier') as HTMLSpanElement | null;
const txtGraphStatBlocked = document.getElementById('txtGraphStatBlocked') as HTMLSpanElement | null;
const txtGraphStatDone = document.getElementById('txtGraphStatDone') as HTMLSpanElement | null;
const elGraphCanvasContainer = document.getElementById('graphCanvasContainer') as HTMLDivElement | null;
const elGraphCanvas = document.getElementById('graphCanvas') as HTMLDivElement | null;
const elGraphSvgOverlay = document.getElementById('graphSvgOverlay') as unknown as SVGSVGElement | null;
const elGraphEdgesLayer = document.getElementById('graphEdgesLayer') as unknown as SVGGElement | null;
const elGraphDragLayer = document.getElementById('graphDragLayer') as unknown as SVGGElement | null;
const elGraphLayers = document.getElementById('graphLayers') as HTMLDivElement | null;

const elDrawerDependenciesContainer = document.getElementById('drawerDependenciesContainer') as HTMLDivElement | null;
const elDrawerDepsCountBadge = document.getElementById('drawerDepsCountBadge') as HTMLSpanElement | null;
const elDrawerBlockedByList = document.getElementById('drawerBlockedByList') as HTMLDivElement | null;
const elDrawerBlocksList = document.getElementById('drawerBlocksList') as HTMLDivElement | null;
const elSelectAddBlocker = document.getElementById('selectAddBlocker') as HTMLSelectElement | null;
const elBtnAddBlockerConfirm = document.getElementById('btnAddBlockerConfirm') as HTMLButtonElement | null;

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
  'draft': document.getElementById('kCardsDraft') as HTMLDivElement,
  'backlog': document.getElementById('kCardsBacklog') as HTMLDivElement,
  'todo': document.getElementById('kCardsTodo') as HTMLDivElement,
  'planned': document.getElementById('kCardsPlanned') as HTMLDivElement,
  'in-progress': document.getElementById('kCardsProgress') as HTMLDivElement,
  'needs-human': document.getElementById('kCardsNeedsHuman') as HTMLDivElement,
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

// Open questions elements
const elQuestionsProgressText = document.getElementById('questionsProgressText') as HTMLSpanElement | null;
const elDrawerQuestionsContainer = document.getElementById('drawerQuestionsContainer') as HTMLDivElement | null;
const elInputAddQuestion = document.getElementById('inputAddQuestion') as HTMLInputElement | null;
const elBtnAddQuestion = document.getElementById('btnAddQuestion') as HTMLButtonElement | null;

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




















// ==========================================
// Git Remote & Repo Parser
// ==========================================

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
  sessions = [];
  sessionIndex = new Map();

  try {
    unsubSessions = await host.onSessions(projectId, (sessSnap) => {
      const prevSessions = sessions;
      sessions = (sessSnap.sessions as any[]) || [];
      sessionIndex = buildSessionIndex(sessions);
      renderViews();
      if (activeIssue) renderDrawer(activeIssue);
      statusReconciler.schedule(issues);

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
          if (targetPath.includes('/.git/worktrees/')) {
            const parentRepoRoot = targetPath.split('/.git/worktrees/')[0];
            try {
              const parentConfig = await host.readFile(`${parentRepoRoot}/.git/config`);
              if (parentConfig && parentConfig.content) {
                found = parseGitRemoteFromConfig(parentConfig.content);
              }
            } catch {}
          }
          if (!found) {
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
  // If currentDirectory is inside /workspace/.local/share/opencode/worktree/,
  // extract parent repository root from .git file and match that project in allProjects first,
  // so worktree sessions inherit their true repository context!
  let worktreeMatchedProject: ProjectItem | null = null;
  if (currentDirectory && currentDirectory.includes('/workspace/.local/share/opencode/worktree/')) {
    try {
      const cleanCurDir = currentDirectory.replace(/\/+$/, '');
      const gitFileRes = await host.readFile(`${cleanCurDir}/.git`);
      if (gitFileRes && gitFileRes.content) {
        const match = gitFileRes.content.match(/^gitdir:\s*(.+)$/m);
        if (match) {
          const gitdir = match[1].trim();
          const targetPath = gitdir.startsWith('/') ? gitdir : `${cleanCurDir}/${gitdir}`;
          if (targetPath.includes('/.git/worktrees/')) {
            const parentRepoRoot = targetPath.split('/.git/worktrees/')[0].replace(/\/+$/, '');
            worktreeMatchedProject = allProjects.find((p) => {
              if (!p.directory) return false;
              const cleanP = p.directory.replace(/\/+$/, '');
              return cleanP === parentRepoRoot || parentRepoRoot.startsWith(cleanP + '/');
            }) || null;
            if (worktreeMatchedProject) {
              addLog(`Worktree matched to parent project: "${worktreeMatchedProject.name}" (${worktreeMatchedProject.directory})`, 'succ');
            }
          }
        }
      }
    } catch (err: any) {
      addLog(`Failed to resolve parent project from worktree .git: ${err?.message || err}`, 'warn');
    }
  }

  // Longest-prefix match: sort by directory path length descending
  const sorted = [...allProjects].sort((a, b) => (b.directory?.length || 0) - (a.directory?.length || 0));

  let targetProject = worktreeMatchedProject || sorted.find((p) => {
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
  issues = [];
  showAllDoneIssues = false;
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
    const token = extractGitHubTokenFromCredentials(creds?.content);
    if (token) {
      workspaceGitToken = token;
      addLog('Loaded authenticated GitHub PAT from workspace credentials', 'succ');
      return workspaceGitToken;
    }
  } catch {}
  try {
    const cfg = await host.readFile('/workspace/.gitconfig');
    const token = extractGitHubTokenFromCredentials(cfg?.content);
    if (token) {
      workspaceGitToken = token;
      return workspaceGitToken;
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
        const rem = directRes.headers.get('x-ratelimit-remaining');
        if (rem !== null) lastRateLimitRemaining = parseInt(rem, 10);
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
      const resHeaders = (res as any).headers;
      if (resHeaders) {
        const rem = resHeaders['x-ratelimit-remaining'];
        if (rem) lastRateLimitRemaining = parseInt(rem, 10);
      }
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

async function streamRemainingPages(repo: string, storageKey: string, startPage: number, epoch: number): Promise<void> {
  let page = startPage;
  const MAX_PAGES = 10; // Supports up to 1,000 issues while keeping memory bounded
  while (page <= MAX_PAGES && currentRepo === repo && activeStreamEpoch === epoch) {
    try {
      const nextRaw = await githubRequest('GET', `/repos/${repo}/issues?state=all&per_page=100&page=${page}`);
      const nextItems = Array.isArray(nextRaw) ? nextRaw : (nextRaw?.items || []);
      if (nextItems.length === 0 || activeStreamEpoch !== epoch) break;

      const nextIssues = normalizeGithubIssues(nextItems);
      if (currentRepo !== repo || activeStreamEpoch !== epoch) break;

      issues = mergeIssuePages(issues, nextIssues);
      issueCache.set(repo, { timestamp: Date.now(), issues });
      if (host?.storage) {
        void host.storage.set(storageKey, { timestamp: Date.now(), issues } as any);
      }
      renderViews();
      statusReconciler.schedule(issues);
      addLog(`Streamed page ${page} (${nextIssues.length} issues, total ${issues.length})`);

      if (nextItems.length < 100) break;
      page++;
    } catch (err: any) {
      addLog(`Background streaming stopped at page ${page}: ${err.message}`, 'warn');
      break;
    }
  }
}

async function fetchIssues(force: boolean = false): Promise<void> {
  if (!currentRepo) return;
  const storageKey = `cached_issues_${currentRepo}`;
  const streamEpoch = ++activeStreamEpoch;

  // 1. Instant in-memory cache check (0ms UI latency)
  if (!force && issueCache.has(currentRepo)) {
    const cached = issueCache.get(currentRepo)!;
    if (Date.now() - cached.timestamp < ISSUE_CACHE_TTL_MS) {
      issues = cached.issues;
      if (!userSelectedTab) {
        selectTab(resolveDefaultTab(issues));
      }
      renderViews();
      addLog(`Rendered ${issues.length} issues from memory cache for ${currentRepo}`);
      return;
    }
  }

  // 2. Instant persistent storage check (0ms UI latency on fresh reload)
  if (!force && issues.length === 0 && host?.storage) {
    try {
      const stored = (await host.storage.get(storageKey)) as any;
      if (stored && Array.isArray(stored.issues) && stored.issues.length > 0) {
        issues = stored.issues;
        issueCache.set(currentRepo, { timestamp: stored.timestamp || Date.now(), issues });
        if (!userSelectedTab) {
          selectTab(resolveDefaultTab(issues));
        }
        renderViews();
        addLog(`Instantly rendered ${issues.length} issues from persistent storage for ${currentRepo}`);
      }
    } catch {}
  }

  isLoading = true;
  if (elIconRefresh) elIconRefresh.style.animation = 'spin 1s linear infinite';

  try {
    addLog(`Fetching issues for ${currentRepo}...`);
    // Page 1: Standard core issues endpoint (5,000 req/hr rate limit pool)
    const page1Raw = await githubRequest(
      'GET',
      `/repos/${currentRepo}/issues?state=all&per_page=100&page=1`
    );

    const page1Items = Array.isArray(page1Raw) ? page1Raw : (page1Raw?.items || []);
    const page1Issues = normalizeGithubIssues(page1Items);

    issues = page1Issues;

    // Cache results in memory and persistent storage
    issueCache.set(currentRepo, {
      timestamp: Date.now(),
      issues,
    });
    if (host?.storage) {
      void host.storage.set(storageKey, { timestamp: Date.now(), issues } as any);
    }

    addLog(`Loaded ${issues.length} issues (Page 1) for ${currentRepo}`, 'succ');
    if (!userSelectedTab) {
      selectTab(resolveDefaultTab(issues));
    }
    renderViews();
    statusReconciler.schedule(issues);

    // Background streaming for remaining pages if 100 items returned
    if (page1Items.length >= 100) {
      void streamRemainingPages(currentRepo, storageKey, 2, streamEpoch);
    }
  } catch (err: any) {
    addLog(`Failed to fetch fresh issues: ${err.message}`, 'error');
    if (issues.length > 0) {
      // Never break: keep showing cached issues!
      if (host?.toast) {
        void host.toast({ kind: 'info', message: `Offline / Rate-limited. Showing ${issues.length} cached issues.` });
      }
    } else {
      renderEmptyState(`Failed to load issues for ${currentRepo}: ${err.message || 'Check GitHub integration tokens'}`);
    }
  } finally {
    isLoading = false;
    if (elIconRefresh) elIconRefresh.style.animation = '';
  }
}

async function updateIssueBody(issue: Issue, newBody: string): Promise<void> {
  issue.body = newBody;
  issue.subtasks = parseSubtasks(newBody);
  issue.openQuestions = parseOpenQuestions(newBody);
  renderViews();
  if (activeIssue && activeIssue.number === issue.number) {
    renderDrawer(issue);
  }

  try {
    await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
      body: newBody,
    });
    await host.toast({ kind: 'info', message: `Updated issue #${issue.number}` });
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
    case 'draft':
      return 'backlog';
    case 'backlog':
      return 'todo';
    case 'todo':
      return 'planned';
    case 'planned':
      return 'in-progress';
    case 'in-progress':
      return 'needs-human';
    case 'needs-human':
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
    case 'draft':
      return { label: 'Backlog', target: 'backlog', icon: '→' };
    case 'backlog':
      return { label: 'To Do', target: 'todo', icon: '→' };
    case 'todo':
      return { label: 'Planned', target: 'planned', icon: '→' };
    case 'planned':
      return { label: 'In Progress', target: 'in-progress', icon: '▶' };
    case 'in-progress':
      return { label: 'In Review', target: 'in-review', icon: '→' };
    case 'needs-human':
      return { label: 'In Progress', target: 'in-progress', icon: '▶' };
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

export function groupIssuesBy(issuesList: Issue[], groupBy: string): IssueGroup[] {
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

  if (groupBy === 'theme' || groupBy === 'tag') {
    const themeMap = new Map<string, IssueGroup>();
    for (const issue of issuesList) {
      const theme = getIssueTheme(issue);
      if (!themeMap.has(theme)) {
        themeMap.set(theme, { id: theme, title: theme, issues: [] });
      }
      themeMap.get(theme)!.issues.push(issue);
    }
    if (themeMap.size === 0) {
      themeMap.set('No Theme', { id: 'No Theme', title: 'No Theme', issues: [] });
    }
    return Array.from(themeMap.values());
  }

  if (groupBy === 'none') {
    return [{ id: 'all', title: 'All Items', issues: issuesList }];
  }

  // Default: status
  const groups: IssueGroup[] = [
    { id: 'draft', title: 'Draft', issues: [] },
    { id: 'backlog', title: 'Backlog', issues: [] },
    { id: 'todo', title: 'To Do', issues: [] },
    { id: 'planned', title: 'Planned', issues: [] },
    { id: 'in-progress', title: 'In Progress', issues: [] },
    { id: 'needs-human', title: 'Needs Human', issues: [] },
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

// ==========================================
// Session & Worktree Reconciler
// ==========================================

function getIssueSession(issue: Issue): SessionInfo | null {
  if (!issue) return null;
  return sessionIndex.get(issue.number) || null;
}

export function resolveIssueColumn(
  issue: Issue,
  sessionOverride?: SessionInfo | SessionInfo[] | null
): ColumnId | null {
  if (!issue) return null;
  if (isIssueClosed(issue)) {
    return 'done';
  }

  const labelNames = (issue.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labelNames.includes('status:done')) return 'done';
  if (labelNames.includes('status:in-review')) return 'in-review';
  if (labelNames.includes('status:needs-human')) return 'needs-human';

  // Check attached session activity
  let session: SessionInfo | null = null;
  if (sessionOverride !== undefined) {
    if (Array.isArray(sessionOverride)) {
      const issueNumStr = String(issue.number);
      session =
        sessionOverride.find((s) => {
          if (s.items && s.items.some((it) => it.id === issueNumStr || (it.data && it.data.issueNumber === issue.number))) {
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
        }) || null;
    } else {
      session = sessionOverride;
    }
  } else {
    session = getIssueSession(issue);
  }

  const isSessionRunning = Boolean(session && session.activity === 'running');
  const isSessionWaiting = Boolean(
    session &&
      (session.activity === 'waiting-permission' ||
        session.activity === 'waiting-question' ||
        session.activity.startsWith('waiting'))
  );
  const isSessionIdle = Boolean(session && session.activity === 'idle');

  // Explicit status:in-progress label
  if (labelNames.includes('status:in-progress')) {
    if (isSessionIdle) {
      return 'in-review';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'in-progress';
  }

  // Explicit status:planned label
  if (labelNames.includes('status:planned')) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'planned';
  }

  // Explicit status:todo label
  if (labelNames.includes('status:todo')) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'todo';
  }

  // Explicit status:backlog label
  if (labelNames.includes('status:backlog')) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'backlog';
  }

  // Explicit status:draft or isVagueIdea(issue)
  if (labelNames.includes('status:draft') || isVagueIdea(issue)) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    return 'draft';
  }

  // Dynamic session detection for issues without explicit status labels
  if (session) {
    if (isSessionRunning) {
      return 'in-progress';
    }
    if (isSessionWaiting) {
      return 'needs-human';
    }
    if (isSessionIdle) {
      return 'in-review';
    }
  }

  // Default for unlabelled well-formed issues
  return 'todo';
}

export function resolveDefaultTab(issues: Issue[]): TabId {
  if (!issues || issues.length === 0) return 'all';

  const hasNeedsHuman = issues.some((i) => resolveIssueColumn(i) === 'needs-human');
  if (hasNeedsHuman) return 'needs-human';

  const hasReview = issues.some((i) => resolveIssueColumn(i) === 'in-review');
  if (hasReview) return 'in-review';

  const hasProgress = issues.some((i) => resolveIssueColumn(i) === 'in-progress');
  if (hasProgress) return 'in-progress';

  const hasTodo = issues.some((i) => resolveIssueColumn(i) === 'todo');
  if (hasTodo) return 'todo';

  const hasPlanned = issues.some((i) => resolveIssueColumn(i) === 'planned');
  if (hasPlanned) return 'planned';

  const hasBacklog = issues.some((i) => resolveIssueColumn(i) === 'backlog');
  if (hasBacklog) return 'backlog';

  const hasDraft = issues.some((i) => resolveIssueColumn(i) === 'draft');
  if (hasDraft) return 'draft';

  return 'all';
}

// Live session write-back reconciler
export const statusReconciler = new StatusReconciler({
  debounceMs: 300,
  updateStatus: async (issue, targetColumn) => {
    await updateIssueStatus(issue, targetColumn);
  },
  getSession: (issue) => getIssueSession(issue),
});

function updateBadgeCounts(): void {
  const counts: Record<ColumnId, number> = {
    'draft': 0,
    'backlog': 0,
    'todo': 0,
    'planned': 0,
    'in-progress': 0,
    'needs-human': 0,
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
  setTxt('tabCountDraft', counts['draft']);
  setTxt('tabCountBacklog', counts['backlog']);
  setTxt('tabCountTodo', counts['todo']);
  setTxt('tabCountPlanned', counts['planned']);
  setTxt('tabCountProgress', counts['in-progress']);
  setTxt('tabCountNeedsHuman', counts['needs-human']);
  setTxt('tabCountReview', counts['in-review']);
  setTxt('tabCountDone', counts['done']);

  // Kanban counts
  setTxt('kCountDraft', counts['draft']);
  setTxt('kCountBacklog', counts['backlog']);
  setTxt('kCountTodo', counts['todo']);
  setTxt('kCountPlanned', counts['planned']);
  setTxt('kCountProgress', counts['in-progress']);
  setTxt('kCountNeedsHuman', counts['needs-human']);
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
    if (elGraphViewContainer) elGraphViewContainer.style.display = 'none';
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
  if (elGraphViewContainer) elGraphViewContainer.style.display = '';

  // Synchronize layout attributes and tab visibility
  applyLayoutMode(false);

  const activeLayout: 'list' | 'kanban' | 'graph' = document.body.getAttribute('data-layout') === 'graph'
    ? 'graph'
    : document.body.getAttribute('data-layout') === 'kanban'
      ? 'kanban'
      : 'list';

  // Render ONLY the active view to avoid triple-DOM overhead
  if (activeLayout === 'list') {
    renderListView(sorted);
  } else if (activeLayout === 'kanban') {
    renderKanbanView(sorted);
  } else if (activeLayout === 'graph') {
    renderGraphView(sorted);
  }
  currentRenderedLayout = activeLayout;

  // Sync batch bar & card selections
  updateBatchBar();
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
  const labelsHtml = filterDisplayLabels(issue.labels)
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

  const questionBadgeInfo = formatQuestionBadge(issue.openQuestions);
  const questionsBadgeHtml = questionBadgeInfo.html;

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
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        ${subtaskHtml}
        ${questionsBadgeHtml}
      </div>
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

  if (currentGroupBy === 'none') {
    const fragment = document.createDocumentFragment();
    listItems.forEach((issue) => {
      const card = buildCardElement(issue, false);
      fragment.appendChild(card);
    });
    elListViewContainer.appendChild(fragment);
  } else {
    const groups = groupIssuesBy(listItems, currentGroupBy);
    let totalRendered = 0;
    const fragment = document.createDocumentFragment();

    groups.forEach((grp) => {
      if (grp.issues.length === 0) return;
      totalRendered += grp.issues.length;

      const groupKey = `list:${grp.id}`;
      const isCollapsed = isGroupCollapsed(groupKey);

      const groupEl = document.createElement('div');
      groupEl.className = `list-group ${isCollapsed ? 'is-collapsed' : ''}`;
      groupEl.dataset.groupId = grp.id;
      groupEl.dataset.groupKey = groupKey;
      groupEl.innerHTML = `
        <div class="list-group-header" role="button" tabindex="0" title="Click to collapse / expand group">
          <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
            <svg class="list-group-chevron icon icon-sm" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
            <span>${escapeHtml(grp.title)}</span>
          </div>
          <span class="status-pill">${grp.issues.length}</span>
        </div>
        <div class="list-group-cards"></div>
      `;

      const headerEl = groupEl.querySelector('.list-group-header') as HTMLElement;
      const toggleCollapse = (e: Event) => {
        e.stopPropagation();
        toggleGroupCollapse(groupKey);
        renderViews();
      };
      headerEl.addEventListener('click', toggleCollapse);
      headerEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCollapse(e);
        }
      });

      // Lazy rendering: only construct cards if group is expanded
      if (!isCollapsed) {
        const listCardsContainer = groupEl.querySelector('.list-group-cards') as HTMLDivElement;
        const cardsFragment = document.createDocumentFragment();
        grp.issues.forEach((issue) => {
          const card = buildCardElement(issue, false);
          cardsFragment.appendChild(card);
        });
        listCardsContainer.appendChild(cardsFragment);
      }

      fragment.appendChild(groupEl);
    });

    if (totalRendered === 0) {
      elListViewContainer.innerHTML = `
        <div class="empty-box">
          <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"/></svg>
          <span>No issues match this view</span>
        </div>
      `;
    } else {
      elListViewContainer.appendChild(fragment);
    }
  }
}

function renderKanbanView(filteredIssues: Issue[]): void {
  elKanbanViewContainer.innerHTML = '';
  const kanbanFragment = document.createDocumentFragment();
  const columns: Array<{ id: ColumnId; title: string }> = [
    { id: 'draft', title: 'Draft' },
    { id: 'backlog', title: 'Backlog' },
    { id: 'todo', title: 'To Do' },
    { id: 'planned', title: 'Planned' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'needs-human', title: 'Needs Human' },
    { id: 'in-review', title: 'Review' },
    { id: 'done', title: 'Done' },
  ];

  columns.forEach((col) => {
    const colIssues = filteredIssues.filter((i) => resolveIssueColumn(i) === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'kanban-col';
    colEl.dataset.column = col.id;
    colEl.innerHTML = `
      <div class="kanban-col-header">
        <span>${escapeHtml(col.title)}</span>
        <span class="status-pill">${colIssues.length}</span>
      </div>
      <div class="kanban-cards" data-column="${escapeHtml(col.id)}"></div>
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

      const subEl = (e.target as HTMLElement)?.closest?.('.kanban-subgroup') as HTMLElement | null;
      const subgroupId = subEl?.dataset?.subgroupId;

      await updateIssueStatus(issue, col.id);

      if (currentGroupBy === 'priority' && subgroupId && subgroupId !== 'none') {
        const updatedLabels = updatePriorityLabels(issue.labels, subgroupId);
        issue.labels = updatedLabels.map((name) => ({ name }));
        if (currentRepo) issueCache.delete(currentRepo);
        renderViews();
        try {
          await githubRequest('PATCH', `/repos/${currentRepo}/issues/${issue.number}`, {
            labels: updatedLabels,
          });
        } catch {}
      }
    });

    let displayIssues = colIssues;
    let doneRemaining = 0;
    if (col.id === 'done' && !searchQuery.trim()) {
      const scoped = scopeDoneIssues(colIssues, 25, showAllDoneIssues);
      displayIssues = scoped.visible;
      doneRemaining = scoped.remaining;
    }

    if (currentGroupBy === 'none' || currentGroupBy === 'status') {
      const cardsFragment = document.createDocumentFragment();
      displayIssues.forEach((issue) => {
        const card = buildCardElement(issue, true);
        cardsFragment.appendChild(card);
      });
      cardsContainer.appendChild(cardsFragment);
    } else {
      const subGroups = groupIssuesBy(displayIssues, currentGroupBy);
      const subFragment = document.createDocumentFragment();
      subGroups.forEach((subGrp) => {
        if (subGrp.issues.length === 0) return;
        const groupKey = `kanban:${col.id}:${subGrp.id}`;
        const isCollapsed = isGroupCollapsed(groupKey);

        const subGroupEl = document.createElement('div');
        subGroupEl.className = `kanban-subgroup ${isCollapsed ? 'is-collapsed' : ''}`;
        subGroupEl.dataset.subgroupId = subGrp.id;
        subGroupEl.dataset.groupKey = groupKey;
        subGroupEl.innerHTML = `
          <div class="kanban-subgroup-header" role="button" tabindex="0" title="Click to collapse / expand group">
            <div style="display: flex; align-items: center; gap: 5px; min-width: 0;">
              <svg class="kanban-subgroup-chevron icon icon-sm" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
              <span class="kanban-subgroup-title">${escapeHtml(subGrp.title)}</span>
            </div>
            <span class="kanban-subgroup-count">${subGrp.issues.length}</span>
          </div>
          <div class="kanban-subgroup-cards"></div>
        `;

        const headerEl = subGroupEl.querySelector('.kanban-subgroup-header') as HTMLElement;
        const toggleCollapse = (e: Event) => {
          e.stopPropagation();
          toggleGroupCollapse(groupKey);
          renderViews();
        };
        headerEl.addEventListener('click', toggleCollapse);
        headerEl.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapse(e);
          }
        });

        // Lazy rendering: only construct cards if subgroup is expanded
        if (!isCollapsed) {
          const subCardsContainer = subGroupEl.querySelector('.kanban-subgroup-cards') as HTMLDivElement;
          const subCardsFragment = document.createDocumentFragment();
          subGrp.issues.forEach((issue) => {
            const card = buildCardElement(issue, true);
            subCardsFragment.appendChild(card);
          });
          subCardsContainer.appendChild(subCardsFragment);
        }
        subFragment.appendChild(subGroupEl);
      });
      cardsContainer.appendChild(subFragment);
    }

    if (col.id === 'done' && doneRemaining > 0) {
      const showMoreBtn = document.createElement('div');
      showMoreBtn.className = 'kanban-show-more-btn';
      showMoreBtn.style.cssText = 'padding: 8px 10px; text-align: center; font-size: 11px; color: var(--prim); cursor: pointer; background: var(--surf-muted); border-radius: var(--rad); margin-top: 6px; border: 1px dashed var(--border); font-weight: 500;';
      showMoreBtn.textContent = `Show all ${colIssues.length} Done (+${doneRemaining} more)`;
      showMoreBtn.addEventListener('click', () => {
        showAllDoneIssues = true;
        renderViews();
      });
      cardsContainer.appendChild(showMoreBtn);
    }

    kanbanFragment.appendChild(colEl);
  });
  elKanbanViewContainer.appendChild(kanbanFragment);
}

function updateViewModeButtons(mode: 'list' | 'kanban' | 'graph'): void {
  elBtnViewList?.classList.toggle('active', mode === 'list');
  elBtnViewList?.setAttribute('aria-checked', mode === 'list' ? 'true' : 'false');

  elBtnViewKanban?.classList.toggle('active', mode === 'kanban');
  elBtnViewKanban?.setAttribute('aria-checked', mode === 'kanban' ? 'true' : 'false');

  elBtnViewGraph?.classList.toggle('active', mode === 'graph');
  elBtnViewGraph?.setAttribute('aria-checked', mode === 'graph' ? 'true' : 'false');

  if (elBtnLayoutToggle) {
    if (mode === 'list') {
      elBtnLayoutToggle.title = 'View: List (click to switch to Board)';
      elBtnLayoutToggle.setAttribute('aria-label', 'View: List (click to switch to Board)');
      elBtnLayoutToggle.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>';
    } else if (mode === 'kanban') {
      elBtnLayoutToggle.title = 'View: Board (click to switch to Graph)';
      elBtnLayoutToggle.setAttribute('aria-label', 'View: Board (click to switch to Graph)');
      elBtnLayoutToggle.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M3 3h4v18H3V3zm7 0h4v12h-4V3zm7 0h4v15h-4V3z"/></svg>';
    } else {
      elBtnLayoutToggle.title = 'View: Graph (click to switch to List)';
      elBtnLayoutToggle.setAttribute('aria-label', 'View: Graph (click to switch to List)');
      elBtnLayoutToggle.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M11 2v4.18C8.6 6.6 6.8 8.6 6.8 11v2H4v7h7v-7H9.2v-2c0-1.5 1.2-2.8 2.8-2.8s2.8 1.3 2.8 2.8v2H13v7h7v-7h-2.2v-2c0-2.4-1.8-4.4-4.2-4.82V2h-2.6zM9 15v3H6v-3h3zm9 0v3h-3v-3h3z"/></svg>';
    }
  }
}

function applyLayoutMode(triggerRender: boolean = true): void {
  if (showArchivedOnly) {
    document.body.removeAttribute('data-layout');
    return;
  }
  isWideScreen = window.innerWidth >= 680;

  let newLayout: 'list' | 'kanban' | 'graph' = 'list';
  if (userLayoutPreference === 'graph') {
    newLayout = 'graph';
    document.body.setAttribute('data-layout', 'graph');
    updateViewModeButtons('graph');
  } else if (userLayoutPreference === 'kanban') {
    newLayout = 'kanban';
    document.body.setAttribute('data-layout', 'kanban');
    updateViewModeButtons('kanban');
  } else if (userLayoutPreference === 'list') {
    newLayout = 'list';
    document.body.removeAttribute('data-layout');
    updateViewModeButtons('list');
  } else {
    if (isWideScreen) {
      newLayout = 'kanban';
      document.body.setAttribute('data-layout', 'kanban');
      updateViewModeButtons('kanban');
    } else {
      newLayout = 'list';
      document.body.removeAttribute('data-layout');
      updateViewModeButtons('list');
    }
  }

  if (triggerRender && currentRenderedLayout !== newLayout) {
    renderViews();
  } else if (newLayout === 'graph') {
    drawCurrentGraphEdges();
  }
}

// ==========================================
// Dependency Graph Visualization & Interaction
// ==========================================

const THEME_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

function getThemeColor(theme: string): string {
  if (!theme || theme === 'No Theme') return 'var(--border)';
  let hash = 0;
  for (let i = 0; i < theme.length; i++) {
    hash = (hash * 31 + theme.charCodeAt(i)) & 0xffffffff;
  }
  return THEME_PALETTE[Math.abs(hash) % THEME_PALETTE.length];
}

async function handleAddDependency(targetNum: number, blockerNum: number): Promise<void> {
  if (targetNum === blockerNum) return;
  if (detectCycle(issues, blockerNum, targetNum)) {
    if (host?.toast) {
      await host.toast({ kind: 'error', message: `Cannot link #${targetNum} -> #${blockerNum}: creates circular dependency` });
    }
    return;
  }
  const targetIssue = issues.find((i) => i.number === targetNum);
  if (!targetIssue) return;
  const newBody = addDependencyToMarkdown(targetIssue.body, blockerNum);
  if (newBody !== targetIssue.body) {
    await updateIssueBody(targetIssue, newBody);
    if (host?.toast) {
      await host.toast({ kind: 'info', message: `Linked #${targetNum} as blocked by #${blockerNum}` });
    }
  }
}

async function handleRemoveDependency(targetNum: number, blockerNum: number): Promise<void> {
  const targetIssue = issues.find((i) => i.number === targetNum);
  if (!targetIssue) return;
  const newBody = removeDependencyFromMarkdown(targetIssue.body, blockerNum);
  if (newBody !== targetIssue.body) {
    await updateIssueBody(targetIssue, newBody);
    if (host?.toast) {
      await host.toast({ kind: 'info', message: `Removed dependency: #${blockerNum} no longer blocks #${targetNum}` });
    }
  }
}

document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.btn-remove-blocker');
  if (btn) {
    e.stopPropagation();
    e.preventDefault();
    const target = parseInt(btn.dataset.target || '0', 10);
    const blocker = parseInt(btn.dataset.blocker || '0', 10);
    if (target > 0 && blocker > 0) {
      void handleRemoveDependency(target, blocker);
    }
  }
});

function showQuickBlockerPicker(targetIssue: Issue, triggerEl: HTMLElement): void {
  document.querySelectorAll('.graph-quick-picker').forEach((p) => p.remove());

  const popover = document.createElement('div');
  popover.className = 'popover graph-quick-picker';
  popover.style.display = 'block';
  popover.style.position = 'absolute';
  popover.style.width = '240px';
  popover.style.zIndex = '200';

  const triggerRect = triggerEl.getBoundingClientRect();
  popover.style.top = `${triggerRect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${Math.max(10, Math.min(window.innerWidth - 250, triggerRect.left + window.scrollX))}px`;

  const existingBlockers = parseIssueDependencies(targetIssue.body);
  const candidateIssues = issues.filter((i) => i.number !== targetIssue.number && !existingBlockers.includes(i.number));

  let itemsHtml = '';
  if (candidateIssues.length === 0) {
    itemsHtml = '<div style="padding: 8px 10px; color: var(--fg-faint); font-size: 11px;">No other issues available.</div>';
  } else {
    candidateIssues.forEach((cand) => {
      itemsHtml += `
        <div class="popover-item" data-blocker-num="${cand.number}" style="padding: 6px 10px; cursor: pointer;">
          <div style="font-weight: 600; font-size: 11.5px; color: var(--fg);">#${cand.number} ${escapeHtml(cand.title)}</div>
        </div>
      `;
    });
  }

  popover.innerHTML = `
    <div class="popover-head" style="display: flex; justify-content: space-between; align-items: center;">
      <span>Add Blocker to #${targetIssue.number}</span>
      <span class="popover-close-btn" style="cursor: pointer; font-weight: 700;">×</span>
    </div>
    <div class="popover-list" style="max-height: 200px; overflow-y: auto;">
      ${itemsHtml}
    </div>
  `;

  document.body.appendChild(popover);

  const closePopover = () => {
    popover.remove();
    document.removeEventListener('click', onDocClick);
  };

  const onDocClick = (e: MouseEvent) => {
    if (!popover.contains(e.target as Node) && e.target !== triggerEl) {
      closePopover();
    }
  };

  setTimeout(() => {
    document.addEventListener('click', onDocClick);
  }, 10);

  popover.querySelector('.popover-close-btn')?.addEventListener('click', closePopover);

  popover.querySelectorAll<HTMLElement>('.popover-item[data-blocker-num]').forEach((item) => {
    item.addEventListener('click', () => {
      const bNum = parseInt(item.dataset.blockerNum || '0', 10);
      if (bNum > 0) {
        closePopover();
        void handleAddDependency(targetIssue.number, bNum);
      }
    });
  });
}

function initDragEdge(sourceNum: number, e: MouseEvent): void {
  isDraggingEdge = true;
  dragSourceNum = sourceNum;
  e.preventDefault();
  e.stopPropagation();

  if (!elGraphCanvas || !elGraphDragLayer) return;
  const canvasRect = elGraphCanvas.getBoundingClientRect();
  const sourceCard = elGraphCanvas.querySelector<HTMLElement>(`.graph-card[data-issue-number="${sourceNum}"]`);
  if (!sourceCard) return;

  const sourceRect = sourceCard.getBoundingClientRect();
  const startX = Math.round(sourceRect.left + sourceRect.width / 2 - canvasRect.left);
  const startY = Math.round(sourceRect.bottom - canvasRect.top);

  const dragPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  dragPath.setAttribute('class', 'graph-edge graph-edge-drag');
  dragPath.setAttribute('marker-end', 'url(#wf-arrow-drag)');
  elGraphDragLayer.innerHTML = '';
  elGraphDragLayer.appendChild(dragPath);

  const onMouseMove = (moveEv: MouseEvent) => {
    if (!isDraggingEdge || !elGraphCanvas) return;
    const currentCanvasRect = elGraphCanvas.getBoundingClientRect();
    const curX = Math.round(moveEv.clientX - currentCanvasRect.left);
    const curY = Math.round(moveEv.clientY - currentCanvasRect.top);
    const dy = curY - startY;
    const curvature = Math.max(30, Math.abs(dy) * 0.5);
    dragPath.setAttribute('d', `M ${startX} ${startY} C ${startX} ${startY + curvature}, ${curX} ${curY - curvature}, ${curX} ${curY}`);

    elGraphCanvas.querySelectorAll('.graph-card').forEach((card) => {
      const rect = card.getBoundingClientRect();
      const isInside = moveEv.clientX >= rect.left && moveEv.clientX <= rect.right &&
                       moveEv.clientY >= rect.top && moveEv.clientY <= rect.bottom;
      const num = parseInt((card as HTMLElement).dataset.issueNumber || '0', 10);
      card.classList.toggle('drop-target-active', isInside && num !== dragSourceNum);
    });
  };

  const onMouseUp = (upEv: MouseEvent) => {
    isDraggingEdge = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (elGraphDragLayer) elGraphDragLayer.innerHTML = '';

    let targetNum: number | null = null;
    if (elGraphCanvas) {
      elGraphCanvas.querySelectorAll<HTMLElement>('.graph-card').forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (
          upEv.clientX >= rect.left && upEv.clientX <= rect.right &&
          upEv.clientY >= rect.top && upEv.clientY <= rect.bottom
        ) {
          const num = parseInt(card.dataset.issueNumber || '0', 10);
          if (num > 0 && num !== dragSourceNum) {
            targetNum = num;
          }
        }
        card.classList.remove('drop-target-active');
      });
    }

    if (targetNum && dragSourceNum) {
      void handleAddDependency(targetNum, dragSourceNum);
    }
    dragSourceNum = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function createGraphCardElement(node: DependencyNode): HTMLElement {
  const card = document.createElement('div');
  card.className = 'graph-card';
  card.dataset.issueNumber = String(node.issue.number);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Issue #${node.issue.number}: ${node.issue.title}`);
  if (node.isDone) card.classList.add('graph-card-done');
  if (node.isFrontier) card.classList.add('graph-card-frontier');
  if (node.isBlocked) card.classList.add('graph-card-blocked');

  const themeCol = getThemeColor(node.theme);
  card.style.setProperty('--card-theme-color', themeCol);

  const subTotal = (node.issue.subtasks || []).length;
  const subDone = (node.issue.subtasks || []).filter((s) => s.completed).length;

  let frontierFlagHtml = '';
  if (node.isFrontier) {
    frontierFlagHtml = '<div class="graph-frontier-flag">READY</div>';
  }

  let priorityHtml = '';
  if (node.priority && node.priority !== 'normal' && node.priority !== 'none') {
    priorityHtml = `<span class="badge badge-priority badge-priority-${node.priority.toLowerCase()} graph-card-priority">${node.priority}</span>`;
  }

  let blockersHtml = '';
  if (node.isBlocked && node.openBlockers.length > 0) {
    const chipsHtml = renderBlockerChips(node.issue, node.openBlockers);
    blockersHtml = `<span class="graph-badge-blocked" title="Blocked by #${node.openBlockers.join(', #')}"><svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> ${chipsHtml}</span>`;
  }

  let impactHtml = '';
  if (node.downstreamImpact > 0) {
    impactHtml = `<span class="graph-badge-impact" title="Unblocks ${node.downstreamImpact} downstream tasks"><svg class="icon icon-xs" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ${node.downstreamImpact} waiting</span>`;
  }

  let subtaskHtml = '';
  if (subTotal > 0) {
    subtaskHtml = `<span class="graph-badge-subtasks">${subDone}/${subTotal}</span>`;
  }

  card.innerHTML = `
    ${frontierFlagHtml}
    <div class="graph-port graph-port-in" data-port="in" data-issue="${node.issue.number}" title="Drop arrow here to make #${node.issue.number} depend on another task">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
    </div>
    <div class="graph-card-head">
      <input type="checkbox" class="graph-card-check" ${node.isDone ? 'checked' : ''} title="Mark done / todo" />
      <span class="graph-card-num">#${node.issue.number}</span>
      <span class="graph-card-theme" title="${escapeHtml(node.theme)}">${escapeHtml(node.theme)}</span>
      ${priorityHtml}
    </div>
    <div class="graph-card-title" title="${escapeHtml(node.issue.title)}">${escapeHtml(node.issue.title)}</div>
    <div class="graph-card-meta">
      ${blockersHtml}
      ${impactHtml}
      ${subtaskHtml}
      <button class="graph-card-add-dep-btn" data-add-dep="${node.issue.number}" title="Add a blocker to #${node.issue.number}">+ Blocker</button>
    </div>
    <div class="graph-port graph-port-out" data-port="out" data-issue="${node.issue.number}" title="Drag arrow to another task to make it depend on #${node.issue.number}">
      <svg viewBox="0 0 24 24"><path d="M12 16l-6-6h12l-6 6z"/></svg>
    </div>
  `;

  const chk = card.querySelector<HTMLInputElement>('.graph-card-check');
  if (chk) {
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      void updateIssueStatus(node.issue, chk.checked ? 'done' : 'todo');
    });
  }

  const addBtn = card.querySelector<HTMLButtonElement>('.graph-card-add-dep-btn');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showQuickBlockerPicker(node.issue, addBtn);
    });
  }

  card.querySelectorAll<HTMLButtonElement>('.btn-remove-blocker').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const target = parseInt(btn.dataset.target || '0', 10);
      const blocker = parseInt(btn.dataset.blocker || '0', 10);
      if (target > 0 && blocker > 0) {
        void handleRemoveDependency(target, blocker);
      }
    });
  });

  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.graph-port') || target.closest('.graph-card-check') || target.closest('.graph-card-add-dep-btn') || target.closest('.btn-remove-blocker')) {
      return;
    }
    openDrawer(node.issue);
  });

  card.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      if (target.closest('.graph-port') || target.closest('.graph-card-check') || target.closest('.graph-card-add-dep-btn') || target.closest('.btn-remove-blocker')) {
        return;
      }
      e.preventDefault();
      openDrawer(node.issue);
    }
  });

  const outPort = card.querySelector<HTMLElement>('.graph-port-out');
  if (outPort) {
    outPort.addEventListener('mousedown', (e) => {
      initDragEdge(node.issue.number, e);
    });
  }

  return card;
}

function drawGraphEdges(graph: DependencyGraph): void {
  if (!elGraphEdgesLayer || !elGraphCanvas || !elGraphSvgOverlay) return;
  elGraphEdgesLayer.innerHTML = '';

  // Ensure the SVG overlay spans the full canvas content (not just the viewport)
  const canvasW = Math.max(elGraphCanvas.scrollWidth, elGraphCanvas.clientWidth, elGraphCanvas.offsetWidth);
  const canvasH = Math.max(elGraphCanvas.scrollHeight, elGraphCanvas.clientHeight, elGraphCanvas.offsetHeight);
  if (canvasW === 0 || canvasH === 0) {
    requestAnimationFrame(() => drawGraphEdges(graph));
    return;
  }
  elGraphSvgOverlay.setAttribute('width', String(canvasW));
  elGraphSvgOverlay.setAttribute('height', String(canvasH));
  elGraphSvgOverlay.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);

  // 1. Batch READ phase: Read canvas and all card positions in a single layout pass
  const canvasRect = elGraphCanvas.getBoundingClientRect();
  const cardElements = new Map<number, HTMLElement>();
  elGraphCanvas.querySelectorAll<HTMLElement>('.graph-card').forEach((card) => {
    const num = parseInt(card.dataset.issueNumber || '0', 10);
    if (num > 0) cardElements.set(num, card);
  });

  const cardRects = new Map<number, DOMRect>();
  cardElements.forEach((card, num) => {
    cardRects.set(num, card.getBoundingClientRect());
  });

  // 2. Batch WRITE phase: Build SVG paths in fragment to prevent layout thrashing
  const edgeFragment = document.createDocumentFragment();

  for (const edge of graph.edges) {
    const sourceRect = cardRects.get(edge.from);
    const targetRect = cardRects.get(edge.to);
    if (!sourceRect || !targetRect) continue;

    const pathData = calculateEdgePath(sourceRect, targetRect, canvasRect);

    const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeGroup.setAttribute('class', 'graph-edge-group');
    edgeGroup.setAttribute('data-from', String(edge.from));
    edgeGroup.setAttribute('data-to', String(edge.to));

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData.d);
    path.setAttribute('data-from', String(edge.from));
    path.setAttribute('data-to', String(edge.to));

    let edgeClass = 'graph-edge';
    let markerId = 'wf-arrow-open';
    if (edge.isClosed) {
      edgeClass += ' graph-edge-closed';
      markerId = 'wf-arrow-closed';
    } else if (edge.isFrontier) {
      edgeClass += ' graph-edge-frontier';
      markerId = 'wf-arrow-frontier';
    } else if (edge.isCrossTheme) {
      edgeClass += ' graph-edge-crosstheme';
      markerId = 'wf-arrow-crosstheme';
    } else {
      edgeClass += ' graph-edge-open';
    }

    path.setAttribute('class', edgeClass);
    path.setAttribute('marker-end', `url(#${markerId})`);

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      void handleRemoveDependency(edge.to, edge.from);
    });

    const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleEl.textContent = `#${edge.from} blocks #${edge.to} (Click to remove dependency)`;
    path.appendChild(titleEl);

    edgeGroup.appendChild(path);

    // Edge midpoint hover delete badge (clickable 24px target)
    const midX = Math.round((pathData.x1 + pathData.x2) / 2);
    const midY = Math.round((pathData.y1 + pathData.y2) / 2);

    const badgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    badgeGroup.setAttribute('class', 'graph-edge-delete-badge');
    badgeGroup.setAttribute('transform', `translate(${midX}, ${midY})`);
    badgeGroup.setAttribute('data-from', String(edge.from));
    badgeGroup.setAttribute('data-to', String(edge.to));
    badgeGroup.setAttribute('role', 'button');
    badgeGroup.setAttribute('aria-label', `Remove dependency: #${edge.from} blocks #${edge.to}`);
    badgeGroup.style.cursor = 'pointer';

    // 24px clickable target (circle with r=12)
    const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hitCircle.setAttribute('r', '12');
    hitCircle.setAttribute('fill', 'transparent');
    badgeGroup.appendChild(hitCircle);

    // Visual badge circle
    const visualCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    visualCircle.setAttribute('class', 'graph-edge-delete-circle');
    visualCircle.setAttribute('r', '8');
    badgeGroup.appendChild(visualCircle);

    // Visual '×' text
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('class', 'graph-edge-delete-text');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('dominant-baseline', 'central');
    textEl.textContent = '×';
    badgeGroup.appendChild(textEl);

    const badgeTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    badgeTitle.textContent = `Remove dependency: #${edge.from} blocks #${edge.to}`;
    badgeGroup.appendChild(badgeTitle);

    badgeGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      void handleRemoveDependency(edge.to, edge.from);
    });

    edgeGroup.appendChild(badgeGroup);
    edgeFragment.appendChild(edgeGroup);
  }

  elGraphEdgesLayer.appendChild(edgeFragment);
}

function drawCurrentGraphEdges(): void {
  if (!currentGraph || !elGraphEdgesLayer || !elGraphCanvas) return;
  if (document.body.getAttribute('data-layout') !== 'graph') return;
  drawGraphEdges(currentGraph);
}

let graphResizeObserver: ResizeObserver | null = null;

function observeGraphResize(): void {
  if (elGraphCanvasContainer && 'ResizeObserver' in window) {
    if (graphResizeObserver) graphResizeObserver.disconnect();
    graphResizeObserver = new ResizeObserver(() => {
      drawCurrentGraphEdges();
    });
    graphResizeObserver.observe(elGraphCanvasContainer);
  }
}

function renderGraphView(filteredIssues: Issue[]): void {
  if (!elGraphViewContainer || !elGraphLayers) return;

  const graph = buildDependencyGraph(filteredIssues);
  currentGraph = graph;

  if (txtGraphStatFrontier) txtGraphStatFrontier.textContent = `${graph.frontierNodes.length} Ready`;
  if (txtGraphStatBlocked) {
    const blockedCount = Array.from(graph.nodes.values()).filter((n) => n.isBlocked).length;
    txtGraphStatBlocked.textContent = `${blockedCount} Blocked`;
  }
  if (txtGraphStatDone) {
    const doneCount = Array.from(graph.nodes.values()).filter((n) => n.isDone).length;
    txtGraphStatDone.textContent = `${doneCount} Done`;
  }

  if (elGraphThemePills) {
    elGraphThemePills.innerHTML = '';
    const allChip = document.createElement('div');
    allChip.className = `graph-theme-chip ${graphSelectedTheme === 'all' ? 'active' : ''}`;
    allChip.setAttribute('tabindex', '0');
    allChip.setAttribute('role', 'button');
    allChip.setAttribute('aria-label', `Filter by All Themes (${filteredIssues.length} issues)`);
    allChip.innerHTML = `<span>All Themes</span><span style="font-size: 9.5px; opacity: 0.7;">(${filteredIssues.length})</span>`;
    allChip.addEventListener('click', () => {
      graphSelectedTheme = 'all';
      renderViews();
    });
    allChip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        allChip.click();
      }
    });
    elGraphThemePills.appendChild(allChip);

    graph.themes.forEach((theme) => {
      const themeCount = graph.themeNodes.get(theme)?.length || 0;
      const chip = document.createElement('div');
      chip.className = `graph-theme-chip ${graphSelectedTheme === theme ? 'active' : ''}`;
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('role', 'button');
      chip.setAttribute('aria-label', `Filter by theme ${theme} (${themeCount} issues)`);
      const dotCol = getThemeColor(theme);
      chip.innerHTML = `
        <span class="graph-theme-dot" style="--dot-color: ${dotCol};"></span>
        <span>${escapeHtml(theme)}</span>
        <span style="font-size: 9.5px; opacity: 0.7;">(${themeCount})</span>
      `;
      chip.addEventListener('click', () => {
        graphSelectedTheme = theme;
        renderViews();
      });
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          chip.click();
        }
      });
      elGraphThemePills.appendChild(chip);
    });
  }

  const visibleNumbers = new Set<number>();
  for (const node of graph.nodes.values()) {
    if (!graphShowDone && node.isDone) continue;
    if (graphSelectedTheme !== 'all') {
      if (node.theme !== graphSelectedTheme && !node.dependents.some((d) => graph.nodes.get(d)?.theme === graphSelectedTheme)) {
        continue;
      }
    }
    visibleNumbers.add(node.issue.number);
  }

  elGraphLayers.innerHTML = '';

  if (visibleNumbers.size === 0) {
    elGraphLayers.innerHTML = `
      <div style="color: var(--fg-muted); padding: 48px 0; text-align: center; font-size: 13px;">
        No issues match the current graph filters.
      </div>
    `;
    if (elGraphEdgesLayer) elGraphEdgesLayer.innerHTML = '';
    return;
  }

  graph.layers.forEach((layerNodes, layerIdx) => {
    const layerVisible = layerNodes.filter((n) => visibleNumbers.has(n.issue.number));
    if (layerVisible.length === 0) return;

    const rowEl = document.createElement('div');
    rowEl.className = 'graph-layer-row';
    rowEl.dataset.layer = String(layerIdx);

    const headerText = layerIdx === 0
      ? 'Layer 0 — Ready / Roots'
      : `Layer ${layerIdx} — Waterfall Step ${layerIdx + 1} (${layerVisible.length})`;

    const headerEl = document.createElement('div');
    headerEl.className = 'graph-layer-header';
    headerEl.innerHTML = `
      <span class="graph-layer-header-num">L${layerIdx}</span>
      <span>${headerText}</span>
    `;
    rowEl.appendChild(headerEl);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'graph-layer-cards';

    layerVisible.forEach((node) => {
      const card = createGraphCardElement(node);
      cardsWrap.appendChild(card);
    });

    rowEl.appendChild(cardsWrap);
    elGraphLayers.appendChild(rowEl);
  });

  observeGraphResize();

  // Draw after two frames: the first lets the browser lay out the freshly
  // appended cards, the second covers late font/image reflow on slow panes.
  requestAnimationFrame(() => {
    drawCurrentGraphEdges();
    requestAnimationFrame(() => drawCurrentGraphEdges());
  });
}

function renderDrawerDependencies(issue: Issue): void {
  if (!elDrawerDependenciesContainer) return;
  const blockers = parseIssueDependencies(issue.body);
  const dependents = issues.filter((other) =>
    other.number !== issue.number && parseIssueDependencies(other.body).includes(issue.number)
  );

  if (elDrawerDepsCountBadge) {
    elDrawerDepsCountBadge.textContent = String(blockers.length + dependents.length);
  }

  if (elDrawerBlockedByList) {
    elDrawerBlockedByList.innerHTML = '';
    if (blockers.length === 0) {
      elDrawerBlockedByList.innerHTML = '<span style="color: var(--fg-faint); font-size: 11px;">None</span>';
    } else {
      blockers.forEach((bNum) => {
        const blockerIssue = issues.find((i) => i.number === bNum);
        const pill = document.createElement('div');
        pill.className = 'badge';
        pill.style.display = 'inline-flex';
        pill.style.alignItems = 'center';
        pill.style.gap = '4px';
        pill.style.cursor = 'pointer';
        const isClosed = blockerIssue ? isIssueClosed(blockerIssue) : false;
        if (isClosed) pill.style.opacity = '0.6';
        pill.innerHTML = `
          <span>#${bNum} ${escapeHtml(blockerIssue?.title || '')}</span>
          <span class="badge-remove-btn" title="Remove dependency" style="font-weight: 700; cursor: pointer; padding: 0 2px;">×</span>
        `;
        pill.addEventListener('click', (e) => {
          if ((e.target as HTMLElement)?.classList.contains('badge-remove-btn')) {
            e.stopPropagation();
            void handleRemoveDependency(issue.number, bNum);
          } else if (blockerIssue) {
            openDrawer(blockerIssue);
          }
        });
        elDrawerBlockedByList.appendChild(pill);
      });
    }
  }

  if (elDrawerBlocksList) {
    elDrawerBlocksList.innerHTML = '';
    if (dependents.length === 0) {
      elDrawerBlocksList.innerHTML = '<span style="color: var(--fg-faint); font-size: 11px;">None</span>';
    } else {
      dependents.forEach((dep) => {
        const pill = document.createElement('div');
        pill.className = 'badge';
        pill.style.cursor = 'pointer';
        const isClosed = isIssueClosed(dep);
        if (isClosed) pill.style.opacity = '0.6';
        pill.textContent = `#${dep.number} ${dep.title}`;
        pill.addEventListener('click', () => openDrawer(dep));
        elDrawerBlocksList.appendChild(pill);
      });
    }
  }

  if (elSelectAddBlocker) {
    let optionsHtml = '<option value="">+ Add blocker / dependency...</option>';
    issues
      .filter((other) => other.number !== issue.number && !blockers.includes(other.number))
      .sort((a, b) => a.number - b.number)
      .forEach((other) => {
        optionsHtml += `<option value="${other.number}">#${other.number}: ${escapeHtml(other.title)}</option>`;
      });
    elSelectAddBlocker.innerHTML = optionsHtml;
    elSelectAddBlocker.value = '';
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
  document.body.classList.add('drawer-open');
  if (document.body.getAttribute('data-layout') === 'graph') {
    requestAnimationFrame(() => drawCurrentGraphEdges());
  }
}

function closeDrawer(): void {
  activeIssue = null;
  elDrawerScrim.classList.remove('active');
  elTaskDrawer.classList.remove('active');
  document.body.classList.remove('drawer-open');
  if (document.body.getAttribute('data-layout') === 'graph') {
    requestAnimationFrame(() => drawCurrentGraphEdges());
  }
}

// ==========================================
// Markdown Renderer & Label Helpers
// ==========================================

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

  // Render open questions
  renderQuestions(issue);

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
  renderDrawerDependencies(issue);
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



function renderQuestions(issue: Issue): void {
  if (!elDrawerQuestionsContainer || !elQuestionsProgressText) return;
  const questions = issue.openQuestions || [];
  const total = questions.length;
  const resolved = questions.filter((q) => q.completed).length;
  const open = total - resolved;

  if (total === 0) {
    elQuestionsProgressText.textContent = '0 open';
    elQuestionsProgressText.style.color = 'var(--fg-muted)';
    elDrawerQuestionsContainer.innerHTML = `
      <div style="color: var(--fg-faint); font-size: 12px; padding: 4px 0;">
        No open questions. Add one below to align on specifications.
      </div>
    `;
    return;
  }

  elQuestionsProgressText.textContent = `${open} open (${resolved} resolved)`;
  elQuestionsProgressText.style.color = open > 0 ? 'var(--warn)' : 'var(--succ)';

  elDrawerQuestionsContainer.innerHTML = '';
  let unresolvedIdx = 0;
  questions.forEach((question) => {
    const itemEl = document.createElement('div');
    itemEl.className = `check-item ${question.completed ? 'done' : ''}`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = question.completed;
    cb.title = question.completed ? 'Mark question as open' : 'Mark question as resolved/answered';

    cb.addEventListener('change', () => {
      const updatedBody = updateOpenQuestionInMarkdown(issue.body, question.lineIndex, cb.checked);
      void updateIssueBody(issue, updatedBody);
    });

    const contentEl = document.createElement('div');
    contentEl.style.flex = '1';
    contentEl.style.minWidth = '0';

    const textRow = document.createElement('div');
    textRow.style.display = 'flex';
    textRow.style.alignItems = 'flex-start';
    textRow.style.justifyContent = 'space-between';
    textRow.style.gap = '8px';

    const span = document.createElement('span');
    span.textContent = question.text;
    span.style.flex = '1';
    span.style.wordBreak = 'break-word';
    textRow.appendChild(span);

    if (!question.completed) {
      const idx = unresolvedIdx;
      unresolvedIdx++;

      const btnAnswer = document.createElement('button');
      btnAnswer.className = 'btn btn-xs btn-inline-answer';
      btnAnswer.setAttribute('data-question-index', String(idx));
      btnAnswer.title = 'Record decision or answer';
      btnAnswer.textContent = 'Answer';
      textRow.appendChild(btnAnswer);

      btnAnswer.addEventListener('click', (e) => {
        e.stopPropagation();
        let answerRow = contentEl.querySelector<HTMLDivElement>('.inline-answer-row');
        if (answerRow) {
          const isVisible = answerRow.style.display !== 'none';
          answerRow.style.display = isVisible ? 'none' : 'flex';
          if (!isVisible) {
            answerRow.querySelector<HTMLInputElement>('.input-inline-answer')?.focus();
          }
          return;
        }

        answerRow = document.createElement('div');
        answerRow.className = 'inline-answer-row';
        answerRow.style.display = 'flex';
        answerRow.style.gap = '6px';
        answerRow.style.marginTop = '4px';
        answerRow.innerHTML = `<input type="text" class="form-ctrl input-inline-answer" placeholder="Type answer or decision..." style="font-size: 11px; height: 24px; flex: 1;" /><button class="btn btn-xs btn-primary btn-submit-inline-answer">Save</button><button class="btn btn-xs btn-cancel-inline-answer">Cancel</button>`;
        contentEl.appendChild(answerRow);

        const input = answerRow.querySelector<HTMLInputElement>('.input-inline-answer');
        const btnSave = answerRow.querySelector<HTMLButtonElement>('.btn-submit-inline-answer');
        const btnCancel = answerRow.querySelector<HTMLButtonElement>('.btn-cancel-inline-answer');

        const submitAnswer = async () => {
          const answerText = input?.value.trim();
          if (!answerText) {
            input?.focus();
            return;
          }
          const targetIssue = activeIssue || issue;
          if (!targetIssue) return;
          const newBody = answerOpenQuestionInMarkdown(targetIssue.body, idx, answerText);
          if (issue && issue !== targetIssue) {
            issue.body = newBody;
            issue.subtasks = parseSubtasks(newBody);
            issue.openQuestions = parseOpenQuestions(newBody);
          }
          await updateIssueBody(targetIssue, newBody);
          await host.toast({ kind: 'info', message: 'Recorded answer to question' });
          if (activeIssue && activeIssue.number === targetIssue.number) {
            renderDrawer(targetIssue);
          }
        };

        btnSave?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          void submitAnswer();
        });

        btnCancel?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (answerRow) answerRow.style.display = 'none';
          btnAnswer.focus();
        });

        input?.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.stopPropagation();
            void submitAnswer();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            if (answerRow) answerRow.style.display = 'none';
            btnAnswer.focus();
          }
        });

        input?.focus();
      });
    }

    contentEl.appendChild(textRow);
    itemEl.appendChild(cb);
    itemEl.appendChild(contentEl);
    elDrawerQuestionsContainer.appendChild(itemEl);
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
    const isAlreadyBlocker = parseIssueDependencies(issue.body).includes(other.number);
    const linkBtnHtml = isAlreadyBlocker
      ? '<span class="status-pill" style="font-size: 9px; color: var(--fg-muted);">Blocker</span>'
      : `<button class="btn btn-sm btn-link-blocker" data-other-num="${other.number}" style="font-size: 9.5px; height: 18px; padding: 0 5px;" title="Link #${other.number} as a blocker of #${issue.number}">+ Link Blocker</button>`;

    item.innerHTML = `
      <div class="related-issue-title" title="${escapeHtml(other.title)}">#${other.number} ${escapeHtml(other.title)}</div>
      <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
        ${compHtml}
        <span class="status-pill" style="font-size: 10px;">${resolveIssueColumn(other) || 'all'}</span>
        ${linkBtnHtml}
      </div>
    `;
    item.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.btn-link-blocker');
      if (btn) {
        e.stopPropagation();
        void handleAddDependency(issue.number, other.number);
        return;
      }
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
      url: selected[0]?.html_url || (currentRepo ? `https://github.com/${currentRepo}/issues` : ''),
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

  try {
    const payload = selected.length === 1
      ? buildIssueAttachPayload(selected[0])
      : buildMultiIssueAttachPayload(selected, currentRepo);
    await host.attach(payload);

    if (selected.length > 1 && typeof host.compose === 'function') {
      try {
        await host.compose({ text: `Focusing on issues: ${selected.map((i) => `#${i.number}`).join(', ')}` });
      } catch {}
    }

    clearSelection();
    await host.toast({
      kind: 'success',
      message: selected.length === 1
        ? `Attached issue #${selected[0].number} to composer`
        : `Attached ${selected.length} issues in consolidated chip to composer`,
    });
  } catch (err: any) {
    addLog(`Failed to attach selected issues: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to attach: ${err?.message || 'Unknown error'}` });
  }
}

// ==========================================
// AI Issue Drafting Prompt Store & Logic
// ==========================================











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
const elAiPromptConfigPanel = document.getElementById('aiPromptConfigPanel') as HTMLDivElement;
const elRadioScopeRepo = document.getElementById('radioScopeRepo') as HTMLInputElement;
const elRadioScopeGlobal = document.getElementById('radioScopeGlobal') as HTMLInputElement;
const elAiPromptTemplateTextarea = document.getElementById('aiPromptTemplateTextarea') as HTMLTextAreaElement;
const elAiAlignmentPromptTextarea = document.getElementById('aiAlignmentPromptTextarea') as HTMLTextAreaElement | null;
const elBtnResetPromptToDefault = document.getElementById('btnResetPromptToDefault') as HTMLButtonElement;
const elBtnSavePromptConfig = document.getElementById('btnSavePromptConfig') as HTMLButtonElement;
const elBtnNewIssueAICancel = document.getElementById('btnNewIssueAICancel') as HTMLButtonElement;
const elBtnLaunchAISession = document.getElementById('btnLaunchAISession') as HTMLButtonElement;
const elBtnImportFromScratchpad = document.getElementById('btnImportFromScratchpad') as HTMLButtonElement | null;

// Scratch Pad Elements
const elBtnOpenScratchpad = document.getElementById('btnOpenScratchpad') as HTMLButtonElement | null;
const elScratchpadModalBackdrop = document.getElementById('scratchpadModalBackdrop') as HTMLDivElement | null;
const elScratchpadRepoBadge = document.getElementById('scratchpadRepoBadge') as HTMLSpanElement | null;
const elScratchpadSaveIndicator = document.getElementById('scratchpadSaveIndicator') as HTMLSpanElement | null;
const elBtnScratchpadClose = document.getElementById('btnScratchpadClose') as HTMLButtonElement | null;
const elBtnScratchpadAddTheme = document.getElementById('btnScratchpadAddTheme') as HTMLButtonElement | null;
const elBtnScratchpadAddFeature = document.getElementById('btnScratchpadAddFeature') as HTMLButtonElement | null;
const elBtnScratchpadAddBug = document.getElementById('btnScratchpadAddBug') as HTMLButtonElement | null;
const elBtnScratchpadAddQuestion = document.getElementById('btnScratchpadAddQuestion') as HTMLButtonElement | null;
const elScratchpadStatsBadge = document.getElementById('scratchpadStatsBadge') as HTMLSpanElement | null;
const elScratchpadTextarea = document.getElementById('scratchpadTextarea') as HTMLTextAreaElement | null;
const elBtnScratchpadClear = document.getElementById('btnScratchpadClear') as HTMLButtonElement | null;
const elBtnScratchpadCopyToCreator = document.getElementById('btnScratchpadCopyToCreator') as HTMLButtonElement | null;
const elBtnScratchpadDirectDraft = document.getElementById('btnScratchpadDirectDraft') as HTMLButtonElement | null;
const elBtnScratchpadAlignAI = document.getElementById('btnScratchpadAlignAI') as HTMLButtonElement | null;

// Scratch Pad Theme Picker Elements
const elScratchpadThemePopover = document.getElementById('scratchpadThemePopover') as HTMLDivElement | null;
const elScratchpadThemeSearch = document.getElementById('scratchpadThemeSearch') as HTMLInputElement | null;
const elBtnScratchpadThemeClose = document.getElementById('btnScratchpadThemeClose') as HTMLButtonElement | null;
const elScratchpadThemeList = document.getElementById('scratchpadThemeList') as HTMLDivElement | null;
const elScratchpadThemeEmpty = document.getElementById('scratchpadThemeEmpty') as HTMLDivElement | null;
const elBtnScratchpadThemeAdd = document.getElementById('btnScratchpadThemeAdd') as HTMLButtonElement | null;

// Toolbar More Menu Elements
const elBtnMoreMenu = document.getElementById('btnMoreMenu') as HTMLButtonElement | null;
const elMoreMenuPopover = document.getElementById('moreMenuPopover') as HTMLDivElement | null;
const elMenuItemToggleArchive = document.getElementById('menuItemToggleArchive') as HTMLDivElement | null;
const elMenuItemRefresh = document.getElementById('menuItemRefresh') as HTMLDivElement | null;
const elMenuItemLogs = document.getElementById('menuItemLogs') as HTMLDivElement | null;

// Manual Mode elements
const elNewIssueTitleInput = document.getElementById('newIssueTitleInput') as HTMLInputElement;
const elNewIssueComplexitySelect = document.getElementById('newIssueComplexitySelect') as HTMLSelectElement | null;
const elNewIssueBodyInput = document.getElementById('newIssueBodyInput') as HTMLTextAreaElement;
const elNewIssueSubtasksList = document.getElementById('newIssueSubtasksList') as HTMLDivElement | null;
const elInputNewIssueDraftSubtask = document.getElementById('inputNewIssueDraftSubtask') as HTMLInputElement | null;
const elBtnAddNewIssueDraftSubtask = document.getElementById('btnAddNewIssueDraftSubtask') as HTMLButtonElement | null;
const elDraftSubtasksCountBadge = document.getElementById('draftSubtasksCountBadge') as HTMLSpanElement | null;
const elNewIssueQuestionsList = document.getElementById('newIssueQuestionsList') as HTMLDivElement | null;
const elInputNewIssueDraftQuestion = document.getElementById('inputNewIssueDraftQuestion') as HTMLInputElement | null;
const elBtnAddNewIssueDraftQuestion = document.getElementById('btnAddNewIssueDraftQuestion') as HTMLButtonElement | null;
const elDraftQuestionsCountBadge = document.getElementById('draftQuestionsCountBadge') as HTMLSpanElement | null;
const elBtnNewIssueSubmit = document.getElementById('btnNewIssueSubmit') as HTMLButtonElement;
const elBtnNewIssueCancel = document.getElementById('btnNewIssueCancel') as HTMLButtonElement;
const elBtnNewIssueClose = document.getElementById('btnNewIssueClose') as HTMLButtonElement;

let draftSubtasks: string[] = [];
let draftQuestions: string[] = [];

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

async function loadPromptConfigForEditor(): Promise<void> {
  const isRepoScope = elRadioScopeRepo.checked;
  if (isRepoScope) {
    const storedDraft = await host.storage.get(`ai_issue_prompt_${currentRepo}`);
    const storedAlign = await host.storage.get(`ai_alignment_prompt_${currentRepo}`);
    elAiPromptTemplateTextarea.value = typeof storedDraft === 'string' ? storedDraft : DEFAULT_AI_ISSUE_PROMPT;
    if (elAiAlignmentPromptTextarea) {
      elAiAlignmentPromptTextarea.value = typeof storedAlign === 'string' ? storedAlign : DEFAULT_AI_ALIGNMENT_PROMPT;
    }
  } else {
    const storedDraft = await host.storage.get('ai_issue_prompt_global');
    const storedAlign = await host.storage.get('ai_alignment_prompt_global');
    elAiPromptTemplateTextarea.value = typeof storedDraft === 'string' ? storedDraft : DEFAULT_AI_ISSUE_PROMPT;
    if (elAiAlignmentPromptTextarea) {
      elAiAlignmentPromptTextarea.value = typeof storedAlign === 'string' ? storedAlign : DEFAULT_AI_ALIGNMENT_PROMPT;
    }
  }
}

async function savePromptConfig(): Promise<void> {
  const isRepoScope = elRadioScopeRepo.checked;
  const draftText = elAiPromptTemplateTextarea.value.trim();
  const alignText = elAiAlignmentPromptTextarea?.value.trim() || '';
  if (!draftText) return;

  try {
    if (isRepoScope) {
      await host.storage.set(`ai_issue_prompt_${currentRepo}`, draftText);
      if (alignText) {
        await host.storage.set(`ai_alignment_prompt_${currentRepo}`, alignText);
      } else {
        await host.storage.delete(`ai_alignment_prompt_${currentRepo}`);
      }
      addLog(`Saved prompt settings for repo ${currentRepo}`, 'succ');
      await host.toast({ kind: 'success', message: 'Saved settings for this repository' });
    } else {
      await host.storage.set('ai_issue_prompt_global', draftText);
      if (alignText) {
        await host.storage.set('ai_alignment_prompt_global', alignText);
      } else {
        await host.storage.delete('ai_alignment_prompt_global');
      }
      addLog('Saved global prompt settings', 'succ');
      await host.toast({ kind: 'success', message: 'Saved global settings' });
    }
    elAiPromptConfigPanel.style.display = 'none';
  } catch (err: any) {
    addLog(`Failed to save prompt config: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: 'Failed to save settings' });
  }
}

async function resetPromptConfigToDefault(): Promise<void> {
  elAiPromptTemplateTextarea.value = DEFAULT_AI_ISSUE_PROMPT;
  if (elAiAlignmentPromptTextarea) elAiAlignmentPromptTextarea.value = DEFAULT_AI_ALIGNMENT_PROMPT;
  const isRepoScope = elRadioScopeRepo.checked;
  try {
    if (isRepoScope) {
      await host.storage.delete(`ai_issue_prompt_${currentRepo}`);
      await host.storage.delete(`ai_alignment_prompt_${currentRepo}`);
    } else {
      await host.storage.delete('ai_issue_prompt_global');
      await host.storage.delete('ai_alignment_prompt_global');
    }
    await host.toast({ kind: 'info', message: 'Reset prompts to default' });
  } catch {}
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

function renderDraftQuestions(): void {
  if (!elNewIssueQuestionsList) return;
  elNewIssueQuestionsList.innerHTML = '';
  if (elDraftQuestionsCountBadge) {
    elDraftQuestionsCountBadge.textContent = `${draftQuestions.length} open`;
  }

  if (draftQuestions.length === 0) {
    elNewIssueQuestionsList.innerHTML = `<div style="color: var(--fg-faint); font-size: 11px; padding: 2px 0;">No open questions added yet.</div>`;
    return;
  }

  draftQuestions.forEach((question, idx) => {
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
        <span style="color: var(--fg-muted); font-size: 10px; font-family: var(--font-mono);">Q${idx + 1}.</span>
        <span style="color: var(--fg);">${escapeHtml(question)}</span>
      </div>
      <button class="btn btn-icon btn-sm btn-del-draft-question" type="button" style="width: 18px; height: 18px; font-size: 11px; padding: 0;" title="Remove question">✕</button>
    `;

    const btnDel = row.querySelector('.btn-del-draft-question') as HTMLButtonElement | null;
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        draftQuestions.splice(idx, 1);
        renderDraftQuestions();
      });
    }

    elNewIssueQuestionsList.appendChild(row);
  });
}

// ==========================================
// Scratch Pad Logic & AI Alignment
// ==========================================

let scratchpadSaveTimer: any = null;

function getScratchpadStorageKey(): string {
  return currentRepo ? `scratchpad_${currentRepo}` : 'scratchpad_global';
}

function getScratchpadLocalKey(): string {
  return `openchamber_scratchpad_${currentRepo || 'global'}`;
}

export async function loadScratchpadContent(): Promise<string> {
  const storageKey = getScratchpadStorageKey();
  let text = '';
  try {
    const stored = await host.storage.get(storageKey);
    if (typeof stored === 'string') {
      text = stored;
    }
  } catch {}
  if (!text) {
    try {
      text = localStorage.getItem(getScratchpadLocalKey()) || '';
    } catch {}
  }
  if (elScratchpadTextarea) {
    elScratchpadTextarea.value = text;
  }
  updateScratchpadStats(text);
  setScratchpadSaveStatus('Saved');
  return text;
}

function setScratchpadSaveStatus(status: 'Saved' | 'Saving...'): void {
  if (!elScratchpadSaveIndicator) return;
  if (status === 'Saving...') {
    elScratchpadSaveIndicator.style.color = 'var(--fg-muted)';
    elScratchpadSaveIndicator.innerHTML = `<span>Saving...</span>`;
  } else {
    elScratchpadSaveIndicator.style.color = 'var(--succ)';
    elScratchpadSaveIndicator.innerHTML = `
      <svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 11px; height: 11px; fill: currentColor;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      <span>Saved</span>
    `;
  }
}

function updateScratchpadStats(text: string): void {
  if (!elScratchpadStatsBadge) return;
  const { themes, totalIdeas, totalQuestions } = parseScratchPadThemes(text);
  const themeWord = themes.length === 1 ? 'theme' : 'themes';
  const ideaWord = totalIdeas === 1 ? 'idea' : 'ideas';
  let stats = `${themes.length} ${themeWord}, ${totalIdeas} ${ideaWord}`;
  if (totalQuestions > 0) {
    const qWord = totalQuestions === 1 ? 'question' : 'questions';
    stats += `, ${totalQuestions} ${qWord}`;
  }
  elScratchpadStatsBadge.textContent = stats;
}

function flushScratchpadSave(): void {
  if (scratchpadSaveTimer !== null) {
    clearTimeout(scratchpadSaveTimer);
    scratchpadSaveTimer = null;
  }
  const text = elScratchpadTextarea?.value ?? '';
  updateScratchpadStats(text);
  try {
    localStorage.setItem(getScratchpadLocalKey(), text);
  } catch {}
  setScratchpadSaveStatus('Saved');
  void host.storage
    .set(getScratchpadStorageKey(), text)
    .then(() => setScratchpadSaveStatus('Saved'))
    .catch(() => setScratchpadSaveStatus('Saved'));
}

function handleScratchpadInput(): void {
  if (!elScratchpadTextarea) return;
  // Show the pending state at once, but batch the re-parse and both writes so a
  // fast typist does not trigger a stats recompute and a storage round-trip per keystroke.
  setScratchpadSaveStatus('Saving...');
  clearTimeout(scratchpadSaveTimer);
  scratchpadSaveTimer = setTimeout(() => {
    flushScratchpadSave();
  }, 1000);
}

function insertIntoScratchpad(snippet: string): void {
  if (!elScratchpadTextarea) return;
  const ta = elScratchpadTextarea;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  ta.value = `${before}${prefix}${snippet}${after}`;
  ta.selectionStart = ta.selectionEnd = start + prefix.length + snippet.length;
  ta.focus();
  handleScratchpadInput();
}

function insertScratchpadTheme(themeName: string): void {
  const clean = themeName.trim();
  if (!clean) return;
  insertIntoScratchpad(`## [Theme: ${clean}]\n- [ ] `);
  if (elScratchpadThemePopover) elScratchpadThemePopover.style.display = 'none';
}

function renderScratchpadThemeList(query: string): void {
  if (!elScratchpadThemeList) return;
  const themes = extractTaskThemes(issues);
  const q = (query || '').trim().toLowerCase();
  const filtered = q
    ? themes.filter((t) => t.theme.toLowerCase().includes(q))
    : themes;

  elScratchpadThemeList.innerHTML = '';

  if (filtered.length === 0) {
    if (elScratchpadThemeEmpty) {
      elScratchpadThemeEmpty.style.display = 'block';
      elScratchpadThemeEmpty.textContent = themes.length === 0
        ? 'No existing themes found in tasks. Type a name below to create one.'
        : 'No themes match your search. Press Enter or click Add to create it.';
    }
  } else if (elScratchpadThemeEmpty) {
    elScratchpadThemeEmpty.style.display = 'none';
  }

  filtered.forEach(({ theme, count }) => {
    const row = document.createElement('div');
    row.className = 'theme-option-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '4px 8px';
    row.style.background = 'var(--surf)';
    row.style.border = '1px solid var(--border-subtle)';
    row.style.borderRadius = 'var(--rad-sm)';
    row.style.cursor = 'pointer';
    row.style.fontSize = '11.5px';
    row.style.gap = '8px';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `Insert theme ${theme} (${count} ${count === 1 ? 'task' : 'tasks'})`);
    row.innerHTML = `
      <span style="color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(theme)}</span>
      <span style="color: var(--fg-muted); font-size: 10px; font-family: var(--font-mono); flex-shrink: 0;">${count} ${count === 1 ? 'task' : 'tasks'}</span>
    `;
    row.addEventListener('mouseenter', () => {
      row.style.background = 'var(--surf-hover)';
      row.style.borderColor = 'var(--border)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = 'var(--surf)';
      row.style.borderColor = 'var(--border-subtle)';
    });
    row.addEventListener('click', () => insertScratchpadTheme(theme));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        insertScratchpadTheme(theme);
      }
    });
    elScratchpadThemeList.appendChild(row);
  });
}

async function openScratchpadModal(): Promise<void> {
  if (elScratchpadRepoBadge) {
    elScratchpadRepoBadge.textContent = currentRepo || 'Global';
  }
  await loadScratchpadContent();
  if (elScratchpadModalBackdrop) {
    elScratchpadModalBackdrop.classList.add('active');
  }
  if (elScratchpadTextarea) {
    setTimeout(() => elScratchpadTextarea?.focus(), 50);
  }
}

function closeScratchpadModal(): void {
  flushScratchpadSave();
  if (elScratchpadModalBackdrop) {
    elScratchpadModalBackdrop.classList.remove('active');
  }
  if (elScratchpadThemePopover) {
    elScratchpadThemePopover.style.display = 'none';
  }
  elBtnScratchpadAddTheme?.setAttribute('aria-expanded', 'false');
}

async function launchScratchpadAlignmentSession(): Promise<void> {
  const text = elScratchpadTextarea?.value.trim() || '';
  if (!text) {
    if (elScratchpadTextarea) elScratchpadTextarea.focus();
    await host.toast({ kind: 'info', message: 'Add some ideas to the scratch pad first' });
    return;
  }
  if (!currentRepo) {
    openRepoPopover();
    return;
  }

  const storedRepoPrompt = await host.storage.get(`ai_alignment_prompt_${currentRepo}`);
  const storedGlobalPrompt = await host.storage.get('ai_alignment_prompt_global');
  const promptText = resolveAiAlignmentPrompt({
    repo: currentRepo,
    userInput: text,
    storedPrompt: typeof storedRepoPrompt === 'string' ? storedRepoPrompt : (typeof storedGlobalPrompt === 'string' ? storedGlobalPrompt : null),
  });

  const firstLine = text.split('\n')[0].replace(/[^a-zA-Z0-9\s-_]/g, '').trim().slice(0, 45);
  try {
    addLog(`Launching AI alignment & clarification session for scratch pad...`);
    const res = await host.startSession({
      projectId: currentProject?.id,
      worktree: false,
      navigation: 'open',
      providerId: 'github-task-board',
      id: `align-${Date.now()}`,
      title: `Align: ${firstLine || 'Ideas & Themes'}`,
      url: `https://github.com/${currentRepo}/issues`,
      text: promptText,
      data: {
        alignment: true,
        repo: currentRepo,
      },
    });
    closeScratchpadModal();
    await host.toast({ kind: 'success', message: 'Launched interactive AI alignment session' });
    if (res.sessionId) {
      void host.openSession(res.sessionId);
    }
  } catch (err: any) {
    addLog(`Failed to start alignment session: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to start session: ${err?.message || 'Unknown error'}` });
  }
}

async function launchScratchpadDirectSession(): Promise<void> {
  const text = elScratchpadTextarea?.value.trim() || '';
  if (!text) {
    if (elScratchpadTextarea) elScratchpadTextarea.focus();
    await host.toast({ kind: 'info', message: 'Add some ideas to the scratch pad first' });
    return;
  }
  if (!currentRepo) {
    openRepoPopover();
    return;
  }

  const storedRepoPrompt = await host.storage.get(`ai_issue_prompt_${currentRepo}`);
  const storedGlobalPrompt = await host.storage.get('ai_issue_prompt_global');
  const promptText = resolveAiIssuePrompt({
    repo: currentRepo,
    userInput: text,
    storedRepoPrompt: typeof storedRepoPrompt === 'string' ? storedRepoPrompt : null,
    storedGlobalPrompt: typeof storedGlobalPrompt === 'string' ? storedGlobalPrompt : null,
  });

  const firstLine = text.split('\n')[0].replace(/[^a-zA-Z0-9\s-_]/g, '').trim().slice(0, 45);
  try {
    addLog(`Launching AI issue drafting session directly from scratch pad...`);
    const res = await host.startSession({
      projectId: currentProject?.id,
      worktree: false,
      navigation: 'open',
      providerId: 'github-task-board',
      id: `draft-${Date.now()}`,
      title: `Draft: ${firstLine || 'GitHub Issues'}`,
      url: `https://github.com/${currentRepo}/issues`,
      text: promptText,
      data: {
        drafting: true,
        repo: currentRepo,
      },
    });
    closeScratchpadModal();
    await host.toast({ kind: 'success', message: 'Launched AI drafting session' });
    if (res.sessionId) {
      void host.openSession(res.sessionId);
    }
  } catch (err: any) {
    addLog(`Failed to start AI session: ${err.message}`, 'error');
    await host.toast({ kind: 'error', message: `Failed to start session: ${err?.message || 'Unknown error'}` });
  }
}

async function loadDraftAiInput(): Promise<void> {
  const key = currentRepo ? `ai_draft_input_${currentRepo}` : 'ai_draft_input_global';
  let val = '';
  try {
    const stored = await host.storage.get(key);
    if (typeof stored === 'string') val = stored;
  } catch {}
  if (!val) {
    try {
      val = localStorage.getItem(`openchamber_ai_draft_${currentRepo || 'global'}`) || '';
    } catch {}
  }
  if (elAiIssueInput && val) {
    elAiIssueInput.value = val;
  }
}

let draftSaveTimer: any = null;
function saveDraftAiInput(text: string): void {
  const key = currentRepo ? `ai_draft_input_${currentRepo}` : 'ai_draft_input_global';
  const localKey = `openchamber_ai_draft_${currentRepo || 'global'}`;
  try {
    if (text) localStorage.setItem(localKey, text);
    else localStorage.removeItem(localKey);
  } catch {}
  clearTimeout(draftSaveTimer);
  if (!text) {
    // Clearing must be immediate so a relaunch cannot resurrect a stale draft.
    void host.storage.delete(key).catch(() => {});
    return;
  }
  draftSaveTimer = setTimeout(() => {
    void host.storage.set(key, text).catch(() => {});
  }, 300);
}

async function openNewIssueModal(): Promise<void> {
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
  draftQuestions = [];
  renderDraftQuestions();
  if (elInputNewIssueDraftQuestion) elInputNewIssueDraftQuestion.value = '';
  // Await the persisted draft BEFORE callers may prefill the textarea, so a
  // late-resolving load cannot clobber a value they just set.
  await loadDraftAiInput();
  elAiPromptConfigPanel.style.display = 'none';

  setNewIssueMode('ai'); // AI Assisted is the first and default!
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
  const body = serializeDraftQuestions(serializeDraftSubtasks(rawBody, draftSubtasks), draftQuestions);
  const initialLabels = ['status:todo'];
  const complexity = elNewIssueComplexitySelect ? elNewIssueComplexitySelect.value : 'none';
  if (complexity && complexity !== 'none') {
    initialLabels.push(`complexity:${complexity.toUpperCase()}`);
  }

  // Alignment reflex: auto-flag vague idea if description is sparse and there are no subtasks,
  // or if any open question is still unresolved.
  const draftOpenQuestions = draftQuestions.map((q) => ({ text: q, completed: false }));
  if (isVagueIdea({ title, body, subtasks: draftSubtasks.map((t) => ({ text: t })), openQuestions: draftOpenQuestions, labels: [] })) {
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

  const firstLine = userInput.split('\n')[0].replace(/[^a-zA-Z0-9\s-_]/g, '').trim().slice(0, 50);

  elBtnLaunchAISession.disabled = true;
  elBtnLaunchAISession.textContent = 'Starting AI Session...';

  try {
    addLog('Launching AI issue drafting session...');
    const res = await host.startSession({
      projectId: currentProject?.id,
      worktree: false, // Issue drafting is administrative; no worktree churn
      navigation: 'open',
      providerId: 'github-task-board',
      id: `draft-${Date.now()}`,
      title: `Draft: ${firstLine || 'GitHub Issues'}`,
      url: `https://github.com/${currentRepo}/issues`,
      text: promptText,
      data: {
        drafting: true,
        repo: currentRepo,
      },
    });

    closeNewIssueModal();
    saveDraftAiInput('');
    if (elAiIssueInput) elAiIssueInput.value = '';
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

export { setupCustomDropdown, initAllCustomDropdowns };


// ==========================================
// Event Wiring & Bootstrapping
// ==========================================

function initEvents(): void {
  // Initialize custom styled dropdowns replacing cut-off HTML selects
  initAllCustomDropdowns();

  // Load persisted collapsed group state
  if (host?.storage) {
    void host.storage.get('collapsed_groups').then((stored: any) => {
      if (Array.isArray(stored)) {
        stored.forEach((k: string) => collapsedGroupKeys.add(k));
        renderViews();
      }
    });
  }

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

  // Search input (debounced by 150ms for responsive typing across hundreds of issues)
  let searchDebounceTimer: any = null;
  elSearchInput.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderViews();
    }, 150);
  });
  elSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchDebounceTimer);
      renderViews();
    }
  });

  // 3-Way View Switcher (List / Board / Graph)
  elBtnViewList?.addEventListener('click', () => {
    userLayoutPreference = 'list';
    applyLayoutMode();
  });
  elBtnViewKanban?.addEventListener('click', () => {
    userLayoutPreference = 'kanban';
    applyLayoutMode();
  });
  elBtnViewGraph?.addEventListener('click', () => {
    userLayoutPreference = 'graph';
    applyLayoutMode();
  });

  // More menu direct view items
  document.getElementById('menuItemViewList')?.addEventListener('click', () => {
    userLayoutPreference = 'list';
    applyLayoutMode();
    closeMoreMenu();
  });
  document.getElementById('menuItemViewBoard')?.addEventListener('click', () => {
    userLayoutPreference = 'kanban';
    applyLayoutMode();
    closeMoreMenu();
  });
  document.getElementById('menuItemViewGraph')?.addEventListener('click', () => {
    userLayoutPreference = 'graph';
    applyLayoutMode();
    closeMoreMenu();
  });

  if (elBtnLayoutToggle) {
    elBtnLayoutToggle.addEventListener('click', () => {
      const cur = document.body.getAttribute('data-layout');
      userLayoutPreference = cur === 'kanban' ? 'graph' : cur === 'graph' ? 'list' : 'kanban';
      applyLayoutMode();
      if (host?.toast) {
        const name = userLayoutPreference === 'kanban' ? 'Board' : userLayoutPreference === 'graph' ? 'Graph' : 'List';
        void host.toast({ kind: 'info', message: `Switched to ${name} view` });
      }
    });
  }

  if (elBtnGraphToggle) {
    elBtnGraphToggle.addEventListener('click', () => {
      userLayoutPreference = document.body.getAttribute('data-layout') === 'graph' ? (isWideScreen ? 'kanban' : 'list') : 'graph';
      applyLayoutMode();
    });
  }

  if (elMenuItemToggleGraph) {
    elMenuItemToggleGraph.addEventListener('click', () => {
      userLayoutPreference = 'graph';
      applyLayoutMode();
      closeMoreMenu();
    });
  }

  if (elChkGraphShowDone) {
    elChkGraphShowDone.addEventListener('change', () => {
      graphShowDone = elChkGraphShowDone.checked;
      renderViews();
    });
  }

  if (elSelectAddBlocker) {
    elSelectAddBlocker.addEventListener('change', () => {
      const val = parseInt(elSelectAddBlocker.value, 10);
      if (val > 0 && activeIssue) {
        void handleAddDependency(activeIssue.number, val);
      }
    });
  }

  // Window resize handler for responsive view adaptivity
  window.addEventListener('resize', () => {
    if (userLayoutPreference === 'auto') {
      applyLayoutMode();
    }
  });

  // Refresh
  const refreshTasks = () => {
    void fetchIssues();
    void discoverWorkspaceRepositories();
  };
  elBtnRefresh.addEventListener('click', refreshTasks);

  // Archive Toggle
  const elBtnArchiveToggle = document.getElementById('btnArchiveToggle') as HTMLButtonElement | null;
  const toggleArchiveView = () => {
    showArchivedOnly = !showArchivedOnly;
    elBtnArchiveToggle?.classList.toggle('active', showArchivedOnly);
    if (elBtnArchiveToggle) {
      elBtnArchiveToggle.title = showArchivedOnly
        ? 'Viewing Archived (Click to show active issues)'
        : 'Toggle Archived Issues View';
    }
    renderViews();
    void host.toast({
      kind: 'info',
      message: showArchivedOnly ? 'Viewing archived issues' : 'Viewing active issues',
    });
  };
  if (elBtnArchiveToggle) {
    elBtnArchiveToggle.addEventListener('click', toggleArchiveView);
  }

  // Toolbar More Menu (used when sidebar is too narrow for all buttons)
  const setMoreMenuOpen = (open: boolean) => {
    if (!elMoreMenuPopover) return;
    elMoreMenuPopover.style.display = open ? 'flex' : 'none';
    elBtnMoreMenu?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      const first = elMoreMenuPopover.querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    } else {
      elBtnMoreMenu?.focus();
    }
  };
  const closeMoreMenu = () => setMoreMenuOpen(false);
  if (elBtnMoreMenu && elMoreMenuPopover) {
    elBtnMoreMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      setMoreMenuOpen(elMoreMenuPopover.style.display === 'none');
    });
    document.addEventListener('click', (e) => {
      if (
        elMoreMenuPopover.style.display !== 'none' &&
        !elMoreMenuPopover.contains(e.target as Node) &&
        !elBtnMoreMenu.contains(e.target as Node)
      ) {
        closeMoreMenu();
      }
    });
    elMoreMenuPopover.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMoreMenu();
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = (e.target as HTMLElement).closest('[role="menuitem"]') as HTMLElement | null;
      if (item && item.querySelector('.popover-item-title')) {
        e.preventDefault();
        item.click();
      }
    });
  }
  if (elMenuItemToggleArchive) {
    elMenuItemToggleArchive.addEventListener('click', () => {
      toggleArchiveView();
      closeMoreMenu();
    });
  }
  if (elMenuItemRefresh) {
    elMenuItemRefresh.addEventListener('click', () => {
      refreshTasks();
      closeMoreMenu();
    });
  }
  if (elMenuItemLogs) {
    elMenuItemLogs.addEventListener('click', () => {
      elLogDrawer.classList.toggle('active');
      closeMoreMenu();
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
      currentGroupBy = 'theme';
      if (elSelectSort) elSelectSort.value = 'newest';
      if (elSelectGroupBy) elSelectGroupBy.value = 'theme';
      if (elSelectFilterPriority) elSelectFilterPriority.value = 'all';
      if (elSelectFilterTag) elSelectFilterTag.value = 'all';
      renderViews();
    });
  }

  // New Issue Modal & Mode Tabs
  elBtnNewIssue.addEventListener('click', () => {
    void openNewIssueModal();
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

  // Scratch Pad Event Wiring
  if (elBtnOpenScratchpad) {
    elBtnOpenScratchpad.addEventListener('click', () => {
      void openScratchpadModal();
    });
  }
  if (elBtnScratchpadClose) {
    elBtnScratchpadClose.addEventListener('click', closeScratchpadModal);
  }
  if (elScratchpadModalBackdrop) {
    elScratchpadModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elScratchpadModalBackdrop) closeScratchpadModal();
    });
  }
  if (elScratchpadTextarea) {
    elScratchpadTextarea.addEventListener('input', handleScratchpadInput);
    elScratchpadTextarea.addEventListener('blur', flushScratchpadSave);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushScratchpadSave();
    }
  });
  if (elBtnScratchpadAddTheme) {
    const setThemePickerOpen = (open: boolean) => {
      if (!elScratchpadThemePopover) return;
      elScratchpadThemePopover.style.display = open ? 'flex' : 'none';
      elBtnScratchpadAddTheme?.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    elBtnScratchpadAddTheme.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!elScratchpadThemePopover) return;
      if (elScratchpadThemePopover.style.display === 'none') {
        setThemePickerOpen(true);
        if (elScratchpadThemeSearch) elScratchpadThemeSearch.value = '';
        renderScratchpadThemeList('');
        elScratchpadThemeSearch?.focus();
      } else {
        setThemePickerOpen(false);
      }
    });
    if (elScratchpadThemePopover) {
      elScratchpadThemePopover.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setThemePickerOpen(false);
          elBtnScratchpadAddTheme.focus();
        }
      });
    }
    if (elBtnScratchpadThemeClose) {
      elBtnScratchpadThemeClose.addEventListener('click', () => setThemePickerOpen(false));
    }
  }
  if (elScratchpadThemeSearch) {
    elScratchpadThemeSearch.addEventListener('input', () => {
      renderScratchpadThemeList(elScratchpadThemeSearch?.value || '');
    });
    elScratchpadThemeSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = elScratchpadThemeSearch?.value.trim() || '';
        if (query) insertScratchpadTheme(query);
      }
    });
  }
  if (elBtnScratchpadThemeAdd) {
    elBtnScratchpadThemeAdd.addEventListener('click', () => {
      const query = elScratchpadThemeSearch?.value.trim() || '';
      if (query) {
        insertScratchpadTheme(query);
      } else {
        elScratchpadThemeSearch?.focus();
      }
    });
  }
  document.addEventListener('click', (e) => {
    if (
      elScratchpadThemePopover &&
      elScratchpadThemePopover.style.display !== 'none' &&
      !elScratchpadThemePopover.contains(e.target as Node) &&
      !elBtnScratchpadAddTheme?.contains(e.target as Node)
    ) {
      elScratchpadThemePopover.style.display = 'none';
    }
  });
  if (elBtnScratchpadAddFeature) {
    elBtnScratchpadAddFeature.addEventListener('click', () => insertIntoScratchpad('- [ ] Feature: '));
  }
  if (elBtnScratchpadAddBug) {
    elBtnScratchpadAddBug.addEventListener('click', () => insertIntoScratchpad('- [ ] Bug: '));
  }
  if (elBtnScratchpadAddQuestion) {
    elBtnScratchpadAddQuestion.addEventListener('click', () => insertIntoScratchpad('  - ? '));
  }
  if (elBtnScratchpadClear) {
    elBtnScratchpadClear.addEventListener('click', async () => {
      if (elScratchpadTextarea) elScratchpadTextarea.value = '';
      handleScratchpadInput();
      await host.toast({ kind: 'info', message: 'Scratch pad cleared' });
    });
  }
  if (elBtnScratchpadCopyToCreator) {
    elBtnScratchpadCopyToCreator.addEventListener('click', async () => {
      const text = elScratchpadTextarea?.value.trim() || '';
      closeScratchpadModal();
      await openNewIssueModal();
      if (text && elAiIssueInput) {
        elAiIssueInput.value = text;
        saveDraftAiInput(text);
      }
    });
  }
  if (elBtnScratchpadAlignAI) {
    elBtnScratchpadAlignAI.addEventListener('click', () => {
      void launchScratchpadAlignmentSession();
    });
  }
  if (elBtnScratchpadDirectDraft) {
    elBtnScratchpadDirectDraft.addEventListener('click', () => {
      void launchScratchpadDirectSession();
    });
  }
  if (elAiIssueInput) {
    elAiIssueInput.addEventListener('input', () => {
      saveDraftAiInput(elAiIssueInput.value);
    });
  }
  if (elBtnImportFromScratchpad) {
    elBtnImportFromScratchpad.addEventListener('click', async () => {
      const text = await loadScratchpadContent();
      if (text && elAiIssueInput) {
        elAiIssueInput.value = text;
        saveDraftAiInput(text);
        await host.toast({ kind: 'info', message: 'Loaded ideas from Scratch Pad' });
      } else {
        await host.toast({ kind: 'info', message: 'Scratch Pad is empty' });
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
  elTaskDrawer.addEventListener('transitionend', () => {
    if (document.body.getAttribute('data-layout') === 'graph') {
      drawCurrentGraphEdges();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-backdrop.active');
      if (activeModal) {
        if (activeModal === elScratchpadModalBackdrop || activeModal.id === 'scratchpadModalBackdrop') {
          flushScratchpadSave();
          closeScratchpadModal();
        } else if (activeModal === elPreflightBackdrop || activeModal.id === 'preflightModalBackdrop') {
          closePreflightModal();
        } else if (activeModal === elNewIssueModalBackdrop || activeModal.id === 'newIssueModalBackdrop') {
          closeNewIssueModal();
        } else {
          activeModal.classList.remove('active');
        }
        return;
      }
      if (activeIssue) {
        closeDrawer();
      }
    }
  });

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

  if (elBtnAddNewIssueDraftQuestion && elInputNewIssueDraftQuestion) {
    const addDraftQuestion = () => {
      const text = elInputNewIssueDraftQuestion.value.trim();
      if (!text) return;
      draftQuestions.push(text);
      elInputNewIssueDraftQuestion.value = '';
      renderDraftQuestions();
    };
    elBtnAddNewIssueDraftQuestion.addEventListener('click', addDraftQuestion);
    elInputNewIssueDraftQuestion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDraftQuestion();
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

  if (elBtnAddQuestion && elInputAddQuestion) {
    elBtnAddQuestion.addEventListener('click', () => {
      if (activeIssue && elInputAddQuestion.value.trim()) {
        const newBody = appendOpenQuestionToMarkdown(activeIssue.body, elInputAddQuestion.value);
        elInputAddQuestion.value = '';
        void updateIssueBody(activeIssue, newBody);
      }
    });

    elInputAddQuestion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') elBtnAddQuestion.click();
    });
  }

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
