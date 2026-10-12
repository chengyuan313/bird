import { describe, expect, it } from 'vitest';
import report from '../tools/playtest-comparison.json';
import productionBank from '../src/core/puzzleBank.json';
import { CERTIFIED_PUZZLE_BANK } from '../src/core/puzzleBank';
import { composeBird, createGameFromLevel, selectBoardTile } from '../src/core/gameEngine';
import { createGame, restartLevel, startExperiment, switchExperimentalBoard } from '../src/core/game';
import { EXPERIMENT_GROUPS, levelFromPlaytestPuzzle, PLAYTEST_PUZZLES, playtestPuzzlesInGroup } from '../src/core/playtestBank';
import { GLOBAL_BIRD_COMPOSITIONS } from '../src/core/recognitionRegistry';
import { PlaytestStatistics, PLAYTEST_RECORD_LIMIT, PLAYTEST_STORAGE_KEY, summarizeAttempts } from '../src/ui/playtestStatistics';
import { comparisonWithoutTimings, runPlaytestComparison } from '../tools/playtestComparison';
import { DIFFICULTY_PROFILES, generateExperimentalCandidate } from '../tools/parameterizedGeneration';
import { legalActions, runStrategyTrial } from '../tools/level3Evaluation';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('V5.3 matched experimental bank', () => {
  it('preserves all 105 production certificates and has 5 unique puzzles in each group', () => {
    expect(CERTIFIED_PUZZLE_BANK.records).toEqual(productionBank.records);
    expect(CERTIFIED_PUZZLE_BANK.records).toHaveLength(105);
    expect(PLAYTEST_PUZZLES).toHaveLength(15);
    expect(new Set(PLAYTEST_PUZZLES.map((item) => item.id)).size).toBe(15);
    expect(new Set(PLAYTEST_PUZZLES.map((item) => item.boardHash)).size).toBe(15);
    for (const group of EXPERIMENT_GROUPS) expect(playtestPuzzlesInGroup(group)).toHaveLength(5);
    expect(PLAYTEST_PUZZLES.every((item) => !CERTIFIED_PUZZLE_BANK.records.some((record) => record.boardHash === item.boardHash))).toBe(true);
    expect(GLOBAL_BIRD_COMPOSITIONS).toHaveLength(103);
  });

  it('keeps matched seeds, content multiset and geometry while changing placement', () => {
    for (const seed of [31, 37, 43, 47, 53]) {
      const matched = PLAYTEST_PUZZLES.filter((item) => item.seed === seed);
      expect(matched.map((item) => item.group)).toEqual(['A', 'B', 'C']);
      expect(matched.map((item) => Array.from(item.characters).sort().join('')))
        .toEqual(Array(3).fill(Array.from(matched[0].characters).sort().join('')));
      const levels = matched.map((item) => levelFromPlaytestPuzzle(item.id));
      expect(levels.map((level) => level.tiles.map((tile) => [tile.id, tile.x, tile.y, tile.layer, tile.blockedBy])))
        .toEqual(Array(3).fill(levels[0].tiles.map((tile) => [tile.id, tile.x, tile.y, tile.layer, tile.blockedBy])));
    }
  });

  it('replays all 15 certificates and reproduces their exact generation inputs', () => {
    const profile = DIFFICULTY_PROFILES.find((item) => item.id === 'standard')!;
    for (const record of PLAYTEST_PUZZLES) {
      const generated = generateExperimentalCandidate(profile, record.seed, record.placement as typeof profile.placement, 'seeded-random');
      expect(generated.ok).toBe(true);
      if (!generated.ok) continue;
      expect([generated.candidate.experimentId, generated.candidate.boardHash]).toEqual([record.id, record.boardHash]);
      const level = levelFromPlaytestPuzzle(record.id);
      expect(level.tiles).toHaveLength(90);
      let state = createGameFromLevel(level);
      for (const action of level.winningSolution) {
        const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
        expect(next).not.toBe(state);
        state = next;
        expect(state.tray.filter(Boolean).length).toBeLessThanOrEqual(10);
      }
      expect(state.phase).toBe('level_complete');
    }
  });

  it('retries the same puzzle, switches within a group, and returns to normal play', () => {
    const first = startExperiment('A');
    expect(first.experimentGroup).toBe('A');
    const taken = selectBoardTile(first, first.boardTiles.find((tile) => tile.blockedBy.length === 0)!.id);
    expect(restartLevel(taken).puzzleId).toBe(first.puzzleId);
    expect(restartLevel(taken).tray.filter(Boolean)).toHaveLength(0);
    const next = switchExperimentalBoard(taken);
    expect(next.experimentGroup).toBe('A');
    expect(next.puzzleId).not.toBe(first.puzzleId);
    expect(startExperiment('B').experimentGroup).toBe('B');
    expect(createGame('level-3').experimentGroup).toBeUndefined();
    expect(createGame('level-1').boardTiles).toHaveLength(22);
    expect(() => startExperiment('B', first.puzzleId)).toThrow();
  });

  it('reproduces comparison outcomes separately from wall-clock timing', () => {
    expect(comparisonWithoutTimings(runPlaytestComparison())).toEqual(comparisonWithoutTimings(report as unknown as ReturnType<typeof runPlaytestComparison>));
    expect(report.groups.every((group) => group.accepted === 5 && group.replayCertified === 5)).toBe(true);
    const first = levelFromPlaytestPuzzle(PLAYTEST_PUZZLES[0].id);
    const noWitness = { ...first, winningSolution: [] };
    expect(runStrategyTrial(first, 'bounded-planner', 123, 20)).toEqual(runStrategyTrial(noWitness, 'bounded-planner', 123, 20));
    expect(runStrategyTrial(first, 'bounded-planner', 123, 0).outcome).toBe('UNKNOWN');
  }, 60_000);

  it('evaluates every legal take and global alias/group composition without reading the witness', () => {
    const level = { id: 'recognition-evaluation', label: '测试',
      tiles: ['斑', '鸠', '麻', '雀', '树'].map((character, index) => ({
        id: `x${index}`, character, x: index, y: 0, layer: 0, blockedBy: [] as string[],
      })), winningSolution: [] };
    let state = createGameFromLevel(level);
    expect(legalActions(state)).toHaveLength(5);
    for (const tileId of ['x0', 'x1', 'x2', 'x3', 'x4']) state = selectBoardTile(state, tileId);
    const composeIds = legalActions(state).filter((action) => action.type === 'compose').map((action) => action.birdId);
    expect(composeIds).toContain('composition:banjiu');
    expect(composeIds).toContain('composition:maque');
    expect(composeIds).toContain('bird:shumaque');
    expect(runStrategyTrial(level, 'always-compose', 42, 0).outcome).toBe('UNKNOWN');
  });
});

describe('opt-in local attempt lifecycle', () => {
  it('starts on an action, excludes hidden time, and classifies retry and interruption', () => {
    const storage = new MemoryStorage();
    let now = 1000;
    const clock = { now: () => now };
    const stats = new PlaytestStatistics(storage, clock);
    const initial = startExperiment('A');
    stats.observe(initial, initial);
    expect(stats.records).toHaveLength(0);
    stats.setEnabled(true);
    const taken = selectBoardTile(initial, initial.boardTiles.find((tile) => tile.blockedBy.length === 0)!.id);
    stats.observe(initial, taken);
    now += 1000;
    stats.setVisible(false);
    now += 5000;
    stats.setVisible(true);
    now += 2000;
    stats.observe(taken, restartLevel(taken));
    expect(stats.records[0]).toMatchObject({ result: 'ABANDONED', attemptIndex: 1, tileSelections: 1, activeDurationMs: 3000 });
    const retry = restartLevel(taken);
    const retryTaken = selectBoardTile(retry, retry.boardTiles.find((tile) => tile.blockedBy.length === 0)!.id);
    stats.observe(retry, retryTaken);
    now += 100;
    stats.interrupt();
    expect(stats.records[1]).toMatchObject({ result: 'INTERRUPTED', attemptIndex: 2 });
    expect(new PlaytestStatistics(storage, clock).records).toHaveLength(2);
  });

  it('records win and loss through actual transitions, without duplicate terminal records', () => {
    const stats = new PlaytestStatistics(new MemoryStorage(), { now: () => 100 });
    stats.setEnabled(true);
    const level = levelFromPlaytestPuzzle(PLAYTEST_PUZZLES[0].id);
    let state = createGameFromLevel(level);
    for (const action of level.winningSolution) {
      const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
      stats.observe(state, next);
      state = next;
    }
    expect(stats.records).toHaveLength(1);
    expect(stats.records[0]).toMatchObject({ result: 'WON', tileSelections: 90, finalScore: state.score });
    stats.observe(state, state);
    expect(stats.records).toHaveLength(1);
    // A full tray with no formable composition is a genuine engine terminal loss.
    let loss = createGameFromLevel({ id: 'loss-fixture', label: '测试',
      tiles: Array.from({ length: 11 }, (_, index) => ({ id: `x${index}`, character: '无', x: index, y: 0, layer: 0, blockedBy: [] })),
      winningSolution: [] });
    for (let index = 0; index < 10; index += 1) {
      const next = selectBoardTile(loss, `x${index}`);
      stats.observe(loss, next);
      loss = next;
    }
    expect(loss.phase).toBe('game_over');
    expect(stats.records[1]).toMatchObject({ result: 'LOST', failureReason: 'TRAY_FULL' });
  });

  it('supports opt-out, JSON export, clearing, invalid data, unavailable storage, and retention', () => {
    const storage = new MemoryStorage();
    storage.setItem(PLAYTEST_STORAGE_KEY, '{broken');
    const stats = new PlaytestStatistics(storage);
    expect(stats.records).toHaveLength(0);
    const initial = createGame('level-1');
    const taken = selectBoardTile(initial, 'l1-u01');
    stats.observe(initial, taken);
    expect(stats.records).toHaveLength(0);
    stats.setEnabled(true);
    stats.observe(initial, taken);
    stats.setEnabled(false);
    expect(stats.records).toHaveLength(0);
    stats.setEnabled(true);
    stats.observe(initial, taken);
    stats.observe(taken, restartLevel(taken));
    expect(JSON.parse(stats.exportJson()).records).toHaveLength(1);
    expect(summarizeAttempts(stats.records).A.attempts).toBe(0);
    stats.clear();
    expect(stats.records).toHaveLength(0);
    const blocked = { getItem: () => { throw Error('security'); }, setItem: () => { throw Error('quota'); }, removeItem: () => { throw Error('security'); } };
    expect(() => new PlaytestStatistics(blocked).setEnabled(true)).not.toThrow();
    storage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, enabled: true, records: [] }));
    expect(new PlaytestStatistics(storage).enabled).toBe(false);
    expect(PLAYTEST_RECORD_LIMIT).toBe(500);
    const many = Array.from({ length: 500 }, (_, index) => ({
      schemaVersion: 1, puzzleId: 'level-1', experimentGroup: null, attemptIndex: index + 1,
      startedAt: index, endedAt: index, activeDurationMs: 0, tileSelections: 1,
      successfulCompositions: 0, maximumTrayOccupancy: 1, finalScore: 0,
      result: 'ABANDONED', failureReason: null,
    }));
    storage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, enabled: true,
      records: many, active: null, attemptCounts: { 'level-1': 500 } }));
    const capped = new PlaytestStatistics(storage, { now: () => 1000 });
    capped.observe(initial, taken);
    capped.observe(taken, restartLevel(taken));
    expect(capped.records).toHaveLength(500);
    expect(capped.records.at(-1)?.attemptIndex).toBe(501);
  });
});
