import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { composeBird, createGameFromLevel, findPlayableBirds, getExposedBoardTiles, selectBoardTile } from '../src/core/gameEngine';
import { boardHash } from '../src/core/puzzleIdentity';
import { REGIONS, REGIONAL_SOURCES, REGIONAL_SPECIES, EDITORIAL_QUEUE, speciesForRegion, validateRegionalEvidence } from '../src/core/regionalData';
import { REGIONAL_PUZZLES, buildRegionalPuzzle, getRegionalPuzzle, replayRegionalCertificate } from '../src/core/regionalPuzzles';
import { emptyRegionalProgress, loadRegionalProgress, recordRegionalResult, REGIONAL_STORAGE_KEY } from '../src/core/regionalProgress';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const pilots = ['CN-LN', 'CN-GD', 'CN-SC', 'CN-YN'] as const;

describe('V6.1 provincial evidence', () => {
  it('resolves every accepted entry to its individual source and exact canonical identity', () => {
    expect(REGIONAL_SOURCES).toHaveLength(5);
    expect(REGIONAL_SPECIES).toHaveLength(97);
    expect(() => validateRegionalEvidence(REGIONAL_SPECIES, REGIONAL_SOURCES)).not.toThrow();
    for (const regionId of pilots) {
      const species = speciesForRegion(regionId);
      expect(species.length).toBeGreaterThanOrEqual(15);
      expect(new Set(species.map((item) => item.speciesId)).size).toBe(species.length);
      expect(REGIONS.find((item) => item.id === regionId)?.status).toBe('playable');
      for (const item of species) {
        const canonical = BIRD_CATALOG.find((bird) => bird.id === item.speciesId)!;
        const source = REGIONAL_SOURCES.find((candidate) => candidate.id === item.sourceId)!;
        expect([item.acceptedName, item.scientificName]).toEqual([canonical.name, canonical.scientificName]);
        expect(item.evidenceReference).toBe(source.url);
        expect(item.sourceVersion).toBe(source.version);
        expect(item.sourceRow).toBeGreaterThan(0);
      }
    }
    expect(speciesForRegion('CN-BJ').map((item) => item.speciesId)).toEqual([
      'bird:bailu', 'bird:yelu', 'bird:chilu', 'bird:canglu', 'bird:daisheng', 'bird:hongsun', 'bird:wudong', 'bird:huixique', 'bird:dabailu', 'bird:dashanque',
    ]);
    expect(speciesForRegion('CN-GD').find((item) => item.speciesId === 'bird:bailu')?.speciesId).toBe(speciesForRegion('CN-YN').find((item) => item.speciesId === 'bird:bailu')?.speciesId);
  });

  it('rejects unresolved sources, taxonomic mismatches, duplicate entries and queued conflicts', () => {
    const first = REGIONAL_SPECIES.find((item) => item.regionId === 'CN-LN')!;
    expect(() => validateRegionalEvidence([{ ...first, sourceId: 'missing' }], REGIONAL_SOURCES)).toThrow('Unreviewed evidence');
    expect(() => validateRegionalEvidence([{ ...first, scientificName: 'Invented species' }], REGIONAL_SOURCES)).toThrow('Taxonomic mismatch');
    expect(() => validateRegionalEvidence([first, first], REGIONAL_SOURCES)).toThrow('Duplicate');
    expect(() => validateRegionalEvidence([first], REGIONAL_SOURCES.filter((source) => source.id !== first.sourceId))).toThrow('Unreviewed evidence');
    for (const item of EDITORIAL_QUEUE) {
      if (!item.name || item.status === 'SOURCE_UNAVAILABLE') continue;
      expect(speciesForRegion(item.regionId).some((entry) => entry.acceptedName === item.name)).toBe(false);
    }
  });
});

describe('V6.1 regional puzzle certificates', () => {
  it('builds two distinct deterministic approved-only 22/33-character puzzles per pilot', () => {
    expect(REGIONAL_PUZZLES).toHaveLength(10);
    const identities = new Set<string>();
    for (const regionId of pilots) {
      const first = getRegionalPuzzle(regionId, 1)!;
      const second = getRegionalPuzzle(regionId, 2)!;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first.level.puzzleId).not.toBe(second.level.puzzleId);
      for (const puzzle of [first, second]) {
        const { stage, seed, level } = puzzle;
        expect(level.tiles).toHaveLength(stage === 1 ? 22 : 33);
        expect(boardHash(level.tiles)).toBe(puzzle.boardHash);
        expect(identities.has(level.puzzleId!)).toBe(false);
        identities.add(level.puzzleId!);
        const approved = new Set(speciesForRegion(regionId).map((item) => item.speciesId));
        expect(level.wordOccurrences!.every((id) => approved.has(id))).toBe(true);
        expect(level.wordOccurrences!.flatMap((id) => BIRD_CATALOG.find((bird) => bird.id === id)!.characters).sort()).toEqual(level.tiles.map((tile) => tile.character).sort());
        const regenerated = buildRegionalPuzzle({ regionId, regionName: REGIONS.find((item) => item.id === regionId)!.name,
          stage: stage as 1 | 2, seed, words: level.wordOccurrences! });
        expect([regenerated.level.puzzleId, regenerated.boardHash, regenerated.level.winningSolution]).toEqual([level.puzzleId, puzzle.boardHash, level.winningSolution]);
        const replay = replayRegionalCertificate(puzzle);
        expect(replay.phase).toBe('level_complete');
        expect(replay.maximumTray).toBeLessThanOrEqual(4);
        const state = createGameFromLevel(level);
        expect(state.compositionQuotas).toEqual(Object.fromEntries([...new Set(level.wordOccurrences)].map((id) => [id, level.wordOccurrences!.filter((candidate) => candidate === id).length])));
        expect(getExposedBoardTiles(state).length).toBeGreaterThan(1);
        expect(new Set(level.wordOccurrences).size).toBeGreaterThanOrEqual(stage === 1 ? 8 : 10);
      }
    }
    expect(() => buildRegionalPuzzle({ regionId: 'CN-LN', regionName: '辽宁', stage: 1, seed: 1,
      words: Array(11).fill('bird:bailu') })).toThrow('Unapproved');
  });

  it('keeps unsampled names unplayable and retries the exact provincial board', () => {
    const level = getRegionalPuzzle('CN-LN', 1)!.level;
    const fresh = createGameFromLevel(level);
    expect(fresh.activeCompositions.map((bird) => bird.id)).not.toContain('bird:datiane');
    expect(composeBird(fresh, 'bird:datiane')).toBe(fresh);
    const first = level.winningSolution[0];
    expect(first.type).toBe('take');
    const taken = selectBoardTile(fresh, (first as { tileId: string }).tileId);
    expect(taken.boardTiles.filter((tile) => !tile.removed)).toHaveLength(21);
    const retried = createGameFromLevel(level);
    expect([retried.puzzleId, retried.boardTiles, retried.compositionQuotas]).toEqual([fresh.puzzleId, fresh.boardTiles, fresh.compositionQuotas]);
    expect(getRegionalPuzzle('CN-LN', 2)!.level.puzzleId).not.toBe(fresh.puzzleId);
  });

  it('records finite non-oracle baseline outcomes and early-choice diagnostics', () => {
    const diagnostics = REGIONAL_PUZZLES.filter((puzzle) => puzzle.regionId !== 'CN-BJ').map((puzzle) => {
      let state = createGameFromLevel(puzzle.level);
      const initialExposed = getExposedBoardTiles(state).length;
      const repeats = Object.entries(state.compositionQuotas).filter(([, count]) => count > 1);
      const firstTakes = puzzle.level.winningSolution.filter((action) => action.type === 'take').slice(0, 2);
      let early = createGameFromLevel(puzzle.level);
      for (const action of firstTakes) if (action.type === 'take') early = selectBoardTile(early, action.tileId);
      const earlyFormable = findPlayableBirds(early).length;
      let actions = 0;
      while (state.phase === 'playing' && actions++ < 100) {
        const formable = findPlayableBirds(state).sort((a, b) => a.id.localeCompare(b.id));
        if (formable.length) state = composeBird(state, formable[0].id);
        else {
          const exposed = getExposedBoardTiles(state).sort((a, b) => a.id.localeCompare(b.id));
          if (!exposed.length) break;
          const next = selectBoardTile(state, exposed[0].id);
          if (next === state) break;
          state = next;
        }
      }
      return { region: puzzle.regionId, stage: puzzle.stage, puzzleId: puzzle.level.puzzleId, boardHash: puzzle.boardHash,
        maximumTray: replayRegionalCertificate(puzzle).maximumTray, initialExposed, earlyFormable,
        uniqueWords: Object.keys(state.compositionQuotas).length, repeats,
        baseline: state.phase === 'level_complete' ? 'WIN' : state.phase === 'game_over' ? 'LOSS' : 'UNKNOWN', actions };
    });
    expect(diagnostics).toHaveLength(8);
    expect(diagnostics.every((item) => item.actions <= 100 && item.initialExposed > 1 && item.earlyFormable > 0)).toBe(true);
    expect(diagnostics.map((item) => item.baseline)).toEqual(['WIN', 'WIN', 'WIN', 'LOSS', 'WIN', 'WIN', 'WIN', 'LOSS']);
  });

  it('never double-counts the same regional species on repeat composition or across provinces', () => {
    const level = getRegionalPuzzle('CN-GD', 1)!.level;
    let state = createGameFromLevel(level);
    for (const action of level.winningSolution) {
      state = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    }
    expect(state.phase).toBe('level_complete');
    expect(state.discoveredBirdIds.filter((id) => id === 'bird:canglu')).toHaveLength(1);
    let progress = recordRegionalResult(emptyRegionalProgress(), 'CN-GD', level.puzzleId!, state.discoveredBirdIds, true);
    progress = recordRegionalResult(progress, 'CN-GD', level.puzzleId!, state.discoveredBirdIds, true);
    expect(progress.discoveredSpeciesIds['CN-GD'].filter((id) => id === 'bird:canglu')).toHaveLength(1);
    progress = recordRegionalResult(progress, 'CN-YN', 'regional:other', ['bird:canglu'], false);
    expect(progress.discoveredSpeciesIds['CN-YN']).toEqual(['bird:canglu']);
    expect(progress.discoveredSpeciesIds['CN-GD']).toContain('bird:canglu');
  });
});

describe('V6.1 regional UI', () => {
  it('switches provinces, plays a full provincial certificate, persists discovery and preserves national access', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document); vi.resetModules();
    await import('../src/main');
    const root = dom.window.document.querySelector('#app')!;
    for (const regionId of pilots) {
      root.querySelector<HTMLButtonElement>(`[data-region-id="${regionId}"]`)?.click();
      if (regionId === 'CN-SC') {
        expect(root.querySelector('.region-progress')?.textContent).toContain('0 / 100');
        expect(root.querySelectorAll('[data-v7-tier]')).toHaveLength(25);
        expect(root.querySelectorAll('[data-v6-stage]')).toHaveLength(2);
      } else {
        expect(root.querySelector('.region-progress')?.textContent).toContain(`本游戏已收录鸟种 ${speciesForRegion(regionId).length}`);
        expect(root.querySelector('[data-stage="1"]')).not.toBeNull();
        expect(root.querySelector('[data-stage="2"]')).not.toBeNull();
      }
      root.querySelector<HTMLButtonElement>('[data-action="select"]')!.click();
    }
    root.querySelector<HTMLButtonElement>('[data-region-id="CN-GD"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-stage="1"]')!.click();
    const puzzle = getRegionalPuzzle('CN-GD', 1)!;
    for (const action of puzzle.level.winningSolution) {
      const selector = action.type === 'take' ? `[data-board-tile-id="${action.tileId}"]` : `[data-bird-id="${action.birdId}"]`;
      const button = root.querySelector<HTMLButtonElement>(selector);
      expect(button, selector).not.toBeNull();
      button!.click();
    }
    expect(root.querySelector('.region-result')?.textContent).toContain('完成地区谜题');
    root.querySelector<HTMLButtonElement>('[data-action="home"]')!.click();
    expect(root.querySelector('.region-progress')?.textContent).toContain('已完成 1 / 2');
    expect(root.querySelector<HTMLButtonElement>('[data-stage="2"]')!.disabled).toBe(false);
    const stored = loadRegionalProgress(dom.window.localStorage);
    expect(stored.completedPuzzleIds['CN-GD']).toContain(puzzle.level.puzzleId);
    root.querySelector<HTMLButtonElement>('[data-action="select"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-region-id="CN-BJ"]')!.click();
    expect(root.querySelector('.region-progress')?.textContent).toContain('本游戏已收录鸟种 10');
    root.querySelector<HTMLButtonElement>('[data-action="legacy"]')!.click();
    expect(root.querySelector('.game-shell')).not.toBeNull();
    expect(dom.window.localStorage.getItem(REGIONAL_STORAGE_KEY)).not.toBeNull();
  });
});
