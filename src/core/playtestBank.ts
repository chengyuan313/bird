import rawBank from './playtestBank.json';
import { BIRD_CATALOG } from './birdCatalog';
import { boardHash } from './puzzleIdentity';
import { decodeWinningTrace } from './puzzleBank';
import { PIACHAN_POSITIONS } from '../preview/piachanLayout';
import { GLOBAL_BIRD_COMPOSITIONS } from './recognitionRegistry';
import type { LevelDefinition } from './types';

export type ExperimentGroup = 'A' | 'B' | 'C';
export type PlaytestPuzzle = (typeof rawBank.records)[number];
export const PLAYTEST_BANK_VERSION = 'playtest-bank-v1';
export const EXPERIMENT_GROUPS = ['A', 'B', 'C'] as const;

function levelFor(record: PlaytestPuzzle): LevelDefinition {
  const characters = Array.from(record.characters);
  const byId = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  return {
    id: 'level-3-experiment', label: `实验 ${record.group}`, seed: record.seed, puzzleId: record.id,
    experimentGroup: record.group as ExperimentGroup,
    catalog: [...new Set(record.sampledBirdIds)].map((id) => {
      const bird = byId.get(id);
      if (!bird) throw new Error(`Unknown experiment bird ${id}`);
      return bird;
    }),
    tiles: PIACHAN_POSITIONS.map((tile, index) => ({ ...tile, character: characters[index] })),
    winningSolution: decodeWinningTrace(record.winningTrace),
    wordOccurrences: record.sampledBirdIds,
  };
}

function validateBank(): void {
  if (rawBank.schemaVersion !== PLAYTEST_BANK_VERSION || rawBank.generatorVersion !== 'experimental-difficulty-v1') {
    throw new Error('Unsupported playtest bank version');
  }
  const ids = new Set<string>();
  const hashes = new Set<string>();
  for (const record of rawBank.records) {
    if (!EXPERIMENT_GROUPS.includes(record.group as ExperimentGroup)
      || ![31, 37, 43, 47, 53].includes(record.seed)
      || record.profileId !== 'standard' || record.spatialOrder !== 'seeded-random'
      || record.placement !== ({ A: 'consecutive', B: 'paired', C: 'multi-name' } as const)[record.group as ExperimentGroup]
      || Array.from(record.characters).length !== 90) throw new Error('Invalid playtest generation inputs');
    const level = levelFor(record);
    const traceWords = level.winningSolution.filter((action) => action.type === 'compose').map((action) => action.birdId);
    const known = new Map(GLOBAL_BIRD_COMPOSITIONS.map((bird) => [bird.id, bird]));
    if (traceWords.length !== record.sampledBirdIds.length
      || traceWords.some((id, index) => id !== record.sampledBirdIds[index])
      || record.sampledBirdIds.some((id) => !known.has(id))
      || record.sampledBirdIds.flatMap((id) => known.get(id)!.characters).sort().join('') !== Array.from(record.characters).sort().join('')) {
      throw new Error(`Invalid experimental word occurrences: ${record.id}`);
    }
    if (boardHash(level.tiles) !== record.boardHash
      || record.id !== `experiment:experimental-difficulty-v1:${record.profileId}:${record.placement}:${record.spatialOrder}:${record.seed}:${record.boardHash}`) {
      throw new Error('Corrupted experimental puzzle identity');
    }
    if (ids.has(record.id) || hashes.has(record.boardHash)) throw new Error('Duplicate experimental puzzle');
    ids.add(record.id);
    hashes.add(record.boardHash);
  }
  for (const group of EXPERIMENT_GROUPS) {
    if (rawBank.records.filter((record) => record.group === group).length !== 5) throw new Error(`Unbalanced experiment ${group}`);
  }
}

validateBank();
export const PLAYTEST_PUZZLES: readonly PlaytestPuzzle[] = rawBank.records;

export function getPlaytestPuzzle(id: string): PlaytestPuzzle {
  const record = PLAYTEST_PUZZLES.find((item) => item.id === id);
  if (!record) throw new Error(`Unknown playtest puzzle ${id}`);
  return record;
}

export function playtestPuzzlesInGroup(group: ExperimentGroup): readonly PlaytestPuzzle[] {
  return PLAYTEST_PUZZLES.filter((item) => item.group === group);
}

export function nextPlaytestPuzzle(group: ExperimentGroup, currentId?: string): PlaytestPuzzle {
  const records = playtestPuzzlesInGroup(group);
  const index = records.findIndex((record) => record.id === currentId);
  return records[(index + 1) % records.length];
}

export function levelFromPlaytestPuzzle(id: string): LevelDefinition {
  return levelFor(getPlaytestPuzzle(id));
}
