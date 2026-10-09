import type { BirdDefinition } from './types';

export const SCORE_BY_LENGTH: Readonly<Record<number, number>> = {
  2: 10,
  3: 30,
  4: 70,
};

const catalogEntries = [
  { assetKey: 'xique', name: '喜鹊' },
  { assetKey: 'huixique', name: '灰喜鹊' },
  { assetKey: 'bailu', name: '白鹭' },
  { assetKey: 'dabailu', name: '大白鹭' },
  { assetKey: 'xiaobailu', name: '小白鹭' },
  { assetKey: 'canglu', name: '苍鹭' },
  { assetKey: 'yelu', name: '夜鹭' },
  { assetKey: 'chilu', name: '池鹭' },
  { assetKey: 'hongsun', name: '红隼' },
  { assetKey: 'baitoubei', name: '白头鹎' },
  { assetKey: 'heishuiji', name: '黑水鸡' },
  { assetKey: 'zhujingbanjiu', name: '珠颈斑鸠' },
  { assetKey: 'shanbanjiu', name: '山斑鸠' },
  { assetKey: 'hongfujinji', name: '红腹锦鸡' },
  { assetKey: 'daisheng', name: '戴胜' },
  { assetKey: 'shumaque', name: '树麻雀' },
] as const;

export const BIRD_CATALOG: readonly BirdDefinition[] = catalogEntries.map(({ assetKey, name }) => ({
  id: `bird:${assetKey}`,
  name,
  characters: Array.from(name),
  score: SCORE_BY_LENGTH[Array.from(name).length],
  assetKey,
}));
