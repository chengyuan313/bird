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

export const LEVEL_3_TILE_SIZE = 48;

type PositionSeed = Omit<LevelPosition, 'blockedBy'>;

const position = (
  id: string,
  x: number,
  y: number,
  layer: number,
  region?: TileRegion,
): PositionSeed => region ? { id, x, y, layer, region } : { id, x, y, layer };

const POSITION_SEEDS: readonly PositionSeed[] = [
  // Dense central base: three staggered grids across four logical layers.
  position('l3-m01', 70, 34, 1),
  position('l3-m02', 122, 34, 1),
  position('l3-m03', 174, 34, 1),
  position('l3-m04', 226, 34, 1),
  position('l3-m05', 70, 86, 1),
  position('l3-m06', 122, 86, 1),
  position('l3-m07', 174, 86, 1),
  position('l3-m08', 226, 86, 1),
  position('l3-m09', 70, 138, 1),
  position('l3-m10', 122, 138, 1),
  position('l3-m11', 174, 138, 1),
  position('l3-m12', 226, 138, 1),
  position('l3-m13', 96, 60, 2),
  position('l3-m14', 148, 60, 2),
  position('l3-m15', 200, 60, 2),
  position('l3-m16', 96, 112, 2),
  position('l3-m17', 148, 112, 2),
  position('l3-m18', 200, 112, 2),
  position('l3-m19', 96, 164, 2),
  position('l3-m20', 148, 164, 2),
  position('l3-m21', 200, 164, 2),
  position('l3-m22', 70, 42, 3),
  position('l3-m23', 122, 42, 3),
  position('l3-m24', 174, 42, 3),
  position('l3-m25', 226, 42, 3),
  position('l3-m26', 70, 120, 3),
  position('l3-m27', 122, 120, 3),
  position('l3-m28', 174, 120, 3),
  position('l3-m29', 226, 120, 3),
  position('l3-m30', 96, 70, 4),
  position('l3-m31', 148, 70, 4),
  position('l3-m32', 200, 70, 4),
  position('l3-m33', 122, 148, 4),
  position('l3-m34', 174, 148, 4),

  // Two short secondary columns form partially independent routes.
  position('l3-m35', 44, 218, 1),
  position('l3-m36', 47, 214, 2),
  position('l3-m37', 50, 210, 3),
  position('l3-m38', 248, 218, 1),
  position('l3-m39', 251, 214, 2),
  position('l3-m40', 254, 210, 3),

  // Six-deep side stacks show their layered edges and open two excavation routes.
  position('l3-x01', 4, 116, 1, 'auxiliary'),
  position('l3-x02', 7, 112, 2, 'auxiliary'),
  position('l3-x03', 10, 108, 3, 'auxiliary'),
  position('l3-x04', 13, 104, 4, 'auxiliary'),
  position('l3-x05', 16, 100, 5, 'auxiliary'),
  position('l3-x06', 19, 96, 6, 'auxiliary'),
  position('l3-x07', 280, 116, 1, 'auxiliary'),
  position('l3-x08', 277, 112, 2, 'auxiliary'),
  position('l3-x09', 274, 108, 3, 'auxiliary'),
  position('l3-x10', 271, 104, 4, 'auxiliary'),
  position('l3-x11', 268, 100, 5, 'auxiliary'),
  position('l3-x12', 265, 96, 6, 'auxiliary'),

  // A compact seven-deep blind stack anchors the lower center.
  position('l3-q01', 150, 218, 1, 'blind'),
  position('l3-q02', 153, 214, 2, 'blind'),
  position('l3-q03', 156, 210, 3, 'blind'),
  position('l3-q04', 159, 206, 4, 'blind'),
  position('l3-q05', 162, 202, 5, 'blind'),
  position('l3-q06', 165, 198, 6, 'blind'),
  position('l3-q07', 168, 194, 7, 'blind'),
];

export function positionsOverlap(first: Pick<LevelPosition, 'x' | 'y'>, second: Pick<LevelPosition, 'x' | 'y'>): boolean {
  return first.x < second.x + LEVEL_3_TILE_SIZE
    && first.x + LEVEL_3_TILE_SIZE > second.x
    && first.y < second.y + LEVEL_3_TILE_SIZE
    && first.y + LEVEL_3_TILE_SIZE > second.y;
}

export const LEVEL_3_LAYOUT: readonly LevelPosition[] = POSITION_SEEDS.map((tile) => ({
  ...tile,
  blockedBy: POSITION_SEEDS
    .filter((candidate) => candidate.layer > tile.layer && positionsOverlap(tile, candidate))
    .map((candidate) => candidate.id),
}));

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
