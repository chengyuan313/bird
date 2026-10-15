import rawBank from './puzzleBank.json';
import { BIRD_CATALOG } from './birdCatalog';
import { BEGINNER_LEVEL_3_CATALOG } from './contentSampler';
import {
  boardHash, certificateHash, GENERATION_VOCABULARY_VERSION, GENERATOR_VERSION, GEOMETRY_VERSION,
  LEGACY_GENERATOR_VERSION, PUZZLE_BANK_SCHEMA_VERSION, puzzleId,
} from './puzzleIdentity';
import { GLOBAL_BIRD_COMPOSITIONS, RECOGNITION_REGISTRY_VERSION } from './recognitionRegistry';
import { PIACHAN_POSITIONS } from '../preview/piachanLayout';
import type { BirdDefinition, BoardTileDefinition, LevelDefinition, WinningAction } from './types';

export type WitnessCertification = 'CONSTRUCTED_AND_REPLAY_VERIFIED' | 'INDEPENDENTLY_SEARCH_DISCOVERED_AND_REPLAY_VERIFIED';
export type IndependentSearchStatus = 'SOLVED' | 'PROVEN_UNSOLVABLE' | 'UNKNOWN' | 'NOT_RUN';

export interface PuzzleDiagnostics {
  initialExposedTiles: number;
  distinctSampledSpecies: number;
  overlappingSpeciesPairs: number;
  overlapPairDensity: number;
  maximumTrayOccupancy: number;
  averageTrayOccupancy: number;
  checkpointFormableCompositions: readonly number[];
  uniqueBoardAssignmentsAtAcceptance: number;
}

export interface CertifiedPuzzleRecord {
  puzzleId: string;
  generatorVersion: string;
  generationVocabularyVersion: string;
  recognitionRulesVersion: string;
  geometryVersion: string;
  seed: number;
  candidateIndex: number;
  boardHash: string;
  certificateHash: string;
  /** One Unicode code point per Piachan position, in PIACHAN_POSITIONS order. */
  characters: string;
  /** Canonical IDs with occurrence multiplicity, in the constructed witness order. */
  sampledBirdIds: readonly string[];
  /** t + base-36 position index; c + canonical asset key. */
  winningTrace: string;
  witnessCertification: WitnessCertification;
  independentSearchStatus: IndependentSearchStatus;
  diagnostics: PuzzleDiagnostics;
}

export interface CertifiedPuzzleBank {
  schemaVersion: string;
  records: readonly CertifiedPuzzleRecord[];
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function charactersFor(record: CertifiedPuzzleRecord): readonly string[] {
  return Array.from(record.characters);
}

function tilesFor(record: CertifiedPuzzleRecord): readonly BoardTileDefinition[] {
  const characters = charactersFor(record);
  return PIACHAN_POSITIONS.map((tile, index) => ({
    id: tile.id, x: tile.x, y: tile.y, layer: tile.layer,
    blockedBy: tile.blockedBy, character: characters[index],
  }));
}

export function decodeWinningTrace(trace: string): readonly WinningAction[] {
  if (!trace || trace.trim() !== trace) throw new Error('Invalid winning trace');
  return trace.split(' ').map((token): WinningAction => {
    if (/^t[0-9a-z]+$/.test(token)) {
      const tile = PIACHAN_POSITIONS[Number.parseInt(token.slice(1), 36)];
      if (!tile) throw new Error(`Invalid winning tile token: ${token}`);
      return { type: 'take', tileId: tile.id };
    }
    if (/^c[a-z0-9]+$/.test(token)) return { type: 'compose', birdId: `bird:${token.slice(1)}` };
    throw new Error(`Invalid winning action token: ${token}`);
  });
}

export function encodeWinningTrace(actions: readonly WinningAction[]): string {
  const indexByTile = new Map(PIACHAN_POSITIONS.map((tile, index) => [tile.id, index]));
  return actions.map((action) => {
    if (action.type === 'take') {
      const index = indexByTile.get(action.tileId);
      if (index === undefined) throw new Error(`Unknown winning tile: ${action.tileId}`);
      return `t${index.toString(36)}`;
    }
    if (!/^bird:[a-z0-9]+$/.test(action.birdId)) throw new Error(`Unsupported witness composition: ${action.birdId}`);
    return `c${action.birdId.slice(5)}`;
  }).join(' ');
}

function sortedCharacters(characters: readonly string[]): string {
  return [...characters].sort().join('');
}

function validateRecord(value: unknown): CertifiedPuzzleRecord {
  if (!object(value)) throw new Error('Invalid puzzle record');
  const record = value as unknown as CertifiedPuzzleRecord;
  if (!Number.isSafeInteger(record.seed) || record.seed < 1 || !Number.isSafeInteger(record.candidateIndex) || record.candidateIndex < 0) {
    throw new Error('Invalid puzzle seed or candidate index');
  }
  if (record.generatorVersion !== LEGACY_GENERATOR_VERSION && record.generatorVersion !== GENERATOR_VERSION) {
    throw new Error('Unsupported generator version');
  }
  if (record.generatorVersion === LEGACY_GENERATOR_VERSION && (record.seed > 5 || record.candidateIndex !== 0)) {
    throw new Error('Invalid legacy puzzle identity');
  }
  if (record.generatorVersion === GENERATOR_VERSION && record.seed <= 5) throw new Error('Legacy seed reinterpreted');
  if (record.generationVocabularyVersion !== GENERATION_VOCABULARY_VERSION
    || record.recognitionRulesVersion !== RECOGNITION_REGISTRY_VERSION
    || record.geometryVersion !== GEOMETRY_VERSION) throw new Error('Unsupported puzzle input version');
  if (typeof record.characters !== 'string' || charactersFor(record).length !== PIACHAN_POSITIONS.length) {
    throw new Error('Puzzle must contain exactly 90 character tiles');
  }
  const knownBirds = new Map<string, BirdDefinition>(BEGINNER_LEVEL_3_CATALOG.map((bird) => [bird.id, bird]));
  if (!Array.isArray(record.sampledBirdIds) || record.sampledBirdIds.length === 0
    || record.sampledBirdIds.some((id) => typeof id !== 'string' || !knownBirds.has(id))) {
    throw new Error('Invalid sampled bird IDs');
  }
  const sampledCharacters = record.sampledBirdIds.flatMap((id) => knownBirds.get(id)!.characters);
  if (sortedCharacters(charactersFor(record)) !== sortedCharacters(sampledCharacters)) {
    throw new Error('Puzzle character multiset does not match sampled birds');
  }
  const computedBoardHash = boardHash(tilesFor(record));
  if (record.boardHash !== computedBoardHash) throw new Error('Corrupted puzzle board hash');
  if (record.puzzleId !== puzzleId(record)) throw new Error('Corrupted puzzle identity');
  if (record.witnessCertification !== 'CONSTRUCTED_AND_REPLAY_VERIFIED'
    && record.witnessCertification !== 'INDEPENDENTLY_SEARCH_DISCOVERED_AND_REPLAY_VERIFIED') {
    throw new Error('Uncertified puzzle record');
  }
  if (!['SOLVED', 'PROVEN_UNSOLVABLE', 'UNKNOWN', 'NOT_RUN'].includes(record.independentSearchStatus)) {
    throw new Error('Unsupported independent search status');
  }
  if (record.independentSearchStatus === 'PROVEN_UNSOLVABLE'
    || (record.witnessCertification === 'INDEPENDENTLY_SEARCH_DISCOVERED_AND_REPLAY_VERIFIED'
      && record.independentSearchStatus !== 'SOLVED')) {
    throw new Error('Contradictory solver and replay evidence');
  }
  if (typeof record.winningTrace !== 'string') throw new Error('Missing winning trace');
  const actions = decodeWinningTrace(record.winningTrace);
  const takes = actions.filter((action) => action.type === 'take').map((action) => action.tileId);
  const compositions = actions.filter((action) => action.type === 'compose').map((action) => action.birdId);
  const knownCompositions = new Set(GLOBAL_BIRD_COMPOSITIONS.map((bird) => bird.id));
  if (takes.length !== PIACHAN_POSITIONS.length || new Set(takes).size !== PIACHAN_POSITIONS.length
    || compositions.length !== record.sampledBirdIds.length
    || compositions.some((id, index) => id !== record.sampledBirdIds[index])
    || compositions.some((id) => !knownCompositions.has(id))) throw new Error('Invalid winning trace structure');
  if (!object(record.diagnostics)
    || !Number.isFinite(record.diagnostics.initialExposedTiles)
    || !Number.isFinite(record.diagnostics.distinctSampledSpecies)
    || !Number.isFinite(record.diagnostics.overlappingSpeciesPairs)
    || !Number.isFinite(record.diagnostics.overlapPairDensity)
    || !Number.isFinite(record.diagnostics.maximumTrayOccupancy)
    || !Number.isFinite(record.diagnostics.averageTrayOccupancy)
    || !Array.isArray(record.diagnostics.checkpointFormableCompositions)
    || record.diagnostics.checkpointFormableCompositions.length !== 4
    || record.diagnostics.checkpointFormableCompositions.some((count) => !Number.isInteger(count) || count < 0)
    || !Number.isSafeInteger(record.diagnostics.uniqueBoardAssignmentsAtAcceptance)
    || record.diagnostics.uniqueBoardAssignmentsAtAcceptance < 1) {
    throw new Error('Invalid puzzle diagnostics');
  }
  if (record.certificateHash !== certificateHash(record)) throw new Error('Corrupted puzzle certificate');
  return record;
}

/** Runtime structural and SHA-256 integrity gate; full engine replay is the offline publication gate. */
export function validatePuzzleBank(value: unknown): CertifiedPuzzleBank {
  if (!object(value) || value.schemaVersion !== PUZZLE_BANK_SCHEMA_VERSION || !Array.isArray(value.records)) {
    throw new Error('Unsupported puzzle-bank schema');
  }
  const records = value.records.map(validateRecord);
  const ids = new Set(records.map((record) => record.puzzleId));
  const hashes = new Set(records.map((record) => record.boardHash));
  if (ids.size !== records.length) throw new Error('Duplicate puzzle ID');
  if (hashes.size !== records.length) throw new Error('Duplicate puzzle board hash');
  records.forEach((record, index) => {
    if (record.diagnostics.uniqueBoardAssignmentsAtAcceptance !== index + 1) {
      throw new Error('Invalid cumulative board-assignment count');
    }
  });
  for (const seed of [1, 2, 3, 4, 5]) {
    if (records.filter((record) => record.seed === seed && record.generatorVersion === LEGACY_GENERATOR_VERSION).length !== 1) {
      throw new Error(`Missing or duplicated legacy seed ${seed}`);
    }
  }
  return { schemaVersion: PUZZLE_BANK_SCHEMA_VERSION, records };
}

const loadingStarted = performance.now();
export const CERTIFIED_PUZZLE_BANK = validatePuzzleBank(rawBank);
export const PUZZLE_BANK_LOAD_DURATION_MS = performance.now() - loadingStarted;

const byId = new Map(CERTIFIED_PUZZLE_BANK.records.map((record) => [record.puzzleId, record]));

export function getCertifiedPuzzle(puzzleId: string): CertifiedPuzzleRecord {
  const record = byId.get(puzzleId);
  if (!record) throw new Error(`Unknown certified puzzle ID: ${puzzleId}`);
  return record;
}

export function getLegacyPuzzle(seed: number): CertifiedPuzzleRecord {
  const record = CERTIFIED_PUZZLE_BANK.records.find((candidate) => candidate.seed === seed
    && candidate.generatorVersion === LEGACY_GENERATOR_VERSION);
  if (!record) throw new Error(`Unverified Level 3 seed: ${seed}`);
  return record;
}

export function nextCertifiedPuzzleId(currentId: string | undefined): string {
  const records = CERTIFIED_PUZZLE_BANK.records;
  if (records.length < 2) throw new Error('Puzzle bank needs at least two certified boards');
  const index = records.findIndex((record) => record.puzzleId === currentId);
  if (currentId !== undefined && index < 0) throw new Error(`Unknown certified puzzle ID: ${currentId}`);
  return records[(index + 1) % records.length].puzzleId;
}

export function levelFromCertifiedPuzzle(record: CertifiedPuzzleRecord): LevelDefinition {
  const byBirdId = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  const catalog = [...new Set(record.sampledBirdIds)].map((id) => byBirdId.get(id)!);
  return {
    id: 'level-3', label: '第三关', seed: record.seed, puzzleId: record.puzzleId,
    catalog, tiles: tilesFor(record), winningSolution: decodeWinningTrace(record.winningTrace),
    wordOccurrences: record.sampledBirdIds,
  };
}
