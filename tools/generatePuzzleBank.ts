import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { characterOverlap } from '../src/core/contentSampler';
import {
  composeBird, createGameFromLevel, findPlayableBirds, isBoardTileExposed,
  selectBoardTile, TRAY_SIZE,
} from '../src/core/gameEngine';
import { createPlayableLevel3, generatePiachanLevel3, PLAYABLE_LEVEL_3_SEEDS } from '../src/core/level3Playable';
import {
  boardHash, certificateHash, GENERATION_VOCABULARY_VERSION, GENERATOR_VERSION, GEOMETRY_VERSION,
  LEGACY_GENERATOR_VERSION, PUZZLE_BANK_SCHEMA_VERSION, puzzleId,
} from '../src/core/puzzleIdentity';
import { GLOBAL_BIRD_COMPOSITIONS, RECOGNITION_REGISTRY_VERSION } from '../src/core/recognitionRegistry';
import { PIACHAN_POSITIONS } from '../src/preview/piachanLayout';
import type { CertifiedPuzzleRecord, PuzzleDiagnostics } from '../src/core/puzzleBank';
import type { GameState, LevelDefinition, WinningAction } from '../src/core/types';

const OUTPUT = fileURLToPath(new URL('../src/core/puzzleBank.json', import.meta.url));
const TOTAL_BUDGET_MS = 90_000;
const CANDIDATE_BUDGET_MS = 1_000;
const MAX_ATTEMPTS = 205;
const NEW_PUZZLE_TARGET = 100;

function characterCounts(values: readonly string[]): string {
  return [...values].sort().join('');
}

function traceFor(actions: readonly WinningAction[]): string {
  const indexById = new Map(PIACHAN_POSITIONS.map((tile, index) => [tile.id, index]));
  return actions.map((action) => {
    if (action.type === 'take') {
      const index = indexById.get(action.tileId);
      if (index === undefined) throw new Error(`Unknown trace tile ${action.tileId}`);
      return `t${index.toString(36)}`;
    }
    if (!/^bird:[a-z0-9]+$/.test(action.birdId)) throw new Error(`Unsupported trace bird ${action.birdId}`);
    return `c${action.birdId.slice(5)}`;
  }).join(' ');
}

function certify(level: LevelDefinition): Omit<PuzzleDiagnostics, 'uniqueBoardAssignmentsAtAcceptance'> {
  if (level.tiles.length !== 90 || level.tiles.length !== PIACHAN_POSITIONS.length) throw new Error('Wrong tile count');
  if (level.tiles.some((tile, index) => tile.id !== PIACHAN_POSITIONS[index].id
    || tile.x !== PIACHAN_POSITIONS[index].x || tile.y !== PIACHAN_POSITIONS[index].y
    || tile.layer !== PIACHAN_POSITIONS[index].layer
    || JSON.stringify(tile.blockedBy) !== JSON.stringify(PIACHAN_POSITIONS[index].blockedBy))) {
    throw new Error('Piachan geometry changed');
  }
  const birdById = new Map(GLOBAL_BIRD_COMPOSITIONS.map((bird) => [bird.id, bird]));
  const sampledBirdIds = level.winningSolution.filter((action) => action.type === 'compose').map((action) => action.birdId);
  const sampledBirds = sampledBirdIds.map((id) => BIRD_CATALOG.find((bird) => bird.id === id));
  if (sampledBirds.some((bird) => !bird)) throw new Error('Witness contains non-canonical generation bird');
  if (characterCounts(level.tiles.map((tile) => tile.character))
    !== characterCounts(sampledBirds.flatMap((bird) => bird!.characters))) throw new Error('Character multiset differs');

  let state = createGameFromLevel(level);
  const initialExposedTiles = state.boardTiles.filter((tile) => isBoardTileExposed(state, tile.id)).length;
  const checkpointFormableCompositions = [findPlayableBirds(state).length];
  const selected = new Set<string>();
  let taken = 0;
  let maximumTrayOccupancy = 0;
  let occupancyTotal = 0;
  for (const action of level.winningSolution) {
    const before = state;
    let next: GameState;
    if (action.type === 'take') {
      if (selected.has(action.tileId) || !isBoardTileExposed(before, action.tileId)) {
        throw new Error(`Illegal or repeated tile selection: ${action.tileId}`);
      }
      selected.add(action.tileId);
      next = selectBoardTile(before, action.tileId);
      taken += 1;
    } else {
      const bird = birdById.get(action.birdId);
      if (!bird || !findPlayableBirds(before).some((option) => option.id === bird.id)) {
        throw new Error(`Unrecognized or unavailable composition: ${action.birdId}`);
      }
      next = composeBird(before, action.birdId);
      const removed = before.tray.flatMap((tile) => tile && !next.tray.some((remaining) => remaining?.id === tile.id)
        ? [tile.character] : []);
      if (characterCounts(removed) !== characterCounts(bird.characters)
        || next.score !== before.score + bird.score
        || next.completedBirdCount !== before.completedBirdCount + 1) throw new Error('Invalid character consumption or score');
      const discovered = bird.speciesId !== null && !before.discoveredBirdIds.includes(bird.speciesId);
      if (next.lastCompletedBird?.isNew !== discovered
        || (bird.classification === 'group' && next.discoveredBirdIds.length !== before.discoveredBirdIds.length)
        || (discovered && !next.discoveredBirdIds.includes(bird.speciesId!))) {
        throw new Error('Invalid biological discovery');
      }
    }
    if (next === before) throw new Error('Engine rejected certificate action');
    const occupied = next.tray.filter(Boolean).length;
    if (occupied > TRAY_SIZE || occupied < 0) throw new Error('Tray capacity violated');
    maximumTrayOccupancy = Math.max(maximumTrayOccupancy, occupied);
    occupancyTotal += occupied;
    state = next;
    if (action.type === 'take' && [30, 60, 90].includes(taken)) {
      checkpointFormableCompositions.push(findPlayableBirds(state).length);
    }
  }
  if (selected.size !== 90 || state.phase !== 'level_complete'
    || state.boardTiles.some((tile) => !tile.removed) || state.tray.some(Boolean)) {
    throw new Error('Certificate does not finish with an empty board and tray');
  }
  const distinct = [...new Map(sampledBirds.map((bird) => [bird!.id, bird!])).values()];
  let overlappingSpeciesPairs = 0;
  for (let first = 0; first < distinct.length; first += 1) {
    for (let second = first + 1; second < distinct.length; second += 1) {
      if (characterOverlap(distinct[first], distinct[second]) > 0) overlappingSpeciesPairs += 1;
    }
  }
  return {
    initialExposedTiles,
    distinctSampledSpecies: distinct.length,
    overlappingSpeciesPairs,
    overlapPairDensity: overlappingSpeciesPairs / (distinct.length * (distinct.length - 1) / 2),
    maximumTrayOccupancy,
    averageTrayOccupancy: Number((occupancyTotal / level.winningSolution.length).toFixed(3)),
    checkpointFormableCompositions,
  };
}

function recordFor(level: LevelDefinition, seed: number, candidateIndex: number, legacy: boolean, uniqueBoardAssignmentsAtAcceptance: number): CertifiedPuzzleRecord {
  const diagnostics = { ...certify(level), uniqueBoardAssignmentsAtAcceptance };
  const inputs = {
    generatorVersion: legacy ? LEGACY_GENERATOR_VERSION : GENERATOR_VERSION,
    generationVocabularyVersion: GENERATION_VOCABULARY_VERSION,
    recognitionRulesVersion: RECOGNITION_REGISTRY_VERSION,
    geometryVersion: GEOMETRY_VERSION,
    seed, candidateIndex,
    boardHash: boardHash(level.tiles),
  };
  if (inputs.boardHash !== createHash('sha256').update(JSON.stringify([...level.tiles]
    .sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0)
    .map((tile) => [tile.id, tile.x, tile.y, tile.layer, [...tile.blockedBy].sort(), tile.character])), 'utf8').digest('hex')) {
    throw new Error('SHA-256 implementation mismatch with Node crypto');
  }
  const record: Omit<CertifiedPuzzleRecord, 'certificateHash'> = {
    puzzleId: puzzleId(inputs), ...inputs,
    characters: level.tiles.map((tile) => tile.character).join(''),
    sampledBirdIds: level.winningSolution.filter((action) => action.type === 'compose').map((action) => action.birdId),
    winningTrace: traceFor(level.winningSolution),
    witnessCertification: 'CONSTRUCTED_AND_REPLAY_VERIFIED',
    independentSearchStatus: 'NOT_RUN',
    diagnostics,
  };
  return { ...record, certificateHash: certificateHash(record) };
}

/** Deterministic sequential candidate scan with hard attempt/time ceilings. */
export function generatePuzzleBank(): void {
  const started = performance.now();
  const records: CertifiedPuzzleRecord[] = [];
  const seenIds = new Set<string>();
  const seenHashes = new Set<string>();
  const rejected: Record<string, number> = {};
  let attempted = 0;
  function accept(level: LevelDefinition, seed: number, candidateIndex: number, legacy: boolean): void {
    attempted += 1;
    const candidateStarted = performance.now();
    try {
      const record = recordFor(level, seed, candidateIndex, legacy, seenHashes.size + 1);
      if (performance.now() - candidateStarted > CANDIDATE_BUDGET_MS) throw new Error('candidate-time-budget');
      if (seenIds.has(record.puzzleId)) throw new Error('duplicate-puzzle-id');
      if (seenHashes.has(record.boardHash)) throw new Error('duplicate-board-hash');
      seenIds.add(record.puzzleId);
      seenHashes.add(record.boardHash);
      records.push(record);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      rejected[reason] = (rejected[reason] ?? 0) + 1;
      if (legacy) throw error;
    }
  }
  for (const seed of PLAYABLE_LEVEL_3_SEEDS) accept(createPlayableLevel3(seed), seed, 0, true);
  for (let candidate = 0; candidate < MAX_ATTEMPTS && records.length - 5 < NEW_PUZZLE_TARGET; candidate += 1) {
    if (performance.now() - started >= TOTAL_BUDGET_MS) {
      rejected['total-time-budget'] = (rejected['total-time-budget'] ?? 0) + 1;
      break;
    }
    const seed = 6 + Math.floor(candidate / 2);
    const candidateIndex = candidate % 2;
    try {
      accept(generatePiachanLevel3(seed, candidateIndex), seed, candidateIndex, false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      rejected[reason] = (rejected[reason] ?? 0) + 1;
      attempted += 1;
    }
  }
  const artifact = JSON.stringify({ schemaVersion: PUZZLE_BANK_SCHEMA_VERSION, records }) + '\n';
  writeFileSync(OUTPUT, artifact, 'utf8');
  console.log(JSON.stringify({
    attempted, accepted: records.length, newlyGenerated: records.length - 5,
    rejected, uniqueBoardHashes: seenHashes.size, duplicateBoardCount: rejected['duplicate-board-hash'] ?? 0,
    wallTimeMs: Math.round(performance.now() - started), bankBytes: Buffer.byteLength(artifact),
    versions: { generator: GENERATOR_VERSION, vocabulary: GENERATION_VOCABULARY_VERSION,
      recognition: RECOGNITION_REGISTRY_VERSION, geometry: GEOMETRY_VERSION },
  }));
  if (records.length - 5 < NEW_PUZZLE_TARGET) throw new Error('Target of 100 new certified puzzles not reached within budget');
}
