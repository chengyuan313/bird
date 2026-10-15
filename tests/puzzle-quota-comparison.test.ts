import { describe, expect, it } from 'vitest';
import { comparePuzzleQuotaPolicy } from '../tools/puzzleQuotaComparison';

describe('matched historical and quota-policy evaluation', () => {
  it('compares fixed-budget non-oracle trials on unchanged puzzle identities', () => {
    const comparison = comparePuzzleQuotaPolicy();
    expect(comparison.productionPuzzleCount).toBe(105);
    expect(comparison.experimentalPuzzleCount).toBe(15);
    for (const result of Object.values(comparison.production)) {
      expect(result.old.wins + result.old.losses + result.old.unknown).toBe(105);
      expect(result.current.wins + result.current.losses + result.current.unknown).toBe(105);
    }
    for (const result of Object.values(comparison.experimental)) {
      expect(result.old.wins + result.old.losses + result.old.unknown).toBe(15);
      expect(result.current.wins + result.current.losses + result.current.unknown).toBe(15);
    }
    console.log(`PUZZLE_QUOTA_COMPARISON ${JSON.stringify(comparison)}`);
  }, 60_000);
});
