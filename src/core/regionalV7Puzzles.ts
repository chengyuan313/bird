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

// Exact retired D1/D2 certificate IDs. Carry their completed-stage credit to
// the corresponding dense replacement without deleting the historical record.
const RETIRED_TUTORIAL_PUZZLES: readonly [string, RegionalTier, number][] = [
  ['regional-v7:1e1d00a5d3ca2faa387c26fe6f58da55dbb62396d9dd6ad6c602e399cafe86d7', 1, 1],
  ['regional-v7:17c4e99d9c173dc1163d02608a6a84bd10e068c10bafd5e1ba646c39810415b7', 1, 2],
  ['regional-v7:809a307821dca33dba1ede9c6840b574e18f251f96697c5af47eeb404fce10e9', 1, 3],
  ['regional-v7:6b2efd6d60b9bde2c275cce5f7c14aa77351593ea366414f8650d998a429cc03', 1, 4],
  ['regional-v7:b356897579b12c319d316dc8be7c5bda1dc8b35f3826aac1257ae65a94da8f56', 1, 5],
  ['regional-v7:68155c4f0a511cc08f8a814a0fe18e1b717bed91e31de99c2fa4362bf6cffdbb', 2, 1],
  ['regional-v7:97970c98dbfe7671cc84737669f8bebb5fe947e92aae429b938049c1e92aec66', 2, 2],
  ['regional-v7:baa7ed31529a1ee9f8bc39bc3a12d0c0e730698e021dbcbbfd307b146c871d3f', 2, 3],
  ['regional-v7:0c868eb595295d8d40ec0a2f2dcedf8fa79bfc6bb11f25011fcf82d11e39455a', 2, 4],
  ['regional-v7:ac03bfe7adafc2e2b14969a1cc13e2cda3a3a58bc53820d1f088063997e7dcc1', 2, 5],
];

export function carryForwardRegionalV7Completions(ids: readonly string[]): string[] {
  const completed = new Set(ids);
  for (const [retiredId, tier, stageIndex] of RETIRED_TUTORIAL_PUZZLES) {
    if (!completed.has(retiredId)) continue;
    const replacement = getRegionalV7Puzzle('CN-SC', tier, stageIndex);
    if (!replacement) throw new Error(`Missing replacement for retired D${tier}-${stageIndex}`);
    completed.add(replacement.record.puzzleId);
  }
  return [...completed];
}
