import { describe, expect, it } from 'vitest';
import { createGameFromLevel, composeBird, selectBoardTile } from '../src/core/gameEngine';
import { REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import { constructContentCandidate, CONTENT_AUDIT_TRIAL_INDICES, CONTENT_TRAIN_TRIAL_INDICES,
  CONTENT_VALIDATION_TRIAL_INDICES, experimentRegionalV7ContentUpgrade, validateContentWords } from '../tools/experimentRegionalV7ContentUpgrade';

const firstD5 = REGIONAL_V7_PUZZLES.find((puzzle) => puzzle.record.tier === 5)!;

describe('unpublished V7 D5 content upgrade experiment', () => {
  it.each([0, 1])('constructs deterministic, sourced, engine-certified A/B content candidate %i', (index) => {
    const candidate = constructContentCandidate(firstD5, index);
    expect(constructContentCandidate(firstD5, index).puzzle.record.boardHash).toBe(candidate.puzzle.record.boardHash);
    expect(candidate.puzzle.record.puzzleId).toMatch(/^regional-v7-content:/);
    expect(candidate.puzzle.record.puzzleId).not.toBe(firstD5.record.puzzleId);
    expect(candidate.puzzle.level.tiles).toHaveLength(90);
    expect(candidate.distinctWords).toBeGreaterThanOrEqual(20);
    expect(candidate.longOccurrences).toBeGreaterThanOrEqual(4);
    expect(candidate.longOccurrences).toBeLessThanOrEqual(8);
    expect(candidate.maximumWitnessTray).toBeLessThanOrEqual(10);
    expect(() => validateContentWords(candidate.puzzle.record.wordOccurrences, firstD5.record.stageIndex)).not.toThrow();
    let state = createGameFromLevel(candidate.puzzle.level);
    for (const action of candidate.puzzle.level.winningSolution) {
      const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
      expect(next).not.toBe(state);
      state = next;
    }
    expect(state.phase).toBe('level_complete');
  });

  it('pre-registers disjoint seed sets and locks validation before audit', () => {
    const all = [...CONTENT_TRAIN_TRIAL_INDICES, ...CONTENT_VALIDATION_TRIAL_INDICES, ...CONTENT_AUDIT_TRIAL_INDICES];
    expect(new Set(all).size).toBe(15);
    expect(Math.min(...all)).toBeGreaterThan(9);
    const report = experimentRegionalV7ContentUpgrade();
    expect(report.attempted).toBe(100);
    expect(report.certified + report.failed).toBe(report.attempted);
    expect(report.certified).toBe(100);
    expect(report.uniqueBoardHashes).toBe(100);
    expect(report.validationWins).toBe(48);
    expect(report.originalValidationWins).toBe(0);
    expect(report.auditWins).toBe(49);
    expect(report.originalAuditWins).toBe(0);
    expect(report.passesHumanPrototypeGate).toBe(true);
    expect(report.stages).toHaveLength(5);
    expect(report.validationRows).toHaveLength(5);
    expect(report.auditRows === null).toBe(!report.validationGate);
    const introduced = new Set(report.stages.flatMap((stage) => stage.selected?.contentReview.introducedSpeciesIds ?? []));
    expect(introduced.size).toBe(20);
    for (const stage of report.stages) {
      expect(stage.trainingCandidates.length + stage.failures.length).toBe(20);
      expect(stage.selected?.contentReview.words.every((word) => word.sourceRow > 0 && word.scientificName && word.name)).toBe(true);
    }
  }, 60_000);
});
