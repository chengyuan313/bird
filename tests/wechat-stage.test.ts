import { describe, expect, it } from 'vitest';
import { getExposedBoardTiles } from '../src/core/gameEngine';
import { getRegionalV7Puzzle } from '../src/core/regionalV7Puzzles';
import type { BirdComposition, GameState } from '../src/core/types';
import { assertWechatTouchTargets, WechatBirdStage, WECHAT_STORAGE_KEY, type HitBox } from '../src/wechat/stage';

function canvasContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop() {} };
  return { fillRect() {}, strokeRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillText() {},
    moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {}, setLineDash() {},
    createLinearGradient: () => gradient,
    set fillStyle(_value: string) {}, set strokeStyle(_value: string) {}, set font(_value: string) {},
    set textAlign(_value: string) {}, set textBaseline(_value: string) {} } as unknown as CanvasRenderingContext2D;
}
function fixture(width = 320, height = 568, safeTop = 44, safeBottom = 534) {
  const values = new Map<string, unknown>();
  const stage = new WechatBirdStage(canvasContext(), { width, height, safeTop, safeBottom },
    { get: (key) => values.get(key), set: (key, value) => { values.set(key, value); } });
  return { stage, values };
}
function center(box: HitBox): [number, number] { return [box.x + box.width / 2, box.y + box.height / 2]; }
function click(stage: WechatBirdStage, id: string): void {
  const box = stage.snapshot().controls.find((item) => item.id === id);
  expect(box, `Control ${id} should be present`).toBeDefined();
  stage.tap(...center(box!));
}
function pan(stage: WechatBirdStage, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const board = stage.snapshot().boardViewport;
  const [x, y] = center(board);
  stage.touchStart(x, y);
  if (Math.abs(dx) + Math.abs(dy) < 7 && (dx || dy)) stage.touchMove(x + 8, y);
  stage.touchMove(x + dx, y + dy); stage.touchEnd(x + dx, y + dy);
}
function take(stage: WechatBirdStage, tileId: string): void {
  const hit = stage.snapshot().visibleTileHits.find((item) => item.id === tileId);
  expect(hit, `Tile ${tileId} should be visible without dragging`).toBeDefined();
  const before = stage.snapshot().remainingTiles;
  stage.tap(...center(hit!));
  if (stage.snapshot().overlay === 'tile-picker') {
    expect((stage as unknown as { pickerIds: string[] }).pickerIds).toContain(tileId);
    while (!stage.snapshot().controls.some((item) => item.id === `pick:${tileId}`)) click(stage, 'picker-next');
    click(stage, `pick:${tileId}`);
  }
  expect(stage.snapshot().remainingTiles).toBe(before - 1);
}

describe('native WeChat Canvas stage', () => {
  it('keeps controls and a local board viewport in the safe area at 320×568 and 390×844', () => {
    for (const viewport of [[320, 568, 44, 534], [390, 844, 47, 810]]) {
      const { stage } = fixture(...viewport);
      const view = stage.snapshot();
      expect(view.boardViewport.height).toBeGreaterThanOrEqual(200);
      expect(view.controls.map((item) => item.id)).toEqual(expect.arrayContaining(['home', 'words', 'retry']));
      assertWechatTouchTargets(stage);
      stage.openPuzzle(5, 1);
      expect(stage.snapshot().remainingTiles).toBe(90);
      assertWechatTouchTargets(stage);
    }
    expect(() => fixture(320, 340, 30, 310)).toThrow(/safe area is too short/);
  });

  it('keeps the entire D5 board fixed during a drag, and takes only an exposed full hit target', () => {
    const { stage } = fixture();
    stage.openPuzzle(5, 1);
    pan(stage, -1000, -1000);
    const far = stage.snapshot();
    expect(far.panX).toBe(0);
    expect(far.panY).toBe(0);
    expect(far.remainingTiles).toBe(90);
    expect(far.cutTileHits).toHaveLength(0);
    expect(far.boardViewport.width).toBeGreaterThanOrEqual(far.boardWidth - 6);
    expect(far.boardViewport.height).toBeGreaterThanOrEqual(far.boardHeight - 6);
    assertWechatTouchTargets(stage);
    pan(stage, 1000, 1000);
    expect(stage.snapshot().panX).toBe(0);
    expect(stage.snapshot().panY).toBe(0);
    expect(stage.snapshot().remainingTiles).toBe(90);
    const exposed = getExposedBoardTiles(stage.getState());
    expect(exposed.length).toBeGreaterThan(0);
    take(stage, exposed[0].id);
    expect(stage.snapshot().trayOccupancy).toBe(1);
    click(stage, 'undo');
    expect(stage.snapshot().trayOccupancy).toBe(0);
    expect(stage.snapshot().remainingTiles).toBe(90);
  });

  it('offers every one of 3, 6, and 7 simultaneously formable words without overlapping hitboxes', () => {
    for (const count of [3, 6, 7]) for (let desired = 0; desired < count; desired++) {
      const { stage } = fixture();
      const compositions: BirdComposition[] = Array.from({ length: count }, (_, index) => ({
        id: `test:word:${index}`, classification: 'group', speciesId: null, name: '白鹭',
        characters: ['白', '鹭'], score: 10, assetKey: 'test', provenance: 'test-only',
      }));
      const writable = stage as unknown as { state: GameState };
      writable.state = { ...stage.getState(), activeCompositions: compositions,
        remainingCompositionQuotas: Object.fromEntries(compositions.map((item) => [item.id, 1])),
        tray: [{ id: 'synthetic:1', character: '白' }, { id: 'synthetic:2', character: '鹭' },
          ...Array<null>(8).fill(null)] };
      stage.render();
      click(stage, 'compose-all');
      assertWechatTouchTargets(stage);
      while (!stage.snapshot().controls.some((item) => item.id === `compose:test:word:${desired}`)) {
        click(stage, 'compose-next');
        assertWechatTouchTargets(stage);
      }
      if (desired >= 5) { click(stage, 'compose-prev'); click(stage, 'compose-next'); }
      click(stage, `compose:test:word:${desired}`);
      expect(stage.snapshot().overlay).toBe('none');
      click(stage, `compose:test:word:${desired}`);
      expect(stage.getState().remainingCompositionQuotas[`test:word:${desired}`]).toBe(0);
      expect(stage.snapshot().trayOccupancy).toBe(0);
    }
  });

  it('shows only exposed choices in a paginated picker and supports backward navigation', () => {
    const { stage } = fixture();
    stage.openPuzzle(5, 1);
    const exposed = getExposedBoardTiles(stage.getState()).slice(0, 7).map((item) => item.id);
    expect(exposed).toHaveLength(7);
    const writable = stage as unknown as { overlay: string; pickerIds: string[] };
    writable.overlay = 'tile-picker'; writable.pickerIds = exposed;
    stage.render();
    assertWechatTouchTargets(stage);
    click(stage, 'picker-next');
    expect(stage.snapshot().controls.some((item) => item.id === `pick:${exposed[6]}`)).toBe(true);
    click(stage, 'picker-prev');
    expect(stage.snapshot().controls.some((item) => item.id === `pick:${exposed[0]}`)).toBe(true);
    click(stage, 'picker-next');
    click(stage, `pick:${exposed[6]}`);
    expect(stage.snapshot().remainingTiles).toBe(89);
  });

  it('routes ambiguous exposed-tile hits through 44px picker choices', () => {
    const { stage } = fixture();
    stage.openPuzzle(5, 1);
    const hits = stage.snapshot().visibleTileHits;
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const writable = stage as unknown as { tileHits: HitBox[] };
    writable.tileHits = [hits[0], { ...hits[1], x: hits[0].x, y: hits[0].y }];
    stage.tap(...center(hits[0]));
    expect(stage.snapshot().overlay).toBe('tile-picker');
    const picks = stage.snapshot().controls.filter((item) => item.id.startsWith('pick:'));
    expect(picks.length).toBeGreaterThanOrEqual(2);
    expect(picks.every((item) => item.width >= 44 && item.height >= 44)).toBe(true);
    assertWechatTouchTargets(stage);
    click(stage, picks[0].id);
    expect(stage.snapshot().remainingTiles).toBe(89);
  });

  it('pages the home scene at the minimum supported safe height and allows repeated game-over undo', () => {
    const { stage } = fixture(320, 568, 100, 444);
    const initial = stage.getState();
    const writable = stage as unknown as { state: GameState; history: GameState[] };
    writable.state = { ...initial, phase: 'game_over', tray: initial.tray.map((_, index) => ({ id: `test:${index}`, character: '无' })) };
    writable.history = [initial, initial];
    stage.render();
    assertWechatTouchTargets(stage);
    click(stage, 'home');
    assertWechatTouchTargets(stage);
    expect(stage.snapshot().controls.some((item) => item.id === 'open:2:4')).toBe(false);
    click(stage, 'home-next');
    assertWechatTouchTargets(stage);
    expect(stage.snapshot().controls.some((item) => item.id === 'open:2:4')).toBe(true);
    click(stage, 'home-prev');
    click(stage, 'overlay-close');
    click(stage, 'undo');
    expect(stage.snapshot().phase).toBe('playing');
    click(stage, 'undo');
    expect(stage.snapshot().phase).toBe('playing');
    expect(stage.snapshot().undoRemaining).toBe(1);
  });

  it('shows three undo credits per puzzle and never spends one without an action', () => {
    const { stage } = fixture();
    expect(stage.snapshot().undoRemaining).toBe(3);
    stage.undo();
    expect(stage.snapshot().undoRemaining).toBe(3);
    for (let index = 0; index < 3; index++) {
      const hit = stage.snapshot().visibleTileHits[0];
      stage.tap(...center(hit));
      expect(stage.snapshot().trayOccupancy).toBe(1);
      click(stage, 'undo');
      expect(stage.snapshot().trayOccupancy).toBe(0);
      expect(stage.snapshot().undoRemaining).toBe(2 - index);
    }
    const hit = stage.snapshot().visibleTileHits[0];
    stage.tap(...center(hit));
    expect(stage.snapshot().controls.some((item) => item.id === 'undo')).toBe(false);
    stage.undo();
    expect(stage.snapshot().trayOccupancy).toBe(1);
    expect(stage.snapshot().undoRemaining).toBe(0);
    stage.retry();
    expect(stage.snapshot().undoRemaining).toBe(3);
  });

  it('shows every exposed tutorial tile without clipping on the compact preview', () => {
    const { stage } = fixture(320, 568, 20, 568);
    const before = stage.snapshot();
    expect(before.cutTileHits).toHaveLength(0);
    expect(before.visibleTileHits.map((tile) => tile.id).sort()).toEqual(
      getExposedBoardTiles(stage.getState()).map((tile) => tile.id).sort());
  });

  it('keeps exposed tiles fully visible across all 25 certified puzzles on both devices', () => {
    for (const viewport of [[320, 568, 20, 568], [390, 844, 47, 810]]) {
      const { stage } = fixture(...viewport);
      for (let tier = 1; tier <= 5; tier++) for (let index = 1; index <= 5; index++) {
        stage.openPuzzle(tier as 1 | 2 | 3 | 4 | 5, index);
        const view = stage.snapshot();
        expect(view.cutTileHits, `D${tier}-${index} at ${viewport[0]}px`).toHaveLength(0);
        expect(view.visibleTileHits.map((tile) => tile.id).sort()).toEqual(
          getExposedBoardTiles(stage.getState()).map((tile) => tile.id).sort());
        expect(view.panX).toBe(0);
        expect(view.panY).toBe(0);
      }
    }
  });

  it('replays every redesigned D1/D2 certificate through visible taps on both devices', () => {
    for (const viewport of [[320, 568, 20, 568], [390, 844, 47, 810]]) {
      const { stage } = fixture(...viewport);
      for (const tier of [1, 2] as const) for (let index = 1; index <= 5; index++) {
        const puzzle = getRegionalV7Puzzle('CN-SC', tier, index)!;
        stage.openPuzzle(tier, index);
        for (const action of puzzle.level.winningSolution) {
          if (action.type === 'take') take(stage, action.tileId);
          else {
            const id = `compose:${action.birdId}`;
            if (!stage.snapshot().controls.some((item) => item.id === id)) {
              click(stage, 'compose-all');
              while (!stage.snapshot().controls.some((item) => item.id === id)) click(stage, 'compose-next');
              click(stage, id);
            }
            click(stage, id);
          }
        }
        expect(stage.snapshot().phase, `D${tier}-${index} at ${viewport[0]}px`).toBe('level_complete');
        expect(stage.snapshot().remainingTiles).toBe(0);
      }
    }
  });

  it('retains old tutorial completion credit when native storage is loaded', () => {
    const oldId = 'regional-v7:1e1d00a5d3ca2faa387c26fe6f58da55dbb62396d9dd6ad6c602e399cafe86d7';
    const values = new Map<string, unknown>([[WECHAT_STORAGE_KEY,
      { version: 1, completedPuzzleIds: [oldId], discoveredSpeciesIds: ['bird:shaoji'] }]]);
    const stage = new WechatBirdStage(canvasContext(), { width: 320, height: 568, safeTop: 20, safeBottom: 568 },
      { get: (key) => values.get(key), set: (key, value) => { values.set(key, value); } });
    expect(stage.snapshot().completedPuzzleIds).toEqual([oldId, getRegionalV7Puzzle('CN-SC', 1, 1)!.record.puzzleId]);
  });

  it('never takes a tile after a drag, cancelled gesture, or long press', () => {
    const { stage } = fixture(320, 568, 20, 568);
    const hit = stage.snapshot().visibleTileHits[0];
    const [x, y] = center(hit);
    const remaining = stage.snapshot().remainingTiles;
    stage.touchStart(x, y); stage.touchMove(x + 12, y); stage.touchEnd(x + 12, y);
    stage.touchStart(x, y); stage.touchCancel(); stage.touchEnd(x, y);
    stage.touchStart(x, y);
    const writable = stage as unknown as { touchOrigin: { time: number } };
    writable.touchOrigin.time -= 601;
    stage.touchEnd(x, y);
    expect(stage.snapshot().remainingTiles).toBe(remaining);
  });

  it('does not let a covered top-layer tile pass a tap through to a lower exposed hit', () => {
    const { stage } = fixture();
    const exposed = stage.snapshot().visibleTileHits[0];
    const writable = stage as unknown as { stackHits: Array<{ box: HitBox; available: boolean }> };
    writable.stackHits.push({ box: { ...exposed, id: 'covered:top' }, available: false });
    const before = stage.snapshot().remainingTiles;
    stage.tap(...center(exposed));
    expect(stage.snapshot().remainingTiles).toBe(before);
  });

  it('opens all 25 certified Sichuan puzzle identities from the fixed HUD home scene', () => {
    const { stage } = fixture();
    click(stage, 'home');
    const found = new Set<string>();
    for (let page = 0; page < 25; page++) {
      assertWechatTouchTargets(stage);
      for (const control of stage.snapshot().controls) if (control.id.startsWith('open:')) found.add(control.id);
      if (!stage.snapshot().controls.some((item) => item.id === 'home-next')) break;
      click(stage, 'home-next');
    }
    expect(found.size).toBe(25);
    click(stage, 'open:5:1');
    expect(stage.snapshot().puzzleId).toBe(getRegionalV7Puzzle('CN-SC', 5, 1)!.record.puzzleId);
    expect(stage.snapshot().remainingTiles).toBe(90);
  });

  it('replays D1 victory through Canvas controls, persists once, and advances to the next puzzle', () => {
    const { stage, values } = fixture();
    const puzzle = getRegionalV7Puzzle('CN-SC', 1, 1)!;
    for (const action of puzzle.level.winningSolution) {
      if (action.type === 'take') take(stage, action.tileId);
      else {
        let control = stage.snapshot().controls.find((item) => item.id === `compose:${action.birdId}`);
        if (!control) {
          click(stage, 'compose-all');
          while (!(control = stage.snapshot().controls.find((item) => item.id === `compose:${action.birdId}`))) click(stage, 'compose-next');
          stage.tap(...center(control));
          control = stage.snapshot().controls.find((item) => item.id === `compose:${action.birdId}`);
        }
        stage.tap(...center(control!));
      }
    }
    expect(stage.snapshot().phase).toBe('level_complete');
    expect(stage.snapshot().overlay).toBe('result');
    expect(stage.snapshot().completedPuzzleIds).toContain(puzzle.record.puzzleId);
    expect(values.get(WECHAT_STORAGE_KEY)).toBeDefined();
    assertWechatTouchTargets(stage);
    click(stage, 'next-puzzle');
    expect(stage.snapshot().puzzleId).toBe(getRegionalV7Puzzle('CN-SC', 1, 2)!.record.puzzleId);
    expect(stage.snapshot().phase).toBe('playing');
  });

  it('replays the D5 certified path without dragging on both viewports', () => {
    const puzzle = getRegionalV7Puzzle('CN-SC', 5, 1)!;
    for (const viewport of [[320, 568, 44, 534], [390, 844, 47, 810]]) {
      const { stage } = fixture(...viewport);
      stage.openPuzzle(5, 1);
      for (const action of puzzle.level.winningSolution) {
        if (action.type === 'take') take(stage, action.tileId);
        else {
          const id = `compose:${action.birdId}`;
          if (!stage.snapshot().controls.some((item) => item.id === id)) {
            click(stage, 'compose-all');
            while (!stage.snapshot().controls.some((item) => item.id === id)) click(stage, 'compose-next');
            click(stage, id);
          }
          click(stage, id);
        }
      }
      expect(stage.snapshot().phase).toBe('level_complete');
      expect(stage.snapshot().remainingTiles).toBe(0);
    }
  });
});
