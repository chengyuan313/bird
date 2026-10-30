import { BIRD_CATALOG, LEGACY_GAMEPLAY_COMPOSITIONS, LEVEL_2_ADDITIONAL_COMPOSITIONS, SCORE_BY_LENGTH, compositionForBird } from './birdCatalog';
import type { BirdComposition } from './types';

/** Changing the playable spellings or their meanings requires a new rules version. */
export const RECOGNITION_REGISTRY_VERSION = 'global-recognition-v4.1.0';

const legacyLittleEgret = LEGACY_GAMEPLAY_COMPOSITIONS.find((bird) => bird.id === 'bird:xiaobailu');
const sparrowAlias = LEVEL_2_ADDITIONAL_COMPOSITIONS.find((bird) => bird.id === 'composition:maque');
if (!legacyLittleEgret || !sparrowAlias) throw new Error('Missing reviewed legacy spelling');

/** 斑鸠 is a reviewed group name, never an individual species discovery. */
const doveGroup: BirdComposition = {
  id: 'composition:banjiu',
  classification: 'group',
  speciesId: null,
  name: '斑鸠',
  characters: ['斑', '鸠'],
  score: SCORE_BY_LENGTH[2],
  assetKey: 'banjiu-group',
  provenance: 'V4.1 product review: playable group name; no biological species identity',
};

export const GLOBAL_BIRD_COMPOSITIONS: readonly BirdComposition[] = [
  ...BIRD_CATALOG.map(compositionForBird),
  legacyLittleEgret,
  sparrowAlias,
  doveGroup,
];

export function validateRecognitionRegistry(compositions: readonly BirdComposition[]): void {
  const ids = new Set<string>();
  const spellings = new Set<string>();
  const canonicalSpecies = new Set<string>();
  const knownSpecies = new Set(BIRD_CATALOG.map((bird) => bird.id));
  for (const composition of compositions) {
    if (ids.has(composition.id)) throw new Error(`Duplicate composition ID: ${composition.id}`);
    ids.add(composition.id);
    if (spellings.has(composition.name)) throw new Error(`Ambiguous playable spelling: ${composition.name}`);
    spellings.add(composition.name);
    if (composition.characters.join('') !== composition.name) throw new Error(`Invalid characters: ${composition.id}`);
    if (composition.score !== SCORE_BY_LENGTH[composition.characters.length]) throw new Error(`Invalid score: ${composition.id}`);
    if (!composition.provenance) throw new Error(`Missing provenance: ${composition.id}`);
    if (composition.classification === 'group') {
      if (composition.speciesId !== null) throw new Error(`Group has species identity: ${composition.id}`);
    } else {
      if (!composition.speciesId || !knownSpecies.has(composition.speciesId)) throw new Error(`Unknown species identity: ${composition.id}`);
      if (composition.classification === 'canonical') {
        if (composition.id !== composition.speciesId || canonicalSpecies.has(composition.speciesId)) throw new Error(`Duplicate canonical species: ${composition.id}`);
        canonicalSpecies.add(composition.speciesId);
      }
    }
  }
}

validateRecognitionRegistry(GLOBAL_BIRD_COMPOSITIONS);
