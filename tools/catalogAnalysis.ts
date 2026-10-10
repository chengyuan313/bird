import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { characterOverlap } from '../src/core/contentSampler';
import type { BirdDefinition } from '../src/core/types';

export interface CatalogGraphAnalysis {
  speciesCount: number;
  uniqueCharacterCount: number;
  nameLengthDistribution: Readonly<Record<string, number>>;
  characterFrequencies: readonly { character: string; species: number; occurrences: number }[];
  overlappingSpeciesPairs: number;
  overlapMultiplicityDistribution: Readonly<Record<string, number>>;
  connectedComponents: number;
  largestComponentSize: number;
  isolatedSpecies: readonly string[];
  highlyConnectedSpecies: readonly { id: string; name: string; degree: number }[];
  shortLongExamples: readonly { short: string; long: string; sharedCharacters: number }[];
}

export function analyzeCatalog(catalog: readonly BirdDefinition[] = BIRD_CATALOG): CatalogGraphAnalysis {
  const adjacency = new Map(catalog.map((bird) => [bird.id, new Set<string>()]));
  const overlapMultiplicityDistribution: Record<string, number> = {};
  let overlappingSpeciesPairs = 0;
  for (let index = 0; index < catalog.length; index += 1) {
    for (let candidate = index + 1; candidate < catalog.length; candidate += 1) {
      const overlap = characterOverlap(catalog[index], catalog[candidate]);
      if (overlap === 0) continue;
      overlappingSpeciesPairs += 1;
      overlapMultiplicityDistribution[String(overlap)] = (overlapMultiplicityDistribution[String(overlap)] ?? 0) + 1;
      adjacency.get(catalog[index].id)!.add(catalog[candidate].id);
      adjacency.get(catalog[candidate].id)!.add(catalog[index].id);
    }
  }

  const birdById = new Map(catalog.map((bird) => [bird.id, bird]));
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const bird of catalog) {
    if (visited.has(bird.id)) continue;
    const component: string[] = [];
    const pending = [bird.id];
    visited.add(bird.id);
    while (pending.length > 0) {
      const id = pending.pop()!;
      component.push(id);
      for (const neighbor of adjacency.get(id)!) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }
    components.push(component);
  }

  const characterData = new Map<string, { species: number; occurrences: number }>();
  for (const bird of catalog) {
    const perBird = new Map<string, number>();
    for (const character of bird.characters) perBird.set(character, (perBird.get(character) ?? 0) + 1);
    for (const [character, occurrences] of perBird) {
      const current = characterData.get(character) ?? { species: 0, occurrences: 0 };
      characterData.set(character, {
        species: current.species + 1,
        occurrences: current.occurrences + occurrences,
      });
    }
  }

  const shortLongExamples: CatalogGraphAnalysis['shortLongExamples'][number][] = [];
  for (const short of catalog.filter((bird) => bird.characterCount === 2)) {
    for (const long of catalog.filter((bird) => bird.characterCount === 4)) {
      const sharedCharacters = characterOverlap(short, long);
      if (sharedCharacters > 0) shortLongExamples.push({ short: short.name, long: long.name, sharedCharacters });
    }
  }
  shortLongExamples.sort((first, second) => second.sharedCharacters - first.sharedCharacters
    || first.short.localeCompare(second.short, 'zh-CN')
    || first.long.localeCompare(second.long, 'zh-CN'));

  const lengthDistribution = catalog.reduce<Record<string, number>>((counts, bird) => {
    counts[String(bird.characterCount)] = (counts[String(bird.characterCount)] ?? 0) + 1;
    return counts;
  }, {});

  return {
    speciesCount: catalog.length,
    uniqueCharacterCount: characterData.size,
    nameLengthDistribution: lengthDistribution,
    characterFrequencies: [...characterData.entries()]
      .map(([character, counts]) => ({ character, ...counts }))
      .sort((first, second) => second.species - first.species
        || second.occurrences - first.occurrences
        || first.character.localeCompare(second.character, 'zh-CN')),
    overlappingSpeciesPairs,
    overlapMultiplicityDistribution,
    connectedComponents: components.length,
    largestComponentSize: Math.max(...components.map((component) => component.length)),
    isolatedSpecies: catalog.filter((bird) => adjacency.get(bird.id)!.size === 0).map((bird) => bird.name),
    highlyConnectedSpecies: catalog
      .map((bird) => ({ id: bird.id, name: bird.name, degree: adjacency.get(bird.id)!.size }))
      .sort((first, second) => second.degree - first.degree || first.name.localeCompare(second.name, 'zh-CN'))
      .slice(0, 10),
    shortLongExamples: shortLongExamples.slice(0, 8),
  };
}

export function birdById(id: string): BirdDefinition {
  const bird = BIRD_CATALOG.find((candidate) => candidate.id === id);
  if (!bird) throw new Error(`Unknown canonical bird: ${id}`);
  return bird;
}
