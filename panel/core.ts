// ==========================================
// Task Board core: pure, DOM-free logic shared by the panel and the tests.
// This module must not import the SDK or touch document/window, so it can be
// imported directly by node --test. main.ts re-exports/uses these; the shipped
// panel/main.js bundle must stay behaviourally identical (guarded by
// test/shipped-parity.test.js).
// ==========================================

export function slugify(text: string, maxLen: number = 60): string {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

export interface Subtask {
  id: string;
  lineIndex: number;
  text: string;
  completed: boolean;
  rawLine: string;
}

export interface HumanTodo {
  text: string;
  source: 'human-task' | 'open-question' | 'session-waiting';
  done: boolean;
}

export interface TestItem {
  text: string;
  completed: boolean;
  lineIndex: number;
  scope: 'issue' | 'batch';
}

export type WorkflowPhase =
  | 'draft'
  | 'exploration'
  | 'alignment'
  | 'planning'
  | 'execution'
  | 'verification'
  | 'human_verification'
  | 'publication'
  | 'done'
  | 'archive';

export type HumanAttention =
  | 'none'
  | 'needs-decision'
  | 'needs-permission'
  | 'needs-review';

export type ExecutionLiveness =
  | 'idle'
  | 'running'
  | 'retrying'
  | 'failed'
  | 'completed';

export type DependencyState =
  | 'ready'
  | 'blocked-by-dependency';

export interface V2IssueMetadata {
  phase: WorkflowPhase;
  attention: HumanAttention;
  liveness: ExecutionLiveness;
  dependencyState: DependencyState;
  isExplicitV2: boolean;
}

export type ColumnId =
  | 'draft'
  | 'backlog'
  | 'todo'
  | 'planned'
  | 'in-progress'
  | 'needs-human'
  | 'in-review'
  | 'done';

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
  updated_at?: string;
  subtasks: Subtask[];
  openQuestions?: Subtask[];
  humanTasks?: Subtask[];
  acceptanceCriteria?: Subtask[];
  v2Metadata?: V2IssueMetadata;
  // Set on issues aggregated from multiple projects/repositories.
  projectId?: string;
  projectName?: string;
  repo?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  directory: string;
  gitRepo: { owner: string; repo: string } | null;
  linkedRepo: string | null;
}

export interface IssueGroup {
  id: string;
  title: string;
  issues: Issue[];
  count?: number;
}

const checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;

const questionsSectionRegex = /^[ \t]*#{1,6}\s*(?:open\s+)?questions(?:\s*:)?/i;
const humanTasksSectionRegex = /^[ \t]*#{1,6}\s*human\s+tasks?(?:\s*:)?/i;
const testPlanIssueHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan\s*\(\s*issue\s*\)(?:\s*:)?/i;
const testPlanBatchHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan\s*\(\s*batch\s*\)(?:\s*:)?/i;
const testPlanHeadingRegex = /^[ \t]*#{1,6}\s*test\s+plan(?:\s*\(.*?\))?(?:\s*:)?/i;
const acceptanceCriteriaSectionRegex = /^[ \t]*#{1,6}\s*acceptance\s+criteria(?:\s*:)?/i;
const subtasksSectionRegex = /^[ \t]*#{1,6}\s*(?:actionable\s+subtasks(?:\s+checklist)?|subtasks?|tasks?)(?:\s*:)?/im;

const headingRegex = /^[ ]{0,3}#{1,6}\s+/;

export function parseFriendlyTitle(
  body: string | null | undefined,
  defaultTitle?: string
): { title: string; subtitle: string | null } {
  if (!body || typeof body !== 'string') {
    return { title: defaultTitle || '', subtitle: null };
  }

  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  const match = cleanBody.match(/(?:^|\r?\n)[ \t]*(?:#{1,6}[ \t]*Friendly Title:|\*\*Friendly Title:?\*\*:?)[ \t]*([^\r\n]*)/i);
  if (match) {
    let extracted = match[1].trim();
    if (!extracted) {
      const matchIndex = match.index ?? 0;
      const remainder = cleanBody.slice(matchIndex + match[0].length);
      const lines = remainder.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (
          line.startsWith('#') ||
          /^\*\*(?:overview|description|details|context|background|about|tasks?|subtasks?|questions?):?\*\*/i.test(line) ||
          /^[-*+]\s+/.test(line) ||
          /^\d+\.\s+/.test(line)
        ) {
          break;
        }
        extracted = line;
        break;
      }
    }

    if (extracted) {
      // Strip wrapping quotes or angle brackets if present
      extracted = extracted.replace(/^<([^>]+)>$/, '$1').replace(/^["'](.*)["']$/, '$1').trim();

      // Guard against unreplaced template placeholder
      if (
        extracted.toLowerCase() === '3-6 words plain english title' ||
        extracted.toLowerCase() === '<3-6 words plain english title>'
      ) {
        return {
          title: defaultTitle || '',
          subtitle: null,
        };
      }

      return {
        title: extracted,
        subtitle: defaultTitle || null,
      };
    }
  }

  return {
    title: defaultTitle || '',
    subtitle: null,
  };
}

export function resolveSimplifiedViewTitle(
  issue: { number: number; title?: string | null; body?: string | null }
): { displayTitle: string; displaySubtitle: string | null; isPlaceholder: boolean } {
  const titles = parseFriendlyTitle(issue.body, '__DEFAULT_TITLE_SENTINEL__');
  if (titles.subtitle === '__DEFAULT_TITLE_SENTINEL__' && titles.title.trim()) {
    const friendly = titles.title.trim();
    const tech = issue.title?.trim() || null;
    return {
      displayTitle: friendly,
      displaySubtitle: tech && tech !== friendly ? tech : null,
      isPlaceholder: false,
    };
  }
  const fallbackTitle = issue.title?.trim() || `Issue #${issue.number}`;
  return {
    displayTitle: fallbackTitle,
    displaySubtitle: null,
    isPlaceholder: false,
  };
}

function escapeHtmlInternal(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTaskTextWithLinks(text: string | null | undefined, currentRepo?: string): string {
  if (!text || typeof text !== 'string') return '';
  let escaped = escapeHtmlInternal(text);

  // 1. Convert markdown links: [label](https://...)
  escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="task-link">${label}</a>`;
  });

  // 2. Convert full GitHub issue URLs: https://github.com/:owner/:repo/issues/:num
  escaped = escaped.replace(/(?<![\w/])(https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/issues\/\d+)(?![^<]*<\/a>)(?![/\w])/g, (_match, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="task-link cross-repo-link">${url}</a>`;
  });

  // 3. Convert cross-repo issue references: owner/repo#123
  escaped = escaped.replace(/(?<![\w/])([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)\b(?![^<]*<\/a>)/g, (match, repo, num) => {
    if (currentRepo && repo.toLowerCase() === currentRepo.toLowerCase()) {
      return match;
    }
    const fullUrl = `https://github.com/${repo}/issues/${num}`;
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="task-link cross-repo-link">${fullUrl}</a>`;
  });

  // 4. Convert file paths into clickable links
  // Protect existing <a> tags so replacements don't corrupt attributes or contents
  const aTokens: string[] = [];
  let working = escaped.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (match) => {
    const placeholder = `%%A_TAG_${aTokens.length}%%`;
    aTokens.push(match);
    return placeholder;
  });

  // Match inline backticks `path/to/file`
  working = working.replace(/`([^`\n]+)`/g, (_m, code) => {
    const trimmed = code.trim();
    if (/(?:^\/|\/|\.[a-zA-Z0-9]+$)/.test(trimmed) && !trimmed.includes(' ')) {
      const clean = trimmed.replace(/[.,;:)]+$/, '');
      return `<a href="#" class="task-link task-file-path-link" data-path="${clean}" title="Click to view file: ${clean}"><code>${trimmed}</code></a>`;
    }
    return `<code>${trimmed}</code>`;
  });

  // Protect <code> tags
  const codeTokens: string[] = [];
  working = working.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, (match) => {
    const placeholder = `%%CODE_TAG_${codeTokens.length}%%`;
    codeTokens.push(match);
    return placeholder;
  });

  // Match raw absolute and relative file paths or known config files
  working = working.replace(/(?<![\w/])(\/(?:workspace|config|tmp|usr|home|etc|var)\/[a-zA-Z0-9_./@-]+(?:\/)?|[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_./-]+\.(?:ts|js|mjs|cjs|json|md|html|css|yaml|yml|sh|py|go|rs|toml|txt)|(?:\.agents|config\/opencode|panel)\/[a-zA-Z0-9_./@-]+(?:\/)?|package\.json|tsconfig\.json|README\.md|LICENSE|\.gitignore)(?=[.,;:)]*(?:$|\s|[<]))/g, (match) => {
    const clean = match.replace(/[.,;:)]+$/, '');
    return `<a href="#" class="task-link task-file-path-link" data-path="${clean}" title="Click to view file: ${clean}">${clean}</a>`;
  });

  // Restore <code> and <a> tokens
  for (let i = codeTokens.length - 1; i >= 0; i--) {
    working = working.replace(`%%CODE_TAG_${i}%%`, codeTokens[i]);
  }
  for (let i = aTokens.length - 1; i >= 0; i--) {
    working = working.replace(`%%A_TAG_${i}%%`, aTokens[i]);
  }

  return working;
}

export function extractQuestionOptions(questionText: string, issueBody?: string): string[] {
  const options: string[] = [];
  const qClean = (questionText || '').trim();

  // 1. Look for options defined in tables in the issue body (e.g. **A. Parent-session injection**)
  if (issueBody) {
    const tableRegex = /\|\s*\*\*([A-D]\.[^*]+)\*\*\s*\|/gi;
    let tm: RegExpExecArray | null;
    const tableOptions: string[] = [];
    while ((tm = tableRegex.exec(issueBody)) !== null) {
      tableOptions.push(tm[1].trim());
    }
    if (tableOptions.length >= 2) {
      options.push(...tableOptions);
      if (/A\s*\+\s*D/i.test(qClean)) {
        options.push('A + D (Combination)');
      }
    }
  }

  // 2. Parse inline choice questions: "Channel A, B, or A+D?" or "X or Y?"
  if (options.length === 0 && qClean) {
    let clean = qClean.replace(/^\s*[-*?]\s*/, '').trim();
    // If prompt has a colon like "Choose one: A, B, or C?", strip before colon
    const colonIdx = clean.indexOf(':');
    if (colonIdx >= 0 && colonIdx < clean.length - 2) {
      clean = clean.slice(colonIdx + 1).trim();
    }
    const orMatch = clean.match(/^(.*?)(?:,\s*|\s+)or\s+([^?]+)\??$/i);
    if (orMatch) {
      const prefix = orMatch[1];
      const last = orMatch[2].trim();
      const strippedPrefix = prefix.replace(/^(?:do you prefer|should we use|which|choose|is this ready for merge \(?)/i, '').trim();
      const parts = strippedPrefix.split(',').map((s) => s.trim()).filter(Boolean);
      parts.push(last.replace(/\)$/, '').trim());
      if (parts.length >= 2 && parts.length <= 6) {
        options.push(...parts);
      }
    }
  }

  // 3. Parse parenthesized options: (A) ..., (B) ...
  if (options.length === 0 && qClean) {
    const parenMatches = [...qClean.matchAll(/\(([A-Za-z0-9]+)\)\s*([^,;()]+)/g)];
    if (parenMatches.length >= 2) {
      parenMatches.forEach((m) => options.push(`(${m[1]}) ${m[2].trim()}`));
    }
  }

  return [...new Set(options)];
}

export function extractQuestionContext(issueBody: string | null | undefined, questionLineIndex?: number): string {
  if (!issueBody) return '';
  const lines = issueBody.split('\n');

  // 1. Look for section heading or text preceding the question line
  if (typeof questionLineIndex === 'number' && questionLineIndex > 0) {
    let precedingHeading = '';
    for (let i = questionLineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (/^#{1,3}\s+/.test(line)) {
        precedingHeading = line.replace(/^#{1,3}\s+/, '');
        break;
      }
    }
    for (let i = questionLineIndex - 1; i >= Math.max(0, questionLineIndex - 8); i--) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('|')) {
        return (precedingHeading ? `${precedingHeading}: ` : '') + line.slice(0, 260);
      }
    }
    if (precedingHeading) return precedingHeading;
  }

  // 2. Fallback to Overview section
  const overviewMatch = issueBody.match(/##\s*Overview\s*\n+([\s\S]*?)(?=\n##|\n###|$)/i);
  if (overviewMatch) {
    const snippet = overviewMatch[1].replace(/[#*`_]/g, '').trim().replace(/\s+/g, ' ');
    return snippet.slice(0, 240) + (snippet.length > 240 ? '...' : '');
  }

  return '';
}

export function parseOpenQuestions(body: string | null | undefined): Subtask[] {
  if (!body || typeof body !== 'string' || !body.includes('[')) return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (!/question/i.test(cleanBody)) return [];
  const hasCodeFence = cleanBody.includes('```') || cleanBody.includes('~~~');
  const hasCR = cleanBody.includes('\r');
  const lines = cleanBody.split('\n');
  const questions: Subtask[] = [];
  let inQuestionsSection = false;
  let inHumanTasksSection = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }

      if (line.includes('#')) {
        const isQuestions = questionsSectionRegex.test(line);
        const isHuman = humanTasksSectionRegex.test(line);
        if (isQuestions || isHuman || headingRegex.test(line)) {
          inQuestionsSection = isQuestions;
          inHumanTasksSection = isHuman;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }

    if (inQuestionsSection) {
      let completed = false;
      let text = '';
      if (
        line.charCodeAt(0) === 45 &&
        line.charCodeAt(1) === 32 &&
        line.charCodeAt(2) === 91 &&
        (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
        line.charCodeAt(4) === 93 &&
        line.charCodeAt(5) === 32
      ) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === 'x';
          text = match[4].trim();
        }
      }
      if (text) {
        questions.push({
          id: `question-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine,
        });
      }
    } else if (!inHumanTasksSection) {
      if (line.includes('?') || line.includes('Q:') || line.includes('q:') || /question/i.test(line)) {
        let completed = false;
        let text = '';
        if (
          line.charCodeAt(0) === 45 &&
          line.charCodeAt(1) === 32 &&
          line.charCodeAt(2) === 91 &&
          (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
          line.charCodeAt(4) === 93 &&
          line.charCodeAt(5) === 32
        ) {
          completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
          text = line.slice(6).trim();
        } else {
          const match = line.match(checklistRegex);
          if (match) {
            completed = match[2].toLowerCase() === 'x';
            text = match[4].trim();
          }
        }
        if (text && /^(?:\?|Q:|Question:)/i.test(text)) {
          const qText = text.replace(/^(?:\?|Q:|Question:)\s*/i, '').trim();
          if (qText) {
            questions.push({
              id: `question-${i}`,
              lineIndex: i,
              completed,
              text: qText,
              rawLine,
            });
          }
        }
      }
    }
  }
  return questions;
}

export function parseHumanTasks(body: string | null | undefined): Subtask[] {
  if (!body || typeof body !== 'string' || !body.includes('[')) return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (!/human/i.test(cleanBody)) return [];
  const hasCodeFence = cleanBody.includes('```') || cleanBody.includes('~~~');
  const hasCR = cleanBody.includes('\r');
  const lines = cleanBody.split('\n');
  const tasks: Subtask[] = [];
  let inHumanTasksSection = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }

      if (line.includes('#')) {
        const isHuman = humanTasksSectionRegex.test(line);
        if (isHuman || questionsSectionRegex.test(line) || headingRegex.test(line)) {
          inHumanTasksSection = isHuman;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }

    if (inHumanTasksSection) {
      let completed = false;
      let text = '';
      if (
        line.charCodeAt(0) === 45 &&
        line.charCodeAt(1) === 32 &&
        line.charCodeAt(2) === 91 &&
        (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
        line.charCodeAt(4) === 93 &&
        line.charCodeAt(5) === 32
      ) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === 'x';
          text = match[4].trim();
        }
      }
      if (text) {
        tasks.push({
          id: `human-task-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine,
        });
      }
    }
  }
  return tasks;
}

export function buildHumanTaskResumePrompt(issueNumber: number): string {
  return `All human tasks for issue #${issueNumber} are now complete. Resume work, run your verification suite, and advance the issue to the next step.`;
}

export function shouldNotifyAgentOnHumanTasksComplete(
  prevTasks: Subtask[] | null | undefined,
  nextTasks: Subtask[] | null | undefined
): boolean {
  if (!nextTasks || nextTasks.length === 0) return false;
  const hadIncomplete = !prevTasks || prevTasks.length === 0 || prevTasks.some((t) => !t.completed);
  const nowAllComplete = nextTasks.every((t) => t.completed);
  return hadIncomplete && nowAllComplete;
}

export function parseAcceptanceCriteria(body: string | null | undefined): Subtask[] {
  if (!body || typeof body !== 'string' || !body.includes('[')) return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (!/acceptance/i.test(cleanBody)) return [];
  const hasCodeFence = cleanBody.includes('```') || cleanBody.includes('~~~');
  const hasCR = cleanBody.includes('\r');
  const lines = cleanBody.split('\n');
  const items: Subtask[] = [];
  let inAcSection = false;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }

      if (line.includes('#')) {
        const isAc = acceptanceCriteriaSectionRegex.test(line);
        if (isAc || headingRegex.test(line)) {
          inAcSection = isAc;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }

    if (inAcSection) {
      let completed = false;
      let text = '';
      if (
        line.charCodeAt(0) === 45 &&
        line.charCodeAt(1) === 32 &&
        line.charCodeAt(2) === 91 &&
        (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
        line.charCodeAt(4) === 93 &&
        line.charCodeAt(5) === 32
      ) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === 'x';
          text = match[4].trim();
        }
      }
      if (text) {
        items.push({
          id: `ac-${i}`,
          lineIndex: i,
          completed,
          text,
          rawLine,
        });
      }
    }
  }
  return items;
}

export function parseSubtasks(body: string | null | undefined): Subtask[] {
  if (!body || typeof body !== 'string' || !body.includes('[')) return [];
  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  const hasCodeFence = cleanBody.includes('```') || cleanBody.includes('~~~');
  const hasCR = cleanBody.includes('\r');
  const lines = cleanBody.split('\n');
  const subtasks: Subtask[] = [];

  let hasExplicitSubtasksSection = false;
  if (/task/i.test(cleanBody)) {
    if (!hasCodeFence) {
      hasExplicitSubtasksSection = subtasksSectionRegex.test(cleanBody);
    } else {
      let inCode = false;
      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        if (/^[ \t]*(?:```|~~~)/.test(rawLine)) {
          inCode = !inCode;
          continue;
        }
        if (inCode) continue;
        if (subtasksSectionRegex.test(rawLine)) {
          hasExplicitSubtasksSection = true;
          break;
        }
      }
    }
  }

  if (hasExplicitSubtasksSection) {
    let inSubtasksSection = false;
    let inCodeFence = false;
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
      const firstChar = line.charCodeAt(0);
      if (firstChar !== 45 && firstChar !== 42) {
        if (hasCodeFence) {
          if (/^[ \t]*(?:```|~~~)/.test(line)) {
            inCodeFence = !inCodeFence;
            continue;
          }
          if (inCodeFence) continue;
        }

        if (line.includes('#')) {
          const isSub = subtasksSectionRegex.test(line);
          if (isSub || headingRegex.test(line)) {
            inSubtasksSection = isSub;
            continue;
          }
        }
      } else if (inCodeFence) {
        continue;
      }

      if (inSubtasksSection) {
        let completed = false;
        let text = '';
        if (
          line.charCodeAt(0) === 45 &&
          line.charCodeAt(1) === 32 &&
          line.charCodeAt(2) === 91 &&
          (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
          line.charCodeAt(4) === 93 &&
          line.charCodeAt(5) === 32
        ) {
          completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
          text = line.slice(6).trim();
        } else {
          const match = line.match(checklistRegex);
          if (match) {
            completed = match[2].toLowerCase() === 'x';
            text = match[4].trim();
          }
        }
        if (text) {
          if (
            text.charCodeAt(0) === 63 ||
            (text.charCodeAt(0) === 81 && (text.charCodeAt(1) === 58 || text.startsWith('Question:'))) ||
            /^(?:\?|Q:|Question:)/i.test(text)
          ) {
            continue;
          }
          subtasks.push({
            id: `task-${i}`,
            lineIndex: i,
            completed,
            text,
            rawLine,
          });
        }
      }
    }
    return subtasks;
  }

  // Fallback: no explicit subtasks section present.
  // Collect top-level checkboxes while strictly excluding checkboxes belonging to
  // Acceptance Criteria, Open Questions, Human Tasks, and Test Plan sections.
  let inExcludedSection = false;
  let inCodeFence = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }

      if (line.includes('#')) {
        const isExcluded =
          acceptanceCriteriaSectionRegex.test(line) ||
          questionsSectionRegex.test(line) ||
          humanTasksSectionRegex.test(line) ||
          testPlanHeadingRegex.test(line);

        if (isExcluded || headingRegex.test(line)) {
          inExcludedSection = isExcluded;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }

    if (inExcludedSection) {
      continue;
    }

    let completed = false;
    let text = '';
    if (
      line.charCodeAt(0) === 45 &&
      line.charCodeAt(1) === 32 &&
      line.charCodeAt(2) === 91 &&
      (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
      line.charCodeAt(4) === 93 &&
      line.charCodeAt(5) === 32
    ) {
      completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
      text = line.slice(6).trim();
    } else {
      const match = line.match(checklistRegex);
      if (match) {
        completed = match[2].toLowerCase() === 'x';
        text = match[4].trim();
      }
    }
    if (text) {
      if (
        text.charCodeAt(0) === 63 ||
        (text.charCodeAt(0) === 81 && (text.charCodeAt(1) === 58 || text.startsWith('Question:'))) ||
        /^(?:\?|Q:|Question:)/i.test(text)
      ) {
        continue;
      }
      subtasks.push({
        id: `task-${i}`,
        lineIndex: i,
        completed,
        text,
        rawLine,
      });
    }
  }
  return subtasks;
}

export function collectHumanTodos(
  issue: Issue | string | null | undefined,
  session?: any
): HumanTodo[] {
  let body = '';
  let preHumanTasks: Subtask[] | undefined;
  let preOpenQuestions: Subtask[] | undefined;
  let issueObj: Issue | null = null;

  if (typeof issue === 'string') {
    body = issue;
  } else if (issue && typeof issue === 'object') {
    issueObj = issue;
    body = typeof issue.body === 'string' ? issue.body : '';
    if (Array.isArray(issue.humanTasks)) {
      preHumanTasks = issue.humanTasks;
    }
    if (Array.isArray(issue.openQuestions)) {
      preOpenQuestions = issue.openQuestions;
    }
  }

  // 1. Unchecked ### Human Tasks: items first, in body order
  const humanTasks = preHumanTasks ?? parseHumanTasks(body);
  const uncheckedHumanTasks = humanTasks.filter((t) => !t.completed);

  const seen = new Set<string>();
  const todos: HumanTodo[] = [];

  for (const t of uncheckedHumanTasks) {
    const text = t.text.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    todos.push({
      text,
      source: 'human-task',
      done: false,
    });
  }

  if (todos.length > 0) {
    return todos;
  }

  // 2. If (1) is empty: unchecked ### Open Questions: items (source open-question)
  const openQuestions = preOpenQuestions ?? parseOpenQuestions(body);
  const uncheckedQuestions = openQuestions.filter((q) => !q.completed);

  for (const q of uncheckedQuestions) {
    const text = q.text.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    todos.push({
      text,
      source: 'open-question',
      done: false,
    });
  }

  if (todos.length > 0) {
    return todos;
  }

  // 3. If an attached agent session is in a waiting* state and (1)+(2) yield nothing:
  // one synthesized item from the waiting reason (source session-waiting)
  const isBoundToOther = (s: any, currentNum: number): boolean => {
    if (!s || !currentNum) return false;
    const currentStr = String(currentNum);
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (!it) continue;
        if (it.id === currentStr) return false;
        const otherNum = it.data?.issueNumber || (Array.isArray(it.data?.issueNumbers) && it.data.issueNumbers[0]) || (Number.isFinite(Number(it.id)) ? Number(it.id) : null);
        if (otherNum && Number(otherNum) !== currentNum) return true;
      }
    }
    if (typeof s.title === 'string') {
      const match = s.title.match(/#(\d+)/);
      if (match && Number(match[1]) !== currentNum) return true;
    }
    const wtName = typeof s.worktree === 'string' ? s.worktree : (s.worktree?.name || s.worktree?.branch || s.worktree?.directory || '');
    if (wtName) {
      const match = wtName.match(/issue-(\d+)/);
      if (match && Number(match[1]) !== currentNum) return true;
    }
    return false;
  };

  let activeSession: any = null;
  if (Array.isArray(session)) {
    if (issueObj && Number.isFinite(issueObj.number)) {
      const issueNumStr = String(issueObj.number);
      activeSession = session.find((s: any) => {
        if (!s) return false;
        if (s.items && Array.isArray(s.items) && s.items.some((it: any) => it && (it.id === issueNumStr || it.data?.issueNumber === issueObj!.number || (Array.isArray(it.data?.issueNumbers) && it.data.issueNumbers.includes(issueObj!.number))))) {
          return true;
        }
        if (s.title && s.title.includes(`#${issueObj!.number}`)) return true;
        const wtName = typeof s.worktree === 'string' ? s.worktree : (s.worktree?.name || s.worktree?.branch || s.worktree?.directory || '');
        if (wtName && wtName.includes(`issue-${issueObj!.number}`)) return true;
        return false;
      }) || (session.length === 1 && !isBoundToOther(session[0], issueObj.number) ? session[0] : null);
    } else {
      activeSession = session.length === 1 ? session[0] : null;
    }
  } else if (session && typeof session === 'object') {
    if (issueObj && Number.isFinite(issueObj.number) && isBoundToOther(session, issueObj.number)) {
      activeSession = null;
    } else {
      activeSession = session;
    }
  }

  if (activeSession) {
    const act = typeof activeSession.activity === 'string' ? activeSession.activity.trim() : '';
    const isWaiting = act === 'waiting-permission' || act === 'waiting-question' || act.startsWith('waiting');
    if (isWaiting) {
      const rawReason = activeSession.waitingReason || activeSession.reason || activeSession.data?.waitingReason || activeSession.data?.reason || '';
      const reason = typeof rawReason === 'string' ? rawReason.trim() : '';

      let text = '';
      if (act === 'waiting-permission') {
        text = reason ? `Agent waiting for permission: ${reason}` : 'Agent waiting for permission';
      } else if (act === 'waiting-question') {
        text = reason ? `Agent waiting for question: ${reason}` : 'Agent waiting for question';
      } else if (act.startsWith('waiting-')) {
        const kind = act.slice(8);
        text = reason ? `Agent waiting for ${kind}: ${reason}` : `Agent waiting for ${kind}`;
      } else {
        text = reason ? `Agent waiting: ${reason}` : 'Agent waiting';
      }

      return [{
        text,
        source: 'session-waiting',
        done: false,
      }];
    }
  }

  return [];
}

export function updateSubtaskInMarkdown(body: string, lineIndex: number, completed: boolean): string {
  const lines = body.split('\n');
  if (lineIndex >= 0 && lineIndex < lines.length) {
    const rawLine = lines[lineIndex];
    const hasCr = rawLine.endsWith('\r');
    const cleanLine = hasCr ? rawLine.slice(0, -1) : rawLine;
    const match = cleanLine.match(checklistRegex);
    if (match) {
      const mark = completed ? 'x' : ' ';
      lines[lineIndex] = `${match[1]}${mark}${match[3]}${match[4]}${hasCr ? '\r' : ''}`;
    }
  }
  return lines.join('\n');
}

export function updateOpenQuestionInMarkdown(body: string, lineIndex: number, completed: boolean): string {
  return updateSubtaskInMarkdown(body, lineIndex, completed);
}

export function answerOpenQuestionInMarkdown(body: string | null | undefined, questionIndex: number, answerText: string): string {
  if (!body) return '';
  const cleanAnswer = (answerText || '').trim().replace(/\r?\n+/g, ' ');
  const questions = parseOpenQuestions(body);
  const unresolved = questions.filter((q) => !q.completed);
  if (questionIndex < 0 || questionIndex >= unresolved.length) {
    return body;
  }
  const target = unresolved[questionIndex];
  const lines = body.split('\n');
  const rawLine = lines[target.lineIndex];
  if (!rawLine) return body;
  const hasCr = rawLine.endsWith('\r');
  const cleanLine = hasCr ? rawLine.slice(0, -1) : rawLine;
  const match = cleanLine.match(checklistRegex);
  if (!match) return body;

  const lineEnding = hasCr ? '\r' : '';
  const questionContent = match[4]
    .replace(/\s*\*\s*\(Answer:[\s\S]*?\)\s*\*$/i, '')
    .trimEnd();
  lines[target.lineIndex] = `${match[1]}x${match[3]}${questionContent} *(Answer: ${cleanAnswer})*${lineEnding}`;
  return lines.join('\n');
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

export function parseTestPlan(body: string | null | undefined): { issueTests: TestItem[]; batchTests: TestItem[] } {
  const result: { issueTests: TestItem[]; batchTests: TestItem[] } = {
    issueTests: [],
    batchTests: [],
  };
  if (!body || typeof body !== 'string' || !body.includes('[')) return result;

  const cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
  if (!/test\s*plan/i.test(cleanBody)) return result;
  const hasCodeFence = cleanBody.includes('```') || cleanBody.includes('~~~');
  const hasCR = cleanBody.includes('\r');
  const lines = cleanBody.split('\n');
  let currentScope: 'issue' | 'batch' | null = null;
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = hasCR && rawLine.includes('\r') ? rawLine.replace(/\r/g, '') : rawLine;
    const firstChar = line.charCodeAt(0);
    if (firstChar !== 45 && firstChar !== 42) {
      if (hasCodeFence) {
        if (/^[ \t]*(?:```|~~~)/.test(line)) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
      }

      if (line.includes('#')) {
        if (testPlanIssueHeadingRegex.test(line)) {
          currentScope = 'issue';
          continue;
        } else if (testPlanBatchHeadingRegex.test(line)) {
          currentScope = 'batch';
          continue;
        } else if (headingRegex.test(line)) {
          currentScope = null;
          continue;
        }
      }
    } else if (inCodeFence) {
      continue;
    }

    if (currentScope) {
      let completed = false;
      let text = '';
      if (
        line.charCodeAt(0) === 45 &&
        line.charCodeAt(1) === 32 &&
        line.charCodeAt(2) === 91 &&
        (line.charCodeAt(3) === 32 || line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88) &&
        line.charCodeAt(4) === 93 &&
        line.charCodeAt(5) === 32
      ) {
        completed = line.charCodeAt(3) === 120 || line.charCodeAt(3) === 88;
        text = line.slice(6).trim();
      } else {
        const match = line.match(checklistRegex);
        if (match) {
          completed = match[2].toLowerCase() === 'x';
          text = match[4].trim();
        }
      }
      if (text) {
        const testItem: TestItem = {
          text,
          completed,
          lineIndex: i,
          scope: currentScope,
        };
        if (currentScope === 'issue') {
          result.issueTests.push(testItem);
        } else {
          result.batchTests.push(testItem);
        }
      }
    }
  }

  return result;
}

export function updateTestItemInMarkdown(body: string, lineIndex: number, completed: boolean): string {
  if (!body) return '';
  return updateSubtaskInMarkdown(body, lineIndex, completed);
}

export function appendTestItemToMarkdown(body: string, text: string, scope: 'issue' | 'batch'): string {
  const cleanText = (text || '').trim();
  if (!cleanText) return body || '';

  const header = scope === 'issue' ? '## Test Plan (Issue)' : '## Test Plan (Batch)';
  const targetRegex = scope === 'issue' ? testPlanIssueHeadingRegex : testPlanBatchHeadingRegex;
  const lineEnding = typeof body === 'string' && body.includes('\r\n') ? '\r' : '';

  if (!body || typeof body !== 'string') {
    return `${header}\n- [ ] ${cleanText}`;
  }

  const lines = body.split('\n');
  let targetHeaderIndex = -1;
  let nextHeaderIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (targetRegex.test(lines[i])) {
      targetHeaderIndex = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s+/.test(lines[j])) {
          nextHeaderIndex = j;
          break;
        }
      }
      break;
    }
  }

  if (targetHeaderIndex !== -1) {
    const sectionEnd = nextHeaderIndex !== -1 ? nextHeaderIndex : lines.length;
    let lastChecklistIndex = -1;
    for (let i = targetHeaderIndex + 1; i < sectionEnd; i++) {
      if (checklistRegex.test(lines[i])) {
        lastChecklistIndex = i;
      }
    }

    if (lastChecklistIndex !== -1) {
      lines.splice(lastChecklistIndex + 1, 0, `- [ ] ${cleanText}${lineEnding}`);
      return lines.join('\n');
    }

    // No existing checklist items in section: insert right after header
    lines.splice(targetHeaderIndex + 1, 0, `- [ ] ${cleanText}${lineEnding}`);
    return lines.join('\n');
  }

  return `${body.trimEnd()}\n\n${header}\n- [ ] ${cleanText}`;
}

export function serializeTestPlan(items: Array<{ text: string; completed?: boolean }>, scope: 'issue' | 'batch'): string {
  const header = scope === 'issue' ? '## Test Plan (Issue)' : '## Test Plan (Batch)';
  const cleanItems = (items || []).filter((item) => item && typeof item.text === 'string' && item.text.trim());
  if (cleanItems.length === 0) {
    return header;
  }
  const lines = cleanItems.map((item) => `- [${item.completed ? 'x' : ' '}] ${item.text.trim()}`);
  return `${header}\n${lines.join('\n')}`;
}

export function resolveOptimisticSubtaskUpdate(
  body: string,
  taskText: string,
  completed: boolean
): { updatedBody: string; found: boolean } {
  if (!body || typeof body !== 'string') {
    return { updatedBody: body || '', found: false };
  }
  const cleanTarget = taskText.trim();
  // 1. Try human tasks first
  const humanTasks = parseHumanTasks(body);
  let target = humanTasks.find((t) => t.completed !== completed && t.text.trim() === cleanTarget)
    || humanTasks.find((t) => t.text.trim() === cleanTarget);

  if (target) {
    return {
      updatedBody: updateSubtaskInMarkdown(body, target.lineIndex, completed),
      found: true,
    };
  }

  // 2. Try regular subtasks
  const subtasks = parseSubtasks(body);
  target = subtasks.find((t) => t.completed !== completed && t.text.trim() === cleanTarget)
    || subtasks.find((t) => t.text.trim() === cleanTarget);

  if (target) {
    return {
      updatedBody: updateSubtaskInMarkdown(body, target.lineIndex, completed),
      found: true,
    };
  }

  return { updatedBody: body, found: false };
}

export interface ResolveQuestionAnswerResult {
  updatedBody: string;
  found: boolean;
  reason?: 'not-found' | 'ambiguous' | 'already-answered';
}

export function resolveOptimisticQuestionAnswer(
  body: string,
  questionText: string,
  answerText: string
): ResolveQuestionAnswerResult {
  if (!body || typeof body !== 'string') {
    return { updatedBody: body || '', found: false, reason: 'not-found' };
  }
  const cleanTarget = (questionText || '').trim();
  if (!cleanTarget) {
    return { updatedBody: body, found: false, reason: 'not-found' };
  }
  const questions = parseOpenQuestions(body);
  const openQuestions = questions.filter((q) => !q.completed);

  // Exact, case-preserving match on source question text
  const matchingIndices: number[] = [];
  openQuestions.forEach((q, idx) => {
    if (q.text.trim() === cleanTarget) {
      matchingIndices.push(idx);
    }
  });

  if (matchingIndices.length > 1) {
    // Ambiguous: two unresolved questions have identical source text. Refuse ambiguity.
    return { updatedBody: body, found: false, reason: 'ambiguous' };
  }

  if (matchingIndices.length === 1) {
    const targetIdx = matchingIndices[0];
    return {
      updatedBody: answerOpenQuestionInMarkdown(body, targetIdx, answerText),
      found: true,
    };
  }

  // Check if it already exists among completed questions
  const alreadyCompleted = questions.some((q) => {
    if (!q.completed) return false;
    const cleanQ = q.text.replace(/\s*\*\s*\(Answer:[\s\S]*?\)\s*\*$/i, '').trim();
    return cleanQ === cleanTarget;
  });
  return {
    updatedBody: body,
    found: false,
    reason: alreadyCompleted ? 'already-answered' : 'not-found',
  };
}

export function resolveOptimisticTestItemUpdate(
  body: string,
  itemText: string,
  completed: boolean
): { updatedBody: string; found: boolean } {
  if (!body || typeof body !== 'string') {
    return { updatedBody: body || '', found: false };
  }
  const cleanTarget = itemText.trim();
  const { issueTests, batchTests } = parseTestPlan(body);
  const allTests = [...issueTests, ...batchTests];
  const target = allTests.find((t) => t.completed !== completed && t.text.trim() === cleanTarget)
    || allTests.find((t) => t.text.trim() === cleanTarget);

  if (target) {
    return {
      updatedBody: updateTestItemInMarkdown(body, target.lineIndex, completed),
      found: true,
    };
  }
  return { updatedBody: body, found: false };
}

export function getIssueBatch(issue: Issue | any): string | null {
  if (!issue || !issue.labels || !Array.isArray(issue.labels) || issue.labels.length === 0) return null;
  for (const l of issue.labels) {
    const name = (typeof l === 'string' ? l : l?.name || '').trim();
    if (name.toLowerCase().startsWith('batch:')) {
      const batchName = name.slice(6).trim();
      if (batchName) return batchName;
    }
  }
  return null;
}

export function isBatchReadyForReview(
  batchName: string,
  allIssues: Issue[]
): { ready: boolean; total: number; inReview: number; outstandingIssues: number[] } {
  const normalizedBatch = (batchName || '').trim().toLowerCase();
  if (!normalizedBatch || !Array.isArray(allIssues)) {
    return { ready: false, total: 0, inReview: 0, outstandingIssues: [] };
  }

  const seenNumbers = new Set<number>();
  const batchIssues: Issue[] = [];

  for (const issue of allIssues) {
    if (!issue || typeof issue.number !== 'number') continue;
    if (seenNumbers.has(issue.number)) continue;

    // Check if issue belongs to this batch (supports multiple batch labels)
    let belongsToBatch = false;
    if (Array.isArray(issue.labels)) {
      for (const l of issue.labels) {
        const name = (typeof l === 'string' ? l : l?.name || '').trim();
        if (name.toLowerCase().startsWith('batch:')) {
          if (name.slice(6).trim().toLowerCase() === normalizedBatch) {
            belongsToBatch = true;
            break;
          }
        }
      }
    }

    if (belongsToBatch) {
      seenNumbers.add(issue.number);
      batchIssues.push(issue);
    }
  }

  const total = batchIssues.length;
  if (total === 0) {
    return { ready: false, total: 0, inReview: 0, outstandingIssues: [] };
  }

  let inReviewCount = 0;
  const outstandingIssues: number[] = [];

  for (const issue of batchIssues) {
    const isClosed =
      (typeof issue.state === 'string' && issue.state.toLowerCase() === 'closed') ||
      (issue as any).state_reason === 'completed' ||
      (issue as any).state_reason === 'not_planned';

    const labelNames = (issue.labels || []).map((l: any) => (typeof l === 'string' ? l : l?.name || '').toLowerCase());
    const isDone =
      isClosed ||
      labelNames.includes('status:done') ||
      labelNames.includes('status:closed') ||
      labelNames.includes('done') ||
      labelNames.includes('closed') ||
      (issue as any).column === 'done' ||
      (issue as any).status === 'done';

    const isInReview =
      !isDone &&
      (labelNames.includes('status:in-review') ||
        labelNames.includes('in-review') ||
        (issue as any).column === 'in-review' ||
        (issue as any).status === 'in-review');

    if (isInReview) {
      inReviewCount++;
    } else if (!isDone) {
      outstandingIssues.push(issue.number);
    }
  }

  const ready = total > 0 && outstandingIssues.length === 0;

  return {
    ready,
    total,
    inReview: inReviewCount,
    outstandingIssues,
  };
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
  mode?: 'tag' | 'issue' | 'theme';
  customTag?: string;
  theme?: string;
  batch?: string;
}): string {
  const mode = options.mode || 'issue';
  if (mode === 'tag') {
    const tag = options.customTag || getIssuePrimaryTag(options.issue);
    return `worktree-tag-${slugify(tag || 'task')}`.slice(0, 80);
  }
  if (mode === 'theme') {
    const rawTheme = options.theme || getIssueTheme(options.issue);
    const theme = rawTheme && rawTheme !== 'No Theme' ? rawTheme : 'task';
    const batch = options.batch || getIssueBatch(options.issue);
    const themeSlug = slugify(theme, 30);
    if (batch) {
      return `${themeSlug}-${slugify(batch, 30)}`.slice(0, 80);
    }
    const issueToken = `issue-${options.issue?.number}`;
    const prefix = `${themeSlug}-${issueToken}-`;
    const remaining = Math.max(10, 80 - prefix.length);
    const branchSlug = slugify(options.issue?.title || 'task', remaining);
    return `${prefix}${branchSlug}`.slice(0, 80);
  }
  const branchSlug = slugify(options.issue?.title || 'task');
  return `issue-${options.issue?.number}-${branchSlug}`.slice(0, 80);
}

export function findThemeWorktree(
  worktrees: any[],
  themeOrIssue: string | Issue | any,
  batch?: string | null,
  projectId?: string | null
): any | null {
  if (!Array.isArray(worktrees) || worktrees.length === 0) return null;

  let theme: string | null = null;
  let issueBatch: string | null = batch || null;

  if (typeof themeOrIssue === 'string') {
    theme = themeOrIssue.trim();
  } else if (themeOrIssue && typeof themeOrIssue === 'object') {
    theme = getIssueTheme(themeOrIssue);
    if (!issueBatch) {
      issueBatch = getIssueBatch(themeOrIssue);
    }
  }

  if (!theme || theme === 'No Theme') return null;

  const themeSlug = slugify(theme);
  const themeLower = theme.toLowerCase();
  const batchSlug = issueBatch ? slugify(issueBatch) : null;
  const batchLower = issueBatch ? issueBatch.toLowerCase() : null;

  const themeBatchSlug = batchSlug ? `${themeSlug}-${batchSlug}` : null;
  const themeBatchLower = batchLower ? `${themeLower}-${batchLower}` : null;

  const getCandidateNames = (wt: any): string[] => {
    if (!wt) return [];
    if (typeof wt === 'string') return [wt];
    const dirBasename = typeof wt.directory === 'string'
      ? wt.directory.split('/').filter(Boolean).pop() || ''
      : '';
    const cleanBranch = typeof wt.branch === 'string'
      ? wt.branch.replace(/^refs\/heads\//, '').replace(/^heads\//, '').replace(/^origin\//, '')
      : '';
    return [
      wt.name,
      wt.branch,
      cleanBranch,
      dirBasename,
    ].filter(Boolean);
  };

  // 1. If batch is present, try matching <theme>-<batch> first
  if (themeBatchSlug || themeBatchLower) {
    for (const wt of worktrees) {
      if (!wt) continue;
      if (projectId && wt.projectId && wt.projectId !== projectId) continue;
      const names = getCandidateNames(wt);
      for (const n of names) {
        const nStr = String(n).trim();
        const nSlug = slugify(nStr);
        const nLower = nStr.toLowerCase();
        if (
          (themeBatchSlug && nSlug === themeBatchSlug) ||
          (themeBatchLower && nLower === themeBatchLower) ||
          (themeBatchSlug && (nSlug === `worktree-tag-${themeBatchSlug}` || nSlug === `theme-${themeBatchSlug}`)) ||
          (themeBatchLower && (nLower === `worktree-tag-${themeBatchLower}` || nLower === `theme-${themeBatchLower}`))
        ) {
          return wt;
        }
      }
    }
  }

  // 2. Match <theme>
  for (const wt of worktrees) {
    if (!wt) continue;
    if (projectId && wt.projectId && wt.projectId !== projectId) continue;
    const names = getCandidateNames(wt);
    for (const n of names) {
      const nStr = String(n).trim();
      const nSlug = slugify(nStr);
      const nLower = nStr.toLowerCase();
      if (
        nSlug === themeSlug ||
        nLower === themeLower ||
        nSlug === `worktree-tag-${themeSlug}` ||
        nSlug === `theme-${themeSlug}` ||
        nLower === `theme:${themeLower}` ||
        nLower === `worktree-tag-${themeLower}`
      ) {
        return wt;
      }
    }
  }

  return null;
}

export interface IssueSkillsResult {
  skillNames: string[];
  transclusions: string[];
}

export function resolveIssueSkills(issues: Issue | Issue[] | null | undefined): IssueSkillsResult {
  if (!issues) {
    return { skillNames: [], transclusions: [] };
  }
  const list = Array.isArray(issues) ? issues : [issues];
  const skillNames: string[] = [];
  const transclusions: string[] = [];

  for (const issue of list) {
    if (!issue) continue;
    if (Array.isArray((issue as any).skills)) {
      for (const s of (issue as any).skills) {
        if (typeof s === 'string' && s.trim()) {
          skillNames.push(s.trim());
        }
      }
    }

    const labelNames = (issue.labels || []).map((l: any) =>
      (typeof l === 'string' ? l : l.name || '').toLowerCase()
    );

    if (labelNames.some((l) => l === 'bug' || l === 'kind:bug' || l === 'type:bug' || l === 'theme:bug')) {
      skillNames.push('surgical-patch', 'debugging-and-error-recovery');
      transclusions.push('[@.agents/skills/build/refactoring/surgical-patch/SKILL.md]');
      transclusions.push('[@.agents/skills/build/domain/debugging-and-error-recovery/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'enhancement' || l === 'kind:enhancement' || l === 'type:enhancement' || l === 'feature' || l === 'theme:enhancement' || l === 'theme:feature')) {
      skillNames.push('test-driven-development', 'lean-build');
      transclusions.push('[@.agents/skills/build/methodology/test-driven-development/SKILL.md]');
      transclusions.push('[@.agents/skills/build/methodology/lean-build/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'documentation' || l === 'kind:documentation' || l === 'docs' || l === 'theme:documentation' || l === 'theme:docs')) {
      skillNames.push('documentation-and-adrs');
      transclusions.push('[@.agents/skills/ship/docs/documentation-and-adrs/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'ui' || l === 'frontend' || l === 'css' || l === 'design' || l === 'theme:ui' || l === 'theme:frontend')) {
      skillNames.push('frontend-ui-engineering');
      transclusions.push('[@.agents/skills/build/domain/frontend-ui-engineering/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'api' || l === 'backend' || l === 'schema' || l === 'contract' || l === 'theme:api' || l === 'theme:backend')) {
      skillNames.push('api-and-interface-design');
      transclusions.push('[@.agents/skills/build/domain/api-and-interface-design/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'performance' || l === 'perf' || l === 'optimization' || l === 'theme:performance' || l === 'theme:perf')) {
      skillNames.push('performance-optimization');
      transclusions.push('[@.agents/skills/build/domain/performance-optimization/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'security' || l === 'auth' || l === 'hardening' || l === 'theme:security')) {
      skillNames.push('security-and-hardening');
      transclusions.push('[@.agents/skills/review/security/security-and-hardening/SKILL.md]');
    }
    if (labelNames.some((l) => l === 'refactor' || l === 'cleanup' || l === 'tech-debt' || l === 'theme:refactor')) {
      skillNames.push('code-simplification', 'safe-refactor');
      transclusions.push('[@.agents/skills/build/refactoring/code-simplification/SKILL.md]');
      transclusions.push('[@.agents/skills/build/refactoring/safe-refactor/SKILL.md]');
    }
  }

  const uniqueSkillNames: string[] = [];
  for (const s of skillNames) {
    if (!uniqueSkillNames.includes(s)) {
      uniqueSkillNames.push(s);
    }
  }

  const uniqueTransclusions: string[] = [];
  for (const t of transclusions) {
    if (!uniqueTransclusions.includes(t)) {
      uniqueTransclusions.push(t);
    }
  }

  return { skillNames: uniqueSkillNames, transclusions: uniqueTransclusions };
}

export function buildLaunchSessionPayload(options: {
  issue: Issue;
  projectId: string;
  useWorktree?: boolean;
  branchName?: string;
  baseBranch?: string;
  prompt?: string;
  worktrees?: any[];
  existingWorktree?: any;
  skills?: string[];
}): any {
  const { issue, projectId, useWorktree = false, branchName, baseBranch, prompt } = options;

  let existingWorktree = options.existingWorktree;
  if (!existingWorktree && options.worktrees && options.worktrees.length > 0) {
    existingWorktree = findThemeWorktree(options.worktrees, issue, undefined, projectId);
  }

  let worktreePayload: any = false;
  let directory: string | undefined = undefined;

  if (existingWorktree) {
    worktreePayload = {
      kind: 'existing',
      name: existingWorktree.name || existingWorktree.branch || '',
      directory: existingWorktree.directory || '',
    };
    if (existingWorktree.directory) {
      directory = existingWorktree.directory;
    }
  } else if (useWorktree) {
    const cleanBranch = branchName
      ? branchName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
      : undefined;
    if (cleanBranch) {
      worktreePayload = { kind: 'new', name: cleanBranch, baseBranch };
    }
  }

  const cleanBranch = branchName
    ? branchName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)
    : undefined;

  const branchForData = existingWorktree
    ? (existingWorktree.branch || existingWorktree.name)
    : (useWorktree && cleanBranch ? cleanBranch : undefined);

  const declaredSkills = options.skills !== undefined
    ? options.skills
    : resolveIssueSkills(issue).skillNames;

  return {
    projectId,
    worktree: worktreePayload,
    ...(directory ? { directory } : {}),
    providerId: 'github-task-board',
    id: String(issue.number),
    title: `#${issue.number} ${issue.title || ''}`.slice(0, 150),
    url: (issue.html_url || '').slice(0, 1000),
    text: prompt || '',
    ...(declaredSkills && declaredSkills.length > 0 ? { skills: declaredSkills } : {}),
    data: {
      issueNumber: issue.number,
      ...(branchForData ? { branch: branchForData } : {}),
      ...(declaredSkills && declaredSkills.length > 0 ? { skills: declaredSkills } : {}),
    },
  };
}

export const DEFAULT_WORK_INSTRUCTIONS = `### Work Type & Proportionate Paths:
- Labels \`bug\` and \`enhancement\` are the only work-type source.
- When both or neither are present, the work type is undecided and must be asked about, not guessed. Never infer a type from the title, the mood of the report, or the area of the code.
- Undecided work type is an alignment question to the user, not a default. Only block work that depends on the unanswered question; independent authorised work continues.
- Work Log: Exactly one required sentence in the Work Log stating which work type applies and the concrete reason for it (for example the observed behaviour that contradicts a stated expectation, or the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.
- Proportionate paths:
  - Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review.
  - Feature path: desired outcome, research and alternatives, user decisions, then implementation.
  - Both paths keep existing evidence rules and existing human authority over release and closure.`;

export type WorkType = 'bug' | 'feature' | 'undecided';

export function resolveIssueWorkType(issue: Issue | null | undefined): WorkType {
  if (!issue || !Array.isArray(issue.labels)) return 'undecided';
  const labelNames = issue.labels.map((l: any) =>
    (typeof l === 'string' ? l : l?.name || '').toLowerCase().trim()
  );
  const hasBug = labelNames.includes('bug');
  const hasEnhancement = labelNames.includes('enhancement');
  if (hasBug && !hasEnhancement) return 'bug';
  if (hasEnhancement && !hasBug) return 'feature';
  return 'undecided';
}

export const DEFAULT_AI_ISSUE_PROMPT = `You are an expert software engineer creating GitHub issues for repository "{repo}".

Input Objective / User Mind-Dump:
{userInput}

Instructions for the Agent:
1. Analyze the user's input. If the user described multiple independent tasks, bugs, or features, decompose them into distinct, well-scoped GitHub issues. If it describes a single topic, create one focused issue.
2. Ground all details in the actual codebase by inspecting relevant project files, function names, and architecture. Load the \`issue-lifecycle\` skill to adhere to Issue Body Contract v1.
3. Every generated issue must follow this exact structure tailored for the OpenChamber Task Board:
   - Title: Conventional commit format (e.g. "feat(auth): add remember-me token refresh" or "fix(ui): prevent horizontal overflow in mobile table").
   - Friendly Title: Start the issue body with "### Friendly Title: <3-6 words plain English title>" before the Overview.
   - Overview: Clear description of the problem, motivation, or user value.
   - Files Impacted: List candidate file paths grounded in the codebase.
   - Acceptance Criteria: Add a "### Acceptance Criteria:" section with interactive Markdown checkboxes (- [ ]) defining testable conditions of done for human validation.
   - Actionable Subtasks Checklist: Mandatory "### Actionable Subtasks Checklist:" with interactive Markdown checkboxes (- [ ]) for each discrete implementation and verification step:
     - [ ] Reproduce with test / define contract
     - [ ] Implement core changes
     - [ ] Run test suite and verify green
   - Open Questions: Add a "### Open Questions:" section with interactive Markdown checkboxes (- [ ]) for every unresolved decision, assumption, or ambiguity that needs human alignment before implementation. Only omit this section when there is genuinely nothing to clarify.
   - Human Tasks: Add a "### Human Tasks:" section with interactive Markdown checkboxes (- [ ]) with verb-first items (e.g. "Approve ...", "Review PR #N", "Grant access to ...", "Deploy ...") written at the moment the agent blocks on a human or hands off for validation.
   - Test Plan: Add a "## Test Plan (Issue):" section with interactive Markdown checkboxes (- [ ]) listing exact automated verification commands.
   - Recommended Worktree Branch: Suggest an isolated git branch name following "issue-<number>-<slug>".
   - Labels: Recommend labels (e.g. "bug", "enhancement", "documentation"). Existing labels "bug" and "enhancement" are the single source of work type. When both or neither are present, the work type is undecided and must be asked about, not guessed; never infer a type from the title, the mood of the report, or the area of the code. Never introduce a "type:*" label or body work-type field.
   - Work Log: Optional "### Work Log:" section for execution notes and evidence. The Work Log contract requires exactly one required sentence: which work type applies and the concrete reason for it (for example the observed behaviour that contradicts a stated expectation, or the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.
4. Autonomous & AFK Protocol: If you encounter blocking decisions or credentials while the user is away, append explicit items to "### Human Tasks:" and set label "status:needs-human". If unaligned questions remain, set label "status:draft". When completely ready for execution, set "status:todo". An agent never sets phase:done, phase:archive or status:done and never closes an issue. Undecided work type is an alignment question to the user, not a default; only block work that depends on the unanswered question while independent authorised work continues.
5. Creation: If a GitHub token is configured or available in ~/.git-credentials, create issues directly via curl:
   curl -s -X POST -H "Authorization: Bearer <token>" -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/{repo}/issues -d '{"title":"...","body":"...","labels":["status:todo",...]}'
   Otherwise, present the complete, ready-to-copy issue titles and bodies for user review.`;

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
2. Ground yourself by inspecting project architecture, existing modules, conventions, and configuration files in this workspace. Load the \`issue-lifecycle\` skill to govern lifecycle states and Issue Body Contract v1.
3. Your primary goal is ALIGNMENT before issue creation:
   - For each distinct theme, identify unstated assumptions, ambiguities, technical tradeoffs, and potential edge cases.
   - Formulate probing, concise questions that need clarification (e.g. data modeling decisions, auth boundaries, UX state handling, error recovery).
   - Propose 2-3 architectural approaches or solutions for tricky decisions with pros/cons and a clear recommendation.
4. Interact directly with the user to align on answers. When human is away, record unresolved questions in the issue body.
5. Once aligned on each theme, synthesize the finalized decisions into clean, well-scoped GitHub issues adhering to Issue Body Contract v1:
   - Title in Conventional Commit format
   - Friendly Title: "### Friendly Title: <3-6 words plain English title>"
   - Overview: "## Overview" with problem description and user value
   - Acceptance Criteria: "### Acceptance Criteria:" with testable checkboxes (- [ ])
   - Actionable Subtasks Checklist: "### Actionable Subtasks Checklist:" with discrete implementation steps (- [ ])
   - Open Questions: "### Open Questions:" (- [ ] unresolved, - [x] answered)
   - Human Tasks: "### Human Tasks:" with verb-first items for verification
   - Test Plan: "## Test Plan (Issue):" with verification commands (- [ ])
   - Suggested worktree branch slug ("issue-<number>-<slug>")`;

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

export interface DraftIssue {
  title: string;
  body: string;
  subtasks?: string[];
  openQuestions?: string[];
  labels?: string[];
  repo?: string;
  sessionId?: string | null;
  status?: 'drafting' | 'ready' | 'failed';
}

export function parseDraftIssueFromMarkdown(text: string | null | undefined): DraftIssue | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean) return null;

  const lines = clean.split('\n');
  let title = '';
  let labels: string[] = [];
  const bodyLines: string[] = [];
  let titleFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for explicit "Title: <text>" or "Issue Title: <text>"
    const titleMatch = /^title:\s*(.+)$/i.exec(trimmed) || /^issue title:\s*(.+)$/i.exec(trimmed);
    if (!titleFound && titleMatch) {
      title = titleMatch[1].trim();
      titleFound = true;
      continue;
    }

    // Check for H1 "# <text>"
    const h1Match = /^#\s+(.+)$/.exec(trimmed);
    if (!titleFound && h1Match) {
      title = h1Match[1].trim();
      titleFound = true;
      continue;
    }

    // Check for explicit "Labels: a, b" or "Tags: a, b"
    const labelsMatch = /^(?:labels|tags):\s*(.+)$/i.exec(trimmed);
    if (labelsMatch) {
      const extracted = labelsMatch[1]
        .split(/[,;\s]+/)
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);
      labels.push(...extracted);
      continue;
    }

    bodyLines.push(line);
  }

  // Fallback: If no markdown header or explicit title prefix was found,
  // use the first non-empty line as title, and the rest as body
  if (!titleFound) {
    let firstNonEmptyIdx = -1;
    for (let i = 0; i < bodyLines.length; i++) {
      if (bodyLines[i].trim()) {
        firstNonEmptyIdx = i;
        break;
      }
    }
    if (firstNonEmptyIdx >= 0) {
      title = bodyLines[firstNonEmptyIdx].trim();
      bodyLines.splice(firstNonEmptyIdx, 1);
    }
  }

  // Clean title delimiters
  title = title.replace(/^[*_"`#]+|[*_"`#]+$/g, '').trim();
  if (!title) return null;

  const body = bodyLines.join('\n').trim();

  // Extract subtasks and open questions from the body
  const subtasks = parseSubtasks(body).map((s) => s.text);
  const openQuestions = parseOpenQuestions(body).map((q) => q.text);

  if (!labels.some((l) => l.startsWith('status:'))) {
    labels.push('status:todo');
  }

  return {
    title,
    body,
    subtasks,
    openQuestions,
    labels: Array.from(new Set(labels)),
    status: 'ready',
  };
}

export function formatDraftReviewMeta(subtaskCount: number, questionCount: number): string {
  const subtaskLabel = subtaskCount === 1 ? '1 subtask' : `${subtaskCount} subtasks`;
  const questionLabel = questionCount === 1 ? '1 question' : `${questionCount} questions`;
  return `${subtaskLabel} · ${questionLabel}`;
}

export function createDraftIssuePayload(draft: {
  title: string;
  body?: string;
  labels?: string[];
}): { title: string; body: string; labels: string[] } {
  const cleanTitle = (draft?.title || '').trim();
  if (!cleanTitle) {
    throw new Error('Draft issue must have a non-empty title');
  }
  const cleanBody = (draft?.body || '').trim();
  let labels = Array.isArray(draft?.labels) ? [...draft.labels] : [];
  if (!labels.some((l) => l.startsWith('status:'))) {
    labels.push('status:todo');
  }
  return {
    title: cleanTitle,
    body: cleanBody,
    labels: Array.from(new Set(labels)),
  };
}

export function buildIssueAttachPayload(issue: Issue, repoOverride?: string) {
  const numStr = String(issue.number);
  const title = `#${issue.number} ${issue.title || ''}`.slice(0, 150);
  const url = (issue.html_url || '').slice(0, 1000);
  const text = `Context from GitHub Issue #${issue.number}: ${issue.title || ''}\n\n${issue.body || ''}`.slice(0, 15000);
  const extractRepo = (val: string | null | undefined): string | null => {
    if (!val || typeof val !== 'string') return null;
    const apiMatch = /api\.github\.com\/repos\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (apiMatch) return `${apiMatch[1]}/${apiMatch[2].replace(/\.git$/, '')}`;
    const githubMatch = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (githubMatch) return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, '')}`;
    const cleaned = val.trim().replace(/\.git$/, '');
    if (/^[^/\s]+\/[^/\s]+$/.test(cleaned)) return cleaned;
    return null;
  };
  const repo = extractRepo(repoOverride) ||
    extractRepo(issue.repo) ||
    extractRepo((issue as any)?.repository_url) ||
    extractRepo(issue.html_url);
  return {
    providerId: 'github-task-board',
    id: numStr,
    title,
    url,
    text,
    ...(issue.user?.login ? { author: String(issue.user.login) } : {}),
    data: {
      issueNumber: issue.number,
      ...(repo ? { repo } : {}),
    },
  };
}

export function buildMultiIssueAttachPayload(issues: Issue[], repo: string = '') {
  const extractRepo = (val: string | null | undefined): string | null => {
    if (!val || typeof val !== 'string') return null;
    const apiMatch = /api\.github\.com\/repos\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (apiMatch) return `${apiMatch[1]}/${apiMatch[2].replace(/\.git$/, '')}`;
    const githubMatch = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (githubMatch) return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, '')}`;
    const cleaned = val.trim().replace(/\.git$/, '');
    if (/^[^/\s]+\/[^/\s]+$/.test(cleaned)) return cleaned;
    return null;
  };

  if (!issues || issues.length === 0) {
    const resolvedEmptyRepo = extractRepo(repo);
    return {
      providerId: 'github-task-board',
      id: 'bundle-empty',
      title: 'No Issues Selected',
      url: repo ? `https://github.com/${repo}/issues` : '',
      text: 'No issues attached.',
      data: {
        issueNumbers: [],
        count: 0,
        isMulti: true,
        ...(resolvedEmptyRepo ? { repo: resolvedEmptyRepo } : {}),
      },
    };
  }
  if (issues.length === 1) {
    return buildIssueAttachPayload(issues[0], repo);
  }
  const numbers = issues.map((i) => i.number);
  const id = `bundle-${numbers.join('-')}`.slice(0, 120);
  const titlesPreview = issues.map((i) => `#${i.number}`).join(', ');
  const title = `[${issues.length} Issues] ${titlesPreview}`.slice(0, 150);
  const primaryUrl = (issues[0]?.html_url || (repo ? `https://github.com/${repo}/issues` : '')).slice(0, 1000);
  const issueEntries = issues.map((i) => {
    const itemRepo = extractRepo(i.repo) || extractRepo((i as any)?.repository_url) || extractRepo(i.html_url) || extractRepo(repo);
    return {
      number: i.number,
      ...(itemRepo ? { repo: itemRepo } : {}),
    };
  });
  const distinctRepos = new Set(issueEntries.map((e) => e.repo).filter(Boolean));
  const uniformRepo = distinctRepos.size === 1
    ? Array.from(distinctRepos)[0]
    : (extractRepo(repo) || null);

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
      issues: issueEntries,
      ...(uniformRepo ? { repo: uniformRepo } : {}),
    },
  };
}

export function mergeSessionItems(
  existingItems: any[] | undefined | null,
  newItems: any[] | any
): any[] {
  const result: any[] = Array.isArray(existingItems) ? [...existingItems] : [];
  const incoming = Array.isArray(newItems) ? newItems : (newItems ? [newItems] : []);

  for (const item of incoming) {
    if (!item) continue;
    const itemId = item.id ? String(item.id) : null;
    const itemNum = item.data?.issueNumber != null
      ? Number(item.data.issueNumber)
      : (itemId && /^\d+$/.test(itemId) ? parseInt(itemId, 10) : null);

    const existingIdx = result.findIndex((existing) => {
      if (!existing) return false;
      if (itemId && existing.id && String(existing.id) === itemId) return true;
      if (
        itemNum != null &&
        ((existing.data?.issueNumber != null && Number(existing.data.issueNumber) === itemNum) ||
          (existing.id && String(existing.id) === String(itemNum)))
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx >= 0) {
      const existing = result[existingIdx];
      const mergedData = { ...(existing.data || {}), ...(item.data || {}) };
      if (Array.isArray(existing.data?.issueNumbers) || Array.isArray(item.data?.issueNumbers)) {
        const combined = new Set([
          ...(Array.isArray(existing.data?.issueNumbers) ? existing.data.issueNumbers : []),
          ...(Array.isArray(item.data?.issueNumbers) ? item.data.issueNumbers : []),
        ]);
        mergedData.issueNumbers = Array.from(combined);
      }
      result[existingIdx] = { ...existing, ...item, data: mergedData };
    } else {
      result.push(item);
    }
  }

  return result;
}

export function attachIssueToSession(session: any, issueOrPayload: Issue | any): any {
  if (!session) return session;
  const payload =
    issueOrPayload && typeof issueOrPayload === 'object' && 'providerId' in issueOrPayload
      ? issueOrPayload
      : issueOrPayload && typeof issueOrPayload === 'object' && 'number' in issueOrPayload
      ? buildIssueAttachPayload(issueOrPayload)
      : issueOrPayload;

  session.items = mergeSessionItems(session.items, payload);
  return session;
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
    const hasChecklistInBody = typeof issue.body === 'string' && issue.body.includes('### Actionable Subtasks Checklist:');
    if (!hasChecklistInBody && issue.subtasks && issue.subtasks.length > 0) {
      prompt += `### Actionable Subtasks Checklist:\n`;
      issue.subtasks.forEach((s) => {
        prompt += `- [${s.completed ? 'x' : ' '}] ${s.text}\n`;
      });
      prompt += '\n';
    }
    prompt += '---\n\n';
  });

  const { skillNames, transclusions } = resolveIssueSkills(selectedIssues);
  if (skillNames.length > 0) {
    const skillList = skillNames.map((s) => '`skill({ id: \'' + s + '\' })`').join(', ');
    prompt += `### Recommended Skills:\n`;
    prompt += `Load relevant skills with the \`skill\` tool before starting (e.g. ${skillList}).\n`;
    prompt += `Transclusion references for worker sessions:\n${transclusions.join('\n')}\n\n`;
  }

  prompt += `### Autonomous & AFK Protocol:\n`;
  prompt += `- Work through the packaged issues sequentially or in coordination, verifying each step with tests.\n`;
  prompt += `- If blocked on human decisions, permissions, or secrets while the human is away, record explicit items under "### Human Tasks:" in the issue body, mark "status:needs-human", and continue with any unblocked tasks.\n\n`;

  prompt += `### Work Type & Proportionate Paths:\n`;
  prompt += `- Labels \`bug\` and \`enhancement\` are the only work-type source.\n`;
  prompt += `- When both or neither are present, the work type is undecided and must be asked about, not guessed. Never infer a type from the title, the mood of the report, or the area of the code.\n`;
  prompt += `- Undecided work type is an alignment question to the user, not a default. Only block work that depends on the unanswered question; independent authorised work continues.\n`;
  prompt += `- Work Log: Exactly one required sentence in the Work Log stating which work type applies and the concrete reason for it (for example the observed behaviour that contradicts a stated expectation, or the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.\n`;
  prompt += `- Proportionate paths:\n`;
  prompt += `  - Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review.\n`;
  prompt += `  - Feature path: desired outcome, research and alternatives, user decisions, then implementation.\n`;
  prompt += `  - Both paths keep existing evidence rules and existing human authority over release and closure.\n\n`;

  prompt += `Please inspect the codebase, address all packaged issues sequentially or in coordination, verify each with tests, and report back.`;
  return prompt;
}

export const DEFAULT_TEMPLATES: Record<string, { id: string; name: string; description: string; promptInstructions: string }> = {
  bug: {
    id: 'bug',
    name: 'Bug Report',
    description: 'Investigate unexpected behavior, identify root cause, and draft fix subtasks',
    promptInstructions: `### Problem Description
[Detailed explanation of observed versus expected behaviour, including error messages]

### Steps to Reproduce
1. [First step]
2. [Second step]

### Root Cause Analysis
[Inspect the relevant codebase files and explain the underlying mechanism]

### Actionable Fix Subtasks
- [ ] Reproduce with an isolated test
- [ ] Implement narrow surgical fix
- [ ] Verify test suite passes
- [ ] Verify regression resistance`,
  },
  feature: {
    id: 'feature',
    name: 'Feature / Enhancement',
    description: 'Design and specify new functionality with architectural plan and subtasks',
    promptInstructions: `### Goal & User Value
[Desired outcome: why this feature is needed and what problem it solves]

### Research & Alternatives
[Explore alternatives, trade-offs, and design choices]

### Architectural & UI Design
[Proposed technical architecture, component structure, or API changes]

### Actionable Implementation Subtasks
- [ ] Define interfaces and types
- [ ] Align on user decisions
- [ ] Implement core logic / components
- [ ] Add unit and integration tests
- [ ] Verify end-to-end user flow`,
  },
  task: {
    id: 'task',
    name: 'Technical Debt / Refactor',
    description: 'Code cleanup, performance optimization, or architecture simplification',
    promptInstructions: `### Motivation
[Identify dead code, performance bottlenecks, or architectural complexity]

### Scope of Refactoring
[Specific files and modules to touch, and what must remain unchanged]

### Actionable Checklist
- [ ] Establish baseline test coverage
- [ ] Perform behavior-preserving refactoring
- [ ] Verify existing tests continue to pass without regressions`,
  },
};

export function mergeTemplates(
  defaults: Record<string, any>,
  userCustomTemplates?: Record<string, any> | null
): Record<string, any> {
  if (!userCustomTemplates || typeof userCustomTemplates !== 'object') {
    return { ...defaults };
  }
  const result = { ...defaults };
  for (const [key, val] of Object.entries(userCustomTemplates)) {
    if (val && typeof val === 'object' && val.promptInstructions) {
      result[key] = {
        ...(result[key] || { id: key, name: key }),
        ...val,
      };
    }
  }
  return result;
}

export function buildAgentIssuePrompt({
  repo,
  template,
  userGoal,
}: {
  repo: string;
  template: { name: string; promptInstructions: string };
  userGoal: string;
}): string {
  return `You are tasked with drafting and creating a new GitHub Issue for repository "${repo}".

User Objective / Summary:
${userGoal.trim()}

Template Specification (${template.name}):
Follow this exact structure and include actionable markdown subtasks (- [ ]):

${template.promptInstructions.trim()}

Instructions for the Agent:
1. Inspect the relevant repository files in the project to gather accurate context, file paths, and function names.
2. Structure the issue clearly with a concise title and the markdown body following the template above.
3. Include an interactive checklist of subtasks with "- [ ]".
4. Once you have drafted the complete issue, ask the user for confirmation or output the finalized issue so it can be committed to GitHub.`;
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

export function renderBlockerChip(target: { number: number } | number, blocker: number): string {
  const targetNum = typeof target === 'number' ? target : target.number;
  return `<span class="graph-badge-blocked-item">#${blocker} <button class="btn-remove-blocker" data-target="${targetNum}" data-blocker="${blocker}" title="Remove dependency">&times;</button></span>`;
}

export function renderBlockerChips(target: { number: number } | number, blockers: number[]): string {
  if (!blockers || blockers.length === 0) return '';
  const targetNum = typeof target === 'number' ? target : target.number;
  return blockers.map((b) => renderBlockerChip(targetNum, b)).join(' ');
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

export function buildSessionIndex(sessions: any[]): Map<number, any> {
  const index = new Map<number, any>();
  if (!sessions || !Array.isArray(sessions)) return index;

  const activityPriority = (act: string): number => {
    if (act === 'running') return 4;
    if (act === 'waiting-permission' || act === 'waiting-question' || (typeof act === 'string' && act.startsWith('waiting'))) return 3;
    if (act === 'idle') return 2;
    return 1;
  };

  const register = (issueNum: number, session: any) => {
    if (!Number.isFinite(issueNum) || issueNum <= 0) return;
    const existing = index.get(issueNum);
    if (!existing) {
      index.set(issueNum, session);
    } else {
      const existingPrio = activityPriority(existing.activity || '');
      const newPrio = activityPriority(session.activity || '');
      if (newPrio > existingPrio) {
        index.set(issueNum, session);
      }
    }
  };

  for (const s of sessions) {
    if (!s) continue;
    if (Array.isArray(s.items)) {
      for (const item of s.items) {
        if (!item) continue;
        if (item.id && /^\d+$/.test(item.id)) {
          register(parseInt(item.id, 10), s);
        }
        if (item.data?.issueNumber != null) {
          register(parseInt(String(item.data.issueNumber), 10), s);
        }
        if (Array.isArray(item.data?.issueNumbers)) {
          for (const n of item.data.issueNumbers) {
            register(parseInt(String(n), 10), s);
          }
        }
      }
    }
    if (s.data?.issueNumber != null) {
      register(parseInt(String(s.data.issueNumber), 10), s);
    }
    if (Array.isArray(s.data?.issueNumbers)) {
      for (const n of s.data.issueNumbers) {
        register(parseInt(String(n), 10), s);
      }
    }
    if (typeof s.title === 'string') {
      const matches = s.title.matchAll(/#(\d+)(?=[^0-9]|$)/g);
      for (const m of matches) {
        register(parseInt(m[1], 10), s);
      }
    }
    const wtStrings: string[] = [];
    if (typeof s.worktree === 'string') {
      wtStrings.push(s.worktree);
    } else if (s.worktree && typeof s.worktree === 'object') {
      if (s.worktree.name) wtStrings.push(String(s.worktree.name));
      if (s.worktree.branch) wtStrings.push(String(s.worktree.branch));
      if (s.worktree.directory) wtStrings.push(String(s.worktree.directory));
    }
    for (const wtStr of wtStrings) {
      const wtMatches = wtStr.matchAll(/(?:^|[^a-zA-Z0-9])issue-(\d+)(?=[^0-9]|$)/gi);
      for (const m of wtMatches) {
        register(parseInt(m[1], 10), s);
      }
    }
  }

  return index;
}

export function scopeDoneIssues(
  doneIssues: any[],
  limit: number = 25,
  showAll: boolean = false
): { visible: any[]; total: number; remaining: number } {
  if (!doneIssues || !Array.isArray(doneIssues)) {
    return { visible: [], total: 0, remaining: 0 };
  }
  const total = doneIssues.length;
  if (showAll || total <= limit) {
    return { visible: doneIssues, total, remaining: 0 };
  }
  return {
    visible: doneIssues.slice(0, limit),
    total,
    remaining: total - limit,
  };
}

export function isIssueClosed(issue: Issue | any): boolean {
  if (!issue) return false;
  if (issue.state === 'closed') return true;
  if (issue.state_reason === 'completed' || issue.state_reason === 'not_planned') return true;
  const labelNames = (issue.labels || []).map((l: any) =>
    (typeof l === 'string' ? l : l?.name || '').toLowerCase()
  );
  if (
    labelNames.includes('status:done') ||
    labelNames.includes('status:closed') ||
    labelNames.includes('done') ||
    labelNames.includes('closed')
  ) {
    return true;
  }
  return false;
}

export function resolveMatchedSession(issue: Issue | any, sessionOrList?: any): any | null {
  if (!sessionOrList || !issue) return null;
  const issueNum = typeof issue.number === 'number' ? issue.number : parseInt(String(issue.number || issue.id || 0), 10);
  const issueNumStr = String(issueNum);

  const isBoundToOther = (s: any, currentNum: number): boolean => {
    if (!s || !currentNum) return false;
    const currentStr = String(currentNum);
    if (Array.isArray(s.items)) {
      for (const it of s.items) {
        if (!it) continue;
        if (it.id === currentStr) return false;
        const otherNum =
          it.data?.issueNumber ||
          (Array.isArray(it.data?.issueNumbers) && it.data.issueNumbers[0]) ||
          (Number.isFinite(Number(it.id)) ? Number(it.id) : null);
        if (otherNum && Number(otherNum) !== currentNum) return true;
      }
    }
    if (typeof s.title === 'string') {
      const match = s.title.match(/#(\d+)/);
      if (match && Number(match[1]) !== currentNum) return true;
    }
    const wtName = typeof s.worktree === 'string'
      ? s.worktree
      : (s.worktree?.name || s.worktree?.branch || s.worktree?.directory || '');
    if (wtName) {
      const match = wtName.match(/issue-(\d+)/);
      if (match && Number(match[1]) !== currentNum) return true;
    }
    return false;
  };

  if (Array.isArray(sessionOrList)) {
    if (Number.isFinite(issueNum) && issueNum > 0) {
      return (
        sessionOrList.find((s: any) => {
          if (!s) return false;
          if (
            s.items &&
            Array.isArray(s.items) &&
            s.items.some(
              (it: any) =>
                it &&
                (it.id === issueNumStr ||
                  it.data?.issueNumber === issueNum ||
                  (Array.isArray(it.data?.issueNumbers) && it.data.issueNumbers.includes(issueNum)))
            )
          ) {
            return true;
          }
          if (
            s.data &&
            (s.data.issueNumber === issueNum ||
              (Array.isArray(s.data.issueNumbers) && s.data.issueNumbers.includes(issueNum)))
          ) {
            return true;
          }
          if (typeof s.title === 'string' && s.title.includes(`#${issueNum}`)) return true;
          const wtName = typeof s.worktree === 'string'
            ? s.worktree
            : (s.worktree?.name || s.worktree?.branch || s.worktree?.directory || '');
          if (wtName && wtName.includes(`issue-${issueNum}`)) return true;
          return false;
        }) || (sessionOrList.length === 1 && !isBoundToOther(sessionOrList[0], issueNum) ? sessionOrList[0] : null)
      );
    }
    return sessionOrList.length === 1 ? sessionOrList[0] : null;
  } else if (typeof sessionOrList === 'object') {
    if (Number.isFinite(issueNum) && issueNum > 0 && isBoundToOther(sessionOrList, issueNum)) {
      return null;
    }
    return sessionOrList;
  }
  return null;
}

const ATTENTION_PRECEDENCE: Record<HumanAttention, number> = {
  'needs-permission': 4,
  'needs-decision': 3,
  'needs-review': 2,
  none: 1,
};

const PHASE_PRECEDENCE: Record<WorkflowPhase, number> = {
  done: 10,
  archive: 9,
  publication: 8,
  human_verification: 7,
  verification: 6,
  execution: 5,
  planning: 4,
  alignment: 3,
  exploration: 2,
  draft: 1,
};

const LIVENESS_PRECEDENCE: Record<ExecutionLiveness, number> = {
  failed: 5,
  retrying: 4,
  running: 3,
  completed: 2,
  idle: 1,
};

export function resolveV2Metadata(
  issue: Issue | any,
  session?: any,
  allIssues?: Issue[]
): V2IssueMetadata {
  if (!issue) {
    return {
      phase: 'draft',
      attention: 'none',
      liveness: 'idle',
      dependencyState: 'ready',
      isExplicitV2: false,
    };
  }

  const rawLabels = Array.isArray(issue.labels) ? issue.labels : [];
  const labelNames = rawLabels.map((l: any) =>
    (typeof l === 'string' ? l : l?.name || '').trim().toLowerCase()
  );

  let phase: WorkflowPhase | null = null;
  let attention: HumanAttention | null = null;
  let liveness: ExecutionLiveness | null = null;
  let dependencyState: DependencyState | null = null;
  let isExplicitV2 = false;

  // 1. Explicit V2 Labels with deterministic precedence
  for (const name of labelNames) {
    if (name.startsWith('phase:')) {
      const p = name.slice(6).trim().replace(/-/g, '_');
      if (
        p === 'draft' ||
        p === 'exploration' ||
        p === 'alignment' ||
        p === 'planning' ||
        p === 'execution' ||
        p === 'verification' ||
        p === 'human_verification' ||
        p === 'publication' ||
        p === 'done' ||
        p === 'archive'
      ) {
        const candidate = p as WorkflowPhase;
        if (!phase || PHASE_PRECEDENCE[candidate] > PHASE_PRECEDENCE[phase]) {
          phase = candidate;
        }
        isExplicitV2 = true;
      }
    } else if (name.startsWith('attention:')) {
      const a = name.slice(10).trim();
      if (
        a === 'none' ||
        a === 'needs-decision' ||
        a === 'needs-permission' ||
        a === 'needs-review'
      ) {
        const candidate = a as HumanAttention;
        if (!attention || ATTENTION_PRECEDENCE[candidate] > ATTENTION_PRECEDENCE[attention]) {
          attention = candidate;
        }
        isExplicitV2 = true;
      }
    } else if (name.startsWith('liveness:')) {
      const l = name.slice(9).trim();
      if (
        l === 'idle' ||
        l === 'running' ||
        l === 'retrying' ||
        l === 'failed' ||
        l === 'completed'
      ) {
        const candidate = l as ExecutionLiveness;
        if (!liveness || LIVENESS_PRECEDENCE[candidate] > LIVENESS_PRECEDENCE[liveness]) {
          liveness = candidate;
        }
      }
    } else if (name === 'dependency:blocked' || name === 'dependency:blocked-by-dependency') {
      dependencyState = 'blocked-by-dependency';
    } else if (name === 'dependency:ready') {
      if (dependencyState !== 'blocked-by-dependency') {
        dependencyState = 'ready';
      }
    }
  }

  // Check explicit properties on issue / issue.v2Metadata if not set by labels
  if (!phase) {
    const rawPhase = (issue as any).phase || (issue.v2Metadata?.isExplicitV2 ? issue.v2Metadata.phase : null);
    if (rawPhase && typeof rawPhase === 'string') {
      const p = rawPhase.trim().toLowerCase().replace(/-/g, '_');
      if (
        p === 'draft' ||
        p === 'exploration' ||
        p === 'alignment' ||
        p === 'planning' ||
        p === 'execution' ||
        p === 'verification' ||
        p === 'human_verification' ||
        p === 'publication' ||
        p === 'done' ||
        p === 'archive'
      ) {
        phase = p as WorkflowPhase;
        isExplicitV2 = true;
      }
    }
  }

  if (!attention) {
    const rawAttention = (issue as any).attention || (issue.v2Metadata?.isExplicitV2 ? issue.v2Metadata.attention : null);
    if (rawAttention && typeof rawAttention === 'string') {
      const a = rawAttention.trim().toLowerCase();
      if (a === 'none' || a === 'needs-decision' || a === 'needs-permission' || a === 'needs-review') {
        attention = a as HumanAttention;
        isExplicitV2 = true;
      }
    }
  }

  const closed = isIssueClosed(issue);

  // 2. Phase Fallback Projection (when phase is null)
  if (!phase) {
    if (closed) {
      phase = 'done';
    } else if (labelNames.includes('archived') || labelNames.includes('archive')) {
      phase = 'archive';
    } else if (labelNames.includes('status:in-review')) {
      phase = 'verification';
    } else if (labelNames.includes('status:in-progress')) {
      phase = 'execution';
    } else if (labelNames.includes('status:planned') || labelNames.includes('status:todo')) {
      phase = 'planning';
    } else if (labelNames.includes('status:needs-alignment')) {
      phase = 'alignment';
    } else if (labelNames.includes('status:draft') || labelNames.includes('status:backlog')) {
      phase = 'draft';
    } else if (labelNames.includes('status:needs-human')) {
      phase = 'execution';
    } else if (isVagueIdea(issue)) {
      phase = 'draft';
    } else {
      phase = 'planning';
    }
  }

  const matchedSession = resolveMatchedSession(issue, session);

  // 3. Attention Fallback Projection (when attention is null)
  if (!attention) {
    if (closed || phase === 'done' || phase === 'archive') {
      attention = 'none';
    } else {
      // Check attached session activity
      if (matchedSession) {
        const act = (typeof matchedSession.activity === 'string' ? matchedSession.activity : '').trim();
        if (act === 'waiting-permission') {
          attention = 'needs-permission';
        } else if (act === 'waiting-question') {
          attention = 'needs-decision';
        } else if (act === 'waiting-review') {
          attention = 'needs-review';
        } else if (act.startsWith('waiting')) {
          attention = 'needs-decision';
        }
      }

      if (!attention) {
        const humanTasks = Array.isArray(issue.humanTasks)
          ? issue.humanTasks
          : parseHumanTasks(typeof issue.body === 'string' ? issue.body : '');
        const openHumanTasks = humanTasks.filter((t: any) => !t.completed);

        if (openHumanTasks.length > 0) {
          const hasPerm = openHumanTasks.some((t: any) =>
            /\b(permission|grant|access|secret|token|credential|deploy|provision)\b/i.test(t.text)
          );
          const hasDec = openHumanTasks.some((t: any) =>
            /\b(decide|decision|choose|choice|answer)\b/i.test(t.text)
          );
          if (hasPerm) {
            attention = 'needs-permission';
          } else if (hasDec) {
            attention = 'needs-decision';
          } else {
            attention = 'needs-review';
          }
        } else {
          const questions = Array.isArray(issue.openQuestions)
            ? issue.openQuestions
            : parseOpenQuestions(typeof issue.body === 'string' ? issue.body : '');
          const openQuestions = questions.filter((q: any) => !q.completed);

          if (openQuestions.length > 0) {
            attention = 'needs-decision';
          } else if (labelNames.includes('status:needs-human')) {
            attention = 'needs-review';
          } else {
            attention = 'none';
          }
        }
      }
    }
  }

  // 4. Liveness Fallback (when liveness is null)
  if (!liveness) {
    if (matchedSession) {
      const act = (typeof matchedSession.activity === 'string' ? matchedSession.activity : '').trim();
      const stat = (typeof matchedSession.status === 'string' ? matchedSession.status : '').trim();
      if (act === 'running' || stat === 'running') {
        liveness = 'running';
      } else if (act === 'retrying' || stat === 'retrying') {
        liveness = 'retrying';
      } else if (act === 'failed' || stat === 'failed' || matchedSession.error) {
        liveness = 'failed';
      } else if (act === 'completed' || stat === 'completed') {
        liveness = 'completed';
      } else {
        liveness = 'idle';
      }
    } else if (closed || phase === 'done') {
      liveness = 'completed';
    } else {
      liveness = 'idle';
    }
  }

  // 5. DependencyState Fallback (when dependencyState is null)
  if (!dependencyState) {
    const blockers = parseIssueDependencies(typeof issue.body === 'string' ? issue.body : '');
    if (blockers.length > 0) {
      if (allIssues && Array.isArray(allIssues) && allIssues.length > 0) {
        const openBlockers = blockers.filter((num) => {
          const target = allIssues.find((i) => i.number === num);
          if (!target) return true;
          return !isIssueClosed(target);
        });
        dependencyState = openBlockers.length > 0 ? 'blocked-by-dependency' : 'ready';
      } else {
        dependencyState = 'blocked-by-dependency';
      }
    } else {
      dependencyState = 'ready';
    }
  }

  return {
    phase,
    attention,
    liveness,
    dependencyState,
    isExplicitV2,
  };
}

export function resolveIssueColumn(
  issue: Issue | any,
  sessionOrList?: any
): ColumnId | null {
  if (!issue) return null;
  if (isIssueClosed(issue)) {
    return 'done';
  }

  const rawLabels = Array.isArray(issue.labels) ? issue.labels : [];
  const labelNames = rawLabels.map((l: any) =>
    (typeof l === 'string' ? l : l?.name || '').trim().toLowerCase()
  );

  // 1. Direct v1 status matches
  if (labelNames.includes('status:done')) return 'done';
  if (labelNames.includes('status:in-review')) return 'in-review';
  if (labelNames.includes('status:needs-human')) return 'needs-human';

  const matchedSession = resolveMatchedSession(issue, sessionOrList);
  const isSessionRunning = Boolean(matchedSession && matchedSession.activity === 'running');
  const isSessionWaiting = Boolean(
    matchedSession &&
      (matchedSession.activity === 'waiting-permission' ||
        matchedSession.activity === 'waiting-question' ||
        matchedSession.activity.startsWith('waiting'))
  );
  const isSessionIdle = Boolean(matchedSession && matchedSession.activity === 'idle');

  // Explicit status:in-progress label
  if (labelNames.includes('status:in-progress')) {
    if (isSessionIdle || isSessionWaiting) {
      return 'needs-human';
    }
    return 'in-progress';
  }

  // Explicit status:planned label
  if (labelNames.includes('status:planned')) {
    if (isSessionRunning) return 'in-progress';
    if (isSessionWaiting) return 'needs-human';
    return 'planned';
  }

  // Explicit status:todo label
  if (labelNames.includes('status:todo')) {
    if (isSessionRunning) return 'in-progress';
    if (isSessionWaiting) return 'needs-human';
    return 'todo';
  }

  // Explicit status:backlog label
  if (labelNames.includes('status:backlog')) {
    if (isSessionRunning) return 'in-progress';
    if (isSessionWaiting) return 'needs-human';
    return 'backlog';
  }

  // Explicit status:draft
  if (labelNames.includes('status:draft')) {
    if (isSessionRunning) return 'in-progress';
    if (isSessionWaiting || isSessionIdle) return 'needs-human';
    return 'draft';
  }

  // Check if explicit v2 labels exist
  const hasExplicitPhase = labelNames.some((l: string) => l.startsWith('phase:'));
  const hasExplicitAttention = labelNames.some((l: string) => l.startsWith('attention:'));

  if (hasExplicitPhase || hasExplicitAttention || issue.v2Metadata?.isExplicitV2) {
    const meta = issue.v2Metadata && issue.v2Metadata.isExplicitV2
      ? issue.v2Metadata
      : resolveV2Metadata(issue, sessionOrList);

    if (meta.phase === 'done' || meta.phase === 'archive') {
      return 'done';
    }

    if (isSessionWaiting || isSessionIdle) {
      return 'needs-human';
    }

    if (meta.attention === 'needs-decision' || meta.attention === 'needs-permission' || meta.attention === 'needs-review') {
      return 'needs-human';
    }

    if (isSessionRunning) {
      return 'in-progress';
    }

    switch (meta.phase) {
      case 'draft':
      case 'exploration':
      case 'alignment':
        return 'draft';
      case 'planning':
        return 'todo';
      case 'execution':
        return 'in-progress';
      case 'verification':
      case 'publication':
        return 'in-review';
      case 'human_verification':
        return 'needs-human';
      case 'done':
      case 'archive':
        return 'done';
      default:
        return 'todo';
    }
  }

  // Legacy fallback for issues without status labels or v2 labels:
  if (isVagueIdea(issue)) {
    if (isSessionRunning) return 'in-progress';
    if (isSessionWaiting || isSessionIdle) return 'needs-human';
    return 'draft';
  }

  if (matchedSession) {
    if (isSessionRunning) return 'in-progress';
    if (isSessionWaiting || isSessionIdle) return 'needs-human';
  }

  return 'todo';
}

export function groupIssuesByAttention(
  issues: Issue[],
  sessionIndex?: Map<number, any> | any
): Record<HumanAttention, Issue[]> {
  const groups: Record<HumanAttention, Issue[]> = {
    'needs-decision': [],
    'needs-permission': [],
    'needs-review': [],
    none: [],
  };

  if (!issues || !Array.isArray(issues)) {
    return groups;
  }

  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') {
      continue;
    }

    let session: any = null;
    if (sessionIndex) {
      if (sessionIndex instanceof Map) {
        if (Number.isFinite(issue.number)) {
          session = sessionIndex.get(issue.number);
        }
        if (!session) {
          const rKey = issueRepoKey(issue);
          if (rKey) session = sessionIndex.get(rKey);
        }
      } else if (Array.isArray(sessionIndex)) {
        session = resolveMatchedSession(issue, sessionIndex);
      } else if (typeof sessionIndex === 'object') {
        if (Number.isFinite(issue.number) && (sessionIndex as any)[issue.number]) {
          session = (sessionIndex as any)[issue.number];
        } else {
          session = resolveMatchedSession(issue, sessionIndex);
        }
      }
    }

    const meta = resolveV2Metadata(issue, session, issues);
    const att = meta && meta.attention;
    const targetGroup: HumanAttention =
      att === 'needs-decision' || att === 'needs-permission' || att === 'needs-review'
        ? att
        : 'none';

    groups[targetGroup].push(issue);
  }

  return groups;
}

export function filterIssuesByAttention(
  issues: Issue[],
  attention: HumanAttention,
  sessionIndex?: Map<number, any> | any
): Issue[] {
  if (!issues || !Array.isArray(issues)) {
    return [];
  }
  const validAttentions: ReadonlySet<HumanAttention> = new Set([
    'none',
    'needs-decision',
    'needs-permission',
    'needs-review',
  ]);
  if (!validAttentions.has(attention)) {
    return [];
  }
  const grouped = groupIssuesByAttention(issues, sessionIndex);
  return grouped[attention] || [];
}

export function normalizeGithubIssues(rawItems: any[]): Issue[] {
  if (!rawItems || !Array.isArray(rawItems)) return [];
  const parseRepo = (val: string | null | undefined): string | null => {
    if (!val || typeof val !== 'string') return null;
    const apiMatch = /api\.github\.com\/repos\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (apiMatch) return `${apiMatch[1]}/${apiMatch[2].replace(/\.git$/, '')}`;
    const githubMatch = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (githubMatch) return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, '')}`;
    const cleaned = val.trim().replace(/\.git$/, '');
    if (/^[^/\s]+\/[^/\s]+$/.test(cleaned)) return cleaned;
    return null;
  };
  return rawItems
    .filter((item: any) => item && !item.pull_request)
    .map((item: any) => {
      const repo = (!item.repo && !item.repository_url && !item.html_url)
        ? undefined
        : (parseRepo(item.repo) ||
           parseRepo(item.repository_url) ||
           parseRepo(item.html_url) ||
           undefined);
      const ac = parseAcceptanceCriteria(item.body || '');
      const subtasks = parseSubtasks(item.body || '');
      const openQuestions = parseOpenQuestions(item.body || '');
      const humanTasks = parseHumanTasks(item.body || '');
      const labels = Array.isArray(item.labels) && item.labels.length > 0
        ? item.labels.map((l: any) => typeof l === 'string' ? { name: l } : { name: l.name, ...(l.color ? { color: l.color } : {}) })
        : [];
      const assignees = Array.isArray(item.assignees) && item.assignees.length > 0
        ? item.assignees.map((a: any) => ({ login: a.login, ...(a.avatar_url ? { avatar_url: a.avatar_url } : {}) }))
        : [];
      const issue: Issue = {
        number: item.number,
        title: item.title || '',
        body: item.body || '',
        state: item.state || 'open',
        html_url: item.html_url || '',
        labels,
        ...(item.user ? { user: { login: item.user.login, ...(item.user.avatar_url ? { avatar_url: item.user.avatar_url } : {}) } } : {}),
        assignees,
        comments: item.comments || 0,
        created_at: item.created_at || '',
        ...(item.updated_at ? { updated_at: item.updated_at } : {}),
        subtasks,
        openQuestions,
        humanTasks,
        ...(ac.length > 0 ? { acceptanceCriteria: ac } : {}),
        ...(repo ? { repo } : {}),
        ...(item.projectId ? { projectId: item.projectId } : {}),
        ...(item.projectName ? { projectName: item.projectName } : {}),
      };

      const shouldPopulateV2 = Boolean(
        item.v2Metadata ||
        item.labels !== undefined ||
        ac.length > 0 ||
        item.phase ||
        item.attention
      );

      if (shouldPopulateV2) {
        issue.v2Metadata = resolveV2Metadata(issue);
      }

      return issue;
    });
}

export function mergeIssuePages(existing: Issue[], incoming: Issue[]): Issue[] {
  const map = new Map<string, Issue>();
  const parseRepo = (val: string | null | undefined): string | null => {
    if (!val || typeof val !== 'string') return null;
    const apiMatch = /api\.github\.com\/repos\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (apiMatch) return `${apiMatch[1]}/${apiMatch[2].replace(/\.git$/, '')}`;
    const githubMatch = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(val);
    if (githubMatch) return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, '')}`;
    const cleaned = val.trim().replace(/\.git$/, '');
    if (/^[^/\s]+\/[^/\s]+$/.test(cleaned)) return cleaned;
    return null;
  };
  const getIssueKey = (issue: Issue): string => {
    const rawRepo = issue.repo ?? (issue as any).projectRepo;
    if (!rawRepo && !issue.html_url) {
      return String(issue.number);
    }
    const repo = (parseRepo(rawRepo) || parseRepo(issue.html_url) || '').toLowerCase().trim();
    return repo ? `${repo}#${issue.number}` : String(issue.number);
  };

  if (Array.isArray(existing)) {
    for (const issue of existing) {
      if (issue && Number.isFinite(issue.number)) {
        map.set(getIssueKey(issue), issue);
      }
    }
  }
  if (Array.isArray(incoming)) {
    for (const issue of incoming) {
      if (issue && Number.isFinite(issue.number)) {
        let key = getIssueKey(issue);
        let prev = map.get(key);
        if (!prev && key.includes('#')) {
          const bareKey = String(issue.number);
          const bareIssue = map.get(bareKey);
          if (bareIssue && !(bareIssue.repo || parseRepo(bareIssue.html_url))) {
            prev = bareIssue;
            map.delete(bareKey);
          }
        }
        const repo = issue.repo || prev?.repo;
        const projectId = issue.projectId || prev?.projectId;
        const projectName = issue.projectName || prev?.projectName;
        map.set(key, {
          ...(prev || {}),
          ...issue,
          ...(repo ? { repo } : {}),
          ...(projectId ? { projectId } : {}),
          ...(projectName ? { projectName } : {}),
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.number - a.number);
}

// ==========================================
// Multi-Project Aggregation & Grouping
// ==========================================

export function getProjectRepoFullName(project: ProjectItem | null | undefined): string | null {
  if (!project) return null;
  const linked = typeof project.linkedRepo === 'string' ? project.linkedRepo.trim() : '';
  if (linked && linked.includes('/')) return linked;
  if (project.gitRepo && project.gitRepo.owner && project.gitRepo.repo) {
    return `${project.gitRepo.owner}/${project.gitRepo.repo}`;
  }
  return null;
}

export function getIssueRepoFullName(issue: Issue | null | undefined): string | null {
  if (!issue) return null;
  return parseRepoFullName(issue.repo) || parseRepoFullName(issue.html_url) || null;
}

// Consolidates issues fetched from multiple repositories into one deduplicated
// collection. Dedup key is repo + issue number, because issue numbers are only
// unique within a repository. Each issue is tagged with its origin so the
// project grouping view can cluster it later.
export function aggregateProjectIssues(sources: Array<{ projectId: string; projectName: string; repo: string; issues: Issue[] }>): Issue[] {
  const byKey = new Map<string, Issue>();
  const list = Array.isArray(sources) ? sources : [];
  for (const source of list) {
    if (!source) continue;
    const repo = typeof source.repo === 'string' ? source.repo.trim() : '';
    const incoming = Array.isArray(source.issues) ? source.issues : [];
    for (const issue of incoming) {
      if (!issue || !Number.isFinite(issue.number)) continue;
      const key = `${repo.toLowerCase()}#${issue.number}`;
      byKey.set(key, {
        ...issue,
        projectId: source.projectId,
        projectName: source.projectName,
        repo: issue.repo || repo,
      });
    }
  }
  return Array.from(byKey.values());
}

// Clusters issues by their tagged project (projectId/projectName) or by the
// repository they came from. Projects without issues are omitted so the board
// shows only clean, non-empty groups, each with its issue count.
export function groupIssuesByProject(issues: Issue[], projects: ProjectItem[]): IssueGroup[] {
  const list = Array.isArray(issues) ? issues.filter(Boolean) : [];
  const projectList = Array.isArray(projects) ? projects.filter(Boolean) : [];

  const byId = new Map<string, ProjectItem>();
  const byRepo = new Map<string, ProjectItem>();
  const projectGroups = new Map<string, IssueGroup>();

  for (const project of projectList) {
    if (project.id) {
      byId.set(project.id, project);
      projectGroups.set(project.id, { id: project.id, title: project.name || project.id, issues: [], count: 0 });
    }
    const repo = getProjectRepoFullName(project);
    if (repo) byRepo.set(repo.toLowerCase(), project);
  }

  const unmatchedGroups = new Map<string, IssueGroup>();

  for (const issue of list) {
    if (!issue || !Number.isFinite(issue.number)) continue;

    let target: IssueGroup | undefined;
    if (issue.projectId && byId.has(issue.projectId)) {
      target = projectGroups.get(issue.projectId);
    }
    if (!target) {
      const repo = getIssueRepoFullName(issue);
      const project = repo ? byRepo.get(repo.toLowerCase()) : undefined;
      if (project) target = projectGroups.get(project.id);
    }
    if (!target) {
      const label = (typeof issue.projectName === 'string' && issue.projectName.trim())
        || getIssueRepoFullName(issue)
        || 'Unknown Project';
      if (!unmatchedGroups.has(label)) {
        unmatchedGroups.set(label, { id: `unmatched:${label}`, title: label, issues: [], count: 0 });
      }
      target = unmatchedGroups.get(label);
    }
    target!.issues.push(issue);
  }

  const result: IssueGroup[] = [];
  for (const project of projectList) {
    const group = project.id ? projectGroups.get(project.id) : undefined;
    if (group && group.issues.length > 0) {
      group.count = group.issues.length;
      result.push(group);
    }
  }
  for (const group of unmatchedGroups.values()) {
    if (group.issues.length > 0) {
      group.count = group.issues.length;
      result.push(group);
    }
  }
  return result;
}

export interface IssueCacheEntry {
  timestamp: number;
  issues: Issue[];
}

// TTL cache read used by both single-repo and all-projects issue fetching so a
// refresh inside the window costs zero GitHub API requests (rate-limit friendly).
export function readCachedIssueCollection(
  cache: Map<string, IssueCacheEntry>,
  key: string,
  ttlMs: number = 60000,
  now: number = Date.now()
): Issue[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now - entry.timestamp >= ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.issues;
}

// ==========================================
// Repo-Aware Session Attribution
// ==========================================

// Extracts owner/repo from a GitHub URL or a plain "owner/repo" string.
export function parseRepoFullName(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const apiMatch = /api\.github\.com\/repos\/([^/\s]+)\/([^/\s#?]+)/i.exec(value);
  if (apiMatch) return `${apiMatch[1]}/${apiMatch[2].replace(/\.git$/, '')}`;
  const githubMatch = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(value);
  if (githubMatch) return `${githubMatch[1]}/${githubMatch[2].replace(/\.git$/, '')}`;
  const cleaned = value.trim().replace(/\.git$/, '');
  if (/^[^/\s]+\/[^/\s]+$/.test(cleaned)) return cleaned;
  return null;
}

// The repository a session chip/attach item belongs to, from an explicit repo
// field or the item's URL. Returns null when the origin cannot be determined.
export function getSessionIssueRepo(item: any): string | null {
  if (!item) return null;
  if (Array.isArray(item.data?.issues)) {
    const repos = new Set<string>();
    for (const entry of item.data.issues) {
      const r = parseRepoFullName(entry?.repo) || parseRepoFullName(entry?.projectRepo);
      if (r) repos.add(r);
    }
    if (repos.size === 1) return Array.from(repos)[0];
    if (repos.size > 1) return null;
  }
  const explicit = item.repo ?? item.projectRepo ?? item.data?.repo;
  const fromExplicit = parseRepoFullName(explicit);
  if (fromExplicit) return fromExplicit;
  return parseRepoFullName(item.html_url) || parseRepoFullName(item.url);
}

// A repo-qualified session key. Only produces a key when the repo is known,
// because issue numbers are only unique within a repository.
export function issueRepoKey(issue: Issue | null | undefined): string | null {
  if (!issue || !Number.isFinite(issue.number)) return null;
  const repo = getIssueRepoFullName(issue);
  if (!repo) return null;
  return `${repo.toLowerCase()}#${issue.number}`;
}

// Every repo-qualified (repo, issue number) pair a session is attached to.
export function sessionRepoKeys(session: any): string[] {
  const keys = new Set<string>();
  if (!session) return [];
  const items = Array.isArray(session.items) ? session.items : [];
  for (const item of items) {
    if (!item) continue;
    let handledPerIssue = false;
    if (Array.isArray(item.data?.issues)) {
      for (const entry of item.data.issues) {
        if (!entry) continue;
        const entryRepo = parseRepoFullName(entry.repo) || parseRepoFullName(entry.projectRepo);
        const entryNum = Number(entry.number ?? entry.issueNumber);
        if (entryRepo && Number.isFinite(entryNum) && entryNum > 0) {
          keys.add(`${entryRepo.toLowerCase()}#${entryNum}`);
          handledPerIssue = true;
        }
      }
    }
    if (handledPerIssue) continue;

    const repo = getSessionIssueRepo(item);
    if (!repo) continue;
    const numbers = new Set<number>();
    if (item.data?.issueNumber != null) numbers.add(Number(item.data.issueNumber));
    if (Array.isArray(item.data?.issueNumbers)) {
      for (const n of item.data.issueNumbers) numbers.add(Number(n));
    }
    if (item.id && /^\d+$/.test(String(item.id))) numbers.add(parseInt(String(item.id), 10));
    for (const n of numbers) {
      if (Number.isFinite(n) && n > 0) keys.add(`${repo.toLowerCase()}#${n}`);
    }
  }
  return Array.from(keys);
}

// Repo-aware session index. A session only registers a (repo, number) key when
// the repo is known, so a session from repo A can never bind to repo B's #N.
export function buildSessionIndexByRepo(sessions: any[]): Map<string, any> {
  const index = new Map<string, any>();
  if (!sessions || !Array.isArray(sessions)) return index;

  const activityPriority = (act: string): number => {
    if (act === 'running') return 4;
    if (act === 'waiting-permission' || act === 'waiting-question' || (typeof act === 'string' && act.startsWith('waiting'))) return 3;
    if (act === 'idle') return 2;
    return 1;
  };

  for (const session of sessions) {
    if (!session) continue;
    for (const key of sessionRepoKeys(session)) {
      const existing = index.get(key);
      if (!existing || activityPriority(session.activity || '') > activityPriority(existing.activity || '')) {
        index.set(key, session);
      }
    }
  }
  return index;
}

export function findSessionForIssueByRepo(index: Map<string, any> | null | undefined, issue: Issue | null | undefined): any | null {
  if (!index || !issue) return null;
  const key = issueRepoKey(issue);
  if (!key) return null;
  return index.get(key) || null;
}

// ==========================================
// Workspace Root Resolution & Rate-Limit Helpers
// ==========================================

export interface WorkspaceRootResolution {
  project: ProjectItem | null;
  /** True only when a project is registered with directory exactly /workspace. */
  pinned: boolean;
  reason: 'exact' | 'named' | 'missing';
}

// Deterministically resolves the project that represents the /workspace root.
// Never silently falls back to an arbitrary shortest directory: if no project
// is registered at /workspace we report `missing` (or `named` for a project
// explicitly called "workspace"), so the caller can warn the operator.
export function resolveWorkspaceRootProject(projects: ProjectItem[] | null | undefined): WorkspaceRootResolution {
  const list = Array.isArray(projects) ? projects.filter(Boolean) : [];

  const exact = list.find((p) => p.directory && p.directory.replace(/\/+$/, '') === '/workspace');
  if (exact) return { project: exact, pinned: true, reason: 'exact' };

  const named = list.find((p) => {
    const name = (p.name || '').trim().toLowerCase();
    const id = (p.id || '').trim().toLowerCase();
    const basename = p.directory ? p.directory.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '' : '';
    return name === 'workspace' || id === 'workspace' || basename === 'workspace';
  });
  if (named) return { project: named, pinned: false, reason: 'named' };

  return { project: null, pinned: false, reason: 'missing' };
}

// Parses Retry-After (delay-seconds or HTTP-date) into milliseconds.
export function parseRetryAfterMs(headers: Record<string, string> | null | undefined, now: number = Date.now()): number {
  if (!headers) return 0;
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (raw === undefined || raw === null || raw === '') return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(String(raw));
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return 0;
}

// Distinguishes a GitHub secondary/primary rate limit from a real auth failure
// so callers can back off instead of showing the authentication banner.
export function isSecondaryRateLimit(
  status: number,
  headers?: Record<string, string> | null,
  body?: string | null
): boolean {
  if (status !== 403 && status !== 429) return false;
  const retryAfter = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (retryAfter !== undefined && retryAfter !== null && retryAfter !== '') return true;
  const remaining = headers?.['x-ratelimit-remaining'] ?? headers?.['X-RateLimit-Remaining'];
  if (remaining !== undefined && Number(remaining) === 0) return true;
  const text = typeof body === 'string' ? body.toLowerCase() : '';
  return (
    text.includes('secondary rate limit') ||
    text.includes('abuse detection') ||
    text.includes('rate limit') ||
    text.includes('api rate limit exceeded')
  );
}

// Exponential backoff, clamped. A server-provided Retry-After always wins.
export function computeBackoffMs(attempt: number, retryAfterMs: number = 0, baseMs: number = 1000, maxMs: number = 60000): number {
  if (retryAfterMs > 0) return Math.min(retryAfterMs, maxMs);
  const exp = baseMs * Math.pow(2, Math.max(0, attempt));
  return Math.min(maxMs, Math.max(baseMs, exp));
}

export interface RetryWithBackoffOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  isRetryable?: (err: any) => boolean;
  getRetryAfterMs?: (err: any) => number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number, err: any) => void;
}

export async function retryWithBackoff<T>(
  worker: (attempt: number) => Promise<T>,
  options: RetryWithBackoffOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseMs = options.baseMs ?? 1000;
  const maxMs = options.maxMs ?? 60000;
  const isRetryable = options.isRetryable ?? (() => false);
  const getRetryAfterMs = options.getRetryAfterMs ?? (() => 0);
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastErr: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await worker(attempt);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err;
      const delay = computeBackoffMs(attempt, getRetryAfterMs(err), baseMs, maxMs);
      options.onRetry?.(attempt, delay, err);
      await sleep(delay);
    }
  }
  throw lastErr;
}

export interface ConcurrencyResult<T, R> {
  item: T;
  status: 'fulfilled' | 'rejected';
  value?: R;
  reason?: any;
}

// Runs `worker` over `items` with at most `limit` promises in flight, returning
// one settled result per item. Keeps multi-repo bursts within API limits.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<Array<ConcurrencyResult<T, R>>> {
  const list = Array.isArray(items) ? items : [];
  const results: Array<ConcurrencyResult<T, R>> = new Array(list.length);
  const concurrency = Math.max(1, Math.min(Math.floor(limit) || 1, list.length || 1));
  let cursor = 0;

  const runner = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      try {
        results[index] = { item: list[index], status: 'fulfilled', value: await worker(list[index], index) };
      } catch (reason) {
        results[index] = { item: list[index], status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runner()));
  return results;
}

// ==========================================
// Issue List Pagination & Page Size Fallback
// ==========================================

// Issue list pages ask for GitHub's maximum of 100. A host that cannot carry
// that much in one answer (older OpenChamber versions cut proxied answers off
// at 256 000 characters) gets SMALL_ISSUE_PAGE_SIZE for that repo instead.
export const FULL_ISSUE_PAGE_SIZE = 100;
export const SMALL_ISSUE_PAGE_SIZE = 20;
export const MAX_ISSUES_PER_REPO = 1000;

export type IssuePageRequest = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: any,
  query?: any,
  headers?: Record<string, string>
) => Promise<any>;

// A cut-off answer fails to parse; a newer host refuses it by code.
export function isOversizedAnswer(err: any): boolean {
  if (!err) return false;
  if (err.code === 'RESPONSE_TOO_LARGE' || (typeof err.message === 'string' && err.message.includes('RESPONSE_TOO_LARGE'))) {
    return true;
  }
  if (err instanceof SyntaxError || err.name === 'SyntaxError') {
    const msg = typeof err.message === 'string' ? err.message : '';
    if (msg.includes('position 0') || msg.includes("token '<'") || msg.includes('token <') || msg.includes('<!DOCTYPE')) {
      return false;
    }
    const lower = msg.toLowerCase();
    return (
      lower.includes('position 256000') ||
      lower.includes('unexpected end of json') ||
      lower.includes('unexpected end of data') ||
      lower.includes('unexpected end of input') ||
      lower.includes('unterminated string') ||
      lower.includes('after property value') ||
      lower.includes('after array element')
    );
  }
  return false;
}

// One page of a repo's issues at the page size `pageSizes` holds for that
// repo. Only page 1 may switch to the small size: later page numbers count in
// the size page 1 was read with.
export async function fetchIssuePage(
  repo: string,
  page: number,
  request: (method: any, path: string, body?: any, query?: any, headers?: Record<string, string>) => Promise<any>,
  pageSizes: Map<string, number>,
  onShrink?: (pageSize: number) => void,
  headers?: Record<string, string>
): Promise<{ items: any[]; pageSize: number; raw?: any }> {
  const read = async (pageSize: number, reqHeaders?: Record<string, string>) => {
    const raw = await request('GET', `/repos/${repo}/issues?state=all&per_page=${pageSize}&page=${page}`, undefined, undefined, reqHeaders);
    return { items: Array.isArray(raw) ? raw : (raw?.items || []), pageSize, raw };
  };
  const pageSize = pageSizes.get(repo) ?? FULL_ISSUE_PAGE_SIZE;
  try {
    return await read(pageSize, headers);
  } catch (err: any) {
    if (page !== 1 || pageSize === SMALL_ISSUE_PAGE_SIZE || !isOversizedAnswer(err)) throw err;
    pageSizes.set(repo, SMALL_ISSUE_PAGE_SIZE);
    onShrink?.(SMALL_ISSUE_PAGE_SIZE);
    let retryHeaders: Record<string, string> | undefined;
    if (headers) {
      retryHeaders = { ...headers };
      delete retryHeaders['If-None-Match'];
      delete retryHeaders['if-none-match'];
      if (Object.keys(retryHeaders).length === 0) {
        retryHeaders = undefined;
      }
    }
    return read(SMALL_ISSUE_PAGE_SIZE, retryHeaders);
  }
}

// ==========================================
// Incremental Issue Synchronization & ETags
// ==========================================

export function buildIncrementalIssuesPath(
  repo: string,
  since: string | Date | number,
  page: number = 1,
  pageSize: number = FULL_ISSUE_PAGE_SIZE
): string {
  const cleanRepo = parseRepoFullName(repo) || (typeof repo === 'string' ? repo.trim() : '');
  const sinceIso = typeof since === 'string'
    ? since
    : new Date(since).toISOString();
  return `/repos/${cleanRepo}/issues?state=all&since=${encodeURIComponent(sinceIso)}&per_page=${pageSize}&page=${page}`;
}

export interface IncrementalSyncResult {
  issues: Issue[];
  modified: boolean;
  changedCount: number;
  etag?: string;
  truncated?: boolean;
}

export async function syncIncrementalRepoIssues(options: {
  repo: string;
  since: string | Date | number;
  currentIssues: Issue[];
  etag?: string;
  pageSizes?: Map<string, number>;
  pageSize?: number;
  onShrink?: (pageSize: number) => void;
  requestFn: (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: any, query?: any, headers?: Record<string, string>) => Promise<any>;
}): Promise<IncrementalSyncResult> {
  const { repo, since, currentIssues, etag, pageSizes, onShrink, requestFn } = options;
  const cleanRepo = parseRepoFullName(repo) || (typeof repo === 'string' ? repo.trim() : '');
  let pageSize = options.pageSize ?? (pageSizes?.get(cleanRepo) ?? FULL_ISSUE_PAGE_SIZE);
  let maxPages = Math.ceil(MAX_ISSUES_PER_REPO / pageSize);
  let page = 1;
  const allItems: any[] = [];
  let newEtag: string | undefined = etag;
  let truncated = false;

  while (page <= maxPages) {
    let path = buildIncrementalIssuesPath(cleanRepo, since, page, pageSize);
    const headers = (page === 1 && etag) ? { 'If-None-Match': etag } : undefined;
    let res: any;

    try {
      res = await requestFn('GET', path, undefined, undefined, headers);
    } catch (err: any) {
      if (page === 1 && pageSize !== SMALL_ISSUE_PAGE_SIZE && isOversizedAnswer(err)) {
        pageSize = SMALL_ISSUE_PAGE_SIZE;
        pageSizes?.set(cleanRepo, SMALL_ISSUE_PAGE_SIZE);
        onShrink?.(SMALL_ISSUE_PAGE_SIZE);
        newEtag = undefined;
        maxPages = Math.ceil(MAX_ISSUES_PER_REPO / pageSize);
        path = buildIncrementalIssuesPath(cleanRepo, since, page, pageSize);
        res = await requestFn('GET', path, undefined, undefined, undefined);
      } else {
        throw err;
      }
    }

    if (page === 1 && res && (res.notModified || res.status === 304)) {
      return {
        issues: currentIssues,
        modified: false,
        changedCount: 0,
        etag: res.etag || etag,
        truncated: false,
      };
    }

    if (page === 1 && (res?.etag || (typeof res === 'object' && res && (res as any).etag))) {
      newEtag = res?.etag || (res as any).etag;
    }

    const items = Array.isArray(res) ? res : (res?.items || res?.data || []);
    if (items.length === 0) break;

    allItems.push(...items);
    if (items.length < pageSize) break;
    if (page === maxPages) {
      truncated = true;
      break;
    }
    page++;
  }

  if (allItems.length === 0) {
    return {
      issues: currentIssues,
      modified: false,
      changedCount: 0,
      etag: newEtag,
      truncated: false,
    };
  }

  const rawChanged = normalizeGithubIssues(allItems);
  const changed = rawChanged.map((issue) => ({
    ...issue,
    repo: issue.repo || cleanRepo,
  }));

  const merged = mergeIssuePages(currentIssues, changed);
  return {
    issues: merged,
    modified: true,
    changedCount: changed.length,
    etag: newEtag,
    truncated,
  };
}




