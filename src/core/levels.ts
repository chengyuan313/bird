import type {
  BoardTileDefinition,
  LevelDefinition,
  TileRegion,
  WinningAction,
} from './types';
import { isPlayableLevel3Seed } from './level3Playable';
import { CERTIFIED_PUZZLE_BANK, getCertifiedPuzzle, getLegacyPuzzle, levelFromCertifiedPuzzle } from './puzzleBank';
import { LEGACY_GAMEPLAY_COMPOSITIONS, LEGACY_GAMEPLAY_SPECIES_CATALOG, LEVEL_2_COMPOSITIONS, LEVEL_2_SPECIES_CATALOG } from './birdCatalog';

const tile = (
  id: string,
  character: string,
  x: number,
  y: number,
  layer: number,
  blockedBy: readonly string[],
  region?: TileRegion,
): BoardTileDefinition => region
  ? { id, character, x, y, layer, blockedBy, region }
  : { id, character, x, y, layer, blockedBy };

interface SolutionBird {
  birdId: string;
  tileIds: readonly string[];
}

function winningActions(birds: readonly SolutionBird[]): WinningAction[] {
  return birds.flatMap(({ birdId, tileIds }) => [
    ...tileIds.map((tileId): WinningAction => ({ type: 'take', tileId })),
    { type: 'compose', birdId },
  ]);
}

const level1: LevelDefinition = {
  id: 'level-1',
  label: '第一关',
  catalog: LEGACY_GAMEPLAY_SPECIES_CATALOG,
  compositions: LEGACY_GAMEPLAY_COMPOSITIONS,
  tiles: [
    tile('l1-u01', '喜', 49, 22, 2, []),
    tile('l1-u02', '鹊', 123, 22, 2, []),
    tile('l1-u03', '白', 197, 22, 2, []),
    tile('l1-u04', '鹭', 12, 80, 2, []),
    tile('l1-u05', '红', 86, 100, 2, []),
    tile('l1-u06', '隼', 160, 100, 2, []),
    tile('l1-u07', '戴', 234, 100, 2, []),
    tile('l1-u08', '胜', 49, 178, 2, []),
    tile('l1-u09', '苍', 160, 178, 2, []),
    tile('l1-u10', '鹭', 271, 158, 2, []),
    tile('l1-u11', '喜', 271, 62, 2, []),
    tile('l1-n01', '鹊', 8, 8, 1, ['l1-u01']),
    tile('l1-n02', '白', 92, 8, 1, ['l1-u01']),
    tile('l1-n03', '鹭', 176, 8, 1, ['l1-u02', 'l1-u03']),
    tile('l1-n04', '苍', 252, 8, 1, ['l1-u03', 'l1-u11']),
    tile('l1-n05', '鹭', 8, 94, 1, ['l1-u04']),
    tile('l1-n06', '夜', 92, 94, 1, ['l1-u05']),
    tile('l1-n07', '鹭', 176, 94, 1, ['l1-u06', 'l1-u07']),
    tile('l1-n08', '池', 260, 94, 1, ['l1-u07', 'l1-u11']),
    tile('l1-n09', '鹭', 8, 180, 1, ['l1-u08']),
    tile('l1-n10', '红', 104, 180, 1, ['l1-u08', 'l1-u09']),
    tile('l1-n11', '隼', 214, 180, 1, ['l1-u09', 'l1-u10']),
  ],
  winningSolution: winningActions([
    { birdId: 'bird:xique', tileIds: ['l1-u01', 'l1-u02'] },
    { birdId: 'bird:bailu', tileIds: ['l1-u03', 'l1-u04'] },
    { birdId: 'bird:hongsun', tileIds: ['l1-u05', 'l1-u06'] },
    { birdId: 'bird:daisheng', tileIds: ['l1-u07', 'l1-u08'] },
    { birdId: 'bird:canglu', tileIds: ['l1-u09', 'l1-u10'] },
    { birdId: 'bird:xique', tileIds: ['l1-u11', 'l1-n01'] },
    { birdId: 'bird:bailu', tileIds: ['l1-n02', 'l1-n03'] },
    { birdId: 'bird:canglu', tileIds: ['l1-n04', 'l1-n05'] },
    { birdId: 'bird:yelu', tileIds: ['l1-n06', 'l1-n07'] },
    { birdId: 'bird:chilu', tileIds: ['l1-n08', 'l1-n09'] },
    { birdId: 'bird:hongsun', tileIds: ['l1-n10', 'l1-n11'] },
  ]),
};

const level2: LevelDefinition = {
  id: 'level-2',
  label: '第二关',
  catalog: LEVEL_2_SPECIES_CATALOG,
  compositions: LEVEL_2_COMPOSITIONS,
  tiles: [
    tile('l2-z01', '灰', 67, 14, 3, []),
    tile('l2-z02', '喜', 141, 14, 3, []),
    tile('l2-z03', '鹊', 215, 14, 3, []),
    tile('l2-z04', '大', 30, 92, 3, []),
    tile('l2-z05', '白', 104, 92, 3, []),
    tile('l2-z06', '鹭', 178, 92, 3, []),
    tile('l2-z07', '小', 252, 92, 3, []),
    tile('l2-z08', '白', 67, 170, 3, []),
    tile('l2-z09', '鹭', 141, 170, 3, []),
    tile('l2-z10', '白', 215, 170, 3, []),
    tile('l2-z11', '头', 289, 140, 3, []),
    tile('l2-m01', '鹎', 49, 22, 2, ['l2-z01']),
    tile('l2-m02', '黑', 123, 22, 2, ['l2-z01']),
    tile('l2-m03', '水', 197, 22, 2, ['l2-z02', 'l2-z03']),
    tile('l2-m04', '鸡', 12, 80, 2, ['l2-z04']),
    tile('l2-m05', '山', 86, 100, 2, ['l2-z04', 'l2-z05']),
    tile('l2-m06', '斑', 160, 100, 2, ['l2-z05', 'l2-z06']),
    tile('l2-m07', '鸠', 234, 100, 2, ['l2-z06', 'l2-z07']),
    tile('l2-m08', '树', 49, 178, 2, ['l2-z08']),
    tile('l2-m09', '麻', 160, 178, 2, ['l2-z09', 'l2-z10']),
    tile('l2-m10', '雀', 271, 158, 2, ['l2-z10', 'l2-z11']),
    tile('l2-m11', '灰', 271, 62, 2, ['l2-z03', 'l2-z07']),
    tile('l2-n01', '喜', 8, 8, 1, ['l2-m01']),
    tile('l2-n02', '鹊', 92, 8, 1, ['l2-m01']),
    tile('l2-n03', '大', 176, 8, 1, ['l2-m02', 'l2-m03']),
    tile('l2-n04', '白', 252, 8, 1, ['l2-m03', 'l2-m11']),
    tile('l2-n05', '鹭', 8, 94, 1, ['l2-m04']),
    tile('l2-n06', '黑', 92, 94, 1, ['l2-m05']),
    tile('l2-n07', '水', 176, 94, 1, ['l2-m06', 'l2-m07']),
    tile('l2-n08', '鸡', 260, 94, 1, ['l2-m07', 'l2-m11']),
    tile('l2-n09', '山', 8, 180, 1, ['l2-m08']),
    tile('l2-n10', '斑', 104, 180, 1, ['l2-m08', 'l2-m09']),
    tile('l2-n11', '鸠', 214, 180, 1, ['l2-m09', 'l2-m10']),
  ],
  winningSolution: winningActions([
    { birdId: 'bird:huixique', tileIds: ['l2-z01', 'l2-z02', 'l2-z03'] },
    { birdId: 'bird:dabailu', tileIds: ['l2-z04', 'l2-z05', 'l2-z06'] },
    { birdId: 'bird:xiaobailu', tileIds: ['l2-z07', 'l2-z08', 'l2-z09'] },
    { birdId: 'bird:baitoubei', tileIds: ['l2-z10', 'l2-z11', 'l2-m01'] },
    { birdId: 'bird:heishuiji', tileIds: ['l2-m02', 'l2-m03', 'l2-m04'] },
    { birdId: 'bird:shanbanjiu', tileIds: ['l2-m05', 'l2-m06', 'l2-m07'] },
    { birdId: 'bird:shumaque', tileIds: ['l2-m08', 'l2-m09', 'l2-m10'] },
    { birdId: 'bird:huixique', tileIds: ['l2-m11', 'l2-n01', 'l2-n02'] },
    { birdId: 'bird:dabailu', tileIds: ['l2-n03', 'l2-n04', 'l2-n05'] },
    { birdId: 'bird:heishuiji', tileIds: ['l2-n06', 'l2-n07', 'l2-n08'] },
    { birdId: 'bird:shanbanjiu', tileIds: ['l2-n09', 'l2-n10', 'l2-n11'] },
  ]),
};

const level3 = levelFromCertifiedPuzzle(CERTIFIED_PUZZLE_BANK.records[0]);

export const AUTHORED_LEVELS: readonly LevelDefinition[] = [level1, level2, level3];

export function getLevel(levelId: string, seed?: number, requestedPuzzleId?: string): LevelDefinition {
  if (requestedPuzzleId !== undefined && levelId !== 'level-3') throw new Error('Puzzle ID is only valid for Level 3');
  if (levelId === 'level-3' && requestedPuzzleId !== undefined) {
    const record = getCertifiedPuzzle(requestedPuzzleId);
    if (seed !== undefined && record.seed !== seed) throw new Error('Puzzle ID and seed do not match');
    return levelFromCertifiedPuzzle(record);
  }
  if (levelId === 'level-3' && seed !== undefined) {
    if (!isPlayableLevel3Seed(seed)) throw new Error(`Unverified Level 3 seed: ${seed}`);
    return levelFromCertifiedPuzzle(getLegacyPuzzle(seed));
  }
  const level = AUTHORED_LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  return level;
}
