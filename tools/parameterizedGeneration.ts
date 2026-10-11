import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  BEGINNER_DISCOVERY_BIRD_IDS, BEGINNER_FAMILIAR_BIRD_IDS,
  sampleBirdContent,
} from '../src/core/contentSampler';
import { composeBird, createGameFromLevel, selectBoardTile } from '../src/core/gameEngine';
import { createSeededRandom, fisherYates } from '../src/core/level3Generator';
import { removalOrder } from '../src/core/level3Playable';
import { boardHash } from '../src/core/puzzleIdentity';
import type { BirdDefinition, LevelDefinition, WinningAction } from '../src/core/types';
import { PIACHAN_POSITIONS, piachanPositionsOverlap } from '../src/preview/piachanLayout';

export const DIFFICULTY_PROFILE_VERSION = 'experimental-difficulty-v1';
export type PlacementMode = 'consecutive' | 'paired' | 'multi-name';
export type SpatialOrder = 'seeded-random' | 'unlock-max' | 'unlock-min';

/** Only fields with an actual generation mechanism are configurable. Spatial facts stay fixed. */
export interface DifficultyProfile {
  version: typeof DIFFICULTY_PROFILE_VERSION;
  id: 'beginner' | 'standard' | 'expert';
  geometryId: 'piachan-90-v1';
  familiarPoolSize: number;
  discoveryPoolSize: number;
  allowedNameLengths: readonly number[];
  minDistinctSpecies: number;
  maxDistinctSpecies: number;
  maxSpeciesOccurrences: number;
  minOverlappingSpeciesPairs: number;
  maxOverlapPairDensity: number;
  spatialOrder: SpatialOrder;
  placement: PlacementMode;
  maxContentAttempts: number;
}

export const DIFFICULTY_PROFILES: readonly DifficultyProfile[] = [
  {
    version: DIFFICULTY_PROFILE_VERSION, id: 'beginner', geometryId: 'piachan-90-v1',
    familiarPoolSize: 28, discoveryPoolSize: 0, allowedNameLengths: [2, 3],
    minDistinctSpecies: 18, maxDistinctSpecies: 22, maxSpeciesOccurrences: 2,
    minOverlappingSpeciesPairs: 2, maxOverlapPairDensity: 0.3,
    spatialOrder: 'unlock-max', placement: 'consecutive', maxContentAttempts: 12,
  },
  {
    version: DIFFICULTY_PROFILE_VERSION, id: 'standard', geometryId: 'piachan-90-v1',
    familiarPoolSize: 24, discoveryPoolSize: 8, allowedNameLengths: [2, 3, 4],
    minDistinctSpecies: 18, maxDistinctSpecies: 22, maxSpeciesOccurrences: 3,
    minOverlappingSpeciesPairs: 6, maxOverlapPairDensity: 0.3,
    spatialOrder: 'seeded-random', placement: 'paired', maxContentAttempts: 12,
  },
  {
    version: DIFFICULTY_PROFILE_VERSION, id: 'expert', geometryId: 'piachan-90-v1',
    familiarPoolSize: 20, discoveryPoolSize: 8, allowedNameLengths: [3, 4],
    minDistinctSpecies: 12, maxDistinctSpecies: 15, maxSpeciesOccurrences: 3,
    minOverlappingSpeciesPairs: 8, maxOverlapPairDensity: 0.3,
    spatialOrder: 'unlock-min', placement: 'multi-name', maxContentAttempts: 12,
  },
];

export function validateDifficultyProfile(profile: DifficultyProfile): void {
  if (profile.version !== DIFFICULTY_PROFILE_VERSION || profile.geometryId !== 'piachan-90-v1') {
    throw new Error('Unsupported difficulty profile or geometry version');
  }
  if (!['beginner', 'standard', 'expert'].includes(profile.id)
    || !['seeded-random', 'unlock-max', 'unlock-min'].includes(profile.spatialOrder)
    || !['consecutive', 'paired', 'multi-name'].includes(profile.placement)) throw new Error('Invalid profile identity or placement');
  if (!Number.isInteger(profile.familiarPoolSize) || profile.familiarPoolSize < 0 || profile.familiarPoolSize > BEGINNER_FAMILIAR_BIRD_IDS.length
    || !Number.isInteger(profile.discoveryPoolSize) || profile.discoveryPoolSize < 0 || profile.discoveryPoolSize > BEGINNER_DISCOVERY_BIRD_IDS.length
    || profile.familiarPoolSize + profile.discoveryPoolSize < profile.minDistinctSpecies) throw new Error('Impossible vocabulary pool');
  if (profile.allowedNameLengths.length === 0 || profile.allowedNameLengths.some((length) => ![2, 3, 4].includes(length))) {
    throw new Error('Unsupported bird-name length');
  }
  if (![profile.minDistinctSpecies, profile.maxDistinctSpecies, profile.maxSpeciesOccurrences,
    profile.minOverlappingSpeciesPairs, profile.maxContentAttempts].every(Number.isSafeInteger)
    || profile.minDistinctSpecies < 1 || profile.maxDistinctSpecies < profile.minDistinctSpecies
    || profile.maxSpeciesOccurrences < 1 || profile.minOverlappingSpeciesPairs < 0
    || profile.maxContentAttempts < 1 || profile.maxContentAttempts > 64
    || profile.maxOverlapPairDensity < 0 || profile.maxOverlapPairDensity > 1) throw new Error('Invalid profile bounds');
  const possiblePairs = profile.maxDistinctSpecies * (profile.maxDistinctSpecies - 1) / 2;
  if (profile.minOverlappingSpeciesPairs > possiblePairs * profile.maxOverlapPairDensity) {
    throw new Error('Impossible shared-character overlap targets');
  }
}

export function profileCatalog(profile: DifficultyProfile): readonly BirdDefinition[] {
  validateDifficultyProfile(profile);
  const ids = new Set<string>([
    ...BEGINNER_FAMILIAR_BIRD_IDS.slice(0, profile.familiarPoolSize),
    ...BEGINNER_DISCOVERY_BIRD_IDS.slice(0, profile.discoveryPoolSize),
  ]);
  const catalog = BIRD_CATALOG.filter((bird) => ids.has(bird.id) && profile.allowedNameLengths.includes(bird.characterCount));
  if (catalog.length < profile.minDistinctSpecies) throw new Error(`Impossible name-length and diversity targets for ${profile.id}: ${catalog.length} eligible`);
  const maximumCharacters = [...catalog].sort((a, b) => b.characterCount - a.characterCount)
    .slice(0, profile.maxDistinctSpecies)
    .reduce((sum, bird) => sum + bird.characterCount * profile.maxSpeciesOccurrences, 0);
  if (maximumCharacters < 90) throw new Error('Impossible 90-tile character budget');
  return catalog;
}

/** Piachan's exact geometry, not a tunable difficulty control. */
export function validateFixedGeometry(): { tileCount: number; layers: number; initiallyExposed: number; blockingEdges: number; blockingEdgeDensity: number; widthPx: number; heightPx: number } {
  const ids = new Set(PIACHAN_POSITIONS.map((tile) => tile.id));
  if (ids.size !== 90) throw new Error('Invalid Piachan position IDs');
  for (const [index, tile] of PIACHAN_POSITIONS.entries()) {
    if (PIACHAN_POSITIONS.slice(index + 1).some((other) => other.layer === tile.layer && piachanPositionsOverlap(tile, other))) {
      throw new Error(`Same-layer visual overlap at ${tile.id}`);
    }
    const expected = PIACHAN_POSITIONS.filter((candidate) => candidate.layer > tile.layer && piachanPositionsOverlap(tile, candidate)).map((candidate) => candidate.id);
    if (JSON.stringify(tile.blockedBy) !== JSON.stringify(expected)) throw new Error(`Invalid blockers for ${tile.id}`);
  }
  const blockingEdges = PIACHAN_POSITIONS.reduce((sum, tile) => sum + tile.blockedBy.length, 0);
  return {
    tileCount: PIACHAN_POSITIONS.length,
    layers: new Set(PIACHAN_POSITIONS.map((tile) => tile.layer)).size,
    initiallyExposed: PIACHAN_POSITIONS.filter((tile) => tile.blockedBy.length === 0).length,
    blockingEdges,
    blockingEdgeDensity: Number((blockingEdges / (90 * 89 / 2)).toFixed(4)),
    widthPx: Math.max(...PIACHAN_POSITIONS.map((tile) => tile.x * 22 + 44)),
    heightPx: Math.max(...PIACHAN_POSITIONS.map((tile) => tile.y * 22 + 44)),
  };
}

export interface ExperimentalCandidate {
  experimentId: string;
  boardHash: string;
  profileId: DifficultyProfile['id'];
  placement: PlacementMode;
  spatialOrder: SpatialOrder;
  contentAttempts: number;
  witnessConcurrentNames: number;
  sampledBirdIds: readonly string[];
  level: LevelDefinition;
}

export type CandidateResult = { ok: true; candidate: ExperimentalCandidate } | { ok: false; reason: string; contentAttempts: number };

function groupBirds(birds: readonly BirdDefinition[], mode: PlacementMode): readonly (readonly BirdDefinition[])[] {
  const limit = mode === 'consecutive' ? 1 : mode === 'paired' ? 2 : 3;
  const groups: BirdDefinition[][] = [];
  let current: BirdDefinition[] = [];
  let characters = 0;
  for (const bird of birds) {
    if (current.length >= limit || characters + bird.characterCount > 10) {
      groups.push(current);
      current = [];
      characters = 0;
    }
    current.push(bird);
    characters += bird.characterCount;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/** Change assignment order, never the Piachan positions or their blocking edges. */
export function experimentalRemovalOrder(seed: number, mode: SpatialOrder): readonly string[] {
  if (mode === 'seeded-random') return removalOrder(seed);
  const random = createSeededRandom(seed ^ 0x53504143);
  const removed = new Set<string>();
  const order: string[] = [];
  while (order.length < PIACHAN_POSITIONS.length) {
    const exposed = PIACHAN_POSITIONS.filter((tile) => !removed.has(tile.id)
      && tile.blockedBy.every((id) => removed.has(id)));
    if (exposed.length === 0) throw new Error('Piachan blocking cycle');
    const scored = exposed.map((tile) => ({ tile, newlyExposed: PIACHAN_POSITIONS.filter((below) =>
      !removed.has(below.id) && below.blockedBy.includes(tile.id)
      && below.blockedBy.every((id) => id === tile.id || removed.has(id))).length }));
    const target = mode === 'unlock-max'
      ? Math.max(...scored.map((item) => item.newlyExposed))
      : Math.min(...scored.map((item) => item.newlyExposed));
    const tied = scored.filter((item) => item.newlyExposed === target);
    const chosen = tied[Math.floor(random() * tied.length)].tile;
    removed.add(chosen.id);
    order.push(chosen.id);
  }
  return order;
}

export function generateExperimentalCandidate(
  profile: DifficultyProfile, seed: number, placement = profile.placement, spatialOrder = profile.spatialOrder,
): CandidateResult {
  if (!Number.isSafeInteger(seed) || seed < 1) throw new Error('Invalid experimental seed');
  if (!['consecutive', 'paired', 'multi-name'].includes(placement)) throw new Error('Invalid placement');
  if (!['seeded-random', 'unlock-max', 'unlock-min'].includes(spatialOrder)) throw new Error('Invalid spatial order');
  const catalog = profileCatalog(profile);
  const constraints = {
    tileCount: 90, minDistinctSpecies: profile.minDistinctSpecies, maxDistinctSpecies: profile.maxDistinctSpecies,
    maxSpeciesOccurrences: profile.maxSpeciesOccurrences, maxSpeciesPerFamily: 3,
    sharedCharacterTargets: {
      minimumOverlappingSpeciesPairs: profile.minOverlappingSpeciesPairs,
      maximumOverlapPairDensity: profile.maxOverlapPairDensity,
    },
  };
  for (let attempt = 0; attempt < profile.maxContentAttempts; attempt += 1) {
    const contentSeed = seed + attempt * 1009;
    const sampled = sampleBirdContent(contentSeed, constraints, catalog);
    if (!sampled.ok) continue;
    const byId = new Map(catalog.map((bird) => [bird.id, bird]));
    const birds = fisherYates(sampled.value.sampledBirdIds, createSeededRandom(contentSeed ^ 0x42495244))
      .map((id) => byId.get(id)!);
    const orderedIds = experimentalRemovalOrder(contentSeed, spatialOrder);
    const characters: string[] = [];
    const winningSolution: WinningAction[] = [];
    let offset = 0;
    let witnessConcurrentNames = 0;
    for (const group of groupBirds(birds, placement)) {
      witnessConcurrentNames = Math.max(witnessConcurrentNames, group.length);
      const sequence: string[] = [];
      for (let index = 0; index < 4; index += 1) {
        for (const bird of group) if (bird.characters[index]) sequence.push(bird.characters[index]);
      }
      characters.push(...sequence);
      winningSolution.push(...orderedIds.slice(offset, offset + sequence.length).map((tileId): WinningAction => ({ type: 'take', tileId })));
      winningSolution.push(...group.map((bird): WinningAction => ({ type: 'compose', birdId: bird.id })));
      offset += sequence.length;
    }
    if (characters.length !== 90 || offset !== 90) throw new Error('Experimental character count mismatch');
    const characterById = new Map(orderedIds.map((id, index) => [id, characters[index]]));
    const tiles = PIACHAN_POSITIONS.map((tile) => ({
      id: tile.id, x: tile.x, y: tile.y, layer: tile.layer, blockedBy: tile.blockedBy,
      character: characterById.get(tile.id)!,
    }));
    const hash = boardHash(tiles);
    const experimentId = `experiment:${DIFFICULTY_PROFILE_VERSION}:${profile.id}:${placement}:${spatialOrder}:${seed}:${hash}`;
    const level: LevelDefinition = {
      id: 'level-3-experiment', label: '离线实验', seed, puzzleId: experimentId,
      catalog: [...new Map(birds.map((bird) => [bird.id, bird])).values()],
      tiles, winningSolution,
    };
    let state = createGameFromLevel(level);
    for (const action of winningSolution) {
      const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
      if (next === state) throw new Error(`Invalid experimental witness for ${experimentId}`);
      state = next;
    }
    if (state.phase !== 'level_complete') throw new Error(`Incomplete experimental witness for ${experimentId}`);
    return { ok: true, candidate: { experimentId, boardHash: hash, profileId: profile.id,
      placement, spatialOrder, contentAttempts: attempt + 1, witnessConcurrentNames,
      sampledBirdIds: birds.map((bird) => bird.id), level } };
  }
  return { ok: false, reason: 'No content sample met profile constraints within the attempt budget', contentAttempts: profile.maxContentAttempts };
}
