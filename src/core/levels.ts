import type {
  BoardTileDefinition,
  LevelDefinition,
  TileRegion,
  WinningAction,
} from './types';

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

const level3: LevelDefinition = {
  id: 'level-3',
  label: '第三关',
  tiles: [
    // Main board: five interlocked logical layers (40 tiles).
    tile('l3-m01', '腹', 78, 28, 5, []),
    tile('l3-m02', '锦', 138, 28, 5, []),
    tile('l3-m03', '颈', 198, 28, 5, []),
    tile('l3-m04', '腹', 48, 88, 5, []),
    tile('l3-m05', '锦', 108, 88, 5, []),
    tile('l3-m06', '颈', 168, 88, 5, []),
    tile('l3-m07', '大', 228, 88, 5, []),
    tile('l3-m08', '灰', 138, 148, 5, []),
    tile('l3-m09', '红', 65, 18, 4, ['l3-m01']),
    tile('l3-m10', '鸡', 112, 18, 4, ['l3-m01', 'l3-m02']),
    tile('l3-m11', '隼', 172, 18, 4, ['l3-m02', 'l3-m03']),
    tile('l3-m12', '珠', 218, 18, 4, ['l3-m03']),
    tile('l3-m13', '斑', 190, 60, 4, ['l3-m03']),
    tile('l3-m14', '鸠', 120, 78, 4, ['l3-m06']),
    tile('l3-m15', '白', 218, 78, 4, ['l3-m07']),
    tile('l3-m16', '鹭', 198, 138, 4, ['l3-m07']),
    tile('l3-m17', '红', 85, 28, 3, ['l3-m09', 'l3-m10']),
    tile('l3-m18', '鸡', 175, 28, 3, ['l3-m11', 'l3-m12']),
    tile('l3-m19', '珠', 200, 65, 3, ['l3-m12', 'l3-m13']),
    tile('l3-m20', '鸠', 125, 88, 3, ['l3-m14']),
    tile('l3-m21', '喜', 218, 88, 3, ['l3-m15']),
    tile('l3-m22', '鹊', 190, 135, 3, ['l3-m16']),
    tile('l3-m23', '白', 235, 120, 3, ['l3-m15', 'l3-m16']),
    tile('l3-m24', '鹭', 175, 165, 3, ['l3-m16']),
    tile('l3-m25', '红', 75, 40, 2, ['l3-m17']),
    tile('l3-m26', '鸡', 120, 40, 2, ['l3-m17']),
    tile('l3-m27', '珠', 180, 80, 2, ['l3-m19', 'l3-m20']),
    tile('l3-m28', '喜', 220, 100, 2, ['l3-m21']),
    tile('l3-m29', '鹊', 195, 145, 2, ['l3-m21', 'l3-m22']),
    tile('l3-m30', '白', 245, 145, 2, ['l3-m23']),
    tile('l3-m31', '鹭', 175, 185, 2, ['l3-m24']),
    tile('l3-m32', '黑', 140, 55, 2, ['l3-m18']),
    tile('l3-m33', '红', 70, 50, 1, ['l3-m25']),
    tile('l3-m34', '鸡', 115, 50, 1, ['l3-m25', 'l3-m26']),
    tile('l3-m35', '喜', 215, 115, 1, ['l3-m28']),
    tile('l3-m36', '鹊', 190, 155, 1, ['l3-m29']),
    tile('l3-m37', '鸠', 245, 170, 1, ['l3-m30']),
    tile('l3-m38', '鹭', 175, 95, 1, ['l3-m27']),
    tile('l3-m39', '水', 140, 65, 1, ['l3-m32']),
    tile('l3-m40', '山', 145, 110, 1, ['l3-m32']),

    // Auxiliary resources: always visible, but costly to take before their targets emerge.
    tile('l3-x01', '腹', 4, 10, 6, [], 'auxiliary'),
    tile('l3-x02', '锦', 4, 60, 6, [], 'auxiliary'),
    tile('l3-x03', '颈', 4, 110, 6, [], 'auxiliary'),
    tile('l3-x04', '腹', 4, 160, 6, [], 'auxiliary'),
    tile('l3-x05', '锦', 4, 210, 6, [], 'auxiliary'),
    tile('l3-x06', '颈', 282, 10, 6, [], 'auxiliary'),
    tile('l3-x07', '大', 282, 60, 6, [], 'auxiliary'),
    tile('l3-x08', '小', 282, 110, 6, [], 'auxiliary'),
    tile('l3-x09', '灰', 282, 160, 6, [], 'auxiliary'),
    tile('l3-x10', '斑', 55, 210, 6, [], 'auxiliary'),
    tile('l3-x11', '斑', 105, 210, 6, [], 'auxiliary'),
    tile('l3-x12', '斑', 155, 210, 6, [], 'auxiliary'),

    // Blind stack: only the exposed top character is readable.
    tile('l3-q01', '鸠', 278, 202, 7, [], 'blind'),
    tile('l3-q02', '红', 276, 200, 6, ['l3-q01'], 'blind'),
    tile('l3-q03', '鸡', 274, 198, 5, ['l3-q02'], 'blind'),
    tile('l3-q04', '珠', 272, 196, 4, ['l3-q03'], 'blind'),
    tile('l3-q05', '斑', 270, 194, 3, ['l3-q04'], 'blind'),
    tile('l3-q06', '鸠', 268, 192, 2, ['l3-q05'], 'blind'),
    tile('l3-q07', '白', 266, 190, 1, ['l3-q06'], 'blind'),
  ],
  winningSolution: winningActions([
    { birdId: 'bird:hongfujinji', tileIds: ['l3-m01', 'l3-m02', 'l3-m09', 'l3-m10'] },
    { birdId: 'bird:zhujingbanjiu', tileIds: ['l3-m03', 'l3-m12', 'l3-m13', 'l3-q01'] },
    { birdId: 'bird:hongsun', tileIds: ['l3-m11', 'l3-q02'] },
    { birdId: 'bird:dabailu', tileIds: ['l3-m07', 'l3-m15', 'l3-m16'] },
    { birdId: 'bird:huixique', tileIds: ['l3-m08', 'l3-m21', 'l3-m22'] },
    { birdId: 'bird:hongfujinji', tileIds: ['l3-m04', 'l3-m05', 'l3-m17', 'l3-q03'] },
    { birdId: 'bird:zhujingbanjiu', tileIds: ['l3-m06', 'l3-m14', 'l3-x10', 'l3-q04'] },
    { birdId: 'bird:dabailu', tileIds: ['l3-x07', 'l3-m23', 'l3-m24'] },
    { birdId: 'bird:hongfujinji', tileIds: ['l3-x01', 'l3-x02', 'l3-m25', 'l3-m26'] },
    { birdId: 'bird:zhujingbanjiu', tileIds: ['l3-x03', 'l3-m19', 'l3-q05', 'l3-m20'] },
    { birdId: 'bird:huixique', tileIds: ['l3-x09', 'l3-m28', 'l3-m29'] },
    { birdId: 'bird:xiaobailu', tileIds: ['l3-x08', 'l3-m30', 'l3-m31'] },
    { birdId: 'bird:heishuiji', tileIds: ['l3-m18', 'l3-m32', 'l3-m39'] },
    { birdId: 'bird:hongfujinji', tileIds: ['l3-x04', 'l3-x05', 'l3-m33', 'l3-m34'] },
    { birdId: 'bird:zhujingbanjiu', tileIds: ['l3-x06', 'l3-x11', 'l3-m27', 'l3-q06'] },
    { birdId: 'bird:xique', tileIds: ['l3-m35', 'l3-m36'] },
    { birdId: 'bird:bailu', tileIds: ['l3-q07', 'l3-m38'] },
    { birdId: 'bird:shanbanjiu', tileIds: ['l3-x12', 'l3-m37', 'l3-m40'] },
  ]),
};

export const AUTHORED_LEVELS: readonly LevelDefinition[] = [level1, level2, level3];

export function getLevel(levelId: string): LevelDefinition {
  const level = AUTHORED_LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  return level;
}
