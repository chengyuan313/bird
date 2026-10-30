import { BIRD_CATALOG } from './birdCatalog';
import { composeBird, createGameFromLevel, isBoardTileExposed, selectBoardTile } from './gameEngine';
import { getLevel } from './levels';
import { boardHash, sha256Hex } from './puzzleIdentity';
import { BEIJING_CONTENT_VERSION, REGIONAL_CONTENT_VERSION, speciesForRegion } from './regionalData';
import { RECOGNITION_REGISTRY_VERSION } from './recognitionRegistry';
import type { LevelDefinition, WinningAction } from './types';

export const REGIONAL_GENERATOR_VERSION = 'authored-geometry-word-sequence-v6.1';
const BEIJING_GENERATOR_VERSION = 'authored-geometry-word-sequence-v6.0';

export interface RegionalStageConfig { regionId: string; regionName: string; stage: 1 | 2; seed: number; words: readonly string[] }
const stageConfigs: readonly RegionalStageConfig[] = [
  { regionId: 'CN-BJ', regionName: '北京', stage: 1, seed: 6001, words: ['bird:bailu', 'bird:yelu', 'bird:chilu', 'bird:canglu', 'bird:daisheng', 'bird:hongsun', 'bird:wudong', 'bird:bailu', 'bird:yelu', 'bird:chilu', 'bird:canglu'] },
  { regionId: 'CN-BJ', regionName: '北京', stage: 2, seed: 6002, words: ['bird:huixique', 'bird:dabailu', 'bird:dashanque', 'bird:huixique', 'bird:dabailu', 'bird:dashanque', 'bird:huixique', 'bird:dabailu', 'bird:dashanque', 'bird:huixique', 'bird:dabailu'] },
  { regionId: 'CN-LN', regionName: '辽宁', stage: 1, seed: 6111, words: ['bird:shaoji', 'bird:yuanyang', 'bird:huihe', 'bird:heiguan', 'bird:hongsun', 'bird:yansun', 'bird:liesun', 'bird:yousun', 'bird:yunque', 'bird:huamei', 'bird:shaoji'] },
  { regionId: 'CN-LN', regionName: '辽宁', stage: 2, seed: 6112, words: ['bird:shaoji', 'bird:yuanyang', 'bird:huihe', 'bird:heiguan', 'bird:hongsun', 'bird:yunque', 'bird:xiaotiane', 'bird:datiane', 'bird:suoyuhe', 'bird:dandinghe', 'bird:hongjiaoxiao', 'bird:changerxiao', 'bird:duanerxiao'] },
  { regionId: 'CN-GD', regionName: '广东', stage: 1, seed: 6121, words: ['bird:canglu', 'bird:chilu', 'bird:bailu', 'bird:yelu', 'bird:hongsun', 'bird:jiayan', 'bird:shuliu', 'bird:bage', 'bird:quequ', 'bird:canglu', 'bird:chilu'] },
  { regionId: 'CN-GD', regionName: '广东', stage: 2, seed: 6122, words: ['bird:bage', 'bird:quequ', 'bird:heishuiji', 'bird:fanzuiyu', 'bird:shanbanjiu', 'bird:fengtouqianya', 'bird:sishengdujuan', 'bird:putongcuiniao', 'bird:baixiongfeicui', 'bird:zongbeibolao'] },
  { regionId: 'CN-SC', regionName: '四川', stage: 1, seed: 6131, words: ['bird:shaoji', 'bird:baixian', 'bird:douyan', 'bird:yuanyang', 'bird:zaojuan', 'bird:canglu', 'bird:bailu', 'bird:jiayan', 'bird:huamei', 'bird:bage', 'bird:wudong'] },
  { regionId: 'CN-SC', regionName: '四川', stage: 2, seed: 6132, words: ['bird:baixian', 'bird:yuanyang', 'bird:xiaotiane', 'bird:chimaya', 'bird:lutouya', 'bird:shanbanjiu', 'bird:dadujuan', 'bird:suoyuhe', 'bird:huixique', 'bird:hongfujinji', 'bird:putongcuiniao'] },
  { regionId: 'CN-YN', regionName: '云南', stage: 1, seed: 6141, words: ['bird:zaojuan', 'bird:chilu', 'bird:canglu', 'bird:bailu', 'bird:hongsun', 'bird:yansun', 'bird:yousun', 'bird:jiayan', 'bird:zaojuan', 'bird:chilu', 'bird:canglu'] },
  { regionId: 'CN-YN', regionName: '云南', stage: 2, seed: 6142, words: ['bird:hongsun', 'bird:jiayan', 'bird:dadujuan', 'bird:dashanque', 'bird:xiaoyunque', 'bird:baiyaoyuyan', 'bird:baixiongfeicui', 'bird:putongcuiniao', 'bird:hongweibolao', 'bird:zongbeibolao'] },
];

export interface RegionalPuzzle {
  regionId: string;
  stage: number;
  seed: number;
  boardHash: string;
  level: LevelDefinition;
  certificate: 'ENGINE_REPLAYED';
}

export function buildRegionalPuzzle(config: RegionalStageConfig): RegionalPuzzle {
  const { regionId, regionName, stage, seed, words } = config;
  const geometry = getLevel(stage === 1 ? 'level-1' : 'level-2');
  const approved = new Set(speciesForRegion(regionId).map((item) => item.speciesId));
  if (words.some((id) => !approved.has(id))) throw new Error('Unapproved regional puzzle species');
  const characters = words.flatMap((id) => BIRD_CATALOG.find((bird) => bird.id === id)!.characters);
  const takeOrder = geometry.winningSolution.filter((action) => action.type === 'take').map((action) => action.tileId);
  if (characters.length !== geometry.tiles.length || takeOrder.length !== characters.length) throw new Error('Invalid regional word count');
  const assigned = new Map(takeOrder.map((id, index) => [id, characters[index]]));
  const tiles = geometry.tiles.map((tile) => ({ ...tile, character: assigned.get(tile.id)! }));
  const hash = boardHash(tiles);
  const generatorVersion = regionId === 'CN-BJ' ? BEIJING_GENERATOR_VERSION : REGIONAL_GENERATOR_VERSION;
  const contentVersion = regionId === 'CN-BJ' ? BEIJING_CONTENT_VERSION : REGIONAL_CONTENT_VERSION;
  const identity = `regional:${sha256Hex(JSON.stringify([
    regionId, stage, seed, generatorVersion, contentVersion,
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
    label: `${regionName}·${stage === 1 ? '初识' : '入门'}`,
    seed, puzzleId: identity, catalog: BIRD_CATALOG.filter((bird) => approved.has(bird.id)),
    wordOccurrences: words, tiles, winningSolution,
  };
  return { regionId, stage, seed, boardHash: hash, level, certificate: 'ENGINE_REPLAYED' };
}

export const REGIONAL_PUZZLES: readonly RegionalPuzzle[] = stageConfigs.map(buildRegionalPuzzle);
if (new Set(REGIONAL_PUZZLES.map((puzzle) => puzzle.level.puzzleId)).size !== REGIONAL_PUZZLES.length ||
  new Set(REGIONAL_PUZZLES.map((puzzle) => `${puzzle.regionId}/${puzzle.stage}`)).size !== REGIONAL_PUZZLES.length) {
  throw new Error('Duplicate regional puzzle candidate');
}

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
