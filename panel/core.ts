// ==========================================
// Task Board core: pure, DOM-free logic shared by the panel and the tests.
// This module must not import the SDK or touch document/window, so it can be
// imported directly by node --test. main.ts re-exports/uses these; the shipped
// panel/main.js bundle must stay behaviourally identical (guarded by
// test/shipped-parity.test.js).
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
  openQuestions?: Subtask[];
}

const checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;

const questionsSectionRegex = /^#{1,4}\s*(?:open\s+)?questions(?:\s*:)?/i;

const headingRegex = /^#{1,4}\s+/;

export function parseOpenQuestions(body: string): Subtask[] {
  if (!body) return [];
  const lines = body.split('\n');
  const questions: Subtask[] = [];
  let inQuestionsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headingRegex.test(line)) {
      inQuestionsSection = questionsSectionRegex.test(line);
      continue;
    }
    if (inQuestionsSection) {
      const match = line.match(checklistRegex);
      if (match) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed: match[2].toLowerCase() === 'x',
          text: match[4].trim(),
          rawLine: line,
        });
      }
    } else {
      const match = line.match(checklistRegex);
      if (match && /^\s*\[[ xX]\]\s*(?:\?|Q:|Question:)/i.test(line)) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed: match[2].toLowerCase() === 'x',
          text: match[4].replace(/^(?:\?|Q:|Question:)\s*/i, '').trim(),
          rawLine: line,
        });
      }
    }
  }
  return questions;
}

export function parseSubtasks(body: string): Subtask[] {
  if (!body) return [];
  const lines = body.split('\n');
  const subtasks: Subtask[] = [];
  let inQuestionsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headingRegex.test(line)) {
      inQuestionsSection = questionsSectionRegex.test(line);
      continue;
    }
    if (inQuestionsSection) {
      continue;
    }
    const match = line.match(checklistRegex);
    if (match) {
      if (/^\s*(?:[-*+]|\d+\.)\s*\[[ xX]\]\s*(?:\?|Q:|Question:)/i.test(line)) {
        continue;
      }
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

export function updateSubtaskInMarkdown(body: string, lineIndex: number, completed: boolean): string {
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

export function updateOpenQuestionInMarkdown(body: string, lineIndex: number, completed: boolean): string {
  return updateSubtaskInMarkdown(body, lineIndex, completed);
}

export function appendSubtaskToMarkdown(body: string, text: string): string {
  const cleanText = text.trim();
  if (!cleanText) return body;
  const suffix = `\n- [ ] ${cleanText}`;
  return body ? `${body.trimEnd()}${suffix}` : `- [ ] ${cleanText}`;
}

export function appendOpenQuestionToMarkdown(body: string, text: string): string {
  const cleanText = text.trim();
  if (!cleanText) return body;
  if (!body) {
    return `### Open Questions:\n- [ ] ${cleanText}`;
  }
  const lines = body.split('\n');
  let qHeaderIndex = -1;
  let nextHeaderIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (questionsSectionRegex.test(lines[i])) {
      qHeaderIndex = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (headingRegex.test(lines[j])) {
          nextHeaderIndex = j;
          break;
        }
      }
      break;
    }
  }

  if (qHeaderIndex !== -1) {
    if (nextHeaderIndex !== -1) {
      lines.splice(nextHeaderIndex, 0, `- [ ] ${cleanText}`);
      return lines.join('\n');
    } else {
      return `${body.trimEnd()}\n- [ ] ${cleanText}`;
    }
  }
  return `${body.trimEnd()}\n\n### Open Questions:\n- [ ] ${cleanText}`;
}

export function serializeDraftQuestions(body: string, questionTexts: string[]): string {
  const cleanBody = (body || '').trim();
  const cleanQuestions = (questionTexts || [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  if (cleanQuestions.length === 0) return cleanBody;
  const questionsBlock = cleanQuestions.map((q) => `- [ ] ${q}`).join('\n');
  if (!cleanBody) {
    return `### Open Questions:\n\n${questionsBlock}`;
  }
  if (questionsSectionRegex.test(cleanBody)) {
    return `${cleanBody}\n${questionsBlock}`;
  }
  return `${cleanBody}\n\n### Open Questions:\n\n${questionsBlock}`;
}

export function isVagueIdea(issue: { title?: string; body?: string; subtasks?: any[]; openQuestions?: any[]; labels?: any[] }): boolean {
  if (!issue) return true;
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  if (labels.includes('status:needs-alignment')) {
    return true;
  }
  const openQuestions = issue.openQuestions || [];
  if (openQuestions.some((q: any) => !q.completed)) {
    return true;
  }
  const subtaskCount = (issue.subtasks || []).length;
  const bodyText = (issue.body || '').trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  return subtaskCount === 0 && wordCount < 20;
}

export function formatQuestionBadge(openQuestions?: Subtask[]) {
  const list = openQuestions || [];
  const total = list.length;
  if (total === 0) {
    return { total: 0, resolved: 0, open: 0, label: '', className: '', html: '' };
  }
  const resolved = list.filter((q) => q.completed).length;
  const open = total - resolved;
  const isOpen = open > 0;
  const label = isOpen ? `${open} open` : `${total} Qs resolved`;
  const className = isOpen ? 'questions-prog is-open' : 'questions-prog is-resolved';
  const icon = isOpen
    ? `<svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>`
    : `<svg class="icon icon-xs" viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: currentColor;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  const html = `<div class="${className}" title="${open} open, ${resolved} resolved">${icon}<span>${label}</span></div>`;
  return { total, resolved, open, label, className, html };
}

export function getIssueTheme(issue: Issue): string {
  if (!issue || !issue.labels || issue.labels.length === 0) return 'No Theme';
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    if (name.toLowerCase().startsWith('theme:')) {
      const themeName = name.slice(6).trim();
      if (themeName) return themeName;
    }
  }
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l.name || '').trim();
    const lower = name.toLowerCase();
    if (
      name &&
      !lower.startsWith('status:') &&
      !lower.startsWith('priority:') &&
      !lower.startsWith('complexity:') &&
      !lower.startsWith('theme:') &&
      !['archived', 'archive'].includes(lower)
    ) {
      return name;
    }
  }
  return 'No Theme';
}

export function extractTaskThemes(issuesList: Issue[]): Array<{ theme: string; count: number }> {
  if (!issuesList || !Array.isArray(issuesList)) return [];
  const counts = new Map<string, number>();
  for (const issue of issuesList) {
    const theme = getIssueTheme(issue);
    if (theme && theme !== 'No Theme') {
      counts.set(theme, (counts.get(theme) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
}

export function parseScratchPadThemes(text: string) {
  if (!text || typeof text !== 'string') {
    return { themes: [], totalIdeas: 0, totalQuestions: 0 };
  }

  const lines = text.split('\n');
  const themes: Array<{ name: string; lines: string[] }> = [];
  let currentTheme = { name: 'General Ideas', lines: [] as string[] };
  let hasExplicitHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#{1,3}\s+(?:\[Theme:\s*)?([^\]\n]+)\]?/i);
    if (headingMatch) {
      if (currentTheme.lines.length > 0 || hasExplicitHeader) {
        themes.push(currentTheme);
      }
      hasExplicitHeader = true;
      currentTheme = {
        name: headingMatch[1].trim(),
        lines: [],
      };
      continue;
    }
    currentTheme.lines.push(line);
  }

  if (currentTheme.lines.length > 0 || hasExplicitHeader) {
    themes.push(currentTheme);
  }

  const activeThemes = themes.filter((t) => t.lines.some((l) => l.trim().length > 0) || t.name !== 'General Ideas');

  let totalIdeas = 0;
  let totalQuestions = 0;

  const analyzed = activeThemes.map((t) => {
    const content = t.lines.join('\n').trim();
    const ideaLines = t.lines.filter((l) => /^\s*(?:[-*+]|\d+\.)(?:\s*\[[ xX]?\])?\s+(?!\?|Q:|Question:)/i.test(l));
    const questionLines = t.lines.filter((l) => /(?:\?|\bQ:|\bQuestion:|\?\s*\[)/i.test(l));
    const ideasCount = ideaLines.length || (content ? 1 : 0);
    const questionsCount = questionLines.length;
    totalIdeas += ideasCount;
    totalQuestions += questionsCount;
    return {
      name: t.name,
      content,
      ideasCount,
      questionsCount,
    };
  });

  return {
    themes: analyzed,
    totalIdeas,
    totalQuestions,
  };
}

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
   - Open Questions: Add a "### Open Questions:" section with interactive Markdown checkboxes (- [ ]) for every unresolved decision, assumption, or ambiguity that needs human alignment before implementation. Only omit this section when there is genuinely nothing to clarify.
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

export const DEFAULT_AI_ALIGNMENT_PROMPT = `You are a principal engineer and architect conducting a deep technical alignment session for repository "{repo}".

User Scratch Pad / Multi-Theme Mind-Dump:
{userInput}

Instructions for the Alignment Session:
1. Review every theme, idea, feature, and bug in the user's scratch pad.
2. Ground yourself by inspecting project architecture, existing modules, conventions, and configuration files in this workspace.
3. Your primary goal is ALIGNMENT before issue creation:
   - For each distinct theme, identify unstated assumptions, ambiguities, technical tradeoffs, and potential edge cases.
   - Formulate probing, concise questions that need clarification (e.g. data modeling decisions, auth boundaries, UX state handling, error recovery).
   - Propose 2-3 architectural approaches or solutions for tricky decisions with pros/cons and a clear recommendation.
4. Interact directly with the user to align on answers.
5. Once aligned on each theme, synthesize the finalized decisions into clean, well-scoped GitHub issues containing:
   - Title in Conventional Commit format
   - Impacted files and architectural plan
   - Actionable Subtasks Checklist (- [ ])
   - Open Questions (- [ ] / - [x])
   - Suggested worktree branch slug`;

export function resolveAiAlignmentPrompt({
  repo,
  userInput,
  storedPrompt,
}: {
  repo: string;
  userInput: string;
  storedPrompt?: string | null;
}): string {
  const template = storedPrompt?.trim() || DEFAULT_AI_ALIGNMENT_PROMPT;
  return template.replace(/\{repo\}/g, repo || '').replace(/\{userInput\}/g, (userInput || '').trim());
}

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

export function buildMultiIssueAttachPayload(issues: Issue[], repo: string = '') {
  if (!issues || issues.length === 0) {
    return {
      providerId: 'github-task-board',
      id: 'bundle-empty',
      title: 'No Issues Selected',
      url: repo ? `https://github.com/${repo}/issues` : '',
      text: 'No issues attached.',
      data: { issueNumbers: [], count: 0, isMulti: true },
    };
  }
  if (issues.length === 1) {
    return buildIssueAttachPayload(issues[0]);
  }
  const numbers = issues.map((i) => i.number);
  const id = `bundle-${numbers.join('-')}`.slice(0, 120);
  const titlesPreview = issues.map((i) => `#${i.number}`).join(', ');
  const title = `[${issues.length} Issues] ${titlesPreview}`.slice(0, 150);
  const primaryUrl = (issues[0]?.html_url || (repo ? `https://github.com/${repo}/issues` : '')).slice(0, 1000);

  let text = `## Attached GitHub Issues (${issues.length} items)\n`;
  if (repo) text += `Repository: ${repo}\n\n`;

  issues.forEach((issue) => {
    text += `### Issue #${issue.number}: ${issue.title || 'Untitled'}\n`;
    if (issue.html_url) text += `Link: ${issue.html_url}\n`;
    const labelNames = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '')).filter(Boolean);
    if (labelNames.length > 0) text += `Labels: ${labelNames.join(', ')}\n`;
    if (issue.subtasks && issue.subtasks.length > 0) {
      text += `Subtasks:\n`;
      issue.subtasks.forEach((s) => {
        text += `- [${s.completed ? 'x' : ' '}] ${s.text}\n`;
      });
    }
    if (issue.body) {
      text += `\nDescription:\n${issue.body.trim()}\n`;
    }
    text += `\n---\n\n`;
  });

  return {
    providerId: 'github-task-board',
    id,
    title,
    url: primaryUrl,
    text: text.slice(0, 15000),
    data: {
      issueNumbers: numbers,
      count: issues.length,
      isMulti: true,
    },
  };
}

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

// ==========================================
// Dependency Graph Engine: Pure models, algorithms, and markdown mutators
// ==========================================

const DEPENDENCY_LINE_REGEX = /(?:^|\n)\s*(?:[-*+]|\d+\.)?\s*\[?[ xX]?\]?\s*(?:blocked\s+by|depends\s+on|requires)(?:\s*:)?\s*([^\n]+)/gi;

export interface DependencyNode {
  issue: Issue;
  blockers: number[];
  openBlockers: number[];
  dependents: number[];
  openDependents: number[];
  downstreamImpact: number;
  isDone: boolean;
  isFrontier: boolean;
  isBlocked: boolean;
  layer: number;
  theme: string;
  priority: string;
}

export interface DependencyEdge {
  from: number;
  to: number;
  isCrossTheme: boolean;
  isClosed: boolean;
  isFrontier: boolean;
}

export interface DependencyGraph {
  nodes: Map<number, DependencyNode>;
  layers: DependencyNode[][];
  edges: DependencyEdge[];
  themes: string[];
  themeNodes: Map<string, DependencyNode[]>;
  frontierNodes: DependencyNode[];
}

export function parseIssueDependencies(body: string | null | undefined): number[] {
  if (!body || typeof body !== 'string') return [];
  const numbers = new Set<number>();
  const matches = body.matchAll(DEPENDENCY_LINE_REGEX);
  for (const match of matches) {
    const text = match[1] || '';
    const numMatches = text.matchAll(/#(\d+)/g);
    for (const nm of numMatches) {
      const n = parseInt(nm[1], 10);
      if (Number.isFinite(n) && n > 0) {
        numbers.add(n);
      }
    }
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

export function addDependencyToMarkdown(body: string | null | undefined, blockerNumber: number): string {
  const blockerRef = `#${blockerNumber}`;
  const existingBlockers = parseIssueDependencies(body);
  if (existingBlockers.includes(blockerNumber)) {
    return body || '';
  }

  const raw = (body || '').trim();
  if (!raw) {
    return `Blocked by ${blockerRef}`;
  }

  // Check if there is an existing Blocked by or Depends on line
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(?:[-*+]|\d+\.)?\s*\[?[ xX]?\]?\s*(?:blocked\s+by|depends\s+on)(?:\s*:)?\s*/i.test(line)) {
      lines[i] = `${line.trimEnd()}, ${blockerRef}`;
      return lines.join('\n');
    }
  }

  return `${raw}\n\nBlocked by ${blockerRef}`;
}

export function removeDependencyFromMarkdown(body: string | null | undefined, blockerNumber: number): string {
  if (!body || typeof body !== 'string') return '';
  const blockerRef = `#${blockerNumber}`;
  if (!body.includes(blockerRef)) return body;

  const lines = body.split('\n');
  const newLines: string[] = [];

  for (const line of lines) {
    if (/^\s*(?:[-*+]|\d+\.)?\s*\[?[ xX]?\]?\s*(?:blocked\s+by|depends\s+on|requires)(?:\s*:)?\s*/i.test(line)) {
      if (line.includes(blockerRef)) {
        // Extract all existing numbers
        const currentNums = Array.from(line.matchAll(/#(\d+)/g))
          .map((m) => parseInt(m[1], 10))
          .filter((n) => n !== blockerNumber);
        if (currentNums.length > 0) {
          const prefixMatch = line.match(/^(\s*(?:[-*+]|\d+\.)?\s*\[?[ xX]?\]?\s*(?:blocked\s+by|depends\s+on|requires)(?:\s*:)?\s*)/i);
          const prefix = prefixMatch ? prefixMatch[1] : 'Blocked by ';
          newLines.push(`${prefix}${currentNums.map((n) => `#${n}`).join(', ')}`);
        }
        // If 0 numbers left, drop the line entirely
        continue;
      }
    }
    newLines.push(line);
  }

  return newLines.join('\n').trim();
}

export function extractIssueReferences(body: string | null | undefined, selfNumber: number): number[] {
  if (!body || typeof body !== 'string') return [];
  const numbers = new Set<number>();
  const matches = body.matchAll(/#(\d+)/g);
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0 && n !== selfNumber) {
      numbers.add(n);
    }
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

export function buildDependencyGraph(issues: Issue[]): DependencyGraph {
  const nodes = new Map<number, DependencyNode>();
  const byNumber = new Map<number, Issue>();

  for (const issue of issues) {
    byNumber.set(issue.number, issue);
  }

  // 1. Initial node creation
  for (const issue of issues) {
    const isDone =
      issue.state === 'closed' ||
      (issue.labels || []).some((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase() === 'status:done');

    const blockers = parseIssueDependencies(issue.body);
    const openBlockers = blockers.filter((num) => {
      const target = byNumber.get(num);
      if (!target) return true; // unknown issue treated as open blocker
      return (
        target.state !== 'closed' &&
        !(target.labels || []).some((l) => (typeof l === 'string' ? l : l.name || '').toLowerCase() === 'status:done')
      );
    });

    const isFrontier = !isDone && openBlockers.length === 0;
    const isBlocked = !isDone && openBlockers.length > 0;

    let priority = 'normal';
    for (const l of issue.labels || []) {
      const name = (typeof l === 'string' ? l : l.name || '').toLowerCase();
      if (name.startsWith('priority:')) {
        priority = name.slice(9);
        break;
      }
    }

    nodes.set(issue.number, {
      issue,
      blockers,
      openBlockers,
      dependents: [],
      openDependents: [],
      downstreamImpact: 0,
      isDone,
      isFrontier,
      isBlocked,
      layer: 0,
      theme: getIssueTheme(issue),
      priority,
    });
  }

  // 2. Inverted dependency graph (dependents)
  for (const node of nodes.values()) {
    for (const blockerNum of node.blockers) {
      const blockerNode = nodes.get(blockerNum);
      if (blockerNode) {
        blockerNode.dependents.push(node.issue.number);
        if (!node.isDone) {
          blockerNode.openDependents.push(node.issue.number);
        }
      }
    }
  }

  // 3. Calculate downstream impact (count of open descendants)
  for (const node of nodes.values()) {
    if (node.isDone) {
      node.downstreamImpact = 0;
      continue;
    }
    const seen = new Set<number>([node.issue.number]);
    const queue = [...node.openDependents];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (seen.has(curr)) continue;
      seen.add(curr);
      const currNode = nodes.get(curr);
      if (currNode) {
        queue.push(...currNode.openDependents);
      }
    }
    node.downstreamImpact = seen.size - 1;
  }

  // 4. Assign waterfall layers (cycle-safe Tarjan's SCC + Longest Path)
  const openNodeNumbers = Array.from(nodes.values())
    .filter((n) => !n.isDone)
    .map((n) => n.issue.number);

  const indices = new Map<number, number>();
  const lowLinks = new Map<number, number>();
  const stack: number[] = [];
  const onStack = new Set<number>();
  const componentOf = new Map<number, number>();
  const components: number[][] = [];
  let nextIndex = 0;

  const visit = (num: number): void => {
    const idx = nextIndex++;
    indices.set(num, idx);
    lowLinks.set(num, idx);
    stack.push(num);
    onStack.add(num);

    const node = nodes.get(num);
    const activeBlockers = (node?.openBlockers || []).filter((b) => nodes.has(b) && !nodes.get(b)!.isDone);

    for (const blocker of activeBlockers) {
      if (!indices.has(blocker)) {
        visit(blocker);
        lowLinks.set(num, Math.min(lowLinks.get(num)!, lowLinks.get(blocker)!));
      } else if (onStack.has(blocker)) {
        lowLinks.set(num, Math.min(lowLinks.get(num)!, indices.get(blocker)!));
      }
    }

    if (lowLinks.get(num) === idx) {
      const component: number[] = [];
      while (stack.length > 0) {
        const member = stack.pop()!;
        onStack.delete(member);
        componentOf.set(member, components.length);
        component.push(member);
        if (member === num) break;
      }
      components.push(component);
    }
  };

  for (const num of openNodeNumbers) {
    if (!indices.has(num)) {
      visit(num);
    }
  }

  const memoLayer = new Map<number, number>();
  const layerOfComponent = (compIdx: number): number => {
    const cached = memoLayer.get(compIdx);
    if (cached !== undefined) return cached;
    let maxBlockerLayer = -1;
    for (const member of components[compIdx]) {
      const memberNode = nodes.get(member);
      if (!memberNode) continue;
      for (const blocker of memberNode.openBlockers) {
        const blockerComp = componentOf.get(blocker);
        if (blockerComp !== undefined && blockerComp !== compIdx) {
          maxBlockerLayer = Math.max(maxBlockerLayer, layerOfComponent(blockerComp));
        }
      }
    }
    const layer = maxBlockerLayer + 1;
    memoLayer.set(compIdx, layer);
    return layer;
  };

  for (const node of nodes.values()) {
    if (node.isDone) {
      node.layer = 0;
    } else {
      const comp = componentOf.get(node.issue.number);
      node.layer = comp !== undefined ? layerOfComponent(comp) : 0;
    }
  }

  // 5. Group into layers
  let maxLayer = 0;
  for (const node of nodes.values()) {
    if (node.layer > maxLayer) maxLayer = node.layer;
  }

  const layers: DependencyNode[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const node of nodes.values()) {
    layers[node.layer].push(node);
  }

  // 6. Barycenter heuristic ordering within layers
  const pos = new Map<number, number>();
  layers[0].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (a.isFrontier !== b.isFrontier) return a.isFrontier ? -1 : 1;
    return b.downstreamImpact - a.downstreamImpact || a.issue.number - b.issue.number;
  });
  layers[0].forEach((n, idx) => pos.set(n.issue.number, idx));

  for (let l = 1; l < layers.length; l++) {
    const layer = layers[l];
    const key = (n: DependencyNode): number => {
      const blockerPositions = n.blockers.map((b) => pos.get(b)).filter((p): p is number => p !== undefined);
      return blockerPositions.length > 0
        ? blockerPositions.reduce((acc, p) => acc + p, 0) / blockerPositions.length
        : n.issue.number;
    };
    layer.sort((a, b) => key(a) - key(b) || b.downstreamImpact - a.downstreamImpact || a.issue.number - b.issue.number);
    layer.forEach((n, idx) => pos.set(n.issue.number, idx));
  }

  // 7. Edges & themes
  const edges: DependencyEdge[] = [];
  const themeNodes = new Map<string, DependencyNode[]>();
  const frontierNodes: DependencyNode[] = [];

  for (const node of nodes.values()) {
    if (node.isFrontier) {
      frontierNodes.push(node);
    }
    let list = themeNodes.get(node.theme);
    if (!list) {
      list = [];
      themeNodes.set(node.theme, list);
    }
    list.push(node);

    for (const blockerNum of node.blockers) {
      const blockerNode = nodes.get(blockerNum);
      const isCrossTheme = blockerNode ? blockerNode.theme !== node.theme : false;
      const isClosed = node.isDone || (blockerNode?.isDone ?? false);
      edges.push({
        from: blockerNum,
        to: node.issue.number,
        isCrossTheme,
        isClosed,
        isFrontier: node.isFrontier,
      });
    }
  }

  const themes = Array.from(themeNodes.keys()).sort((a, b) => {
    if (a === 'No Theme') return 1;
    if (b === 'No Theme') return -1;
    return (themeNodes.get(b)?.length || 0) - (themeNodes.get(a)?.length || 0);
  });

  return {
    nodes,
    layers,
    edges,
    themes,
    themeNodes,
    frontierNodes,
  };
}

export interface RectLike {
  left: number;
  top: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

export function calculateEdgePath(
  sourceRect: RectLike,
  targetRect: RectLike,
  canvasRect: { left: number; top: number }
): { d: string; x1: number; y1: number; x2: number; y2: number } {
  const sWidth = sourceRect.width ?? (sourceRect.right !== undefined ? sourceRect.right - sourceRect.left : 0);
  const sHeight = sourceRect.height ?? (sourceRect.bottom !== undefined ? sourceRect.bottom - sourceRect.top : 0);
  const tWidth = targetRect.width ?? (targetRect.right !== undefined ? targetRect.right - targetRect.left : 0);

  const x1 = Math.round(sourceRect.left + sWidth / 2 - canvasRect.left);
  const y1 = Math.round((sourceRect.bottom !== undefined ? sourceRect.bottom : sourceRect.top + sHeight) - canvasRect.top);
  const x2 = Math.round(targetRect.left + tWidth / 2 - canvasRect.left);
  const y2 = Math.round(targetRect.top - canvasRect.top);

  const dy = y2 - y1;
  const curvature = Math.max(30, Math.abs(dy) * 0.5);

  const d = `M ${x1} ${y1} C ${x1} ${y1 + curvature}, ${x2} ${y2 - curvature}, ${x2} ${y2}`;
  return { d, x1, y1, x2, y2 };
}

export function detectCycle(issues: Issue[], newBlockerNum: number, targetNum: number): boolean {
  if (newBlockerNum === targetNum) return true;
  const blockerMap = new Map<number, number[]>();
  for (const issue of issues) {
    blockerMap.set(issue.number, parseIssueDependencies(issue.body));
  }

  const visited = new Set<number>();
  const queue = [...(blockerMap.get(newBlockerNum) || [])];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetNum) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    queue.push(...(blockerMap.get(curr) || []));
  }
  return false;
}

