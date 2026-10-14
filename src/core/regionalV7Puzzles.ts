import bank from './regionalV7Bank.json';
import { levelFromRegionalV7Record, validateRegionalV7Record, type RegionalV7PuzzleRecord } from './regionalV7Generator';
import { REGIONAL_V7_TIERS, type RegionalTier } from './regionalV7Data';
import type { LevelDefinition } from './types';

export interface RegionalV7Puzzle {
  record: RegionalV7PuzzleRecord;
  level: LevelDefinition;
}

if (bank.schemaVersion !== 'regional-v7-bank-1' || bank.records.length !== 25) throw new Error('Unsupported regional V7 puzzle bank');
const records = bank.records as unknown as RegionalV7PuzzleRecord[];
export const REGIONAL_V7_PUZZLES: readonly RegionalV7Puzzle[] = records.map((record) => {
  validateRegionalV7Record(record);
  return { record, level: levelFromRegionalV7Record(record) };
});
if (new Set(REGIONAL_V7_PUZZLES.map((item) => item.record.puzzleId)).size !== REGIONAL_V7_PUZZLES.length ||
  REGIONAL_V7_TIERS.some((tier) => REGIONAL_V7_PUZZLES.filter((item) => item.record.tier === tier).length !== 5)) {
  throw new Error('Incomplete regional V7 puzzle bank');
}

export function getRegionalV7Puzzle(regionId: string, tier: RegionalTier, stageIndex: number): RegionalV7Puzzle | undefined {
  return REGIONAL_V7_PUZZLES.find((item) => item.record.regionId === regionId && item.record.tier === tier && item.record.stageIndex === stageIndex);
}
