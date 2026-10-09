import { BIRD_CATALOG } from './birdCatalog';
import type { BoardTileDefinition, LevelDefinition } from './types';

interface AuthoredStack {
  key: string;
  birdId: string;
  x: number;
  y: number;
}

const positions = [
  [8, 8], [92, 8], [176, 8], [260, 8],
  [8, 94], [92, 94], [176, 94], [260, 94],
  [8, 180], [92, 180], [176, 180], [260, 180],
] as const;

function stacksFor(prefix: string, birdIds: readonly string[]): AuthoredStack[] {
  return birdIds.map((birdId, index) => ({
    key: `${prefix}-stack-${String(index + 1).padStart(2, '0')}`,
    birdId,
    x: positions[index][0],
    y: positions[index][1],
  }));
}

function buildTiles(stacks: readonly AuthoredStack[]): BoardTileDefinition[] {
  return stacks.flatMap((stack) => {
    const bird = BIRD_CATALOG.find((candidate) => candidate.id === stack.birdId);
    if (!bird) throw new Error(`Unknown authored bird: ${stack.birdId}`);

    return bird.characters.map((character, index) => ({
      id: `${stack.key}-tile-${String(index + 1).padStart(2, '0')}`,
      character,
      layer: bird.characters.length - index,
      x: stack.x + index * 5,
      y: stack.y + index * 6,
      blockedBy: index === 0
        ? []
        : [`${stack.key}-tile-${String(index).padStart(2, '0')}`],
    }));
  });
}

function defineLevel(id: string, label: string, birdIds: readonly string[]): LevelDefinition {
  return { id, label, tiles: buildTiles(stacksFor(id, birdIds)) };
}

export const AUTHORED_LEVELS: readonly LevelDefinition[] = [
  defineLevel('level-1', '第一关', [
    'bird:xique', 'bird:bailu', 'bird:canglu', 'bird:yelu',
    'bird:chilu', 'bird:hongsun', 'bird:daisheng', 'bird:xique',
    'bird:bailu', 'bird:canglu', 'bird:hongsun',
  ]),
  defineLevel('level-2', '第二关', [
    'bird:huixique', 'bird:dabailu', 'bird:xiaobailu', 'bird:baitoubei',
    'bird:heishuiji', 'bird:shanbanjiu', 'bird:shumaque', 'bird:huixique',
    'bird:dabailu', 'bird:heishuiji', 'bird:shanbanjiu',
  ]),
  defineLevel('level-3', '第三关', [
    'bird:zhujingbanjiu', 'bird:hongfujinji', 'bird:zhujingbanjiu',
    'bird:hongfujinji', 'bird:zhujingbanjiu', 'bird:hongfujinji',
    'bird:zhujingbanjiu', 'bird:hongfujinji', 'bird:zhujingbanjiu',
    'bird:hongfujinji', 'bird:xique', 'bird:bailu',
  ]),
];

export function getLevel(levelId: string): LevelDefinition {
  const level = AUTHORED_LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  return level;
}
