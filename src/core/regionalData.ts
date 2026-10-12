import { BIRD_CATALOG } from './birdCatalog';
import review from '../../data/regional-review.json';
import expansion from '../../data/regional-review-v6.1.json';

export const REGIONAL_CONTENT_VERSION = 'regional-content-v6.1.0';
export const BEIJING_CONTENT_VERSION = 'regional-content-v6.0.0';
export const BEIJING_SOURCE = review.source;

export interface RegionalSource {
  id: string;
  kind: 'official-list' | 'peer-reviewed-local-survey' | 'peer-reviewed-provincial-checklist';
  publisher: string;
  title: string;
  url: string;
  version: string;
  scope: string;
  rightsNote: string;
  reviewedAt: string;
}

export const REGIONAL_SOURCES: readonly RegionalSource[] = [
  { id: 'bj-2025', kind: 'official-list', publisher: '北京市园林绿化局', title: review.sourceName, url: review.source,
    version: review.sourceVersion, scope: '北京市', rightsNote: review.rightsNote, reviewedAt: review.reviewedAt },
  ...expansion.sources.map((source) => ({ ...source, kind: source.kind as RegionalSource['kind'] })),
];

export type RegionCategory = 'province' | 'autonomous-region' | 'municipality' | 'special-administrative-region' | 'taiwan';
export type RegionStatus = 'playable' | 'pending';
export interface RegionRecord {
  id: string;
  name: string;
  category: RegionCategory;
  status: RegionStatus;
  curatedPlayableSpeciesCount: number;
  contentVersion: string;
  source: string | null;
  verifiedAt: string | null;
  crosswalk: { iso3166_2: string; gbifStateProvince: string | null; gadmGid: string | null };
}

const definitions: readonly [string, string, RegionCategory, string | null][] = [
  ['CN-BJ', '北京', 'municipality', 'Beijing'], ['CN-TJ', '天津', 'municipality', null],
  ['CN-HE', '河北', 'province', null], ['CN-SX', '山西', 'province', null],
  ['CN-NM', '内蒙古', 'autonomous-region', null], ['CN-LN', '辽宁', 'province', 'Liaoning'],
  ['CN-JL', '吉林', 'province', null], ['CN-HL', '黑龙江', 'province', null],
  ['CN-SH', '上海', 'municipality', null], ['CN-JS', '江苏', 'province', null],
  ['CN-ZJ', '浙江', 'province', null], ['CN-AH', '安徽', 'province', null],
  ['CN-FJ', '福建', 'province', null], ['CN-JX', '江西', 'province', null],
  ['CN-SD', '山东', 'province', null], ['CN-HA', '河南', 'province', null],
  ['CN-HB', '湖北', 'province', null], ['CN-HN', '湖南', 'province', null],
  ['CN-GD', '广东', 'province', 'Guangdong'], ['CN-GX', '广西', 'autonomous-region', null],
  ['CN-HI', '海南', 'province', null], ['CN-CQ', '重庆', 'municipality', null],
  ['CN-SC', '四川', 'province', 'Sichuan'], ['CN-GZ', '贵州', 'province', null],
  ['CN-YN', '云南', 'province', 'Yunnan'], ['CN-XZ', '西藏', 'autonomous-region', null],
  ['CN-SN', '陕西', 'province', null], ['CN-GS', '甘肃', 'province', null],
  ['CN-QH', '青海', 'province', null], ['CN-NX', '宁夏', 'autonomous-region', null],
  ['CN-XJ', '新疆', 'autonomous-region', null], ['CN-HK', '香港', 'special-administrative-region', null],
  ['CN-MO', '澳门', 'special-administrative-region', null], ['CN-TW', '台湾', 'taiwan', null],
];

const playableRegionIds = new Set(['CN-BJ', 'CN-LN', 'CN-GD', 'CN-SC', 'CN-YN']);

/** ISO codes are internal identities. GBIF stateProvince is an untrusted source text filter, never a geocode. */
export const REGIONS: readonly RegionRecord[] = definitions.map(([id, name, category, gbifStateProvince]) => ({
  id, name, category,
  status: playableRegionIds.has(id) ? 'playable' : 'pending',
  curatedPlayableSpeciesCount: review.accepted.filter((item) => item.regionId === id).length + expansion.accepted.filter((item) => item[0] === id).length,
  contentVersion: id === 'CN-BJ' ? BEIJING_CONTENT_VERSION : REGIONAL_CONTENT_VERSION,
  source: REGIONAL_SOURCES.find((source) => id === 'CN-BJ' ? source.id === 'bj-2025' : expansion.accepted.some((entry) => entry[0] === id && entry[4] === source.id))?.url ?? null,
  verifiedAt: playableRegionIds.has(id) ? expansion.reviewedAt : null,
  crosswalk: { iso3166_2: id, gbifStateProvince, gadmGid: null },
}));

export interface RegionalSpeciesEvidence {
  regionId: string;
  speciesId: string;
  acceptedName: string;
  scientificName: string;
  sourceId: string;
  evidenceReference: string;
  sourceRow: number;
  sourceName: string;
  sourceVersion: string;
  license: string;
  geographicReview: RegionalSource['kind'];
  editorialStatus: 'ACCEPTED';
}

/** Compact human-reviewed manifest; the source list and records are not bundled. */
export const REGIONAL_SPECIES: readonly RegionalSpeciesEvidence[] = [...review.accepted.map((item) => ({
    regionId: item.regionId, speciesId: item.speciesId, acceptedName: item.acceptedName, scientificName: item.scientificName,
    sourceId: 'bj-2025', evidenceReference: BEIJING_SOURCE, sourceRow: item.sourceRow, sourceName: review.sourceName,
    sourceVersion: review.sourceVersion, license: review.rightsNote,
    geographicReview: 'official-list', editorialStatus: 'ACCEPTED',
} as RegionalSpeciesEvidence)), ...expansion.accepted.map(([regionId, speciesId, acceptedName, scientificName, sourceId, sourceRow]) => {
  const source = REGIONAL_SOURCES.find((item) => item.id === sourceId);
  return { regionId: String(regionId), speciesId: String(speciesId), acceptedName: String(acceptedName), scientificName: String(scientificName),
    sourceId: String(sourceId), evidenceReference: source?.url ?? '', sourceRow: Number(sourceRow), sourceName: source?.title ?? '',
    sourceVersion: source?.version ?? '', license: source?.rightsNote ?? '', geographicReview: source?.kind ?? 'official-list',
    editorialStatus: 'ACCEPTED' as const };
})];

export const EDITORIAL_QUEUE = [...review.editorialQueue.filter((item) => item.status !== 'SOURCE_REVIEW_PENDING'), ...expansion.editorialQueue];

export function speciesForRegion(regionId: string): readonly RegionalSpeciesEvidence[] {
  return REGIONAL_SPECIES.filter((item) => item.regionId === regionId && item.editorialStatus === 'ACCEPTED');
}

export function validateRegionalData(): void {
  if (review.schemaVersion !== 'regional-review-v6.0.0') throw new Error('Unsupported review schema');
  if (expansion.schemaVersion !== 'regional-review-v6.1.0') throw new Error('Unsupported expansion schema');
  if (REGIONS.length !== 34 || new Set(REGIONS.map((region) => region.id)).size !== 34) throw new Error('Expected 34 unique regions');
  const ids = new Set(REGIONS.map((region) => region.id));
  validateRegionalEvidence(REGIONAL_SPECIES, REGIONAL_SOURCES);
  for (const region of REGIONS) {
    if (region.crosswalk.iso3166_2 !== region.id) throw new Error(`Invalid region crosswalk: ${region.id}`);
    if (region.curatedPlayableSpeciesCount !== speciesForRegion(region.id).length) throw new Error(`Invalid species count: ${region.id}`);
    if ((region.status === 'playable') !== (region.curatedPlayableSpeciesCount > 0)) throw new Error(`Invalid availability: ${region.id}`);
    if (region.status === 'playable' && (!region.source || !region.verifiedAt)) throw new Error(`Missing region verification: ${region.id}`);
    if (region.status === 'pending' && region.verifiedAt !== null) throw new Error(`Pending region marked verified: ${region.id}`);
  }
}

/** Validates candidate manifests before they can be accepted into regional gameplay. */
export function validateRegionalEvidence(entries: readonly RegionalSpeciesEvidence[], sources: readonly RegionalSource[]): void {
  const ids = new Set(definitions.map(([id]) => id));
  const species = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  if (sourceMap.size !== sources.length) throw new Error('Duplicate regional source ID');
  for (const source of sources) {
    if (!source.id || !['official-list', 'peer-reviewed-local-survey', 'peer-reviewed-provincial-checklist'].includes(source.kind) || !source.publisher || !source.title || !source.url.startsWith('https://') || !source.version || !source.scope || !source.rightsNote || !source.reviewedAt) throw new Error(`Incomplete regional source: ${source.id}`);
  }
  const pairs = new Set<string>();
  for (const item of entries) {
    const pair = `${item.regionId}/${item.speciesId}`;
    if (pairs.has(pair) || !ids.has(item.regionId)) throw new Error(`Duplicate or unknown regional species: ${pair}`);
    pairs.add(pair);
    const reviewed = species.get(item.speciesId);
    if (!reviewed || reviewed.name !== item.acceptedName || reviewed.scientificName !== item.scientificName) throw new Error(`Taxonomic mismatch: ${pair}`);
    const source = sourceMap.get(item.sourceId);
    if (!source || item.evidenceReference !== source.url || item.sourceVersion !== source.version || item.license !== source.rightsNote || item.geographicReview !== source.kind || !Number.isSafeInteger(item.sourceRow) || item.sourceRow < 1 || item.editorialStatus !== 'ACCEPTED') throw new Error(`Unreviewed evidence: ${pair}`);
  }
}

validateRegionalData();
