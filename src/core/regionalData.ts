import { BIRD_CATALOG } from './birdCatalog';
import review from '../../data/regional-review.json';

export const REGIONAL_CONTENT_VERSION = 'regional-content-v6.0.0';
export const BEIJING_SOURCE = review.source;

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

/** Research leads only; pending regions have no approved species from these sources. */
const researchLeads: Readonly<Record<string, string>> = {
  'CN-LN': 'https://www.ln.gov.cn/web/zwgkx/zfwj/szfwj/zfwj2010/BF4D19B9104442B783BED7FC11A838D8/index.shtml',
  'CN-GD': 'https://www.gd.gov.cn/attachment/0/435/435303/3368465.pdf',
  'CN-YN': 'https://lcj.yn.gov.cn/html/2025/zdlyxxgkqt_0922/75325.html',
  'CN-SC': 'https://lcj.sc.gov.cn/scslyt/c1055/2024/5/20/bd4c4810f1c8465fbc3e3b43bd245e80/files/%E8%AF%BA%E6%B0%B4%E6%B2%B3%E4%BF%9D%E6%8A%A4%E5%8C%BA%E5%8A%9F%E8%83%BD%E5%8C%BA%E8%B0%83%E6%95%B4%E8%AE%BA%E8%AF%81%E6%8A%A5%E5%91%8A%E6%8A%A5%E6%89%B9%E7%A8%BF.pdf',
};

/** ISO codes are internal identities. GBIF stateProvince is an untrusted source text filter, never a geocode. */
export const REGIONS: readonly RegionRecord[] = definitions.map(([id, name, category, gbifStateProvince]) => ({
  id, name, category,
  status: id === 'CN-BJ' ? 'playable' : 'pending',
  curatedPlayableSpeciesCount: review.accepted.filter((item) => item.regionId === id).length,
  contentVersion: REGIONAL_CONTENT_VERSION,
  source: id === 'CN-BJ' ? BEIJING_SOURCE : researchLeads[id] ?? null,
  verifiedAt: id === 'CN-BJ' ? review.reviewedAt : null,
  crosswalk: { iso3166_2: id, gbifStateProvince, gadmGid: null },
}));

export interface RegionalSpeciesEvidence {
  regionId: string;
  speciesId: string;
  acceptedName: string;
  scientificName: string;
  evidenceReference: string;
  sourceRow: number;
  sourceName: string;
  sourceVersion: string;
  license: string;
  geographicReview: 'official-regional-list';
  editorialStatus: 'ACCEPTED';
}

/** Compact human-reviewed manifest; the source list and records are not bundled. */
export const REGIONAL_SPECIES: readonly RegionalSpeciesEvidence[] = review.accepted.map((item) => ({
    regionId: item.regionId, speciesId: item.speciesId, acceptedName: item.acceptedName, scientificName: item.scientificName,
    evidenceReference: BEIJING_SOURCE, sourceRow: item.sourceRow, sourceName: review.sourceName,
    sourceVersion: review.sourceVersion, license: review.rightsNote,
    geographicReview: 'official-regional-list', editorialStatus: 'ACCEPTED',
}));

export const EDITORIAL_QUEUE = review.editorialQueue;

export function speciesForRegion(regionId: string): readonly RegionalSpeciesEvidence[] {
  return REGIONAL_SPECIES.filter((item) => item.regionId === regionId && item.editorialStatus === 'ACCEPTED');
}

export function validateRegionalData(): void {
  if (review.schemaVersion !== 'regional-review-v6.0.0') throw new Error('Unsupported review schema');
  if (REGIONS.length !== 34 || new Set(REGIONS.map((region) => region.id)).size !== 34) throw new Error('Expected 34 unique regions');
  const ids = new Set(REGIONS.map((region) => region.id));
  const species = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  for (const region of REGIONS) {
    if (region.crosswalk.iso3166_2 !== region.id) throw new Error(`Invalid region crosswalk: ${region.id}`);
    if (region.curatedPlayableSpeciesCount !== speciesForRegion(region.id).length) throw new Error(`Invalid species count: ${region.id}`);
    if ((region.status === 'playable') !== (region.curatedPlayableSpeciesCount > 0)) throw new Error(`Invalid availability: ${region.id}`);
    if (region.status === 'playable' && (!region.source || !region.verifiedAt)) throw new Error(`Missing region verification: ${region.id}`);
    if (region.status === 'pending' && region.verifiedAt !== null) throw new Error(`Pending region marked verified: ${region.id}`);
  }
  const pairs = new Set<string>();
  for (const item of REGIONAL_SPECIES) {
    const pair = `${item.regionId}/${item.speciesId}`;
    if (pairs.has(pair) || !ids.has(item.regionId)) throw new Error(`Duplicate or unknown regional species: ${pair}`);
    pairs.add(pair);
    const reviewed = species.get(item.speciesId);
    if (!reviewed || reviewed.name !== item.acceptedName || reviewed.scientificName !== item.scientificName) throw new Error(`Taxonomic mismatch: ${pair}`);
    if (!item.evidenceReference || !item.sourceVersion || !item.license || !Number.isSafeInteger(item.sourceRow) || item.editorialStatus !== 'ACCEPTED') throw new Error(`Unreviewed evidence: ${pair}`);
  }
}

validateRegionalData();
