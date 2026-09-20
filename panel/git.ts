// ==========================================
// Git Remote & Token Parser
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

export function extractGitHubTokenFromCredentials(content: string | null | undefined): string | null {
  if (!content || typeof content !== 'string') return null;
  const match = content.match(/https:\/\/(?:[^:]+?:)?(gh[pousr]_[A-Za-z0-9_]+)@github\.com/);
  if (match) return match[1];
  const generic = content.match(/gh[pousr]_[A-Za-z0-9_]+/);
  return generic ? generic[0] : null;
}
