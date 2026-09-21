// ==========================================
// In-App Diagnostic Logger & Common Utilities
// ==========================================

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

export function sanitizeHexColor(color?: string): string | null {
  if (!color) return null;
  const clean = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3,8}$/.test(clean)) {
    return `#${clean}`;
  }
  return null;
}

export interface LogEntry {
  time: string;
  msg: string;
  level: 'info' | 'warn' | 'error' | 'succ';
}

export const logEntries: LogEntry[] = [];

export function addLog(msg: string, level: 'info' | 'warn' | 'error' | 'succ' = 'info'): void {
  const d = new Date();
  const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  logEntries.push({ time: timeStr, msg, level });
  if (logEntries.length > 200) logEntries.shift();

  if (level === 'error') console.error(`[TaskBoard] ${msg}`);
  else if (level === 'warn') console.warn(`[TaskBoard] ${msg}`);
  else console.log(`[TaskBoard] ${msg}`);

  if (typeof document !== 'undefined') {
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
}
