import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../web/public');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgbaBuffer) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // Filter type 0 (None)
    rgbaBuffer.copy(
      scanlines,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression 0
  ihdr[11] = 0; // Filter 0
  ihdr[12] = 0; // Interlace 0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Render icon pixels
function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (Math.floor(y) * size + Math.floor(x)) * 4;
    // Simple alpha blending
    const srcA = a / 255;
    const destA = buf[idx + 3] / 255;
    const outA = srcA + destA * (1 - srcA);
    if (outA > 0) {
      buf[idx] = Math.round((r * srcA + buf[idx] * destA * (1 - srcA)) / outA);
      buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * destA * (1 - srcA)) / outA);
      buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * destA * (1 - srcA)) / outA);
      buf[idx + 3] = Math.round(outA * 255);
    }
  }

  function fillRoundedRect(x0, y0, w, h, r, red, green, blue, alpha = 255) {
    const x1 = x0 + w;
    const y1 = y0 + h;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        let inside = false;
        if (x >= x0 + r && x <= x1 - r && y >= y0 && y <= y1) inside = true;
        else if (x >= x0 && x <= x1 && y >= y0 + r && y <= y1 - r) inside = true;
        else {
          // Check 4 corners
          const cx = x < x0 + r ? x0 + r : x1 - r;
          const cy = y < y0 + r ? y0 + r : y1 - r;
          const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (dist <= r) inside = true;
        }
        if (inside) setPixel(x, y, red, green, blue, alpha);
      }
    }
  }

  // Base canvas background: rich dark #0a0b0e
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(x, y, 10, 11, 14, 255);
    }
  }

  // Subtle outer squircle / rounded card: #14171d
  const margin = size * 0.05;
  const innerSize = size - margin * 2;
  const cornerRadius = size * 0.18;
  fillRoundedRect(margin, margin, innerSize, innerSize, cornerRadius, 20, 23, 29, 255);

  // Column definitions
  // 3 Kanban columns
  const pad = size * 0.12;
  const colWidth = (size - pad * 2 - size * 0.06 * 2) / 3;
  const colGap = size * 0.06;
  const colTop = size * 0.18;
  const colHeight = size * 0.64;
  const cardRadius = size * 0.035;

  // Colors
  const colBg = [28, 31, 38];
  const colBorder = [45, 52, 64];
  const blueAccent = [59, 130, 246];
  const emeraldAccent = [16, 185, 129];
  const amberAccent = [245, 158, 11];
  const cardBg = [35, 39, 48];
  const cardBrightBg = [42, 47, 58];

  // Draw 3 columns
  for (let c = 0; c < 3; c++) {
    const cx = pad + c * (colWidth + colGap);
    // Column track background
    fillRoundedRect(cx, colTop, colWidth, colHeight, cardRadius, colBg[0], colBg[1], colBg[2], 255);

    // Column header bar
    const headW = colWidth * 0.55;
    const headH = size * 0.024;
    const headCol = c === 0 ? amberAccent : c === 1 ? blueAccent : emeraldAccent;
    fillRoundedRect(cx + colWidth * 0.1, colTop + size * 0.035, headW, headH, headH * 0.5, headCol[0], headCol[1], headCol[2], 240);

    // Cards inside columns
    if (c === 0) {
      // Column 1: Drafts (2 cards)
      fillRoundedRect(cx + colWidth * 0.08, colTop + size * 0.09, colWidth * 0.84, size * 0.18, cardRadius * 0.8, cardBg[0], cardBg[1], cardBg[2], 255);
      fillRoundedRect(cx + colWidth * 0.08, colTop + size * 0.30, colWidth * 0.84, size * 0.14, cardRadius * 0.8, cardBg[0], cardBg[1], cardBg[2], 255);
    } else if (c === 1) {
      // Column 2: In-Progress / Backlog (3 cards, middle highlighted)
      fillRoundedRect(cx + colWidth * 0.08, colTop + size * 0.09, colWidth * 0.84, size * 0.16, cardRadius * 0.8, cardBg[0], cardBg[1], cardBg[2], 255);
      // Hero active card
      fillRoundedRect(cx + colWidth * 0.08, colTop + size * 0.28, colWidth * 0.84, size * 0.22, cardRadius * 0.8, cardBrightBg[0], cardBrightBg[1], cardBrightBg[2], 255);
      // Hero accent bar on card
      fillRoundedRect(cx + colWidth * 0.16, colTop + size * 0.32, colWidth * 0.5, size * 0.018, size * 0.009, blueAccent[0], blueAccent[1], blueAccent[2], 255);
      fillRoundedRect(cx + colWidth * 0.16, colTop + size * 0.36, colWidth * 0.65, size * 0.014, size * 0.007, 140, 146, 157, 200);
      fillRoundedRect(cx + colWidth * 0.16, colTop + size * 0.40, colWidth * 0.4, size * 0.014, size * 0.007, 140, 146, 157, 160);
    } else {
      // Column 3: Done (2 cards with green status check badge)
      fillRoundedRect(cx + colWidth * 0.08, colTop + size * 0.09, colWidth * 0.84, size * 0.20, cardRadius * 0.8, cardBg[0], cardBg[1], cardBg[2], 255);
      // Done badge chip
      fillRoundedRect(cx + colWidth * 0.16, colTop + size * 0.13, colWidth * 0.35, size * 0.02, size * 0.01, emeraldAccent[0], emeraldAccent[1], emeraldAccent[2], 255);

      fillRoundedRect(cx + colWidth * 0.08, colTop + size * 0.32, colWidth * 0.84, size * 0.16, cardRadius * 0.8, cardBg[0], cardBg[1], cardBg[2], 255);
      fillRoundedRect(cx + colWidth * 0.16, colTop + size * 0.36, colWidth * 0.35, size * 0.02, size * 0.01, emeraldAccent[0], emeraldAccent[1], emeraldAccent[2], 255);
    }
  }

  return encodePng(size, size, buf);
}

// Generate SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14171d"/>
      <stop offset="100%" stop-color="#0a0b0e"/>
    </linearGradient>
    <linearGradient id="heroCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2a303c"/>
      <stop offset="100%" stop-color="#21252f"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Background squircle -->
  <rect x="24" y="24" width="464" height="464" rx="96" fill="url(#bgGrad)"/>
  <rect x="24" y="24" width="464" height="464" rx="96" fill="none" stroke="#2d3440" stroke-width="2" opacity="0.6"/>

  <!-- Column 1: Drafts -->
  <rect x="62" y="92" width="114" height="328" rx="18" fill="#181b22" stroke="#262b36" stroke-width="1.5"/>
  <rect x="76" y="110" width="58" height="12" rx="6" fill="#f59e0b" opacity="0.9"/>
  <rect x="72" y="138" width="94" height="92" rx="12" fill="#222630" stroke="#2e3543" stroke-width="1"/>
  <rect x="82" y="152" width="56" height="8" rx="4" fill="#8c929d" opacity="0.7"/>
  <rect x="82" y="168" width="74" height="6" rx="3" fill="#5a606d" opacity="0.6"/>
  <rect x="72" y="242" width="94" height="74" rx="12" fill="#222630" stroke="#2e3543" stroke-width="1"/>
  <rect x="82" y="256" width="64" height="8" rx="4" fill="#8c929d" opacity="0.7"/>

  <!-- Column 2: In-Progress / Active Tasks -->
  <rect x="199" y="92" width="114" height="328" rx="18" fill="#181b22" stroke="#262b36" stroke-width="1.5"/>
  <rect x="213" y="110" width="62" height="12" rx="6" fill="#3b82f6"/>
  <rect x="209" y="138" width="94" height="80" rx="12" fill="#222630" stroke="#2e3543" stroke-width="1"/>
  <rect x="219" y="152" width="60" height="8" rx="4" fill="#8c929d" opacity="0.7"/>

  <!-- Hero Active Task Card -->
  <g filter="url(#shadow)">
    <rect x="209" y="230" width="94" height="114" rx="12" fill="url(#heroCardGrad)" stroke="#3b82f6" stroke-width="1.5"/>
    <rect x="219" y="246" width="52" height="10" rx="5" fill="#3b82f6"/>
    <rect x="219" y="266" width="74" height="7" rx="3.5" fill="#f0f2f5" opacity="0.9"/>
    <rect x="219" y="281" width="58" height="6" rx="3" fill="#8c929d" opacity="0.7"/>
    <!-- Checklist items indicator -->
    <circle cx="223" cy="303" r="3" fill="#3b82f6"/>
    <rect x="231" y="300" width="45" height="6" rx="3" fill="#8c929d" opacity="0.6"/>
    <circle cx="223" cy="319" r="3" fill="#3b82f6"/>
    <rect x="231" y="316" width="55" height="6" rx="3" fill="#8c929d" opacity="0.6"/>
  </g>

  <!-- Column 3: Done -->
  <rect x="336" y="92" width="114" height="328" rx="18" fill="#181b22" stroke="#262b36" stroke-width="1.5"/>
  <rect x="350" y="110" width="50" height="12" rx="6" fill="#10b981"/>
  <rect x="346" y="138" width="94" height="102" rx="12" fill="#222630" stroke="#2e3543" stroke-width="1"/>
  <rect x="356" y="152" width="40" height="10" rx="5" fill="#10b981" opacity="0.85"/>
  <rect x="356" y="172" width="74" height="7" rx="3.5" fill="#8c929d" opacity="0.7"/>
  <rect x="356" y="187" width="54" height="6" rx="3" fill="#5a606d" opacity="0.5"/>
  <rect x="346" y="252" width="94" height="84" rx="12" fill="#222630" stroke="#2e3543" stroke-width="1"/>
  <rect x="356" y="266" width="40" height="10" rx="5" fill="#10b981" opacity="0.85"/>
  <rect x="356" y="286" width="68" height="7" rx="3.5" fill="#8c929d" opacity="0.7"/>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');
console.log('Wrote web/public/icon.svg');

const icon192 = renderIcon(192);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('Wrote web/public/icon-192.png (' + icon192.length + ' bytes)');

const icon512 = renderIcon(512);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
console.log('Wrote web/public/icon-512.png (' + icon512.length + ' bytes)');

const appleIcon = renderIcon(180);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
console.log('Wrote web/public/apple-touch-icon.png (' + appleIcon.length + ' bytes)');
