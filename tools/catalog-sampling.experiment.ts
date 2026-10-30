import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  FUTURE_90_TILE_CONSTRAINTS,
  sampleBirdContent,
} from '../src/core/contentSampler';

function summary(values: readonly number[]): { min: number; max: number; average: number } {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

describe('future 90-tile content experiment', () => {
  it('analyzes 100 deterministic content pools without claiming solvability', () => {
    const started = performance.now();
    const distinctSpecies: number[] = [];
    const maximumRepetitions: number[] = [];
    const characterDiversities: number[] = [];
    const sharedCharacterDensities: number[] = [];
    const nameLengthOccurrences: Record<string, number> = {};
    const characterFrequency: Record<string, number> = {};
    let exactTileCountSamples = 0;

    for (let seed = 1; seed <= 100; seed += 1) {
      const result = sampleBirdContent(seed, FUTURE_90_TILE_CONSTRAINTS);
      expect(result.ok, result.ok ? undefined : `seed ${seed}: ${result.reason}`).toBe(true);
      if (!result.ok) continue;
      expect(result).toEqual(sampleBirdContent(seed, FUTURE_90_TILE_CONSTRAINTS));
      const counts = Object.values(result.value.speciesCounts);
      const selected = Object.keys(result.value.speciesCounts)
        .map((id) => BIRD_CATALOG.find((bird) => bird.id === id)!);
      if (result.value.characters.length === 90) exactTileCountSamples += 1;
      distinctSpecies.push(result.value.distinctSpecies);
      maximumRepetitions.push(Math.max(...counts));
      characterDiversities.push(new Set(result.value.characters).size);
      sharedCharacterDensities.push(result.value.overlapPairDensity);
      for (const bird of selected) {
        const amount = result.value.speciesCounts[bird.id];
        nameLengthOccurrences[String(bird.characterCount)] = (nameLengthOccurrences[String(bird.characterCount)] ?? 0) + amount;
      }
      for (const character of result.value.characters) {
        characterFrequency[character] = (characterFrequency[character] ?? 0) + 1;
      }
    }

    const report = {
      seeds: 100,
      exactTileCountSamples,
      distinctSpecies: summary(distinctSpecies),
      maximumSpeciesRepetition: summary(maximumRepetitions),
      chineseCharacterDiversity: summary(characterDiversities),
      sharedCharacterPairDensity: summary(sharedCharacterDensities),
      nameLengthOccurrenceDistribution: nameLengthOccurrences,
      mostFrequentCharacters: Object.entries(characterFrequency)
        .map(([character, occurrences]) => ({ character, occurrences }))
        .sort((first, second) => second.occurrences - first.occurrences
          || first.character.localeCompare(second.character, 'zh-CN'))
        .slice(0, 12),
      runtimeMs: performance.now() - started,
      reproducible: true,
      solvabilityEvaluated: false,
    };
    console.log(JSON.stringify(report, null, 2));
    expect(exactTileCountSamples).toBe(100);
    expect(Math.max(...maximumRepetitions)).toBeLessThanOrEqual(2);
  });
});
