import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { createGameFromLevel, composeBird, selectBoardTile } from '../src/core/gameEngine';
import { boardHash } from '../src/core/puzzleIdentity';
import { REGIONS, REGIONAL_SPECIES, EDITORIAL_QUEUE, speciesForRegion, validateRegionalData } from '../src/core/regionalData';
import { REGIONAL_PUZZLES, getRegionalPuzzle, replayRegionalCertificate } from '../src/core/regionalPuzzles';
import { emptyRegionalProgress, loadRegionalProgress, recordRegionalResult, REGIONAL_STORAGE_KEY } from '../src/core/regionalProgress';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('V6 regional data and certificates', () => {
  it('has 34 stable distinct region records and explicit source crosswalks', () => {
    expect(() => validateRegionalData()).not.toThrow();
    expect(REGIONS).toHaveLength(34);
    expect(new Set(REGIONS.map((region) => region.id)).size).toBe(34);
    expect(REGIONS.filter((region) => region.status === 'playable').map((region) => region.id)).toEqual(['CN-BJ']);
    expect(REGIONS.find((region) => region.id === 'CN-BJ')?.crosswalk.gbifStateProvince).toBe('Beijing');
    expect(REGIONS.filter((region) => region.status === 'pending').every((region) => region.curatedPlayableSpeciesCount === 0)).toBe(true);
    expect(speciesForRegion('CN-LN')).toEqual([]);
  });

  it('accepts only exact reviewed registry matches with evidence and excludes conflicts', () => {
    expect(REGIONAL_SPECIES).toHaveLength(10);
    for (const item of REGIONAL_SPECIES) {
      const canonical = BIRD_CATALOG.find((bird) => bird.id === item.speciesId)!;
      expect([item.acceptedName, item.scientificName]).toEqual([canonical.name, canonical.scientificName]);
      expect(item.evidenceReference).toMatch(/^https:\/\//);
      expect(item.sourceVersion).toBeTruthy();
      expect(item.license).toBeTruthy();
      expect(item.editorialStatus).toBe('ACCEPTED');
    }
    expect(EDITORIAL_QUEUE.find((item) => item.name === '喜鹊')?.status).toBe('TAXON_CONFLICT');
    expect(speciesForRegion('CN-BJ').some((item) => item.speciesId === 'bird:xique')).toBe(false);
    expect(speciesForRegion('CN-BJ').some((item) => item.speciesId === 'bird:shumaque')).toBe(false);
  });

  it('certifies both Beijing stages through the real engine with exact characters and quotas', () => {
    const ids = new Set<string>();
    for (const puzzle of REGIONAL_PUZZLES) {
      expect(puzzle.regionId).toBe('CN-BJ');
      expect(ids.has(puzzle.level.puzzleId!)).toBe(false);
      ids.add(puzzle.level.puzzleId!);
      expect(boardHash(puzzle.level.tiles)).toBe(puzzle.boardHash);
      expect(puzzle.level.tiles).toHaveLength(puzzle.stage === 1 ? 22 : 33);
      expect(puzzle.level.wordOccurrences!.every((id) => speciesForRegion('CN-BJ').some((item) => item.speciesId === id))).toBe(true);
      const characters = puzzle.level.wordOccurrences!.flatMap((id) => BIRD_CATALOG.find((bird) => bird.id === id)!.characters);
      expect(characters.sort().join('')).toBe(puzzle.level.tiles.map((tile) => tile.character).sort().join(''));
      expect(replayRegionalCertificate(puzzle)).toEqual({ phase: 'level_complete', maximumTray: puzzle.stage === 1 ? 2 : 3 });
      const state = createGameFromLevel(puzzle.level);
      const first = puzzle.level.winningSolution[0];
      expect(first.type).toBe('take');
      const taken = selectBoardTile(state, (first as { tileId: string }).tileId);
      expect(taken.tray.filter(Boolean)).toHaveLength(1);
      const retried = createGameFromLevel(puzzle.level);
      expect(retried.puzzleId).toBe(state.puzzleId);
      expect(retried.compositionQuotas).toEqual(state.compositionQuotas);
      expect(retried.boardTiles.map((tile) => tile.character)).toEqual(state.boardTiles.map((tile) => tile.character));
      expect(composeBird(state, 'composition:banjiu')).toBe(state);
    }
    expect(getRegionalPuzzle('CN-LN', 1)).toBeUndefined();
  });

  it('keeps regional species discovery distinct from puzzle completion and preserves V5 storage', () => {
    const progress = recordRegionalResult(emptyRegionalProgress(), 'CN-BJ', 'regional:test', ['bird:bailu', 'bird:bailu'], false);
    expect(progress.discoveredSpeciesIds['CN-BJ']).toEqual(['bird:bailu']);
    expect(progress.completedPuzzleIds['CN-BJ']).toEqual([]);
    const completed = recordRegionalResult(progress, 'CN-BJ', 'regional:test', ['bird:bailu'], true);
    expect(completed.completedPuzzleIds['CN-BJ']).toEqual(['regional:test']);
    expect(completed.discoveredSpeciesIds['CN-LN']).toBeUndefined();
    const storage = new Map([['bird.playtest.v1', 'historical'], [REGIONAL_STORAGE_KEY, JSON.stringify(completed)]]);
    expect(loadRegionalProgress({ getItem: (key) => storage.get(key) ?? null }).completedPuzzleIds['CN-BJ']).toEqual(['regional:test']);
    expect(storage.get('bird.playtest.v1')).toBe('historical');
    expect(loadRegionalProgress({ getItem: () => '{' })).toEqual(emptyRegionalProgress());
  });
});

describe('V6 region UI', () => {
  it('resumes a saved region on reload and keeps historical statistics storage untouched', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    dom.window.localStorage.setItem(REGIONAL_STORAGE_KEY, JSON.stringify({ ...emptyRegionalProgress(), lastRegionId: 'CN-BJ', discoveredSpeciesIds: { 'CN-BJ': ['bird:bailu'] } }));
    dom.window.localStorage.setItem('bird.playtest.v1', 'historical-value');
    vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document); vi.resetModules();
    await import('../src/main');
    const root = dom.window.document.querySelector('#app')!;
    expect(root.querySelector('.region-progress')?.textContent).toContain('已发现 1 种');
    root.querySelector<HTMLButtonElement>('[data-action="select"]')!.click();
    expect(root.querySelectorAll('[data-region-id]')).toHaveLength(34);
    expect(dom.window.localStorage.getItem('bird.playtest.v1')).toBe('historical-value');
  });

  it('selects, searches, plays, discovers, retries, and returns without losing legacy entry', async () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document); vi.resetModules();
    await import('../src/main');
    const root = dom.window.document.querySelector('#app')!;
    expect(root.querySelectorAll('[data-region-id]')).toHaveLength(34);
    const search = root.querySelector<HTMLInputElement>('#province-search')!;
    search.value = '辽宁'; search.dispatchEvent(new dom.window.Event('input'));
    expect(root.querySelectorAll('.province-card:not([hidden])')).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('[data-region-id="CN-LN"]')!.click();
    expect(root.querySelector('#province-note')?.textContent).toContain('鸟种资料整理中');
    search.value = '北京'; search.dispatchEvent(new dom.window.Event('input'));
    root.querySelector<HTMLButtonElement>('[data-region-id="CN-BJ"]')!.click();
    expect(root.querySelector('.region-progress')?.textContent).toContain('本游戏已收录鸟种 10');
    expect(root.querySelector<HTMLButtonElement>('[data-stage="2"]')!.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-stage="1"]')!.click();
    const puzzle = getRegionalPuzzle('CN-BJ', 1)!;
    const identity = root.querySelector('.regional-game')?.getAttribute('data-puzzle-id');
    root.querySelector<HTMLButtonElement>('[data-board-tile-id]')!.click();
    expect(root.querySelector('.regional-meta')?.textContent).toContain('剩余 21 / 22');
    root.querySelector<HTMLButtonElement>('[data-action="retry"]')!.click();
    expect(root.querySelector('.regional-game')?.getAttribute('data-puzzle-id')).toBe(identity);
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
    expect(root.querySelector('.region-collection')?.textContent).toContain('白鹭');
    root.querySelector<HTMLButtonElement>('[data-stage="2"]')!.click();
    expect(root.querySelector('.regional-meta')?.textContent).toContain('剩余 33 / 33');
    expect(root.querySelector('.regional-game')?.getAttribute('data-puzzle-id')).toBe(getRegionalPuzzle('CN-BJ', 2)!.level.puzzleId);
    root.querySelector<HTMLButtonElement>('[data-action="home"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="legacy"]')!.click();
    expect(root.querySelector('.game-shell')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.national-region-return')!.click();
    expect(root.querySelector('.region-progress')).not.toBeNull();
  });
});
