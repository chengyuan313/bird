import { composeBird, createGameFromLevel, findPlayableBirds, getExposedBoardTiles, selectBoardTile } from './gameEngine';
import { createSeededRandom, fisherYates } from './level3Generator';
import { boardHash, sha256Hex } from './puzzleIdentity';
import { geometryForTier, REGIONAL_V7_GEOMETRY_VERSION, topologicalTakeOrder, validateRegionalGeometry } from './regionalV7Geometry';
import { REGIONAL_V7_CONTENT_VERSION, REGIONAL_V7_TILE_COUNTS, V7_DIFFICULTY_POOLS, V7_PLAYABLE_NAMES,
  V7_PROVINCIAL_MEMBERSHIPS, V7_REGIONAL_COMPOSITIONS, type RegionalTier } from './regionalV7Data';
import type { LevelDefinition, WinningAction } from './types';

export const REGIONAL_V7_GENERATOR_VERSION = 'regional-solution-first-v7.5.0';
export const REGIONAL_V7_PUZZLES_PER_TIER = 5;
export interface RegionalV7Diagnostics {
  initialExposed: number;
  uniqueWords: number;
  regionalFeatureWords: number;
  maximumWitnessTray: number;
  lengthDistribution: Readonly<Record<string, number>>;
  baseline: 'WIN' | 'LOSS' | 'UNKNOWN';
  baselineActions: number;
  randomLegalWins: number;
  randomLegalLosses: number;
  randomLegalUnknown: number;
}
export interface RegionalV7PuzzleRecord {
  puzzleId: string;
  regionId: string;
  tier: RegionalTier;
  stageIndex: number;
  seed: number;
  generatorVersion: string;
  contentVersion: string;
  geometryVersion: string;
  geometryId: string;
  boardHash: string;
  /** One Unicode character per geometry tile, in geometry order. */
  characters: string;
  wordOccurrences: readonly string[];
  /** Geometry indexes in certificate take order. */
  takeOrder: readonly number[];
  certificate: 'ENGINE_REPLAYED';
  independentSearchStatus: 'NOT_RUN';
  diagnostics: RegionalV7Diagnostics;
}

const playableById = new Map(V7_PLAYABLE_NAMES.map((bird) => [bird.id, bird]));
const featureIds = new Set(V7_PROVINCIAL_MEMBERSHIPS.filter((entry) => entry.regionalFeature).map((entry) => entry.speciesId));

function generateWords(regionId: string, tier: RegionalTier, stageIndex: number, seed: number): readonly string[] {
  const pool = V7_DIFFICULTY_POOLS.find((item) => item.regionId === regionId && item.tier === tier);
  if (!pool) throw new Error(`No V7 pool for ${regionId} D${tier}`);
  const tileCount = REGIONAL_V7_TILE_COUNTS[tier];
  const introduced = pool.newlyIntroducedSpeciesIds.slice((stageIndex - 1) * 4, stageIndex * 4);
  if (introduced.length !== 4) throw new Error('Missing four introduced words');
  const random = createSeededRandom(seed);
  const easy = V7_DIFFICULTY_POOLS[0].speciesIds.filter((id) => playableById.get(id)?.nameLength === 2);
  const opening = easy[Math.floor(random() * easy.length)];
  const required = [opening, ...introduced.filter((id) => id !== opening)];
  if (tier >= 3) {
    const signatures = fisherYates(pool.regionalFeatureSpeciesIds.filter((id) => !required.includes(id)), random).slice(0, 2);
    required.push(...signatures);
  }
  const requiredLength = required.reduce((sum, id) => sum + playableById.get(id)!.nameLength, 0);
  if (requiredLength > tileCount) throw new Error('Required V7 words exceed tile budget');

  // Bounded deterministic attempts, with an exact remainder check and at most two
  // occurrences of each word. No fallback puzzle or silent word substitution.
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = [...required];
    const counts = new Map<string, number>();
    for (const id of result) counts.set(id, (counts.get(id) ?? 0) + 1);
    let remaining = tileCount - requiredLength;
    const candidates = fisherYates(pool.speciesIds, createSeededRandom(seed ^ Math.imul(attempt + 1, 0x9e3779b1)));
    while (remaining > 0) {
      const option = candidates.find((id) => {
        const length = playableById.get(id)!.nameLength;
        return (counts.get(id) ?? 0) < 2 && length <= remaining && (remaining - length === 0 || remaining - length >= 2);
      });
      if (!option) break;
      result.push(option);
      counts.set(option, (counts.get(option) ?? 0) + 1);
      remaining -= playableById.get(option)!.nameLength;
      // Rotate the candidate order to prevent the same filler word dominating.
      candidates.push(candidates.shift()!);
    }
    if (remaining === 0 && new Set(result).size >= Math.min(7, result.length)) return result;
  }
  throw new Error(`Cannot fill ${regionId} D${tier} stage ${stageIndex} in 200 bounded attempts`);
}

export function levelFromRegionalV7Record(record: RegionalV7PuzzleRecord): LevelDefinition {
  const geometry = geometryForTier(record.tier);
  const characters = Array.from(record.characters);
  if (characters.length !== geometry.tiles.length || record.takeOrder.length !== geometry.tiles.length) throw new Error('V7 record tile count mismatch');
  const tiles = geometry.tiles.map((tile, index) => ({ ...tile, character: characters[index] }));
  const orderedIds = record.takeOrder.map((index) => geometry.tiles[index]?.id);
  if (orderedIds.some((id) => !id) || new Set(orderedIds).size !== orderedIds.length) throw new Error('Invalid V7 take order');
  const winningSolution: WinningAction[] = [];
  let offset = 0;
  for (const id of record.wordOccurrences) {
    const bird = playableById.get(id);
    if (!bird) throw new Error(`Unknown V7 word ${id}`);
    for (const tileId of orderedIds.slice(offset, offset + bird.nameLength)) winningSolution.push({ type: 'take', tileId });
    offset += bird.nameLength;
    winningSolution.push({ type: 'compose', birdId: id });
  }
  if (offset !== orderedIds.length) throw new Error('V7 trace length mismatch');
  const approved = new Set(record.wordOccurrences);
  return { id: `regional-v7-${record.regionId.toLowerCase()}-d${record.tier}-${record.stageIndex}`,
    label: `四川 · D${record.tier} · 第${record.stageIndex}局`, seed: record.seed, puzzleId: record.puzzleId,
    compositions: V7_REGIONAL_COMPOSITIONS.filter((item) => approved.has(item.id)),
    wordOccurrences: record.wordOccurrences, tiles, winningSolution };
}

function replay(level: LevelDefinition): number {
  let state = createGameFromLevel(level);
  let maximum = 0;
  for (const action of level.winningSolution) {
    const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    if (next === state) throw new Error(`Invalid V7 witness action ${JSON.stringify(action)}`);
    state = next;
    maximum = Math.max(maximum, state.tray.filter(Boolean).length);
  }
  if (state.phase !== 'level_complete') throw new Error(`V7 witness failed ${level.id}`);
  return maximum;
}

function baseline(level: LevelDefinition): { result: RegionalV7Diagnostics['baseline']; actions: number } {
  let state = createGameFromLevel(level);
  let actions = 0;
  while (state.phase === 'playing' && actions < 250) {
    const formable = findPlayableBirds(state).sort((a, b) => a.id.localeCompare(b.id));
    const next = formable.length ? composeBird(state, formable[0].id) :
      selectBoardTile(state, getExposedBoardTiles(state).sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? '');
    if (next === state) break;
    state = next;
    actions++;
  }
  return { result: state.phase === 'level_complete' ? 'WIN' : state.phase === 'game_over' ? 'LOSS' : 'UNKNOWN', actions };
}

function randomLegalTrials(level: LevelDefinition, seed: number): Pick<RegionalV7Diagnostics,
  'randomLegalWins' | 'randomLegalLosses' | 'randomLegalUnknown'> {
  let randomLegalWins = 0;
  let randomLegalLosses = 0;
  let randomLegalUnknown = 0;
  for (let trial = 0; trial < 10; trial++) {
    const random = createSeededRandom(seed ^ Math.imul(trial + 1, 0x45d9f3b));
    let state = createGameFromLevel(level);
    for (let action = 0; action < 250 && state.phase === 'playing'; action++) {
      const birds = findPlayableBirds(state);
      const tiles = getExposedBoardTiles(state);
      const choices = [...birds.map((bird) => ({ kind: 'compose' as const, id: bird.id })),
        ...(state.tray.some((slot) => slot === null) ? tiles.map((tile) => ({ kind: 'take' as const, id: tile.id })) : [])];
      if (!choices.length) break;
      const choice = choices[Math.floor(random() * choices.length)];
      state = choice.kind === 'compose' ? composeBird(state, choice.id) : selectBoardTile(state, choice.id);
    }
    if (state.phase === 'level_complete') randomLegalWins++;
    else if (state.phase === 'game_over') randomLegalLosses++;
    else randomLegalUnknown++;
  }
  return { randomLegalWins, randomLegalLosses, randomLegalUnknown };
}

export function generateRegionalV7Puzzle(regionId: string, tier: RegionalTier, stageIndex: number): RegionalV7PuzzleRecord {
  if (regionId !== 'CN-SC' || !Number.isSafeInteger(stageIndex) || stageIndex < 1 || stageIndex > REGIONAL_V7_PUZZLES_PER_TIER) throw new Error('Unsupported V7 generation request');
  const seed = 750000 + tier * 100 + stageIndex;
  const geometry = geometryForTier(tier);
  validateRegionalGeometry(geometry, REGIONAL_V7_TILE_COUNTS[tier]);
  const words = generateWords(regionId, tier, stageIndex, seed);
  const takeIds = topologicalTakeOrder(geometry, seed);
  const characterSequence = words.flatMap((id) => playableById.get(id)!.characters);
  if (characterSequence.length !== geometry.tiles.length) throw new Error('V7 word budget mismatch');
  const characterById = new Map(takeIds.map((id, index) => [id, characterSequence[index]]));
  const tiles = geometry.tiles.map((tile) => ({ ...tile, character: characterById.get(tile.id)! }));
  const hash = boardHash(tiles);
  const puzzleId = `regional-v7:${sha256Hex(JSON.stringify([regionId, tier, stageIndex, seed,
    REGIONAL_V7_GENERATOR_VERSION, REGIONAL_V7_CONTENT_VERSION, REGIONAL_V7_GEOMETRY_VERSION, geometry.id, hash, words]))}`;
  const provisional: RegionalV7PuzzleRecord = { puzzleId, regionId, tier, stageIndex, seed,
    generatorVersion: REGIONAL_V7_GENERATOR_VERSION, contentVersion: REGIONAL_V7_CONTENT_VERSION,
    geometryVersion: REGIONAL_V7_GEOMETRY_VERSION, geometryId: geometry.id, boardHash: hash,
    characters: tiles.map((tile) => tile.character).join(''), wordOccurrences: words,
    takeOrder: takeIds.map((id) => geometry.tiles.findIndex((tile) => tile.id === id)),
    certificate: 'ENGINE_REPLAYED', independentSearchStatus: 'NOT_RUN',
    diagnostics: { initialExposed: 0, uniqueWords: 0, regionalFeatureWords: 0, maximumWitnessTray: 0,
      lengthDistribution: {}, baseline: 'UNKNOWN', baselineActions: 0,
      randomLegalWins: 0, randomLegalLosses: 0, randomLegalUnknown: 0 } };
  const level = levelFromRegionalV7Record(provisional);
  const fresh = createGameFromLevel(level);
  const lengths: Record<string, number> = {};
  for (const id of words) { const length = playableById.get(id)!.nameLength; lengths[length] = (lengths[length] ?? 0) + 1; }
  const trial = baseline(level);
  const randomTrials = randomLegalTrials(level, seed);
  return { ...provisional, diagnostics: { initialExposed: getExposedBoardTiles(fresh).length,
    uniqueWords: new Set(words).size, regionalFeatureWords: new Set(words.filter((id) => featureIds.has(id))).size,
    maximumWitnessTray: replay(level), lengthDistribution: lengths, baseline: trial.result, baselineActions: trial.actions,
    ...randomTrials } };
}

export function validateRegionalV7Record(record: RegionalV7PuzzleRecord): void {
  if (record.generatorVersion !== REGIONAL_V7_GENERATOR_VERSION || record.contentVersion !== REGIONAL_V7_CONTENT_VERSION ||
    record.geometryVersion !== REGIONAL_V7_GEOMETRY_VERSION || record.certificate !== 'ENGINE_REPLAYED' ||
    record.independentSearchStatus !== 'NOT_RUN' || record.seed !== 750000 + record.tier * 100 + record.stageIndex) throw new Error('V7 record version mismatch');
  const pool = V7_DIFFICULTY_POOLS.find((item) => item.regionId === record.regionId && item.tier === record.tier);
  if (!pool || record.wordOccurrences.some((id) => !pool.speciesIds.includes(id))) throw new Error('Unapproved V7 word');
  const geometry = geometryForTier(record.tier);
  if (record.geometryId !== geometry.id) throw new Error('V7 geometry mismatch');
  const level = levelFromRegionalV7Record(record);
  if (boardHash(level.tiles) !== record.boardHash) throw new Error('V7 board hash mismatch');
  const expectedId = `regional-v7:${sha256Hex(JSON.stringify([record.regionId, record.tier, record.stageIndex, record.seed,
    record.generatorVersion, record.contentVersion, record.geometryVersion, record.geometryId, record.boardHash, record.wordOccurrences]))}`;
  if (record.puzzleId !== expectedId) throw new Error('V7 puzzle identity mismatch');
  const max = replay(level);
  if (max !== record.diagnostics.maximumWitnessTray || max > 10) throw new Error('V7 certificate diagnostic mismatch');
}
