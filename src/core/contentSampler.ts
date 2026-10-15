import { BIRD_CATALOG } from './birdCatalog';
import { createSeededRandom, fisherYates } from './level3Generator';
import type { BirdDefinition } from './types';

export interface SharedCharacterTargets {
  minimumOverlappingSpeciesPairs?: number;
  maximumOverlapPairDensity?: number;
}

export interface ContentSamplingConstraints {
  tileCount: number;
  minDistinctSpecies: number;
  maxDistinctSpecies?: number;
  maxSpeciesOccurrences: number;
  maxSpeciesPerFamily?: number;
  sharedCharacterTargets?: SharedCharacterTargets;
}

export interface SampledBirdContent {
  seed: number;
  sampledBirdIds: readonly string[];
  speciesCounts: Readonly<Record<string, number>>;
  familySpeciesCounts: Readonly<Record<string, number>>;
  characters: readonly string[];
  distinctSpecies: number;
  overlappingSpeciesPairs: number;
  overlapPairDensity: number;
}

export type ContentSamplingResult =
  | { ok: true; value: SampledBirdContent }
  | { ok: false; reason: string };

export const FUTURE_90_TILE_CONSTRAINTS: ContentSamplingConstraints = {
  tileCount: 90,
  minDistinctSpecies: 20,
  maxDistinctSpecies: 35,
  maxSpeciesOccurrences: 2,
  maxSpeciesPerFamily: 4,
  sharedCharacterTargets: {
    minimumOverlappingSpeciesPairs: 12,
    maximumOverlapPairDensity: 0.2,
  },
};

// A deliberately familiar-first subset of the verified canonical catalog. The final
// eight entries add less familiar names for discovery without dominating a board.
export const BEGINNER_FAMILIAR_BIRD_IDS = [
  'bird:xique', 'bird:huixique', 'bird:bailu', 'bird:dabailu',
  'bird:canglu', 'bird:yelu', 'bird:hongsun', 'bird:heishuiji',
  'bird:shanbanjiu', 'bird:hongfujinji', 'bird:daisheng', 'bird:shumaque',
  'bird:jiayan', 'bird:yunque', 'bird:wudong', 'bird:bage',
  'bird:dashanque', 'bird:huangque', 'bird:jinchique', 'bird:yousun',
  'bird:anchun', 'bird:lutouya', 'bird:yuanyang', 'bird:datiane',
  'bird:dandinghe', 'bird:baihe', 'bird:hongzuiou', 'bird:huamei',
] as const;

export const BEGINNER_DISCOVERY_BIRD_IDS = [
  'bird:baiyaoyuyan', 'bird:baijiling', 'bird:putongcuiniao',
  'bird:baizhenhe', 'bird:heiguan', 'bird:putongluci',
  'bird:zongbeibolao', 'bird:beihongweiqu',
] as const;

const beginnerIds = new Set<string>([
  ...BEGINNER_FAMILIAR_BIRD_IDS,
  ...BEGINNER_DISCOVERY_BIRD_IDS,
]);
export const BEGINNER_LEVEL_3_CATALOG: readonly BirdDefinition[] = BIRD_CATALOG.filter(
  (bird) => beginnerIds.has(bird.id),
);

export const BEGINNER_90_TILE_CONSTRAINTS: ContentSamplingConstraints = {
  tileCount: 90,
  minDistinctSpecies: 18,
  maxDistinctSpecies: 22,
  maxSpeciesOccurrences: 3,
  maxSpeciesPerFamily: 3,
  sharedCharacterTargets: {
    minimumOverlappingSpeciesPairs: 6,
    maximumOverlapPairDensity: 0.25,
  },
};

function characterCounts(characters: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const character of characters) counts.set(character, (counts.get(character) ?? 0) + 1);
  return counts;
}

/** Counts shared characters with multiplicity, e.g. 白白鹭 and 白鹭 overlap by two. */
export function characterOverlap(first: BirdDefinition, second: BirdDefinition): number {
  const firstCounts = characterCounts(first.characters);
  const secondCounts = characterCounts(second.characters);
  return [...firstCounts.entries()].reduce(
    (total, [character, amount]) => total + Math.min(amount, secondCounts.get(character) ?? 0),
    0,
  );
}

export function countOverlappingSpeciesPairs(birds: readonly BirdDefinition[]): number {
  let pairs = 0;
  for (let index = 0; index < birds.length; index += 1) {
    for (let candidate = index + 1; candidate < birds.length; candidate += 1) {
      if (characterOverlap(birds[index], birds[candidate]) > 0) pairs += 1;
    }
  }
  return pairs;
}

function overlapPairDensity(birds: readonly BirdDefinition[], overlappingPairs: number): number {
  const possiblePairs = birds.length * (birds.length - 1) / 2;
  return possiblePairs === 0 ? 0 : overlappingPairs / possiblePairs;
}

function validationError(
  constraints: ContentSamplingConstraints,
  catalog: readonly BirdDefinition[],
): string | undefined {
  if (!Number.isInteger(constraints.tileCount) || constraints.tileCount <= 0) {
    return 'tileCount must be a positive integer';
  }
  if (!Number.isInteger(constraints.minDistinctSpecies) || constraints.minDistinctSpecies <= 0) {
    return 'minDistinctSpecies must be a positive integer';
  }
  if (!Number.isInteger(constraints.maxSpeciesOccurrences) || constraints.maxSpeciesOccurrences <= 0) {
    return 'maxSpeciesOccurrences must be a positive integer';
  }
  const maximumDistinct = constraints.maxDistinctSpecies ?? catalog.length;
  if (maximumDistinct < constraints.minDistinctSpecies) {
    return 'maxDistinctSpecies cannot be lower than minDistinctSpecies';
  }
  const familyCap = constraints.maxSpeciesPerFamily ?? catalog.length;
  if (!Number.isInteger(familyCap) || familyCap <= 0) {
    return 'maxSpeciesPerFamily must be a positive integer';
  }
  const availableByFamily = new Map<string, number>();
  for (const bird of catalog) {
    availableByFamily.set(bird.family, Math.min(familyCap, (availableByFamily.get(bird.family) ?? 0) + 1));
  }
  const availableDistinct = [...availableByFamily.values()].reduce((sum, amount) => sum + amount, 0);
  if (constraints.minDistinctSpecies > Math.min(catalog.length, availableDistinct)) {
    return 'minimum species diversity exceeds the eligible catalog';
  }
  const shortest = [...catalog]
    .sort((first, second) => first.characterCount - second.characterCount)
    .slice(0, constraints.minDistinctSpecies)
    .reduce((sum, bird) => sum + bird.characterCount, 0);
  if (shortest > constraints.tileCount) return 'minimum species diversity exceeds the tile budget';
  const largestCapacity = [...catalog]
    .sort((first, second) => second.characterCount - first.characterCount)
    .slice(0, Math.min(maximumDistinct, availableDistinct))
    .reduce((sum, bird) => sum + bird.characterCount * constraints.maxSpeciesOccurrences, 0);
  if (largestCapacity < constraints.tileCount) return 'tile count exceeds the configured repetition capacity';
  const density = constraints.sharedCharacterTargets?.maximumOverlapPairDensity;
  if (density !== undefined && (density < 0 || density > 1)) {
    return 'maximumOverlapPairDensity must be between 0 and 1';
  }
  return undefined;
}

function chooseCounts(
  selected: readonly BirdDefinition[],
  remainingTiles: number,
  maxSpeciesOccurrences: number,
  random: () => number,
): readonly number[] | undefined {
  let states = new Map<number, readonly number[]>([[0, []]]);
  for (const bird of selected) {
    const next = new Map<number, readonly number[]>();
    const extras = fisherYates(
      Array.from({ length: maxSpeciesOccurrences }, (_, amount) => amount),
      random,
    );
    for (const [total, counts] of states) {
      for (const extra of extras) {
        const nextTotal = total + extra * bird.characterCount;
        if (nextTotal <= remainingTiles && !next.has(nextTotal)) {
          next.set(nextTotal, [...counts, extra + 1]);
        }
      }
    }
    states = next;
  }
  return states.get(remainingTiles);
}

export function sampleBirdContent(
  seed: number,
  constraints: ContentSamplingConstraints,
  catalog: readonly BirdDefinition[] = BIRD_CATALOG,
): ContentSamplingResult {
  const invalid = validationError(constraints, catalog);
  if (invalid) return { ok: false, reason: invalid };

  const random = createSeededRandom(seed ^ 0x6c8e9cf5);
  const maximumDistinct = Math.min(constraints.maxDistinctSpecies ?? catalog.length, catalog.length);
  const familyCap = constraints.maxSpeciesPerFamily ?? catalog.length;
  const targets = constraints.sharedCharacterTargets;

  for (let attempt = 0; attempt < 4096; attempt += 1) {
    const targetDistinct = constraints.minDistinctSpecies
      + Math.floor(random() * (maximumDistinct - constraints.minDistinctSpecies + 1));
    const familyCounts = new Map<string, number>();
    const selected: BirdDefinition[] = [];
    for (const bird of fisherYates(catalog, random)) {
      const familyCount = familyCounts.get(bird.family) ?? 0;
      if (familyCount >= familyCap) continue;
      selected.push(bird);
      familyCounts.set(bird.family, familyCount + 1);
      if (selected.length === targetDistinct) break;
    }
    if (selected.length !== targetDistinct) continue;

    const baseTiles = selected.reduce((sum, bird) => sum + bird.characterCount, 0);
    const maximumTiles = baseTiles * constraints.maxSpeciesOccurrences;
    if (baseTiles > constraints.tileCount || maximumTiles < constraints.tileCount) continue;

    const overlappingPairs = countOverlappingSpeciesPairs(selected);
    const density = overlapPairDensity(selected, overlappingPairs);
    if (targets?.minimumOverlappingSpeciesPairs !== undefined
      && overlappingPairs < targets.minimumOverlappingSpeciesPairs) continue;
    if (targets?.maximumOverlapPairDensity !== undefined
      && density > targets.maximumOverlapPairDensity) continue;

    const counts = chooseCounts(
      selected,
      constraints.tileCount - baseTiles,
      constraints.maxSpeciesOccurrences,
      random,
    );
    if (!counts) continue;

    const speciesCounts: Record<string, number> = {};
    const sampledBirdIds: string[] = [];
    const characters: string[] = [];
    selected.forEach((bird, index) => {
      const amount = counts[index];
      speciesCounts[bird.id] = amount;
      for (let occurrence = 0; occurrence < amount; occurrence += 1) {
        sampledBirdIds.push(bird.id);
        characters.push(...bird.characters);
      }
    });
    return {
      ok: true,
      value: {
        seed,
        sampledBirdIds,
        speciesCounts,
        familySpeciesCounts: Object.fromEntries(familyCounts),
        characters: fisherYates(characters, createSeededRandom(seed)),
        distinctSpecies: selected.length,
        overlappingSpeciesPairs: overlappingPairs,
        overlapPairDensity: density,
      },
    };
  }

  return { ok: false, reason: 'No bird content pool satisfies all configured constraints' };
}
