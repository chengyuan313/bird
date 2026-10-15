import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BIRD_CATALOG, LEGACY_GAMEPLAY_BIRD_CATALOG, LEGACY_GAMEPLAY_COMPOSITIONS, LEVEL_2_COMPOSITIONS, LEVEL_2_SPECIES_CATALOG } from '../src/core/birdCatalog';
import {
  FUTURE_90_TILE_CONSTRAINTS,
  characterOverlap,
  sampleBirdContent,
} from '../src/core/contentSampler';

const ORIGINAL_IDS = [
  'bird:xique',
  'bird:huixique',
  'bird:bailu',
  'bird:dabailu',
  'bird:xiaobailu',
  'bird:canglu',
  'bird:yelu',
  'bird:chilu',
  'bird:hongsun',
  'bird:baitoubei',
  'bird:heishuiji',
  'bird:zhujingbanjiu',
  'bird:shanbanjiu',
  'bird:hongfujinji',
  'bird:daisheng',
  'bird:shumaque',
] as const;

describe('canonical Bird Catalog V2', () => {
  it('contains 100 canonical biological species', () => {
    expect(BIRD_CATALOG).toHaveLength(100);
  });

  it.each([
    ['IDs', BIRD_CATALOG.map((bird) => bird.id)],
    ['asset keys', BIRD_CATALOG.map((bird) => bird.assetKey)],
    ['gameplay names', BIRD_CATALOG.map((bird) => bird.name)],
    ['scientific names', BIRD_CATALOG.map((bird) => bird.scientificName)],
  ])('has unique %s', (_label, values) => {
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps every original ID and asset key stable in the frozen gameplay catalog', () => {
    expect(LEGACY_GAMEPLAY_BIRD_CATALOG.map((bird) => bird.id)).toEqual(ORIGINAL_IDS);
    for (const bird of LEGACY_GAMEPLAY_BIRD_CATALOG) {
      expect(bird.id).toBe(`bird:${bird.assetKey}`);
    }
  });

  it('stores characters, counts, scientific names, sources, and research-only aliases', () => {
    for (const bird of BIRD_CATALOG) {
      expect(bird.characters).toEqual(Array.from(bird.name));
      expect(bird.characterCount).toBe(Array.from(bird.name).length);
      expect(bird.scientificName.trim()).not.toBe('');
      expect(bird.source).toContain('IOC World Bird List');
      expect(bird.aliases ?? []).not.toContain(bird.name);
    }
  });

  it('models 小白鹭 only as the legacy gameplay alias of canonical 白鹭', () => {
    const canonical = BIRD_CATALOG.find((bird) => bird.id === 'bird:bailu')!;
    const legacy = LEGACY_GAMEPLAY_BIRD_CATALOG.find((bird) => bird.id === 'bird:xiaobailu')!;
    expect(BIRD_CATALOG.some((bird) => bird.id === legacy.id)).toBe(false);
    expect(canonical).toMatchObject({ scientificName: 'Egretta garzetta', aliases: ['小白鹭'] });
    expect(legacy).toMatchObject({
      name: '小白鹭',
      scientificName: 'Egretta garzetta',
      legacyOnly: true,
      canonicalBirdId: canonical.id,
    });
  });

  it('does not duplicate a species through an alias', () => {
    const names = new Set(BIRD_CATALOG.map((bird) => bird.name));
    for (const bird of BIRD_CATALOG) {
      for (const alias of bird.aliases ?? []) expect(names.has(alias)).toBe(false);
    }
  });

  it('keeps biological IDs separate from unique playable spelling IDs', () => {
    expect(LEGACY_GAMEPLAY_COMPOSITIONS.map((composition) => composition.id)).toEqual(ORIGINAL_IDS);
    expect(new Set(LEVEL_2_COMPOSITIONS.map((composition) => composition.id)).size).toBe(LEVEL_2_COMPOSITIONS.length);
    expect(new Set(LEVEL_2_SPECIES_CATALOG.map((bird) => bird.id)).size).toBe(LEVEL_2_SPECIES_CATALOG.length);
    for (const composition of LEVEL_2_COMPOSITIONS) {
      expect(BIRD_CATALOG.some((bird) => bird.id === composition.speciesId)).toBe(true);
      expect(composition.characters).toEqual(Array.from(composition.name));
      expect(composition.score).toBe(composition.characters.length === 2 ? 10 : composition.characters.length === 3 ? 30 : 70);
    }
    expect(LEVEL_2_COMPOSITIONS.find((composition) => composition.id === 'bird:xiaobailu')?.speciesId).toBe('bird:bailu');
    expect(LEVEL_2_COMPOSITIONS.find((composition) => composition.id === 'composition:maque')?.speciesId).toBe('bird:shumaque');
    expect(LEVEL_2_COMPOSITIONS.find((composition) => composition.id === 'bird:shanmaque')?.speciesId).toBe('bird:shanmaque');
  });

  it('keeps the artwork-planning JSON export synchronized', () => {
    const exported = JSON.parse(readFileSync(
      new URL('../docs/bird-catalog.json', import.meta.url),
      'utf8',
    ));
    expect(exported).toEqual(BIRD_CATALOG.map((bird) => ({
      ...bird,
      aliases: bird.aliases ?? [],
    })));
  });

  it('counts shared characters with multiplicity', () => {
    const first = { ...BIRD_CATALOG[0], characters: ['白', '白', '鹭'] };
    const second = { ...BIRD_CATALOG[1], characters: ['白', '白', '鸟'] };
    expect(characterOverlap(first, second)).toBe(2);
  });
});

describe('canonical content sampler', () => {
  it('is deterministic for the same seed and diverse across different seeds', () => {
    const first = sampleBirdContent(42, FUTURE_90_TILE_CONSTRAINTS);
    const repeated = sampleBirdContent(42, FUTURE_90_TILE_CONSTRAINTS);
    const different = sampleBirdContent(43, FUTURE_90_TILE_CONSTRAINTS);
    expect(first).toEqual(repeated);
    expect(first.ok && different.ok).toBe(true);
    if (first.ok && different.ok) {
      expect(first.value.sampledBirdIds).not.toEqual(different.value.sampledBirdIds);
    }
  });

  it('respects tile, diversity, repetition, family, and overlap constraints', () => {
    const result = sampleBirdContent(17, FUTURE_90_TILE_CONSTRAINTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.characters).toHaveLength(90);
    expect(result.value.distinctSpecies).toBeGreaterThanOrEqual(20);
    expect(result.value.distinctSpecies).toBeLessThanOrEqual(35);
    expect(Math.max(...Object.values(result.value.speciesCounts))).toBeLessThanOrEqual(2);
    expect(Math.max(...Object.values(result.value.familySpeciesCounts))).toBeLessThanOrEqual(4);
    expect(result.value.overlappingSpeciesPairs).toBeGreaterThanOrEqual(12);
    expect(result.value.overlapPairDensity).toBeLessThanOrEqual(0.2);
    const scientificNames = Object.keys(result.value.speciesCounts).map(
      (id) => BIRD_CATALOG.find((bird) => bird.id === id)!.scientificName,
    );
    expect(new Set(scientificNames).size).toBe(scientificNames.length);
  });

  it('fails impossible constraints explicitly instead of relaxing them', () => {
    expect(sampleBirdContent(1, {
      ...FUTURE_90_TILE_CONSTRAINTS,
      minDistinctSpecies: 101,
    })).toEqual({ ok: false, reason: 'maxDistinctSpecies cannot be lower than minDistinctSpecies' });
    expect(sampleBirdContent(1, {
      ...FUTURE_90_TILE_CONSTRAINTS,
      tileCount: 1000,
    })).toEqual({ ok: false, reason: 'tile count exceeds the configured repetition capacity' });
  });
});
