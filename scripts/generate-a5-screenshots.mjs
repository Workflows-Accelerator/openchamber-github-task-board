import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

import { startFakeGitHub, makeIssue } from '../web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD } from '../web/tests/helpers.mjs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, '.agents/run/chamberos-board-v2/verifications/A5/screenshots');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function cropPng(inputPath, outputPath, cropW, cropH) {
  const buf = fs.readFileSync(inputPath);
  let pos = 8;
  let ihdr = null;
  const idatChunks = [];

  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
      };
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    pos += 12 + length;
  }

  const origW = ihdr.width;
  const origH = ihdr.height;
  const finalW = Math.min(cropW, origW);
  const finalH = Math.min(cropH, origH);

  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  const bpp = 4;
  const origStride = 1 + origW * bpp;
  const rawPixels = Buffer.alloc(origH * origW * bpp);

  for (let y = 0; y < origH; y++) {
    const filterType = decompressed[y * origStride];
    const scanline = decompressed.subarray(y * origStride + 1, (y + 1) * origStride);
    const outRow = rawPixels.subarray(y * origW * bpp, (y + 1) * origW * bpp);

    for (let x = 0; x < origW * bpp; x++) {
      const xVal = scanline[x];
      const a = (x >= bpp) ? outRow[x - bpp] : 0;
      const b = (y > 0) ? rawPixels[(y - 1) * origW * bpp + x] : 0;
      const c = (x >= bpp && y > 0) ? rawPixels[(y - 1) * origW * bpp + x - bpp] : 0;

      let recon = 0;
      if (filterType === 0) recon = xVal;
      else if (filterType === 1) recon = (xVal + a) & 0xff;
      else if (filterType === 2) recon = (xVal + b) & 0xff;
      else if (filterType === 3) recon = (xVal + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        recon = (xVal + pr) & 0xff;
      }
      outRow[x] = recon;
    }
  }

  const newStride = 1 + finalW * bpp;
  const newDecompressed = Buffer.alloc(finalH * newStride);
  for (let y = 0; y < finalH; y++) {
    newDecompressed[y * newStride] = 0;
    rawPixels.copy(
      newDecompressed,
      y * newStride + 1,
      y * origW * bpp,
      y * origW * bpp + finalW * bpp
    );
  }

  const newIdatData = zlib.deflateSync(newDecompressed);

  const newIhdrData = Buffer.alloc(13);
  newIhdrData.writeUInt32BE(finalW, 0);
  newIhdrData.writeUInt32BE(finalH, 4);
  newIhdrData.writeUInt8(8, 8);
  newIhdrData.writeUInt8(6, 9);
  newIhdrData.writeUInt8(0, 10);
  newIhdrData.writeUInt8(0, 11);
  newIhdrData.writeUInt8(0, 12);

  const outBuf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    makeChunk('IHDR', newIhdrData),
    makeChunk('IDAT', newIdatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(outputPath, outBuf);
}

async function run() {
  console.log('Starting Fake GitHub & Board server...');
  const now = Date.now();
  const mockIssues = [
    makeIssue({
      number: 1,
      title: 'Deploy authentication middleware to edge nodes',
      body: `# Overview\nEdge middleware deployment across multi-region edge nodes.\n\n## Questions\n- [ ] Should session tokens expire after 24h or 7d?\n- [ ] Is Redis cluster reachable from edge pop?\n\n### Actionable Subtasks\n- [x] Configure token rotation\n- [ ] Test edge latency`,
      labels: ['status:in-progress', 'backend'],
      state: 'open',
      created_at: new Date(now - 10 * 86400000).toISOString(),
      updated_at: new Date(now - 1 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 2,
      title: 'Payment gateway integration and Stripe webhooks',
      body: `# Overview\nPayment processing pipeline with automated invoice generation.\n\n## Questions\n- [ ] Which currency conversions are supported for CAD accounts?\n\n## Human Tasks\n- [ ] Provide production API keys in dashboard`,
      labels: ['status:needs-human', 'finance'],
      state: 'open',
      created_at: new Date(now - 8 * 86400000).toISOString(),
      updated_at: new Date(now - 2 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 3,
      title: 'Domain DNS configuration and SSL issuance',
      body: `# Overview\nAutomate DNS propagation checks and TLS certificate renewal.\n\n## Human Tasks\n- [ ] Verify SPF and DKIM TXT records in registrar\n- [ ] Sign vendor DPA agreement`,
      labels: ['status:todo', 'infrastructure'],
      state: 'open',
      created_at: new Date(now - 5 * 86400000).toISOString(),
      updated_at: new Date(now - 3 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 4,
      title: 'Core database migration to PostgreSQL 16',
      body: `Requires database migration before edge nodes connect.\n\nBlocked by #1\nDepends on #1`,
      labels: ['status:todo', 'database'],
      state: 'open',
      created_at: new Date(now - 4 * 86400000).toISOString(),
      updated_at: new Date(now - 4 * 3600000).toISOString(),
    }),
    makeIssue({
      number: 5,
      title: 'Exploratory WebGPU canvas renderer',
      body: `Experimental graphics pipeline for high-performance visual task dependency graphs. Body is archived on backburner until Core v2 is stable.`,
      labels: ['status:backlog', 'backburner'],
      state: 'open',
      created_at: new Date(now - 14 * 86400000).toISOString(),
      updated_at: new Date(now - 12 * 86400000).toISOString(),
    }),
    makeIssue({
      number: 6,
      title: 'Prototype responsive navigation drawer',
      body: `Deliver drawer animation with backdrop dismiss on mobile and tablet viewports. Completed and verified on iOS and Android.`,
      labels: ['status:done', 'ui'],
      state: 'closed',
      created_at: new Date(now - 6 * 86400000).toISOString(),
      updated_at: new Date(now - 2 * 86400000).toISOString(),
    }),
    makeIssue({
      number: 7,
      title: 'Initial proof of concept for task board',
      body: `Proof of concept with offline localStorage cache and optimistic mutations.`,
      labels: ['status:done'],
      state: 'closed',
      created_at: new Date(now - 20 * 86400000).toISOString(),
      updated_at: new Date(now - 15 * 86400000).toISOString(),
    }),
    makeIssue({
      number: 8,
      title: 'Internal draft specifications for v3 pipeline',
      body: `Internal raw architecture notes and draft proposals for internal review only.`,
      labels: ['status:draft'],
      state: 'open',
      created_at: new Date(now - 1 * 86400000).toISOString(),
      updated_at: new Date(now - 1 * 3600000).toISOString(),
    }),
  ];

  const fake = await startFakeGitHub({ issues: mockIssues });
  const board = await startBoard(fake);

  // Authenticate upfront to obtain session cookie
  const session = new HttpSession(board.url);
  await session.request('/api/session', {
    method: 'POST',
    body: { password: BOARD_PASSWORD },
  });
  const authCookie = session.cookie;
  console.log('Pre-authenticated session ready');

  const PROXY_PORT = 49210;
  const proxy = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PROXY_PORT}`);

    if (url.pathname === '/test-harness.js') {
      const script = `
        window.addEventListener("DOMContentLoaded", () => {
          const poll = setInterval(() => {
            const boardCount = document.getElementById("board-count");
            if (boardCount && boardCount.textContent.trim().length > 0) {
              clearInterval(poll);
              const params = new URLSearchParams(window.location.search);
              const view = params.get("view") || "decisions";
              const theme = params.get("theme") || "dark";
              const lang = params.get("lang") || "en";
              const tab = params.get("tab") || "";
              const w = parseInt(params.get("w") || "1280", 10);
              const h = parseInt(params.get("h") || "720", 10);

              localStorage.setItem("theme", theme);
              document.documentElement.setAttribute("data-theme", theme);

              if (lang === "fr") {
                const langBtn = document.getElementById("lang-switch-btn");
                const cur = localStorage.getItem("tb_lang") || "en";
                if (cur !== "fr" && langBtn) {
                  langBtn.click();
                }
              } else {
                const langBtn = document.getElementById("lang-switch-btn");
                const cur = localStorage.getItem("tb_lang") || "en";
                if (cur !== "en" && langBtn) {
                  langBtn.click();
                }
              }

              const style = document.createElement("style");
              let css = "body { width: " + w + "px !important; max-width: " + w + "px !important; height: " + h + "px !important; overflow-x: hidden !important; } ";
              if (w <= 768) {
                css += ".compact-header { display: flex !important; } .sidebar { display: none !important; } .section-view { padding: 16px !important; }";
              } else {
                css += ".compact-header { display: none !important; } .sidebar { display: flex !important; }";
              }
              style.textContent = css;
              document.head.appendChild(style);

              const navBtn = document.getElementById("nav-" + view);
              if (navBtn) navBtn.click();

              if (view === "archive" && tab) {
                setTimeout(() => {
                  const tabBtn = document.getElementById("archive-tab-" + tab);
                  if (tabBtn) tabBtn.click();
                }, 200);
              }

              if (view === "client") {
                setTimeout(() => {
                  const toggleBtn = document.getElementById("client-toggle-btn");
                  const desc = document.getElementById("client-filter-status-desc");
                  if (toggleBtn && desc && !desc.textContent.includes("Active")) {
                    toggleBtn.click();
                  }
                }, 200);
              }

              setTimeout(() => {
                document.body.setAttribute("data-ready", "true");
              }, 400);
            }
          }, 50);
        });
      `;
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(script);
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const upstreamRes = await fetch(`${board.url}/index.html`, {
        headers: { cookie: authCookie },
      });
      let html = await upstreamRes.text();
      html = html.replace('</body>', '<script src="/test-harness.js"></script></body>');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `${authCookie}; Path=/; SameSite=Lax`,
        'Content-Security-Policy': upstreamRes.headers.get('content-security-policy') || '',
      });
      res.end(html);
      return;
    }

    const upstreamUrl = `${board.url}${req.url}`;
    const upstreamHeaders = {
      ...req.headers,
      host: `127.0.0.1:${board.port}`,
      cookie: req.headers.cookie || authCookie,
    };
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      duplex: 'half',
    });

    res.writeHead(upstreamRes.status, Object.fromEntries(upstreamRes.headers.entries()));
    const buf = await upstreamRes.arrayBuffer();
    res.end(Buffer.from(buf));
  });

  await new Promise((resolve) => proxy.listen(PROXY_PORT, '127.0.0.1', resolve));
  console.log(`Test proxy listening at http://127.0.0.1:${PROXY_PORT}`);

  const scenarios = [
    // 1. Decisions view
    {
      name: '01-decisions-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'decisions',
      lang: 'en',
    },
    {
      name: '02-decisions-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'decisions',
      lang: 'en',
    },
    {
      name: '03-decisions-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'decisions',
      lang: 'en',
    },
    {
      name: '04-decisions-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'decisions',
      lang: 'en',
    },

    // 2. Blocked view
    {
      name: '05-blocked-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'blocked',
      lang: 'en',
    },
    {
      name: '06-blocked-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'blocked',
      lang: 'en',
    },
    {
      name: '07-blocked-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'blocked',
      lang: 'en',
    },
    {
      name: '08-blocked-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'blocked',
      lang: 'en',
    },

    // 3. Operations overview
    {
      name: '09-operations-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'operations',
      lang: 'en',
    },
    {
      name: '10-operations-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'operations',
      lang: 'en',
    },
    {
      name: '11-operations-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'operations',
      lang: 'en',
    },
    {
      name: '12-operations-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'operations',
      lang: 'en',
    },

    // 4. Archive & Backburner view
    {
      name: '13-archive-backburner-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'archive',
      tab: 'backburner',
      lang: 'en',
    },
    {
      name: '14-archive-closed-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'archive',
      tab: 'closed',
      lang: 'en',
    },
    {
      name: '15-archive-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'archive',
      tab: 'backburner',
      lang: 'en',
    },
    {
      name: '16-archive-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'archive',
      tab: 'closed',
      lang: 'en',
    },

    // 5. Client view
    {
      name: '17-client-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'client',
      lang: 'en',
    },
    {
      name: '18-client-1280-light.png',
      w: 1280,
      h: 720,
      theme: 'light',
      view: 'client',
      lang: 'en',
    },
    {
      name: '19-client-768-dark.png',
      w: 768,
      h: 800,
      theme: 'dark',
      view: 'client',
      lang: 'en',
    },
    {
      name: '20-client-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'client',
      lang: 'en',
    },

    // 6. Discussions placeholder
    {
      name: '21-discussions-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'discussions',
      lang: 'en',
    },
    {
      name: '22-discussions-360-dark.png',
      w: 360,
      h: 640,
      theme: 'dark',
      view: 'discussions',
      lang: 'en',
    },

    // 7. Bilingual view (FR)
    {
      name: '23-bilingual-fr-decisions-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'decisions',
      lang: 'fr',
    },
    {
      name: '24-bilingual-fr-operations-1280-dark.png',
      w: 1280,
      h: 720,
      theme: 'dark',
      view: 'operations',
      lang: 'fr',
    },
  ];

  try {
    for (let i = 0; i < scenarios.length; i++) {
      const sc = scenarios[i];
      const targetUrl = `http://127.0.0.1:${PROXY_PORT}/?view=${sc.view}&theme=${sc.theme}&w=${sc.w}&h=${sc.h}&lang=${sc.lang}&tab=${sc.tab || ''}`;
      const tempPath = `/tmp/raw-${sc.name}`;
      const outPath = path.join(SCREENSHOTS_DIR, sc.name);

      console.log(`[${i + 1}/${scenarios.length}] Capturing ${sc.name}...`);
      const cmd = `obscura fetch "${targetUrl}" --allow-private-network --selector "body[data-ready=\\\"true\\\"]" --timeout 20 -s "${tempPath}"`;
      await execAsync(cmd);

      cropPng(tempPath, outPath, sc.w, sc.h);
      const stat = fs.statSync(outPath);
      console.log(`  Saved ${sc.name} (${stat.size} bytes)`);
    }
    console.log('All verification screenshots captured successfully!');
  } finally {
    proxy.close();
    await board.app.close();
    await fake.close();
  }
}

run().catch((err) => {
  console.error('Failure:', err);
  process.exit(1);
});
