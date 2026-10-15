import { writeFileSync } from 'node:fs';
import { REGIONAL_V7_TIERS } from '../src/core/regionalV7Data';
import { generateRegionalV7Puzzle, REGIONAL_V7_PUZZLES_PER_TIER, validateRegionalV7Record } from '../src/core/regionalV7Generator';

const records = REGIONAL_V7_TIERS.flatMap((tier) =>
  Array.from({ length: REGIONAL_V7_PUZZLES_PER_TIER }, (_, index) => generateRegionalV7Puzzle('CN-SC', tier, index + 1)));
for (const record of records) validateRegionalV7Record(record);
const ids = new Set(records.map((record) => record.puzzleId));
const hashes = new Set(records.map((record) => record.boardHash));
if (ids.size !== records.length || hashes.size !== records.length) throw new Error('Duplicate V7 puzzle or board');
for (const tier of REGIONAL_V7_TIERS) {
  const covered = new Set(records.filter((record) => record.tier === tier).flatMap((record) => record.wordOccurrences));
  const introduced = records.find((record) => record.tier === tier)!.wordOccurrences;
  if (!introduced.length || records.filter((record) => record.tier === tier).length !== 5 || covered.size < 20) throw new Error(`Insufficient D${tier} coverage`);
}
writeFileSync('src/core/regionalV7Bank.json', `${JSON.stringify({ schemaVersion: 'regional-v7-bank-1', records }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ records: records.length, byTier: REGIONAL_V7_TIERS.map((tier) => ({ tier,
  records: records.filter((record) => record.tier === tier).length,
  baselines: records.filter((record) => record.tier === tier).map((record) => record.diagnostics.baseline) })) }));
