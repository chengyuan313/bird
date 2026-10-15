import { describe, expect, it } from 'vitest';
import { REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import { evaluateRegionalV7Bank, evaluateRegionalV7Trial, REGIONAL_V7_EVALUATION_STRATEGIES } from '../tools/evaluateRegionalV7Difficulty';

describe('V7 non-oracle difficulty evaluation', () => {
  it('is deterministic, bounded, and reports exact terminal state diagnostics', () => {
    const puzzle = REGIONAL_V7_PUZZLES.find((item) => item.record.tier === 2)!;
    for (const strategy of REGIONAL_V7_EVALUATION_STRATEGIES) {
      const first = evaluateRegionalV7Trial(puzzle, strategy, 0);
      expect(evaluateRegionalV7Trial(puzzle, strategy, 0)).toEqual(first);
      expect(first.actions).toBeLessThanOrEqual(180);
      expect(first.maximumTrayOccupancy).toBeLessThanOrEqual(10);
      expect(first.finalTrayOccupancy).toBeLessThanOrEqual(first.maximumTrayOccupancy);
      if (first.status === 'LOSS') expect(first.deadlockCause).not.toBe('NONE');
      else expect(first.deadlockCause).toBe('NONE');
    }
  });

  it('does not use the construction witness or require it to exist', () => {
    const original = REGIONAL_V7_PUZZLES[0];
    const withoutWitness = { ...original, level: { ...original.level, winningSolution: [] } };
    expect(evaluateRegionalV7Trial(original, 'word-seeking', 3))
      .toEqual(evaluateRegionalV7Trial(withoutWitness, 'word-seeking', 3));
  });

  it('separates finite-budget UNKNOWN from actual tray deadlocks', () => {
    const puzzle = REGIONAL_V7_PUZZLES[0];
    const limited = evaluateRegionalV7Trial(puzzle, 'random-legal', 0, 1);
    expect(limited.status).toBe('UNKNOWN');
    expect(limited.deadlockCause).toBe('NONE');
    expect(limited.actions).toBe(1);
    const report = evaluateRegionalV7Bank(1);
    expect(report.rows).toHaveLength(25 * REGIONAL_V7_EVALUATION_STRATEGIES.length);
    for (const group of report.summary) {
      expect(group.wins + group.losses + group.unknown).toBe(group.trials);
      expect(group.fullTrayDeadlocks + group.boardExhaustedDeadlocks).toBeLessThanOrEqual(group.losses);
    }
    expect(report.d5PuzzleSummary).toHaveLength(5);
  });
});
