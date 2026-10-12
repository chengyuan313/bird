import { GAMEPLAY_RULESET_VERSION } from './gameEngine';
import { REGIONAL_CONTENT_VERSION } from './regionalData';

export const REGIONAL_STORAGE_KEY = 'bird.regions.v1';
export interface RegionalProgress {
  schemaVersion: 1;
  rulesetVersion: string;
  contentVersion: string;
  lastRegionId: string | null;
  completedPuzzleIds: Record<string, string[]>;
  discoveredSpeciesIds: Record<string, string[]>;
}

export function emptyRegionalProgress(): RegionalProgress {
  return { schemaVersion: 1, rulesetVersion: GAMEPLAY_RULESET_VERSION, contentVersion: REGIONAL_CONTENT_VERSION,
    lastRegionId: null, completedPuzzleIds: {}, discoveredSpeciesIds: {} };
}

export function loadRegionalProgress(storage: Pick<Storage, 'getItem'> | null): RegionalProgress {
  try {
    const raw = storage?.getItem(REGIONAL_STORAGE_KEY);
    if (!raw) return emptyRegionalProgress();
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return emptyRegionalProgress();
    const data = value as Partial<RegionalProgress>;
    if (data.schemaVersion !== 1) return emptyRegionalProgress();
    const lists = (candidate: unknown): Record<string, string[]> => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
      return Object.fromEntries(Object.entries(candidate).filter(([, item]) => Array.isArray(item))
        .map(([key, item]) => [key, [...new Set((item as unknown[]).filter((entry): entry is string => typeof entry === 'string'))]]));
    };
    return { schemaVersion: 1, rulesetVersion: typeof data.rulesetVersion === 'string' ? data.rulesetVersion : GAMEPLAY_RULESET_VERSION,
      contentVersion: typeof data.contentVersion === 'string' ? data.contentVersion : REGIONAL_CONTENT_VERSION,
      lastRegionId: typeof data.lastRegionId === 'string' ? data.lastRegionId : null,
      completedPuzzleIds: lists(data.completedPuzzleIds), discoveredSpeciesIds: lists(data.discoveredSpeciesIds) };
  } catch { return emptyRegionalProgress(); }
}

export function saveRegionalProgress(storage: Pick<Storage, 'setItem'> | null, progress: RegionalProgress): void {
  try { storage?.setItem(REGIONAL_STORAGE_KEY, JSON.stringify(progress)); } catch { /* Storage is optional. */ }
}

export function recordRegionalResult(progress: RegionalProgress, regionId: string, puzzleId: string,
  discoveredSpeciesIds: readonly string[], completed: boolean): RegionalProgress {
  const discovered = new Set([...(progress.discoveredSpeciesIds[regionId] ?? []), ...discoveredSpeciesIds]);
  const finished = new Set(progress.completedPuzzleIds[regionId] ?? []);
  if (completed) finished.add(puzzleId);
  return { ...progress, rulesetVersion: GAMEPLAY_RULESET_VERSION, contentVersion: REGIONAL_CONTENT_VERSION,
    discoveredSpeciesIds: { ...progress.discoveredSpeciesIds, [regionId]: [...discovered] },
    completedPuzzleIds: { ...progress.completedPuzzleIds, [regionId]: [...finished] } };
}
