import { BIRD_CATALOG } from './birdCatalog';
import type { BirdDefinition, BoardTileDefinition, TileRegion } from './types';

export interface LevelPosition {
  id: string;
  x: number;
  y: number;
  layer: number;
  blockedBy: readonly string[];
  region?: TileRegion;
}

export interface GenerationConstraints {
  tileCount: number;
  minDistinctSpecies: number;
  maxSpeciesOccurrences: number;
  sharedFamilies: readonly {
    birdIds: readonly string[];
    minimumSelected: number;
  }[];
}

export interface GeneratedLevel3Content {
  seed: number;
  sampledBirdIds: readonly string[];
  speciesCounts: Readonly<Record<string, number>>;
  characters: readonly string[];
  tiles: readonly BoardTileDefinition[];
}

export type GenerationResult =
  | { ok: true; value: GeneratedLevel3Content }
  | { ok: false; reason: string };

const position = (
  id: string,
  x: number,
  y: number,
  layer: number,
  blockedBy: readonly string[],
  region?: TileRegion,
): LevelPosition => region
  ? { id, x, y, layer, blockedBy, region }
  : { id, x, y, layer, blockedBy };

export const LEVEL_3_LAYOUT: readonly LevelPosition[] = [
  position('l3-m01', 78, 28, 5, []),
  position('l3-m02', 138, 28, 5, []),
  position('l3-m03', 198, 28, 5, []),
  position('l3-m04', 48, 88, 5, []),
  position('l3-m05', 108, 88, 5, []),
  position('l3-m06', 168, 88, 5, []),
  position('l3-m07', 228, 88, 5, []),
  position('l3-m08', 138, 148, 5, []),
  position('l3-m09', 65, 18, 4, ['l3-m01']),
  position('l3-m10', 112, 18, 4, ['l3-m01', 'l3-m02']),
  position('l3-m11', 172, 18, 4, ['l3-m02', 'l3-m03']),
  position('l3-m12', 218, 18, 4, ['l3-m03']),
  position('l3-m13', 190, 60, 4, ['l3-m03']),
  position('l3-m14', 120, 78, 4, ['l3-m06']),
  position('l3-m15', 218, 78, 4, ['l3-m07']),
  position('l3-m16', 198, 138, 4, ['l3-m07']),
  position('l3-m17', 85, 28, 3, ['l3-m09', 'l3-m10']),
  position('l3-m18', 175, 28, 3, ['l3-m11', 'l3-m12']),
  position('l3-m19', 200, 65, 3, ['l3-m12', 'l3-m13']),
  position('l3-m20', 125, 88, 3, ['l3-m14']),
  position('l3-m21', 218, 88, 3, ['l3-m15']),
  position('l3-m22', 190, 135, 3, ['l3-m16']),
  position('l3-m23', 235, 120, 3, ['l3-m15', 'l3-m16']),
  position('l3-m24', 175, 165, 3, ['l3-m16']),
  position('l3-m25', 75, 40, 2, ['l3-m17']),
  position('l3-m26', 120, 40, 2, ['l3-m17']),
  position('l3-m27', 180, 80, 2, ['l3-m19', 'l3-m20']),
  position('l3-m28', 220, 100, 2, ['l3-m21']),
  position('l3-m29', 195, 145, 2, ['l3-m21', 'l3-m22']),
  position('l3-m30', 245, 145, 2, ['l3-m23']),
  position('l3-m31', 175, 185, 2, ['l3-m24']),
  position('l3-m32', 140, 55, 2, ['l3-m18']),
  position('l3-m33', 70, 50, 1, ['l3-m25']),
  position('l3-m34', 115, 50, 1, ['l3-m25', 'l3-m26']),
  position('l3-m35', 215, 115, 1, ['l3-m28']),
  position('l3-m36', 190, 155, 1, ['l3-m29']),
  position('l3-m37', 245, 170, 1, ['l3-m30']),
  position('l3-m38', 175, 95, 1, ['l3-m27']),
  position('l3-m39', 140, 65, 1, ['l3-m32']),
  position('l3-m40', 145, 110, 1, ['l3-m32']),
  position('l3-x01', 4, 10, 6, [], 'auxiliary'),
  position('l3-x02', 4, 60, 6, [], 'auxiliary'),
  position('l3-x03', 4, 110, 6, [], 'auxiliary'),
  position('l3-x04', 4, 160, 6, [], 'auxiliary'),
  position('l3-x05', 4, 210, 6, [], 'auxiliary'),
  position('l3-x06', 282, 10, 6, [], 'auxiliary'),
  position('l3-x07', 282, 60, 6, [], 'auxiliary'),
  position('l3-x08', 282, 110, 6, [], 'auxiliary'),
  position('l3-x09', 282, 160, 6, [], 'auxiliary'),
  position('l3-x10', 55, 210, 6, [], 'auxiliary'),
  position('l3-x11', 105, 210, 6, [], 'auxiliary'),
  position('l3-x12', 155, 210, 6, [], 'auxiliary'),
  position('l3-q01', 278, 202, 7, [], 'blind'),
  position('l3-q02', 276, 200, 6, ['l3-q01'], 'blind'),
  position('l3-q03', 274, 198, 5, ['l3-q02'], 'blind'),
  position('l3-q04', 272, 196, 4, ['l3-q03'], 'blind'),
  position('l3-q05', 270, 194, 3, ['l3-q04'], 'blind'),
  position('l3-q06', 268, 192, 2, ['l3-q05'], 'blind'),
  position('l3-q07', 266, 190, 1, ['l3-q06'], 'blind'),
];

export const DEFAULT_LEVEL_3_CONSTRAINTS: GenerationConstraints = {
  tileCount: LEVEL_3_LAYOUT.length,
  minDistinctSpecies: 12,
  maxSpeciesOccurrences: 2,
  sharedFamilies: [
    {
      birdIds: ['bird:bailu', 'bird:dabailu', 'bird:xiaobailu'],
      minimumSelected: 2,
    },
    {
      birdIds: ['bird:xique', 'bird:huixique'],
      minimumSelected: 2,
    },
  ],
};

/** Deterministic mulberry32 PRNG. All arithmetic is explicitly 32-bit. */
export function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}

export function fisherYates<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function respectsSharedFamilies(
  counts: ReadonlyMap<string, number>,
  constraints: GenerationConstraints,
): boolean {
  return constraints.sharedFamilies.every(({ birdIds, minimumSelected }) =>
    birdIds.filter((id) => (counts.get(id) ?? 0) > 0).length >= minimumSelected,
  );
}

function sampleBirds(
  seed: number,
  catalog: readonly BirdDefinition[],
  constraints: GenerationConstraints,
): readonly BirdDefinition[] | undefined {
  const random = createSeededRandom(seed ^ 0xa5a5a5a5);
  const ordered = fisherYates(catalog, random);
  const amounts = [
    ...Array.from({ length: constraints.maxSpeciesOccurrences }, (_, index) => index + 1),
    0,
  ];
  const optionOrders = ordered.map(() => fisherYates(amounts, random));
  const counts = new Map<string, number>();
  const rejected = new Set<string>();

  function visit(
    index: number,
    remaining: number,
    distinct: number,
    familyCounts: readonly number[],
  ): boolean {
    if (remaining < 0) return false;
    if (index === ordered.length) {
      return remaining === 0
        && distinct >= constraints.minDistinctSpecies
        && familyCounts.every((amount, familyIndex) =>
          amount >= constraints.sharedFamilies[familyIndex].minimumSelected,
        );
    }

    const possibleDistinct = distinct + (ordered.length - index);
    if (possibleDistinct < constraints.minDistinctSpecies) return false;
    const key = `${index}|${remaining}|${distinct}|${familyCounts.join(',')}`;
    if (rejected.has(key)) return false;
    const bird = ordered[index];
    for (const amount of optionOrders[index]) {
      const length = bird.characters.length * amount;
      if (length > remaining) continue;
      if (amount > 0) counts.set(bird.id, amount);
      else counts.delete(bird.id);
      const nextFamilyCounts = familyCounts.map((familyCount, familyIndex) => {
        const belongs = constraints.sharedFamilies[familyIndex].birdIds.includes(bird.id);
        return familyCount + (belongs && amount > 0 ? 1 : 0);
      });
      if (visit(
        index + 1,
        remaining - length,
        distinct + (amount > 0 ? 1 : 0),
        nextFamilyCounts,
      )) return true;
    }
    counts.delete(bird.id);
    rejected.add(key);
    return false;
  }

  if (!visit(0, constraints.tileCount, 0, constraints.sharedFamilies.map(() => 0))) return undefined;
  if (!respectsSharedFamilies(counts, constraints)) return undefined;
  return ordered.flatMap((bird) => Array<BirdDefinition>(counts.get(bird.id) ?? 0).fill(bird));
}

export function generateLevel3Content(
  seed: number,
  constraints: GenerationConstraints = DEFAULT_LEVEL_3_CONSTRAINTS,
  catalog: readonly BirdDefinition[] = BIRD_CATALOG,
): GenerationResult {
  if (constraints.tileCount !== LEVEL_3_LAYOUT.length) {
    return { ok: false, reason: `Layout has ${LEVEL_3_LAYOUT.length} positions, not ${constraints.tileCount}` };
  }
  const sampled = sampleBirds(seed, catalog, constraints);
  if (!sampled) return { ok: false, reason: 'No bird multiset satisfies the configured constraints' };

  const characters = sampled.flatMap((bird) => [...bird.characters]);
  const shuffledCharacters = fisherYates(characters, createSeededRandom(seed));
  const speciesCounts = sampled.reduce<Record<string, number>>((counts, bird) => {
    counts[bird.id] = (counts[bird.id] ?? 0) + 1;
    return counts;
  }, {});
  const tiles = LEVEL_3_LAYOUT.map((layout, index): BoardTileDefinition => ({
    ...layout,
    blockedBy: [...layout.blockedBy],
    character: shuffledCharacters[index],
  }));

  return {
    ok: true,
    value: {
      seed,
      sampledBirdIds: sampled.map((bird) => bird.id),
      speciesCounts,
      characters: shuffledCharacters,
      tiles,
    },
  };
}
