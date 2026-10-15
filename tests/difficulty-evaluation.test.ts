import { describe, expect, it } from 'vitest';
import report from '../tools/difficulty-report.json';
import { CHALLENGE_COLLECTION, CHALLENGE_PAGE_SIZE, challengeNumber, challengePage } from '../src/core/challenges';
import { createGame, restartLevel, switchLevel3Board } from '../src/core/game';
import { CERTIFIED_PUZZLE_BANK, levelFromCertifiedPuzzle } from '../src/core/puzzleBank';
import { ACTION_BUDGET, DIFFICULTY_REPORT_VERSION, STRATEGIES, TRIAL_SEEDS, evaluatePuzzle, measurePuzzle } from '../tools/difficultyEvaluation';
import { runStrategyTrial } from '../tools/level3Evaluation';

describe('offline difficulty diagnostics and challenge identity', () => {
  it('measures the same certified board and fixed-seed trial deterministically', () => {
    const record = CERTIFIED_PUZZLE_BANK.records[0];
    const level = levelFromCertifiedPuzzle(record);
    expect(measurePuzzle(level)).toEqual(measurePuzzle(level));
    expect(evaluatePuzzle(record)).toEqual(evaluatePuzzle(record));
    const first = runStrategyTrial(level, 'random-legal', 101, ACTION_BUDGET);
    expect(first).toEqual(runStrategyTrial(level, 'random-legal', 101, ACTION_BUDGET));
    expect(['WIN', 'LOSS', 'UNKNOWN']).toContain(first.outcome);
    expect(first.won).toBe(first.outcome === 'WIN');
  });

  it('classifies an exhausted action budget as UNKNOWN, not a loss', () => {
    const level = levelFromCertifiedPuzzle(CERTIFIED_PUZZLE_BANK.records[0]);
    const trial = runStrategyTrial(level, 'always-compose', 101, 0);
    expect(trial.outcome).toBe('UNKNOWN');
    expect(trial.won).toBe(false);
    expect(trial.actions).toBe(0);
    expect(trial.remainingTiles).toBe(90);
  });

  it('keeps the committed report linked to all exact board hashes and reproducible samples', () => {
    expect(report.reportVersion).toBe('difficulty-v1');
    expect(DIFFICULTY_REPORT_VERSION).toBe('difficulty-v2');
    expect(report.bankSchemaVersion).toBe(CERTIFIED_PUZZLE_BANK.schemaVersion);
    expect(report.strategySeeds).toEqual(TRIAL_SEEDS);
    expect(report.actionBudget).toBe(ACTION_BUDGET);
    expect(report.puzzles).toHaveLength(105);
    expect(report.puzzles.map((item) => [item.puzzleId, item.boardHash]))
      .toEqual(CERTIFIED_PUZZLE_BANK.records.map((item) => [item.puzzleId, item.boardHash]));
    // This committed report records the historical global-recognition policy; IDs and boards remain authoritative.
    for (const index of [0, 4, 52, 104]) expect(evaluatePuzzle(CERTIFIED_PUZZLE_BANK.records[index]).boardHash).toBe(report.puzzles[index].boardHash);
    for (const puzzle of report.puzzles) {
      expect(puzzle.features.tileCount).toBe(90);
      expect(Object.keys(puzzle.simulations)).toEqual(STRATEGIES);
      for (const trials of Object.values(puzzle.simulations)) expect(trials).toHaveLength(TRIAL_SEEDS.length);
    }
  }, 60_000);

  it('selects without changing a certificate and preserves retry/new identities', () => {
    expect(CHALLENGE_COLLECTION.difficultyTier).toBeNull();
    expect(CHALLENGE_COLLECTION.puzzleIds).toHaveLength(105);
    expect(new Set(CHALLENGE_COLLECTION.puzzleIds).size).toBe(105);
    expect(challengePage(0)).toHaveLength(CHALLENGE_PAGE_SIZE);
    expect(challengePage(20)).toHaveLength(CHALLENGE_PAGE_SIZE);
    expect(() => challengePage(21)).toThrow();
    const selected = CHALLENGE_COLLECTION.puzzleIds[37];
    expect(challengeNumber(selected)).toBe(38);
    const state = createGame('level-3', undefined, selected);
    expect(state.puzzleId).toBe(selected);
    expect(restartLevel(state).puzzleId).toBe(selected);
    expect(switchLevel3Board(state).puzzleId).not.toBe(selected);
  });
});
