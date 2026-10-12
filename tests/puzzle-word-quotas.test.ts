import { describe, expect, it } from 'vitest';
import { composeBird, createGame, createGameFromLevel, evaluateTerminalState, findPlayableBirds, restartLevel, selectBoardTile, startExperiment, switchExperimentalBoard, switchLevel3Board } from '../src/core/game';
import { GAMEPLAY_RULESET_VERSION } from '../src/core/gameEngine';
import { getLevel } from '../src/core/levels';
import { CERTIFIED_PUZZLE_BANK, levelFromCertifiedPuzzle } from '../src/core/puzzleBank';
import { PLAYTEST_PUZZLES, levelFromPlaytestPuzzle } from '../src/core/playtestBank';
import { GLOBAL_BIRD_COMPOSITIONS } from '../src/core/recognitionRegistry';
import { PlaytestStatistics, PLAYTEST_STORAGE_KEY, summarizeAttempts } from '../src/ui/playtestStatistics';
import { replaySolution } from '../tools/level3Solver';
import type { LevelDefinition, RackTile } from '../src/core/types';

const byId = new Map(GLOBAL_BIRD_COMPOSITIONS.map((bird) => [bird.id, bird]));

function fixture(ids: readonly string[]): LevelDefinition {
  const tiles = ids.flatMap((id) => byId.get(id)!.characters).map((character, index) => ({
    id: `f${index}`, character, x: index * 20, y: 0, layer: 0, blockedBy: [],
  }));
  return { id: 'quota-fixture', label: '测试', tiles, wordOccurrences: ids, winningSolution: [] };
}

function tray(text: string): Array<RackTile | null> {
  return [...Array.from(text).map((character, index) => ({ id: `r${index}`, character })),
    ...Array<RackTile | null>(10 - Array.from(text).length).fill(null)];
}

describe('puzzle-scoped composition quotas', () => {
  it('keeps the registry but rejects non-sampled names, aliases, and groups', () => {
    expect(GLOBAL_BIRD_COMPOSITIONS).toHaveLength(103);
    const state = { ...createGameFromLevel(fixture(['bird:shanbanjiu', 'bird:shumaque'])), tray: tray('山斑鸠树麻雀') };
    expect(findPlayableBirds(state).map((bird) => bird.id)).toEqual(['bird:shanbanjiu', 'bird:shumaque']);
    for (const id of ['composition:banjiu', 'composition:maque', 'bird:dashanque']) {
      expect(composeBird(state, id)).toBe(state);
    }
    expect(state.gameplayRulesetVersion).toBe(GAMEPLAY_RULESET_VERSION);
  });

  it('consumes exact characters and score once per occurrence, then rejects a stale ID', () => {
    let state = createGameFromLevel(fixture(['bird:xique', 'bird:xique', 'bird:shanbanjiu']));
    expect(state.compositionQuotas).toEqual({ 'bird:xique': 2, 'bird:shanbanjiu': 1 });
    const original = state.compositionQuotas;
    state = selectBoardTile(selectBoardTile(state, 'f0'), 'f1');
    const first = composeBird(state, 'bird:xique');
    expect(first.score).toBe(10);
    expect(first.completedBirdCount).toBe(1);
    expect(first.discoveredBirdIds).toEqual(['bird:xique']);
    expect(first.remainingCompositionQuotas['bird:xique']).toBe(1);
    expect(first.compositionQuotas).toBe(original);
    expect(first.tray.every((tile) => tile === null)).toBe(true);
    const second = composeBird({ ...first, tray: tray('喜鹊') }, 'bird:xique');
    expect(second.score).toBe(20);
    expect(second.remainingCompositionQuotas['bird:xique']).toBe(0);
    expect(second.discoveredBirdIds).toEqual(['bird:xique']);
    const stale = { ...second, tray: tray('喜鹊') };
    expect(findPlayableBirds(stale).some((bird) => bird.id === 'bird:xique')).toBe(false);
    expect(composeBird(stale, 'bird:xique')).toBe(stale);
    expect(composeBird(stale, 'bird:not-real')).toBe(stale);
  });

  it('preserves discovery semantics when an alias or group is explicitly sampled', () => {
    const initial = createGameFromLevel(fixture(['bird:shumaque', 'composition:maque', 'composition:banjiu']));
    const tree = composeBird({ ...initial, tray: tray('树麻雀') }, 'bird:shumaque');
    expect(tree.discoveredBirdIds).toEqual(['bird:shumaque']);
    const alias = composeBird({ ...tree, tray: tray('麻雀') }, 'composition:maque');
    expect(alias.score).toBe(40);
    expect(alias.discoveredBirdIds).toEqual(['bird:shumaque']);
    expect(alias.lastCompletedBird?.isNew).toBe(false);
    const group = composeBird({ ...alias, tray: tray('斑鸠') }, 'composition:banjiu');
    expect(group.score).toBe(50);
    expect(group.discoveredBirdIds).toEqual(['bird:shumaque']);
    expect(group.lastCompletedBird?.isNew).toBe(false);
  });

  it('uses remaining quotas for full-tray and empty-board terminal decisions', () => {
    const initial = createGameFromLevel(fixture(['bird:xique']));
    const emptyBoard = initial.boardTiles.map((tile) => ({ ...tile, removed: true }));
    const cleanup = { ...initial, boardTiles: emptyBoard, tray: tray('喜鹊') };
    expect(composeBird(cleanup, 'bird:xique').phase).toBe('level_complete');
    const exhausted = { ...cleanup, remainingCompositionQuotas: { 'bird:xique': 0 } };
    expect(composeBird(exhausted, 'bird:xique')).toBe(exhausted);
    expect(evaluateTerminalState(emptyBoard, exhausted.tray, exhausted.activeCompositions, exhausted.remainingCompositionQuotas)).toBe('game_over');
    const full = { ...initial, tray: tray('喜鹊〇〇〇〇〇〇〇〇') };
    expect(findPlayableBirds(full).map((bird) => bird.id)).toEqual(['bird:xique']);
    const noQuota = { ...full, remainingCompositionQuotas: { 'bird:xique': 0 } };
    expect(findPlayableBirds(noQuota)).toEqual([]);
    expect(evaluateTerminalState(noQuota.boardTiles, noQuota.tray, noQuota.activeCompositions, noQuota.remainingCompositionQuotas)).toBe('game_over');
  });

  it('rejects absent, unknown, mismatched, and character-inconsistent word sources', () => {
    expect(() => createGameFromLevel({ ...fixture(['bird:xique']), wordOccurrences: undefined, winningSolution: [] })).toThrow('Invalid puzzle word occurrences');
    expect(() => createGameFromLevel({ ...fixture(['bird:xique']), wordOccurrences: ['bird:missing'] })).toThrow('Unknown puzzle composition');
    expect(() => createGameFromLevel({ ...fixture(['bird:xique']), wordOccurrences: ['bird:bailu'] })).toThrow('do not match tiles');
    expect(() => createGameFromLevel({ ...fixture(['bird:xique']), winningSolution: [{ type: 'compose', birdId: 'bird:bailu' }] })).toThrow('Invalid puzzle word occurrences');
  });

  it('restores quotas on retry and changes them with puzzle or experiment selection', () => {
    const first = createGame('level-3');
    expect(restartLevel({ ...first, remainingCompositionQuotas: {} }).remainingCompositionQuotas).toEqual(first.compositionQuotas);
    const next = switchLevel3Board(first);
    expect(next.puzzleId).not.toBe(first.puzzleId);
    expect(Object.values(next.compositionQuotas).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(0);
    const experiment = startExperiment('A');
    const switched = switchExperimentalBoard(experiment);
    expect(switched.puzzleId).not.toBe(experiment.puzzleId);
    expect(restartLevel({ ...experiment, remainingCompositionQuotas: {} }).remainingCompositionQuotas).toEqual(experiment.compositionQuotas);
    expect(createGame('level-1').compositionQuotas).toEqual(createGame('level-1').remainingCompositionQuotas);
  });

  it('replays both tutorials, all 105 certified boards, and all 15 experimental boards with zero remaining quotas', () => {
    const levels = [getLevel('level-1'), getLevel('level-2'),
      ...CERTIFIED_PUZZLE_BANK.records.map(levelFromCertifiedPuzzle),
      ...PLAYTEST_PUZZLES.map((record) => levelFromPlaytestPuzzle(record.id))];
    expect(levels).toHaveLength(122);
    for (const level of levels) {
      const completed = replaySolution(level, level.winningSolution);
      expect(completed.phase).toBe('level_complete');
      expect(Object.values(completed.remainingCompositionQuotas).every((count) => count === 0)).toBe(true);
      expect(completed.completedBirdCount).toBe(level.wordOccurrences?.length
        ?? level.winningSolution.filter((action) => action.type === 'compose').length);
    }
  }, 60_000);

  it('tags new local statistics without rewriting old records or mixing summary rulesets', () => {
    const oldRecord = { schemaVersion: 1, puzzleId: 'level-1', experimentGroup: null, attemptIndex: 1,
      startedAt: 1, endedAt: 2, activeDurationMs: 1, tileSelections: 1, successfulCompositions: 0,
      maximumTrayOccupancy: 1, finalScore: 0, result: 'ABANDONED', failureReason: null };
    const memory = new Map([[PLAYTEST_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, enabled: true,
      records: [oldRecord], active: null, attemptCounts: { 'level-1': 1 } })]]);
    const storage = { getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); } };
    const stats = new PlaytestStatistics(storage);
    const initial = createGame('level-1');
    const taken = selectBoardTile(initial, 'l1-u01');
    stats.observe(initial, taken);
    stats.observe(taken, restartLevel(taken));
    expect(stats.records[0]).toEqual(oldRecord);
    expect(stats.records[1].gameplayRulesetVersion).toBe(GAMEPLAY_RULESET_VERSION);
    expect(summarizeAttempts(stats.records, GAMEPLAY_RULESET_VERSION).all.attempts).toBe(1);
    expect(summarizeAttempts(stats.records, 'global-recognition-v4.1.0').all.attempts).toBe(0);
  });
});
