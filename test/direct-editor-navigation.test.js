import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_TS = fs.readFileSync(path.join(__dirname, '../panel/main.ts'), 'utf8');

// ==========================================
// Direct Editor Navigation Contract Tests
// ==========================================

test('panel/main.ts handleFilePathClick invokes host.openFile and file.open surface alongside clipboard copy', () => {
  // Check for handleFilePathClick definition
  assert.ok(MAIN_TS.includes('async function handleFilePathClick('), 'handleFilePathClick function defined');

  // Check for host.openFile invocation
  assert.ok(
    MAIN_TS.includes('openFile') && (MAIN_TS.includes('(host as any).openFile') || MAIN_TS.includes('host.openFile')),
    'handleFilePathClick checks and calls host.openFile'
  );

  // Check for file.open / file surface invocation
  assert.ok(
    MAIN_TS.includes("'file.open'") || MAIN_TS.includes('"file.open"'),
    'handleFilePathClick checks file.open surface capability'
  );
  assert.ok(
    MAIN_TS.includes("'file'") || MAIN_TS.includes('"file"'),
    'handleFilePathClick retains file surface capability fallback'
  );

  // Check for clipboard copy
  assert.ok(
    MAIN_TS.includes('writeClipboard') || MAIN_TS.includes('clipboard.writeText'),
    'handleFilePathClick copies path to clipboard'
  );

  // Check that candidate path resolutions are preserved
  assert.ok(MAIN_TS.includes('cleanCurDir'), 'preserves current directory check');
  assert.ok(MAIN_TS.includes('cleanProjDir'), 'preserves current project check');
  assert.ok(MAIN_TS.includes('${cleanCurDir}/${cleanPath}'), 'preserves relative path combination');
});
