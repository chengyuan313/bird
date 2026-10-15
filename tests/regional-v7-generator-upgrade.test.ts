import { describe, expect, it } from 'vitest';
import { createGameFromLevel, selectBoardTile, composeBird } from '../src/core/gameEngine';
import { REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import { constructUpgradeCandidate, experimentRegionalV7GeneratorUpgrade } from '../tools/experimentRegionalV7GeneratorUpgrade';

const original = REGIONAL_V7_PUZZLES.find((puzzle) => puzzle.record.tier === 5)!;

describe('unpublished V7 D5 generator upgrade experiment', () => {
  it.each([0, 1])('certifies construction method at candidate %i without changing words or geometry', (index) => {
    const first = constructUpgradeCandidate(original, index);
    const again = constructUpgradeCandidate(original, index);
    expect(again.boardHash).toBe(first.boardHash);
    expect(again.puzzle.record.puzzleId).toBe(first.puzzle.record.puzzleId);
    expect(first.boardHash).not.toBe(original.record.boardHash);
    expect(first.puzzle.record.puzzleId).toMatch(/^regional-v7-upgrade:/);
    expect(first.maximumWitnessTray).toBeLessThanOrEqual(8);
    expect([...first.puzzle.level.wordOccurrences!].sort()).toEqual([...original.level.wordOccurrences!].sort());
    expect(first.puzzle.level.tiles.map((tile) => tile.blockedBy)).toEqual(original.level.tiles.map((tile) => tile.blockedBy));
    let state = createGameFromLevel(first.puzzle.level);
    for (const action of first.puzzle.level.winningSolution) {
      const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
      expect(next).not.toBe(state);
      state = next;
    }
    expect(state.phase).toBe('level_complete');
  });

  it('keeps train/holdout independent and reports acceptance without publishing', () => {
    const report = experimentRegionalV7GeneratorUpgrade();
    expect(report.attempted).toBe(100);
    expect(report.certified + report.failed).toBe(100);
    expect(report.stages).toHaveLength(5);
    expect(report.holdoutWins).toBeLessThanOrEqual(50);
    for (const stage of report.stages) {
      expect(stage.attempted).toBe(20);
      expect(stage.methodDiagnostics).toHaveLength(2);
      expect(stage.methodDiagnostics.reduce((sum, item) => sum + item.certified + item.failed, 0)).toBe(20);
      if (!stage.selected) continue;
      expect(stage.selected.maximumWitnessTray).toBeLessThanOrEqual(8);
      expect(stage.selected.holdout.reduce((sum, item) => sum + item.wins + item.losses + item.unknown, 0)).toBe(10);
      expect(REGIONAL_V7_PUZZLES.some((puzzle) => puzzle.record.puzzleId === stage.selected!.puzzleId)).toBe(false);
    }
  }, 45_000);
});
