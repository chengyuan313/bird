import Sichuan from '../../data/regional-v7-sichuan.json';
import { BIRD_CATALOG, SCORE_BY_LENGTH } from './birdCatalog';
import type { BirdComposition } from './types';

export const REGIONAL_V7_CONTENT_VERSION = 'regional-content-v7.5.0';
export const REGIONAL_V7_TIERS = [1, 2, 3, 4, 5] as const;
export type RegionalTier = typeof REGIONAL_V7_TIERS[number];
export const REGIONAL_V7_TILE_COUNTS: Readonly<Record<RegionalTier, number>> = { 1: 22, 2: 33, 3: 45, 4: 60, 5: 90 };

export interface SpeciesMasterRecord {
  id: string;
  chineseName: string;
  scientificName: string;
  originalChineseName: string;
  originalScientificName: string;
  nameReview: 'LEGACY_EXACT_MATCH' | 'PROVISIONAL_SOURCE_NAME';
  synonyms: readonly string[];
}

export interface ProvincialMembership {
  regionId: string;
  speciesId: string;
  sourceId: string;
  sourceRow: number;
  sourceUrl: string;
  sourceVersion: string;
  originalChineseName: string;
  originalScientificName: string;
  locality: string | null;
  habitat: string | null;
  habitatSourceUrl: string | null;
  rightsNote: string;
  evidenceConfidence: 'PUBLISHED_PROVINCIAL_CHECKLIST';
  regionalFeature: boolean;
}

export interface PlayableRegionalName {
  id: string;
  speciesId: string;
  name: string;
  characters: readonly string[];
  nameLength: number;
  score: number;
  eligible: true;
  taxonomyState: SpeciesMasterRecord['nameReview'];
}

export interface RegionalDifficultyPool {
  regionId: string;
  tier: RegionalTier;
  speciesIds: readonly string[];
  newlyIntroducedSpeciesIds: readonly string[];
  regionalFeatureSpeciesIds: readonly string[];
  contentVersion: string;
}

const source = Sichuan.source;
const habitatBySpecies = new Map(Sichuan.habitatEvidence.map((item) => [item.speciesId, item]));
type SourceEntry = readonly [string, string, string, number, number, boolean, string];
const entries = Sichuan.entries as unknown as SourceEntry[];

export const REGIONAL_V7_SOURCES = [source] as const;
export const V7_SPECIES_MASTER: readonly SpeciesMasterRecord[] = entries.map(([id, chineseName, scientificName, , , , nameReview]) => ({
  id, chineseName, scientificName, originalChineseName: chineseName, originalScientificName: scientificName,
  nameReview: nameReview as SpeciesMasterRecord['nameReview'], synonyms: [],
}));
export const V7_PROVINCIAL_MEMBERSHIPS: readonly ProvincialMembership[] = entries.map(([speciesId, name, scientificName, sourceRow, , regionalFeature]) => {
  const habitat = habitatBySpecies.get(speciesId);
  return {
    regionId: Sichuan.regionId, speciesId, sourceId: source.id, sourceRow, sourceUrl: source.url,
    sourceVersion: source.version, originalChineseName: name, originalScientificName: scientificName,
    locality: habitat?.locality ?? null, habitat: habitat?.habitat ?? null,
    habitatSourceUrl: habitat?.sourceUrl ?? null, rightsNote: source.rightsNote,
    evidenceConfidence: 'PUBLISHED_PROVINCIAL_CHECKLIST', regionalFeature,
  };
});
export const V7_PLAYABLE_NAMES: readonly PlayableRegionalName[] = V7_SPECIES_MASTER.map((species) => {
  const characters = Array.from(species.chineseName);
  return { id: species.id, speciesId: species.id, name: species.chineseName, characters,
    nameLength: characters.length, score: SCORE_BY_LENGTH[characters.length], eligible: true,
    taxonomyState: species.nameReview };
});
export const V7_DIFFICULTY_POOLS: readonly RegionalDifficultyPool[] = REGIONAL_V7_TIERS.map((tier) => {
  const speciesIds = entries.filter((entry) => entry[4] <= tier).map((entry) => entry[0]);
  const newlyIntroducedSpeciesIds = entries.filter((entry) => entry[4] === tier).map((entry) => entry[0]);
  return { regionId: Sichuan.regionId, tier, speciesIds, newlyIntroducedSpeciesIds,
    regionalFeatureSpeciesIds: entries.filter((entry) => entry[4] <= tier && entry[5]).map((entry) => entry[0]),
    contentVersion: REGIONAL_V7_CONTENT_VERSION };
});

export const V7_REGIONAL_COMPOSITIONS: readonly BirdComposition[] = V7_PLAYABLE_NAMES.map((bird) => ({
  id: bird.id, classification: 'canonical', speciesId: bird.speciesId, name: bird.name,
  characters: bird.characters, score: bird.score, assetKey: bird.id.replace(':', '-'),
  provenance: `${source.id} row ${V7_PROVINCIAL_MEMBERSHIPS.find((item) => item.speciesId === bird.speciesId)!.sourceRow}; ${bird.taxonomyState}`,
}));

export function v7SpeciesForRegion(regionId: string): readonly ProvincialMembership[] {
  return V7_PROVINCIAL_MEMBERSHIPS.filter((item) => item.regionId === regionId);
}

export function v7Pool(regionId: string, tier: RegionalTier): RegionalDifficultyPool | undefined {
  return V7_DIFFICULTY_POOLS.find((pool) => pool.regionId === regionId && pool.tier === tier);
}

export function validateRegionalV7Data(): void {
  if (Sichuan.schemaVersion !== 'regional-v7.5.0' || source.id !== 'sc-checklist-2020' || !source.url.startsWith('https://')) throw new Error('Invalid V7 source');
  if (entries.length !== 100 || new Set(entries.map((entry) => entry[0])).size !== 100 ||
      new Set(entries.map((entry) => entry[1])).size !== 100 || new Set(entries.map((entry) => entry[2])).size !== 100) throw new Error('V7 Sichuan pool needs 100 distinct taxa');
  const legacy = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  for (const [id, name, latin, row, tier, feature, review] of entries) {
    const length = Array.from(name).length;
    if (!/^[\p{Script=Han}]+$/u.test(name) || length < 2 || length > 6 || !/^[A-Z][a-z]+ [a-z]+$/.test(latin) ||
      !Number.isSafeInteger(row) || row < 1 || !REGIONAL_V7_TIERS.includes(tier as RegionalTier) || typeof feature !== 'boolean' ||
      !['LEGACY_EXACT_MATCH', 'PROVISIONAL_SOURCE_NAME'].includes(review)) throw new Error(`Invalid V7 source row ${row}`);
    const old = legacy.get(id);
    if (review === 'LEGACY_EXACT_MATCH' && (!old || old.name !== name || old.scientificName !== latin)) throw new Error(`Invalid legacy identity ${id}`);
    if (review === 'PROVISIONAL_SOURCE_NAME' && (!id.startsWith('species:') || old)) throw new Error(`Invalid provisional identity ${id}`);
  }
  if (entries.filter((entry) => entry[5]).length < 20) throw new Error('Insufficient sourced regional features');
  for (const tier of REGIONAL_V7_TIERS) {
    const pool = v7Pool('CN-SC', tier)!;
    if (pool.speciesIds.length !== tier * 20 || pool.newlyIntroducedSpeciesIds.length !== 20 ||
      new Set(pool.speciesIds).size !== tier * 20) throw new Error(`Invalid V7 tier ${tier}`);
  }
  for (const habitat of Sichuan.habitatEvidence) {
    if (!entries.some((entry) => entry[0] === habitat.speciesId) || !habitat.sourceUrl.startsWith('https://')) throw new Error('Unreviewed habitat evidence');
  }
}

validateRegionalV7Data();
