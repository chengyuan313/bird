import { CERTIFIED_PUZZLE_BANK, getCertifiedPuzzle } from './puzzleBank';

export const CHALLENGE_COLLECTION = {
  id: 'certified-piachan-v1',
  label: '认证挑战',
  /** A neutral collection until playtest evidence supports difficulty tiers. */
  difficultyTier: null,
  puzzleIds: CERTIFIED_PUZZLE_BANK.records.map((record) => record.puzzleId),
} as const;

export const CHALLENGE_PAGE_SIZE = 5;

export function challengeNumber(puzzleId: string): number {
  getCertifiedPuzzle(puzzleId);
  return CHALLENGE_COLLECTION.puzzleIds.indexOf(puzzleId) + 1;
}

export function challengePage(page: number): readonly { number: number; puzzleId: string }[] {
  if (!Number.isInteger(page) || page < 0 || page >= Math.ceil(CHALLENGE_COLLECTION.puzzleIds.length / CHALLENGE_PAGE_SIZE)) {
    throw new Error('Invalid challenge page');
  }
  return CHALLENGE_COLLECTION.puzzleIds.slice(page * CHALLENGE_PAGE_SIZE, (page + 1) * CHALLENGE_PAGE_SIZE)
    .map((puzzleId, index) => ({ number: page * CHALLENGE_PAGE_SIZE + index + 1, puzzleId }));
}
