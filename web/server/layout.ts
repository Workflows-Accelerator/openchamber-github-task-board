// ==========================================
// Server-side canvas layout persistence.
//
// Dragging a card updates this store, not GitHub. One file holds the layout
// for every scope ('all' or 'owner/repo'), keyed by card identity. Writes are
// serialized through an in-process queue and land atomically via a temp file
// and rename, so concurrent requests can never clobber each other or leave a
// half-written JSON file behind.
//
// Collapsed-by-default model: only explicitly expanded group keys are stored.
// ==========================================

import { randomBytes } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const CANVAS_LAYOUT_VERSION = 1 as const;
export const DEFAULT_MAX_SCOPES = 100;
export const DEFAULT_MAX_POSITIONS_PER_SCOPE = 2000;
export const MAX_EXPANDED_GROUPS = 500;
export const MAX_SCOPE_LENGTH = 200;
export const MAX_KEY_LENGTH = 200;

export type CanvasDirection = 'auto' | 'LR' | 'TD';

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasScopeLayout {
  direction: CanvasDirection;
  expandedGroups: string[];
  positions: Record<string, CanvasPosition>;
  updatedAt: string | null;
}

export interface CanvasLayoutFile {
  version: typeof CANVAS_LAYOUT_VERSION;
  scopes: Record<string, CanvasScopeLayout>;
}

export interface CanvasLayoutStoreOptions {
  filePath: string;
  maxScopes?: number;
  maxPositionsPerScope?: number;
}

export interface CanvasScopePatch {
  direction?: CanvasDirection;
  expandedGroups?: string[];
  setPositions?: Record<string, CanvasPosition | null>;
  resetPositions?: boolean;
}

export type LayoutValidationCode =
  | 'invalid-scope'
  | 'invalid-direction'
  | 'invalid-expanded-groups'
  | 'invalid-position'
  | 'too-many-scopes'
  | 'too-many-positions';

export class LayoutValidationError extends Error {
  code: LayoutValidationCode;
  field: string;

  constructor(code: LayoutValidationCode, field: string, message: string) {
    super(message);
    this.name = 'LayoutValidationError';
    this.code = code;
    this.field = field;
  }
}

const DIRECTIONS: readonly CanvasDirection[] = ['auto', 'LR', 'TD'];
const SCOPE_PATTERN = /^(all|[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100})$/;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDirection(value: unknown): value is CanvasDirection {
  return typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);
}

function isValidKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_KEY_LENGTH) return false;
  if (UNSAFE_KEYS.has(value)) return false;
  return !/[\u0000-\u001f\u007f]/.test(value);
}

function isValidScope(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_SCOPE_LENGTH && SCOPE_PATTERN.test(value);
}

function requireScope(scope: string): string {
  if (!isValidScope(scope)) {
    throw new LayoutValidationError(
      'invalid-scope',
      'scope',
      'scope must be "all" or "owner/repo"',
    );
  }
  return scope;
}

function cloneScope(scope: CanvasScopeLayout): CanvasScopeLayout {
  const positions: Record<string, CanvasPosition> = {};
  for (const [key, position] of Object.entries(scope.positions)) {
    positions[key] = { x: position.x, y: position.y };
  }
  return {
    direction: scope.direction,
    expandedGroups: [...scope.expandedGroups],
    positions,
    updatedAt: scope.updatedAt,
  };
}

function defaultScope(): CanvasScopeLayout {
  return { direction: 'auto', expandedGroups: [], positions: {}, updatedAt: null };
}

function sanitizeExpandedGroups(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const entry of value) {
    if (!isValidKey(entry) || seen.has(entry)) continue;
    seen.add(entry);
    groups.push(entry);
    if (groups.length >= MAX_EXPANDED_GROUPS) break;
  }
  return groups;
}

function sanitizePositions(value: unknown): Record<string, CanvasPosition> {
  const positions: Record<string, CanvasPosition> = {};
  if (!isRecord(value)) return positions;
  for (const [key, raw] of Object.entries(value)) {
    if (!isValidKey(key) || !isRecord(raw)) continue;
    if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) continue;
    positions[key] = { x: raw.x, y: raw.y };
  }
  return positions;
}

function sanitizeUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function sanitizeScope(value: unknown): CanvasScopeLayout | null {
  if (!isRecord(value)) return null;
  return {
    direction: isDirection(value.direction) ? value.direction : 'auto',
    expandedGroups: sanitizeExpandedGroups(value.expandedGroups),
    positions: sanitizePositions(value.positions),
    updatedAt: sanitizeUpdatedAt(value.updatedAt),
  };
}

function parseExpandedGroups(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new LayoutValidationError(
      'invalid-expanded-groups',
      'expandedGroups',
      'expandedGroups must be an array of group keys',
    );
  }
  if (value.length > MAX_EXPANDED_GROUPS) {
    throw new LayoutValidationError(
      'invalid-expanded-groups',
      'expandedGroups',
      `expandedGroups may hold at most ${MAX_EXPANDED_GROUPS} entries`,
    );
  }
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const entry of value) {
    if (!isValidKey(entry)) {
      throw new LayoutValidationError(
        'invalid-expanded-groups',
        'expandedGroups',
        'expandedGroups entries must be non-empty strings without control characters',
      );
    }
    if (seen.has(entry)) continue;
    seen.add(entry);
    groups.push(entry);
  }
  return groups;
}

function parsePositionsPatch(value: unknown): Record<string, CanvasPosition | null> {
  if (!isRecord(value)) {
    throw new LayoutValidationError(
      'invalid-position',
      'setPositions',
      'setPositions must be an object of positions or null deletions',
    );
  }
  const entries: Record<string, CanvasPosition | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isValidKey(key)) {
      throw new LayoutValidationError(
        'invalid-position',
        'setPositions',
        'position keys must be non-empty strings without control characters',
      );
    }
    if (raw === null) {
      entries[key] = null;
      continue;
    }
    if (!isRecord(raw) || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) {
      throw new LayoutValidationError(
        'invalid-position',
        'setPositions',
        'positions require finite numeric x and y',
      );
    }
    entries[key] = { x: raw.x, y: raw.y };
  }
  return entries;
}

function errorCode(error: unknown): string | undefined {
  if (isRecord(error) && typeof error.code === 'string') return error.code;
  return undefined;
}

export class CanvasLayoutStore {
  private readonly filePath: string;
  private readonly maxScopes: number;
  private readonly maxPositionsPerScope: number;
  private readonly scopes = new Map<string, CanvasScopeLayout>();
  private loadPromise: Promise<void> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: CanvasLayoutStoreOptions) {
    if (!options || typeof options.filePath !== 'string' || options.filePath.trim() === '') {
      throw new TypeError('CanvasLayoutStore requires a non-empty filePath');
    }
    this.filePath = options.filePath;
    this.maxScopes = Math.max(1, Math.floor(options.maxScopes ?? DEFAULT_MAX_SCOPES));
    this.maxPositionsPerScope = Math.max(
      1,
      Math.floor(options.maxPositionsPerScope ?? DEFAULT_MAX_POSITIONS_PER_SCOPE),
    );
  }

  async getScope(scope: string): Promise<CanvasScopeLayout> {
    return this.enqueue(async () => {
      requireScope(scope);
      await this.ensureLoaded();
      const stored = this.scopes.get(scope);
      return stored ? cloneScope(stored) : defaultScope();
    });
  }

  async patchScope(scope: string, patch: CanvasScopePatch): Promise<CanvasScopeLayout> {
    return this.enqueue(async () => {
      requireScope(scope);
      if (!isRecord(patch)) {
        throw new LayoutValidationError('invalid-direction', 'patch', 'patch must be an object');
      }

      const hasDirection = patch.direction !== undefined;
      const hasGroups = patch.expandedGroups !== undefined;
      const hasPositions = patch.setPositions !== undefined;
      const shouldReset = patch.resetPositions === true;

      const nextDirection = hasDirection ? patch.direction : undefined;
      if (hasDirection && !isDirection(nextDirection)) {
        throw new LayoutValidationError(
          'invalid-direction',
          'direction',
          'direction must be "auto", "LR" or "TD"',
        );
      }
      const nextGroups = hasGroups ? parseExpandedGroups(patch.expandedGroups) : undefined;
      const positionEntries = hasPositions ? parsePositionsPatch(patch.setPositions) : undefined;

      await this.ensureLoaded();

      const existing = this.scopes.get(scope);
      if (!existing && this.scopes.size >= this.maxScopes) {
        throw new LayoutValidationError(
          'too-many-scopes',
          'scope',
          `at most ${this.maxScopes} scopes may be stored`,
        );
      }

      const base = existing ? cloneScope(existing) : defaultScope();
      if (!hasDirection && !hasGroups && !hasPositions && !shouldReset) {
        return base;
      }

      const next: CanvasScopeLayout = {
        direction: hasDirection ? (nextDirection as CanvasDirection) : base.direction,
        expandedGroups: nextGroups ?? base.expandedGroups,
        positions: shouldReset ? {} : base.positions,
        updatedAt: new Date().toISOString(),
      };

      if (positionEntries) {
        for (const [key, position] of Object.entries(positionEntries)) {
          if (position === null) {
            delete next.positions[key];
          } else {
            next.positions[key] = position;
          }
        }
      }

      if (Object.keys(next.positions).length > this.maxPositionsPerScope) {
        throw new LayoutValidationError(
          'too-many-positions',
          'setPositions',
          `at most ${this.maxPositionsPerScope} positions may be stored per scope`,
        );
      }

      this.scopes.set(scope, next);
      try {
        await this.writeLayout();
      } catch (error) {
        if (existing) {
          this.scopes.set(scope, existing);
        } else {
          this.scopes.delete(scope);
        }
        throw error;
      }
      return cloneScope(next);
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.load();
    }
    return this.loadPromise;
  }

  private async load(): Promise<void> {
    let raw: string;
    try {
      raw = await fsp.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return;
      // Unreadable state must not take the board down; start empty.
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await this.backupCorruptFile(raw);
      return;
    }

    if (!isRecord(parsed) || parsed.version !== CANVAS_LAYOUT_VERSION || !isRecord(parsed.scopes)) {
      await this.backupCorruptFile(raw);
      return;
    }

    for (const [scope, value] of Object.entries(parsed.scopes)) {
      if (!isValidScope(scope)) continue;
      const sanitized = sanitizeScope(value);
      if (sanitized) this.scopes.set(scope, sanitized);
    }
  }

  private async backupCorruptFile(raw: string): Promise<void> {
    try {
      await fsp.writeFile(`${this.filePath}.corrupt`, raw, { mode: 0o600 });
    } catch {
      // The backup is diagnostic only; recovery still proceeds.
    }
  }

  private async writeLayout(): Promise<void> {
    const scopes: Record<string, CanvasScopeLayout> = {};
    for (const scope of [...this.scopes.keys()].sort()) {
      scopes[scope] = this.scopes.get(scope) as CanvasScopeLayout;
    }
    const data: CanvasLayoutFile = { version: CANVAS_LAYOUT_VERSION, scopes };
    const json = `${JSON.stringify(data, null, 2)}\n`;

    const directory = path.dirname(this.filePath);
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });

    const tmpPath = `${this.filePath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      await fsp.writeFile(tmpPath, json, { mode: 0o600 });
      await fsp.chmod(tmpPath, 0o600).catch(() => {});
      await fsp.rename(tmpPath, this.filePath);
    } catch (error) {
      await fsp.unlink(tmpPath).catch(() => {});
      throw error;
    }
  }
}
