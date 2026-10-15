import { describe, expect, it } from 'vitest';
import { getExposedBoardTiles } from '../src/core/gameEngine';
import { getRegionalV7Puzzle } from '../src/core/regionalV7Puzzles';
import type { BirdComposition, GameState } from '../src/core/types';
import { assertWechatTouchTargets, WechatBirdStage, WECHAT_STORAGE_KEY, type HitBox } from '../src/wechat/stage';

function canvasContext(): CanvasRenderingContext2D {
  return { fillRect() {}, strokeRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillText() {},
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
  const tile = stage.getState().boardTiles.find((item) => item.id === tileId)!;
  let snapshot = stage.snapshot();
  const targetX = Math.max(snapshot.boardViewport.width - snapshot.boardWidth,
    Math.min(0, snapshot.boardViewport.width - tile.x - 48));
  const targetY = Math.max(snapshot.boardViewport.height - snapshot.boardHeight,
    Math.min(0, snapshot.boardViewport.height - tile.y - 48));
  pan(stage, targetX - snapshot.panX, targetY - snapshot.panY);
  snapshot = stage.snapshot();
  const hit = snapshot.visibleTileHits.find((item) => item.id === tileId);
  expect(hit, `Tile ${tileId} should be reachable`).toBeDefined();
  const before = snapshot.remainingTiles;
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

  it('pans to both D5 board extremes without taking a tile, and takes only an exposed full hit target', () => {
    const { stage } = fixture();
    stage.openPuzzle(5, 1);
    const initial = stage.snapshot();
    pan(stage, -1000, -1000);
    const far = stage.snapshot();
    expect(far.panX).toBe(initial.boardViewport.width - initial.boardWidth);
    expect(far.panY).toBe(initial.boardViewport.height - initial.boardHeight);
    expect(far.remainingTiles).toBe(90);
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

  it('routes an actual overlapping exposed-tile tap through 44px picker choices', () => {
    const { stage } = fixture();
    stage.openPuzzle(5, 1);
    const hits = stage.snapshot().visibleTileHits;
    const board = stage.snapshot().boardViewport;
    let point: [number, number] | null = null;
    for (let i = 0; i < hits.length && !point; i++) for (let j = i + 1; j < hits.length && !point; j++) {
      const left = Math.max(hits[i].x, hits[j].x, board.x);
      const right = Math.min(hits[i].x + hits[i].width, hits[j].x + hits[j].width, board.x + board.width);
      const top = Math.max(hits[i].y, hits[j].y, board.y);
      const bottom = Math.min(hits[i].y + hits[i].height, hits[j].y + hits[j].height, board.y + board.height);
      if (right > left && bottom > top) point = [(left + right) / 2, (top + bottom) / 2];
    }
    expect(point).not.toBeNull();
    stage.tap(...point!);
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
    expect(stage.snapshot().controls.some((item) => item.id === 'open:1:5')).toBe(false);
    click(stage, 'home-next');
    assertWechatTouchTargets(stage);
    expect(stage.snapshot().controls.some((item) => item.id === 'open:1:5')).toBe(true);
    click(stage, 'home-prev');
    click(stage, 'overlay-close');
    click(stage, 'undo');
    expect(stage.snapshot().phase).toBe('playing');
    click(stage, 'undo');
    expect(stage.snapshot().phase).toBe('playing');
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
        }
        stage.tap(...center(control));
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

  it('reaches all 90 D5 tiles via local pan and replays the certified path on both viewports', () => {
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
          }
          click(stage, id);
        }
      }
      expect(stage.snapshot().phase).toBe('level_complete');
      expect(stage.snapshot().remainingTiles).toBe(0);
    }
  });
});
