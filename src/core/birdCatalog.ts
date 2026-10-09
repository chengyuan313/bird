import type { BirdDefinition } from './types';

export const SCORE_BY_LENGTH: Readonly<Record<number, number>> = {
  2: 10,
  3: 30,
  4: 70,
};

const names = [
  '喜鹊',
  '灰喜鹊',
  '白鹭',
  '大白鹭',
  '小白鹭',
  '苍鹭',
  '夜鹭',
  '池鹭',
  '红隼',
  '白头鹎',
  '黑水鸡',
  '珠颈斑鸠',
  '山斑鸠',
  '红腹锦鸡',
  '戴胜',
  '树麻雀',
] as const;

export const BIRD_CATALOG: readonly BirdDefinition[] = names.map((name, index) => ({
  id: `bird-${index + 1}`,
  name,
  characters: Array.from(name),
  score: SCORE_BY_LENGTH[Array.from(name).length],
  presentationKey: `plumage-${index + 1}`,
}));

export const CATALOG_CHARACTER_POOL: readonly string[] = BIRD_CATALOG.flatMap(
  (bird) => bird.characters,
);
