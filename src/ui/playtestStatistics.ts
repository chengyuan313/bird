import type { GameState } from '../core/types';

export const PLAYTEST_STATS_VERSION = 1;
export const PLAYTEST_STORAGE_KEY = 'bird.playtest.v1';
export const PLAYTEST_RECORD_LIMIT = 500;
export type AttemptResult = 'WON' | 'LOST' | 'ABANDONED' | 'INTERRUPTED';

export interface AttemptRecord {
  schemaVersion: typeof PLAYTEST_STATS_VERSION;
  puzzleId: string;
  experimentGroup: 'A' | 'B' | 'C' | null;
  attemptIndex: number;
  startedAt: number;
  endedAt: number;
  activeDurationMs: number;
  tileSelections: number;
  successfulCompositions: number;
  maximumTrayOccupancy: number;
  finalScore: number;
  result: AttemptResult;
  failureReason: 'TRAY_FULL' | 'BOARD_EXHAUSTED' | null;
}

type ActiveAttempt = Omit<AttemptRecord, 'endedAt' | 'result' | 'failureReason'>;
interface StoredData { schemaVersion: 1; enabled: boolean; records: AttemptRecord[]; active: ActiveAttempt | null; attemptCounts: Record<string, number> }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface Clock { now(): number }

function validRecord(value: unknown): value is AttemptRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AttemptRecord>;
  return item.schemaVersion === 1 && typeof item.puzzleId === 'string'
    && ['A', 'B', 'C', null].includes(item.experimentGroup ?? null)
    && Number.isSafeInteger(item.attemptIndex) && Number.isFinite(item.startedAt)
    && Number.isFinite(item.endedAt) && Number.isFinite(item.activeDurationMs)
    && Number.isSafeInteger(item.tileSelections) && Number.isSafeInteger(item.successfulCompositions)
    && Number.isSafeInteger(item.maximumTrayOccupancy) && Number.isFinite(item.finalScore)
    && ['WON', 'LOST', 'ABANDONED', 'INTERRUPTED'].includes(item.result ?? '');
}

function validActive(value: unknown): value is ActiveAttempt {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ActiveAttempt>;
  return item.schemaVersion === 1 && typeof item.puzzleId === 'string'
    && Number.isSafeInteger(item.attemptIndex) && Number.isFinite(item.startedAt)
    && Number.isFinite(item.activeDurationMs) && Number.isSafeInteger(item.tileSelections)
    && Number.isSafeInteger(item.successfulCompositions) && Number.isSafeInteger(item.maximumTrayOccupancy)
    && Number.isFinite(item.finalScore);
}

export class PlaytestStatistics {
  private recordsValue: AttemptRecord[] = [];
  private active: ActiveAttempt | null = null;
  private runningSince: number | null = null;
  private enabledValue = false;
  private visible = true;
  private attemptCounts: Record<string, number> = {};

  constructor(private readonly storage: StoragePort | null, private readonly clock: Clock = { now: () => Date.now() }) {
    try {
      const raw = storage?.getItem(PLAYTEST_STORAGE_KEY);
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object' || (data as StoredData).schemaVersion !== 1) return;
      const stored = data as StoredData;
      this.enabledValue = stored.enabled === true;
      this.recordsValue = Array.isArray(stored.records) ? stored.records.filter(validRecord).slice(-PLAYTEST_RECORD_LIMIT) : [];
      if (stored.attemptCounts && typeof stored.attemptCounts === 'object') {
        for (const [id, count] of Object.entries(stored.attemptCounts)) {
          if (Number.isSafeInteger(count) && count >= 0) this.attemptCounts[id] = count;
        }
      }
      for (const record of this.recordsValue) this.attemptCounts[record.puzzleId] = Math.max(this.attemptCounts[record.puzzleId] ?? 0, record.attemptIndex);
      if (this.enabledValue && validActive(stored.active)) {
        this.active = stored.active;
        this.finish('INTERRUPTED', this.active.startedAt + this.active.activeDurationMs);
      }
    } catch { /* Storage is optional; never block gameplay. */ }
  }

  get enabled(): boolean { return this.enabledValue; }
  get records(): readonly AttemptRecord[] { return this.recordsValue; }

  setEnabled(enabled: boolean): void {
    if (!enabled) { this.active = null; this.runningSince = null; }
    this.enabledValue = enabled;
    this.persist();
  }

  clear(): void {
    this.recordsValue = [];
    this.active = null;
    this.runningSince = null;
    this.attemptCounts = {};
    try { this.storage?.removeItem(PLAYTEST_STORAGE_KEY); } catch { /* Optional storage. */ }
    this.persist();
  }

  exportJson(): string {
    return JSON.stringify({ schemaVersion: PLAYTEST_STATS_VERSION, records: this.recordsValue }, null, 2);
  }

  private persist(): void {
    try {
      this.storage?.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify({
        schemaVersion: PLAYTEST_STATS_VERSION, enabled: this.enabledValue,
        records: this.recordsValue, active: this.active,
        attemptCounts: this.attemptCounts,
      } satisfies StoredData));
    } catch { /* Quota and security errors must not stop the game. */ }
  }

  private accrue(now: number): void {
    if (this.active && this.runningSince !== null) {
      this.active.activeDurationMs += Math.max(0, now - this.runningSince);
      this.runningSince = now;
    }
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    const now = this.clock.now();
    if (!visible) { this.accrue(now); this.runningSince = null; }
    else if (this.active) this.runningSince = now;
    this.visible = visible;
    this.persist();
  }

  interrupt(): void {
    if (this.active) this.finish('INTERRUPTED', this.clock.now());
  }

  private finish(result: AttemptResult, now: number, state?: GameState): void {
    if (!this.active) return;
    this.accrue(now);
    this.recordsValue.push({ ...this.active, endedAt: now, result,
      failureReason: result === 'LOST' && state
        ? (state.boardTiles.every((tile) => tile.removed) ? 'BOARD_EXHAUSTED' : 'TRAY_FULL') : null });
    this.recordsValue = this.recordsValue.slice(-PLAYTEST_RECORD_LIMIT);
    this.active = null;
    this.runningSince = null;
    this.persist();
  }

  observe(previous: GameState, next: GameState): void {
    if (!this.enabledValue || previous === next) return;
    const now = this.clock.now();
    const samePuzzle = previous.levelId === next.levelId && previous.puzzleId === next.puzzleId;
    const selected = next.boardTiles.filter((tile) => tile.removed).length
      - previous.boardTiles.filter((tile) => tile.removed).length;
    const composed = next.completedBirdCount - previous.completedBirdCount;
    if (!samePuzzle || selected < 0 || composed < 0) this.finish('ABANDONED', now, previous);
    if (selected <= 0 && composed <= 0) return;
    if (!this.active) {
      const puzzleId = next.puzzleId ?? next.levelId;
      const attemptIndex = (this.attemptCounts[puzzleId] ?? 0) + 1;
      this.attemptCounts[puzzleId] = attemptIndex;
      this.active = {
        schemaVersion: 1, puzzleId, experimentGroup: next.experimentGroup ?? null,
        attemptIndex,
        startedAt: now, activeDurationMs: 0, tileSelections: 0,
        successfulCompositions: 0, maximumTrayOccupancy: 0, finalScore: 0,
      };
      this.runningSince = this.visible ? now : null;
    }
    this.accrue(now);
    this.active.tileSelections += Math.max(0, selected);
    this.active.successfulCompositions += Math.max(0, composed);
    this.active.maximumTrayOccupancy = Math.max(this.active.maximumTrayOccupancy, next.tray.filter(Boolean).length);
    this.active.finalScore = next.score;
    if (next.phase === 'level_complete') this.finish('WON', now, next);
    else if (next.phase === 'game_over') this.finish('LOST', now, next);
    else this.persist();
  }
}

export function summarizeAttempts(records: readonly AttemptRecord[]) {
  const summarize = (items: readonly AttemptRecord[]) => ({
    attempts: items.length,
    wins: items.filter((record) => record.result === 'WON').length,
    completionRate: items.length ? items.filter((record) => record.result === 'WON').length / items.length : null,
    averageDurationMs: items.length ? items.reduce((sum, record) => sum + record.activeDurationMs, 0) / items.length : null,
    averageMaximumTray: items.length ? items.reduce((sum, record) => sum + record.maximumTrayOccupancy, 0) / items.length : null,
  });
  return { all: summarize(records), A: summarize(records.filter((record) => record.experimentGroup === 'A')),
    B: summarize(records.filter((record) => record.experimentGroup === 'B')),
    C: summarize(records.filter((record) => record.experimentGroup === 'C')) };
}
