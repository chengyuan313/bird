import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { BIRD_CATALOG, SCORE_BY_LENGTH } from '../src/core/birdCatalog';
import { composeBird, createGameFromLevel, findPlayableBirds, getExposedBoardTiles, selectBoardTile } from '../src/core/gameEngine';
import { boardHash } from '../src/core/puzzleIdentity';
import { emptyRegionalProgress, loadRegionalProgress, recordRegionalResult, saveRegionalProgress } from '../src/core/regionalProgress';
import { REGIONAL_V7_TIERS, REGIONAL_V7_TILE_COUNTS, V7_DIFFICULTY_POOLS, V7_PLAYABLE_NAMES,
  V7_PROVINCIAL_MEMBERSHIPS, V7_SPECIES_MASTER, v7Pool, validateRegionalV7Data } from '../src/core/regionalV7Data';
import { geometryForTier, topologicalTakeOrder, validateRegionalGeometry } from '../src/core/regionalV7Geometry';
import { generateRegionalV7Puzzle, validateRegionalV7Record } from '../src/core/regionalV7Generator';
import { getRegionalV7Puzzle, REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import { REGIONAL_PUZZLES } from '../src/core/regionalPuzzles';
import { speciesForRegion } from '../src/core/regionalData';
import type { BirdComposition, LevelDefinition } from '../src/core/types';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('V7.5 Sichuan editorial pipeline', () => {
  it('has 100 distinct sourced species and independent regional membership', () => {
    expect(() => validateRegionalV7Data()).not.toThrow();
    expect(V7_SPECIES_MASTER).toHaveLength(100);
    expect(V7_PROVINCIAL_MEMBERSHIPS).toHaveLength(100);
    expect(new Set(V7_SPECIES_MASTER.map((bird) => bird.id)).size).toBe(100);
    expect(new Set(V7_SPECIES_MASTER.map((bird) => bird.scientificName)).size).toBe(100);
    expect(V7_SPECIES_MASTER.filter((bird) => !BIRD_CATALOG.some((old) => old.id === bird.id))).toHaveLength(77);
    expect(V7_PROVINCIAL_MEMBERSHIPS.filter((item) => item.regionalFeature).length).toBeGreaterThanOrEqual(20);
    for (const membership of V7_PROVINCIAL_MEMBERSHIPS) {
      const master = V7_SPECIES_MASTER.find((bird) => bird.id === membership.speciesId)!;
      expect(membership.regionId).toBe('CN-SC');
      expect(membership.sourceUrl).toBe('https://html.rhhz.net/scdwzz/html/61796.htm');
      expect(membership.sourceRow).toBeGreaterThan(0);
      expect([membership.originalChineseName, membership.originalScientificName]).toEqual([master.chineseName, master.scientificName]);
    }
    expect(V7_PROVINCIAL_MEMBERSHIPS.filter((item) => item.habitatSourceUrl)).toHaveLength(2);
    for (const regionId of ['CN-BJ', 'CN-GD', 'CN-YN']) {
      const legacyEgret = speciesForRegion(regionId).find((item) => item.speciesId === 'bird:bailu');
      if (!legacyEgret) throw new Error(`Missing shared egret in ${regionId}`);
      expect(legacyEgret?.scientificName).toBe('Egretta garzetta');
      expect(V7_SPECIES_MASTER.find((item) => item.id === legacyEgret.speciesId)?.scientificName).toBe(legacyEgret.scientificName);
    }
  });

  it('forms five cumulative 20-species increments without duplicate biological identities', () => {
    expect(V7_DIFFICULTY_POOLS).toHaveLength(5);
    for (const tier of REGIONAL_V7_TIERS) {
      const pool = v7Pool('CN-SC', tier)!;
      expect(pool.speciesIds).toHaveLength(tier * 20);
      expect(pool.newlyIntroducedSpeciesIds).toHaveLength(20);
      expect(new Set(pool.speciesIds).size).toBe(tier * 20);
      if (tier > 1) expect(pool.speciesIds).toEqual([...v7Pool('CN-SC', (tier - 1) as typeof tier)!.speciesIds, ...pool.newlyIntroducedSpeciesIds]);
    }
    expect(v7Pool('CN-GD', 1)).toBeUndefined();
  });

  it('accepts Unicode-safe 2–6 names and rejects malformed or truncated compositions', () => {
    expect([2, 3, 4, 5, 6].map((length) => SCORE_BY_LENGTH[length])).toEqual([10, 30, 70, 120, 180]);
    for (const bird of V7_PLAYABLE_NAMES) {
      expect(Array.from(bird.name)).toEqual(bird.characters);
      expect(bird.nameLength).toBeGreaterThanOrEqual(2);
      expect(bird.nameLength).toBeLessThanOrEqual(6);
      expect(bird.score).toBe(SCORE_BY_LENGTH[bird.nameLength]);
    }
    for (const length of [5, 6]) {
      const bird = V7_PLAYABLE_NAMES.find((item) => item.nameLength === length)!;
      const composition: BirdComposition = { id: bird.id, speciesId: bird.speciesId, name: bird.name,
        characters: bird.characters, score: bird.score, classification: 'canonical', assetKey: bird.id, provenance: 'test' };
      const level: LevelDefinition = { id: `long-${length}`, label: '测试', compositions: [composition], wordOccurrences: [bird.id],
        tiles: bird.characters.map((character, index) => ({ id: `t${index}`, character, x: index * 50, y: 0, layer: 1, blockedBy: [] })),
        winningSolution: [] };
      let state = createGameFromLevel(level);
      for (const tile of level.tiles) state = selectBoardTile(state, tile.id);
      expect(findPlayableBirds(state).map((item) => item.id)).toContain(bird.id);
      state = composeBird(state, bird.id);
      expect([state.phase, state.score, state.discoveredBirdIds]).toEqual(['level_complete', bird.score, [bird.speciesId]]);
      expect(() => createGameFromLevel({ ...level, compositions: [{ ...composition, characters: bird.characters.slice(0, -1) }] })).toThrow('Invalid playable composition');
      expect(() => createGameFromLevel({ ...level, compositions: [{ ...composition, name: `${bird.name}A` }] })).toThrow('Invalid playable composition');
    }
  });
});

describe('V7.5 certified regional puzzles', () => {
  it('validates existing geometry subsets and every deterministic offline bank record', () => {
    expect(REGIONAL_V7_PUZZLES).toHaveLength(25);
    expect(new Set(REGIONAL_V7_PUZZLES.map((item) => item.record.puzzleId)).size).toBe(25);
    expect(new Set(REGIONAL_V7_PUZZLES.map((item) => item.record.boardHash)).size).toBe(25);
    for (const tier of REGIONAL_V7_TIERS) {
      const geometry = geometryForTier(tier);
      expect(() => validateRegionalGeometry(geometry, REGIONAL_V7_TILE_COUNTS[tier])).not.toThrow();
      expect(topologicalTakeOrder(geometry, 750000 + tier).length).toBe(REGIONAL_V7_TILE_COUNTS[tier]);
      const records = REGIONAL_V7_PUZZLES.filter((item) => item.record.tier === tier);
      expect(records).toHaveLength(5);
      const covered = new Set(records.flatMap((item) => item.record.wordOccurrences));
      for (const id of v7Pool('CN-SC', tier)!.newlyIntroducedSpeciesIds) expect(covered.has(id)).toBe(true);
      for (const puzzle of records) {
        const { record, level } = puzzle;
        expect(level.tiles).toHaveLength(REGIONAL_V7_TILE_COUNTS[tier]);
        expect(boardHash(level.tiles)).toBe(record.boardHash);
        expect(record.puzzleId).toMatch(/^regional-v7:[a-f0-9]{64}$/);
        expect(() => validateRegionalV7Record(record)).not.toThrow();
        expect(generateRegionalV7Puzzle('CN-SC', tier, record.stageIndex)).toEqual(record);
        expect(record.diagnostics.maximumWitnessTray).toBeLessThanOrEqual(6);
        expect(record.diagnostics.initialExposed).toBeGreaterThan(1);
        expect(record.diagnostics.baselineActions).toBeLessThanOrEqual(250);
        expect(record.diagnostics.baseline).toBe('WIN');
        expect(record.diagnostics.randomLegalWins + record.diagnostics.randomLegalLosses +
          record.diagnostics.randomLegalUnknown).toBe(10);
        expect(record.wordOccurrences.every((id) => v7Pool('CN-SC', tier)!.speciesIds.includes(id))).toBe(true);
        let state = createGameFromLevel(level);
        expect(getExposedBoardTiles(state).length).toBe(record.diagnostics.initialExposed);
        for (const action of level.winningSolution) {
          const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
          expect(next).not.toBe(state);
          state = next;
        }
        expect(state.phase).toBe('level_complete');
        expect(state.tray.every((slot) => slot === null)).toBe(true);
        expect(state.remainingCompositionQuotas && Object.values(state.remainingCompositionQuotas).every((count) => count === 0)).toBe(true);
      }
    }
    expect(REGIONAL_V7_PUZZLES.reduce((total, item) => total + item.record.diagnostics.randomLegalWins, 0)).toBe(47);
    expect(() => generateRegionalV7Puzzle('CN-GD', 1, 1)).toThrow('Unsupported');
  });

  it('preserves historical regional identities and migrates old progress without resetting it', () => {
    expect(REGIONAL_PUZZLES).toHaveLength(10);
    expect(REGIONAL_PUZZLES.filter((item) => item.regionId === 'CN-BJ').map((item) => item.level.puzzleId)).toEqual([
      'regional:638e10601d021dcc26cdf361a6b6dfcfaf456b7f0c7e5fbedd913ae39dd569ae',
      'regional:e55f64d42b07bad81cf1b4fb9a47152cdcc4df39bc78db7b2bc862748fbab1fb',
    ]);
    const dom = new JSDOM('', { url: 'https://example.test/bird/' });
    const old = { ...emptyRegionalProgress(), contentVersion: 'regional-content-v6.1.0',
      completedPuzzleIds: { 'CN-SC': [REGIONAL_PUZZLES.find((item) => item.regionId === 'CN-SC')!.level.puzzleId!] },
      discoveredSpeciesIds: { 'CN-SC': ['bird:shaoji'] }, lastRegionId: 'CN-SC' };
    saveRegionalProgress(dom.window.localStorage, old);
    const loaded = loadRegionalProgress(dom.window.localStorage);
    expect(loaded).toEqual(old);
    const updated = recordRegionalResult(loaded, 'CN-SC', getRegionalV7Puzzle('CN-SC', 1, 1)!.record.puzzleId,
      ['bird:shaoji', 'species:grus-nigricollis'], true);
    expect(updated.completedPuzzleIds['CN-SC']).toHaveLength(2);
    expect(updated.discoveredSpeciesIds['CN-SC']).toEqual(['bird:shaoji', 'species:grus-nigricollis']);
    expect(updated.contentVersion).toBe('regional-content-v7.5.0');
  });
});

describe('V7.5 province-first UI', () => {
  it.each([320, 390])('plays Sichuan D1 at %ipx with scaled, bounded geometry and persisted progress', async (screenWidth) => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/' });
    Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', { configurable: true,
      get() { return this.classList.contains('v7-board') ? screenWidth - 58 : 0; } });
    vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.window.document); vi.resetModules();
    await import('../src/main');
    const root = dom.window.document.querySelector('#app')!;
    expect(root.querySelectorAll('[data-region-id]')).toHaveLength(34);
    root.querySelector<HTMLButtonElement>('[data-region-id="CN-SC"]')!.click();
    expect(root.querySelector('.region-progress')?.textContent).toContain('0 / 100');
    expect(root.querySelectorAll('[data-v7-species]')).toHaveLength(100);
    expect(root.querySelectorAll('[data-v7-tier]')).toHaveLength(25);
    expect(root.querySelector<HTMLButtonElement>('[data-v7-tier="2"]')!.disabled).toBe(true);
    const search = root.querySelector<HTMLInputElement>('#v7-species-search')!;
    search.value = '四川山鹧鸪'; search.dispatchEvent(new dom.window.Event('input'));
    expect(root.querySelectorAll('[data-v7-species]:not([hidden])')).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('[data-v7-tier="1"][data-v7-stage="1"]')!.click();
    const puzzle = getRegionalV7Puzzle('CN-SC', 1, 1)!;
    const canvas = root.querySelector<HTMLElement>('.board-canvas')!;
    const scale = (screenWidth - 58) / 350;
    expect(canvas.style.transform).toBe(`scale(${scale})`);
    expect(root.querySelector<HTMLElement>('.v7-board')!.style.height).toBe(`${258 * scale}px`);
    for (const action of puzzle.level.winningSolution) {
      const selector = action.type === 'take' ? `[data-board-tile-id="${action.tileId}"]` : `[data-bird-id="${action.birdId}"]`;
      const button = root.querySelector<HTMLButtonElement>(selector);
      expect(button, selector).not.toBeNull();
      button!.click();
    }
    expect(root.querySelector('.region-result')?.textContent).toContain('完成四川谜题');
    root.querySelector<HTMLButtonElement>('[data-action="home"]')!.click();
    expect(root.querySelector('.region-progress')?.textContent).toContain('1 / 25');
    expect(loadRegionalProgress(dom.window.localStorage).completedPuzzleIds['CN-SC']).toContain(puzzle.record.puzzleId);
    root.querySelector<HTMLButtonElement>('[data-v6-stage="1"]')!.click();
    expect(root.querySelector('.regional-game')?.textContent).toContain('四川·初识');
    root.querySelector<HTMLButtonElement>('[data-action="legacy"]')!.click();
    expect(root.querySelector('.game-shell')).not.toBeNull();
  });
});
