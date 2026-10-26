import { loadConfig } from '../server/config.ts';
import { createBoardServer } from '../server/app.ts';

export const BOARD_PASSWORD = 'correct horse battery staple';
export const SESSION_SECRET = 's'.repeat(48);
export const SYNTHETIC_TOKEN = 'ghp_synthetic_board_token_000000000000';

export function browserConfig(fake, env = {}) {
  return loadConfig({
    BOARD_GITHUB_TOKEN: fake.token,
    BOARD_GITHUB_LOGIN: fake.login,
    BOARD_REPO: fake.repo,
    BOARD_PASSWORD: BOARD_PASSWORD,
    BOARD_SESSION_SECRET: SESSION_SECRET,
    ...env,
  });
}

export async function startBoard(fake, options = {}) {
  const config = options.config ?? browserConfig(fake, options.env ?? {});
  const logs = [];
  const app = await createBoardServer({
    config,
    githubApiBase: fake.url,
    logger: (line) => logs.push(line),
    ...options,
  });
  const { port } = await app.listen(0);
  const base = `http://127.0.0.1:${port}`;
  return { app, config, logs, url: base, port };
}

export class HttpSession {
  constructor(base) {
    this.base = base;
    this.cookie = null;
    this.csrf = null;
  }

  async request(path, { method = 'GET', body, csrf = true, headers = {} } = {}) {
    const requestHeaders = { ...headers };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    if (this.cookie) requestHeaders.cookie = this.cookie;
    if (csrf && this.csrf) requestHeaders['x-csrf-token'] = this.csrf;
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const cookiePair = setCookie.split(';')[0];
      this.cookie = cookiePair.endsWith('=') ? null : cookiePair;
      if (/Max-Age=0/i.test(setCookie)) this.cookie = null;
    }
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, headers: response.headers, text, json };
  }

  async login(password = BOARD_PASSWORD) {
    const response = await this.request('/api/session', {
      method: 'POST',
      body: { password },
      csrf: false,
    });
    if (response.status === 200) this.csrf = response.json.csrfToken;
    return response;
  }

  async logout() {
    return this.request('/api/session', { method: 'DELETE' });
  }
}
