import { describe, expect, it } from 'vitest';
import { createGameFromLevel, composeBird, selectBoardTile } from '../src/core/gameEngine';
import { REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import { createMemoryCandidate, experimentRegionalV7Rescue, tryVisibleUndo } from '../tools/experimentRegionalV7Rescue';

const original = REGIONAL_V7_PUZZLES.find((puzzle) => puzzle.record.tier === 5)!;

describe('V7 D5 unpublished rescue experiment', () => {
  it('limits and reproduces visible-state single-step undo trials without a witness', () => {
    const first = tryVisibleUndo(original, 0);
    expect(tryVisibleUndo({ ...original, level: { ...original.level, winningSolution: [] } }, 0)).toEqual(first);
    expect(first.forwardActions).toBeLessThanOrEqual(180);
    expect(first.undos).toBeLessThanOrEqual(20);
    expect(first.finalTray).toBeLessThanOrEqual(10);
    if (first.status !== 'LOSS') expect(first.deadlockCause).toBe('NONE');
  });

  it('builds a distinct in-memory identity with unchanged word multiset and a replayable certificate', () => {
    const candidate = createMemoryCandidate(original, 0);
    expect(candidate.record.puzzleId).not.toBe(original.record.puzzleId);
    expect(candidate.record.puzzleId).toMatch(/^regional-v7-rescue:/);
    expect([...candidate.record.wordOccurrences].sort()).toEqual([...original.record.wordOccurrences].sort());
    expect([...candidate.record.characters].sort()).toEqual([...original.record.characters].sort());
    let state = createGameFromLevel(candidate.level);
    for (const action of candidate.level.winningSolution) {
      state = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    }
    expect(state.phase).toBe('level_complete');
    expect(REGIONAL_V7_PUZZLES.find((puzzle) => puzzle.record.puzzleId === candidate.record.puzzleId)).toBeUndefined();
  });

  it('reports held-out trials separately from training-selected candidates', () => {
    const report = experimentRegionalV7Rescue();
    expect(report.originalUndo).toHaveLength(25);
    expect(report.candidateCount).toBe(40);
    expect(report.trainingTrialCount).toBe(200);
    expect(report.holdoutTrialCount).toBe(25);
    expect(report.rearranged).toHaveLength(5);
    for (const stage of report.rearranged) {
      expect(stage.candidates).toBe(8);
      expect(stage.uniqueBoardHashes).toBeGreaterThan(0);
      expect(stage.trainWins).toBeLessThanOrEqual(5);
      expect(stage.holdoutWins + stage.holdoutLosses + stage.holdoutUnknown).toBe(5);
    }
  });
});
