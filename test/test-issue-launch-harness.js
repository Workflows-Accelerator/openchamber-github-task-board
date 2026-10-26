import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import {
  DEFAULT_WORK_INSTRUCTIONS,
  buildConsolidatedIssuePrompt,
  findThemeWorktree,
  getIssueRepoFullName,
  getIssueTheme,
  renderBatchLaunchPrompt,
  renderSingleIssueBrief,
  resolveIssueSkills,
} from '../panel/core.ts';

// Execute the actual launch functions, not a reconstructed assignment or a copy of their prompts.
// Only host/DOM state is replaced; prompt renderers and issue helpers are the real core exports.
function loadLaunchFunction(name, dependencies) {
  const source = fs.readFileSync(new URL('../panel/main.ts', import.meta.url), 'utf8');
  const declaration = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^\\}`, 'm'))?.[0];
  if (!declaration) throw new Error(`Missing live launch function: ${name}`);
  const javascript = stripTypeScriptTypes(declaration);
  return new Function(...Object.keys(dependencies), `return (${javascript});`)(...Object.values(dependencies));
}

export function runPreflightBrief(issue, { useWorktree = false, worktrees = [] } = {}) {
  const input = { value: 'previous brief: not rendered' };
  const updatePreflightBrief = loadLaunchFunction('updatePreflightBrief', {
    activeIssue: issue,
    elPreflightWorktreeToggle: { checked: useWorktree },
    elPreflightPromptInput: input,
    worktrees,
    getIssueTheme,
    findThemeWorktree,
    renderSingleIssueBrief,
    DEFAULT_WORK_INSTRUCTIONS,
    buildConsolidatedIssuePrompt,
  });
  updatePreflightBrief();
  return input.value;
}

export async function runBatchLaunchSessions(issues) {
  const payloads = [];
  const errors = [];
  const selectedIssueNumbers = new Set(issues.map((issue) => issue.number));
  const launchBatchSeparateSessions = loadLaunchFunction('launchBatchSeparateSessions', {
    issues,
    selectedIssueNumbers,
    currentProject: { id: 'launch-test-project' },
    currentRepo: 'launch-test/repository',
    ALL_PROJECTS_CACHE_KEY: '__all_projects__',
    clearSelection: () => selectedIssueNumbers.clear(),
    host: {
      toast: async () => {},
      startSession: async (payload) => { payloads.push(payload); },
    },
    getIssueRepoFullName,
    resolveIssueSkills,
    renderBatchLaunchPrompt,
    DEFAULT_WORK_INSTRUCTIONS,
    buildConsolidatedIssuePrompt,
    updateIssueStatus: async () => {},
    addLog: (message, level) => { if (level === 'error') errors.push(message); },
  });
  await launchBatchSeparateSessions();
  return { payloads, errors };
}
