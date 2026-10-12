import { BIRD_CATALOG } from './birdCatalog';
import { composeBird, createGameFromLevel, isBoardTileExposed, selectBoardTile } from './gameEngine';
import { getLevel } from './levels';
import { boardHash, sha256Hex } from './puzzleIdentity';
import { REGIONAL_CONTENT_VERSION, speciesForRegion } from './regionalData';
import { RECOGNITION_REGISTRY_VERSION } from './recognitionRegistry';
import type { LevelDefinition, WinningAction } from './types';

export const REGIONAL_GENERATOR_VERSION = 'authored-geometry-word-sequence-v6.0';

const stageWords: Readonly<Record<number, readonly string[]>> = {
  1: ['bird:bailu', 'bird:yelu', 'bird:chilu', 'bird:canglu', 'bird:daisheng', 'bird:hongsun', 'bird:wudong', 'bird:bailu', 'bird:yelu', 'bird:chilu', 'bird:canglu'],
  2: ['bird:huixique', 'bird:dabailu', 'bird:dashanque', 'bird:huixique', 'bird:dabailu', 'bird:dashanque', 'bird:huixique', 'bird:dabailu', 'bird:dashanque', 'bird:huixique', 'bird:dabailu'],
};

export interface RegionalPuzzle {
  regionId: string;
  stage: number;
  seed: number;
  boardHash: string;
  level: LevelDefinition;
  certificate: 'ENGINE_REPLAYED';
}

function makePuzzle(stage: number): RegionalPuzzle {
  const regionId = 'CN-BJ';
  const seed = 6000 + stage;
  const geometry = getLevel(stage === 1 ? 'level-1' : 'level-2');
  const words = stageWords[stage];
  const approved = new Set(speciesForRegion(regionId).map((item) => item.speciesId));
  if (words.some((id) => !approved.has(id))) throw new Error('Unapproved regional puzzle species');
  const characters = words.flatMap((id) => BIRD_CATALOG.find((bird) => bird.id === id)!.characters);
  const takeOrder = geometry.winningSolution.filter((action) => action.type === 'take').map((action) => action.tileId);
  if (characters.length !== geometry.tiles.length || takeOrder.length !== characters.length) throw new Error('Invalid regional word count');
  const assigned = new Map(takeOrder.map((id, index) => [id, characters[index]]));
  const tiles = geometry.tiles.map((tile) => ({ ...tile, character: assigned.get(tile.id)! }));
  const hash = boardHash(tiles);
  const identity = `regional:${sha256Hex(JSON.stringify([
    regionId, stage, seed, REGIONAL_GENERATOR_VERSION, REGIONAL_CONTENT_VERSION,
    RECOGNITION_REGISTRY_VERSION, hash, words,
  ]))}`;
  const winningSolution: WinningAction[] = [];
  let index = 0;
  for (const id of words) {
    const bird = BIRD_CATALOG.find((candidate) => candidate.id === id)!;
    for (const _character of bird.characters) winningSolution.push({ type: 'take', tileId: takeOrder[index++] });
    winningSolution.push({ type: 'compose', birdId: id });
  }
  const level: LevelDefinition = {
    id: `regional-${regionId.toLowerCase()}-${stage}`,
    label: stage === 1 ? '北京·初识' : '北京·入门',
    seed, puzzleId: identity, catalog: BIRD_CATALOG.filter((bird) => approved.has(bird.id)),
    wordOccurrences: words, tiles, winningSolution,
  };
  return { regionId, stage, seed, boardHash: hash, level, certificate: 'ENGINE_REPLAYED' };
}

export const REGIONAL_PUZZLES: readonly RegionalPuzzle[] = [makePuzzle(1), makePuzzle(2)];

export function getRegionalPuzzle(regionId: string, stage: number): RegionalPuzzle | undefined {
  return REGIONAL_PUZZLES.find((puzzle) => puzzle.regionId === regionId && puzzle.stage === stage);
}

export function replayRegionalCertificate(puzzle: RegionalPuzzle): { phase: string; maximumTray: number } {
  let state = createGameFromLevel(puzzle.level);
  let maximumTray = 0;
  for (const action of puzzle.level.winningSolution) {
    if (action.type === 'take') {
      if (!isBoardTileExposed(state, action.tileId)) throw new Error(`Blocked certificate tile: ${action.tileId}`);
      state = selectBoardTile(state, action.tileId);
    } else {
      const next = composeBird(state, action.birdId);
      if (next === state) throw new Error(`Invalid certificate composition: ${action.birdId}`);
      state = next;
    }
    maximumTray = Math.max(maximumTray, state.tray.filter(Boolean).length);
    if (maximumTray > 10) throw new Error('Certificate exceeded tray');
  }
  if (state.phase !== 'level_complete') throw new Error(`Regional certificate did not win: ${puzzle.level.id}`);
  return { phase: state.phase, maximumTray };
}
