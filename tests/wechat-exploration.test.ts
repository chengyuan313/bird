import { describe, expect, it } from 'vitest';
import { createGameFromLevel, getExposedBoardTiles, selectBoardTile } from '../src/core/gameEngine';
import { REGIONAL_V7_PUZZLES } from '../src/core/regionalV7Puzzles';
import { V7_SPECIES_MASTER } from '../src/core/regionalV7Data';
import { collectionSpecies } from '../src/wechat/exploration';
import { restoreWechatSession, WECHAT_PREFERENCES_KEY, WECHAT_SESSION_KEY } from '../src/wechat/session';
import { assertWechatTouchTargets, WechatBirdStage, WECHAT_STORAGE_KEY, type HitBox } from '../src/wechat/stage';

function context(): CanvasRenderingContext2D {
  return { fillRect() {}, strokeRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillText() {},
    moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {}, fill() {}, stroke() {}, setLineDash() {},
    createLinearGradient: () => ({ addColorStop() {} }) } as unknown as CanvasRenderingContext2D;
}
function setup(width = 320, height = 568, safeTop = 20, safeBottom = height,
  values = new Map<string, unknown>(), effects?: { vibrate(type: string): void; copyText?(text: string): Promise<boolean> }) {
  return { values, stage: new WechatBirdStage(context(), { width, height, safeTop, safeBottom },
    { get: (key) => values.get(key), set: (key, value) => values.set(key, structuredClone(value)) }, undefined, effects) };
}
function center(hit: HitBox): [number, number] { return [hit.x + hit.width / 2, hit.y + hit.height / 2]; }
function click(stage: WechatBirdStage, id: string) {
  const hit = stage.snapshot().controls.find((item) => item.id === id);
  expect(hit, id).toBeDefined(); stage.touchStart(...center(hit!)); stage.touchEnd(...center(hit!));
}
function take(stage: WechatBirdStage, id: string) {
  const hit = stage.snapshot().visibleTileHits.find((item) => item.id === id)!;
  expect(hit, id).toBeDefined(); stage.tap(...center(hit));
  if (stage.snapshot().overlay === 'tile-picker') {
    for (let page = 0; page < 15 && !stage.snapshot().controls.some((item) => item.id === `pick:${id}`); page++) click(stage, 'picker-next');
    click(stage, `pick:${id}`);
  }
}
function compose(stage: WechatBirdStage, id: string) {
  if (!stage.snapshot().controls.some((item) => item.id === `compose:${id}`)) {
    click(stage, 'compose-all');
    for (let page = 0; page < 15 && !stage.snapshot().controls.some((item) => item.id === `compose:${id}`); page++) click(stage, 'compose-next');
    click(stage, `compose:${id}`);
  }
  click(stage, `compose:${id}`);
}

describe('Sichuan WeChat internal-test journey', () => {
  it.each([[320, 568, 20, 568], [390, 844, 47, 810], [320, 568, 100, 444]])(
    'starts on the notebook home and navigates fixed pages at %spx', (width, height, top, bottom) => {
      const { stage } = setup(width, height, top, bottom);
      expect(stage.snapshot().scene).toBe('landing');
      expect(stage.snapshot().hasSession).toBe(false);
      assertWechatTouchTargets(stage);
      click(stage, 'levels');
      const found = new Set<string>();
      for (let page = 0; page < 25; page++) {
        assertWechatTouchTargets(stage);
        stage.snapshot().controls.filter((item) => item.id.startsWith('open:')).forEach((item) => found.add(item.id));
        if (!stage.snapshot().controls.some((item) => item.id === 'page-next')) break;
        click(stage, 'page-next');
      }
      expect(found.size).toBe(25);
      click(stage, 'scene-back'); click(stage, 'collection');
      const birds = new Set<string>();
      for (let page = 0; page < 100; page++) {
        assertWechatTouchTargets(stage);
        stage.snapshot().controls.filter((item) => item.id.startsWith('species:')).forEach((item) => birds.add(item.id));
        if (!stage.snapshot().controls.some((item) => item.id === 'page-next')) break;
        click(stage, 'page-next');
      }
      expect(birds.size).toBe(100);
      const species = stage.snapshot().controls.find((item) => item.id.startsWith('species:'))!;
      click(stage, species.id); assertWechatTouchTargets(stage);
      click(stage, 'scene-back');
      expect(stage.snapshot().controls.some((item) => item.id === species.id)).toBe(true);
      click(stage, 'scene-back'); click(stage, 'settings'); assertWechatTouchTargets(stage);
      click(stage, 'sources'); assertWechatTouchTargets(stage);
    });

  it('shows three first-play instructions once, and can reopen them without changing a game', () => {
    const { stage, values } = setup();
    click(stage, 'start-game');
    for (let step = 0; step < 3; step++) {
      expect(stage.snapshot().overlay).toBe('tutorial'); assertWechatTouchTargets(stage); click(stage, 'tutorial-next');
    }
    expect(stage.snapshot().overlay).toBe('none');
    expect((values.get(WECHAT_PREFERENCES_KEY) as { tutorialSeen: boolean }).tutorialSeen).toBe(true);
    take(stage, getExposedBoardTiles(stage.getState())[0].id);
    const state = structuredClone(stage.getState());
    click(stage, 'home'); click(stage, 'settings'); click(stage, 'help');
    click(stage, 'tutorial-close');
    expect(stage.snapshot().scene).toBe('settings');
    click(stage, 'scene-back'); click(stage, 'continue-game');
    expect(stage.snapshot().overlay).toBe('none'); expect(stage.getState()).toEqual(state);
  });

  it('persists a real engine trace, composition and undo allowance across a new runtime', () => {
    const { stage, values } = setup(); stage.openPuzzle(1, 1);
    const puzzle = REGIONAL_V7_PUZZLES[0];
    const firstCompose = puzzle.level.winningSolution.findIndex((action) => action.type === 'compose');
    for (const action of puzzle.level.winningSolution.slice(0, firstCompose + 1)) {
      if (action.type === 'take') take(stage, action.tileId); else compose(stage, action.birdId);
    }
    stage.undo();
    const expected = structuredClone(stage.getState()); stage.suspend();
    const resumed = setup(390, 844, 47, 810, values).stage;
    expect(resumed.snapshot().scene).toBe('landing'); expect(resumed.snapshot().hasSession).toBe(true);
    click(resumed, 'continue-game'); click(resumed, 'tutorial-close');
    expect(resumed.getState()).toEqual(expected); expect(resumed.snapshot().undoRemaining).toBe(2);
    assertWechatTouchTargets(resumed);
    resumed.undo();
    expect(resumed.snapshot().undoRemaining).toBe(1);
    expect(resumed.snapshot().trayOccupancy).toBe(stage.snapshot().trayOccupancy - 1);
    expect(resumed.snapshot().remainingTiles).toBe(stage.snapshot().remainingTiles + 1);
  });

  it('preserves a full-tray loss and restores the previous legal state with one undo after reload', () => {
    const puzzle = REGIONAL_V7_PUZZLES.find((item) => item.record.tier === 5)!;
    let state = createGameFromLevel(puzzle.level), path: string[] = [];
    for (let trial = 0; trial < 32; trial++) {
      state = createGameFromLevel(puzzle.level); path = [];
      for (let count = 0; count < 10 && state.phase === 'playing'; count++) {
        const exposed = getExposedBoardTiles(state), tile = exposed[(trial + count * 7) % exposed.length];
        path.push(tile.id); state = selectBoardTile(state, tile.id);
      }
      if (state.phase === 'game_over') break;
    }
    expect(state.phase).toBe('game_over');
    const { stage, values } = setup(); stage.openPuzzle(5, 1);
    for (const id of path) take(stage, id);
    expect(stage.getState()).toEqual(state);
    const restored = setup(320, 568, 20, 568, values).stage;
    click(restored, 'continue-game'); click(restored, 'tutorial-close');
    expect(restored.getState()).toEqual(state); restored.undo();
    expect(restored.snapshot().phase).toBe('playing'); expect(restored.snapshot().trayOccupancy).toBe(9);
  });

  it('commits discoveries only on victory, clears the session, and starts the next incomplete puzzle', () => {
    const { stage, values } = setup(); stage.openPuzzle(1, 1);
    const puzzle = REGIONAL_V7_PUZZLES[0];
    for (const action of puzzle.level.winningSolution) {
      if (action.type === 'take') take(stage, action.tileId); else compose(stage, action.birdId);
      if (stage.getState().phase !== 'level_complete') expect(stage.snapshot().discoveredSpeciesIds).toHaveLength(0);
    }
    expect(stage.snapshot().phase).toBe('level_complete'); expect(stage.snapshot().hasSession).toBe(false);
    expect(values.get(WECHAT_SESSION_KEY)).toBeNull();
    expect(stage.snapshot().discoveredSpeciesIds).toEqual(expect.arrayContaining(puzzle.level.compositions!.map((bird) => bird.speciesId)));
    const before = stage.snapshot().discoveredSpeciesIds;
    click(stage, 'home'); click(stage, 'collection'); click(stage, 'filter-discovered');
    expect(collectionSpecies({ discoveredOnly: true, tierFilter: 0, discovered: before })).toHaveLength(before.length);
    click(stage, 'scene-back'); click(stage, 'start-game'); click(stage, 'tutorial-close');
    expect(stage.snapshot().puzzleId).toBe(REGIONAL_V7_PUZZLES[1].record.puzzleId);
    expect(stage.snapshot().discoveredSpeciesIds).toEqual(before);
  });

  it('asks before replacing an unfinished puzzle and leaves it unchanged when cancelled', () => {
    const { stage } = setup(); stage.openPuzzle(1, 1); take(stage, getExposedBoardTiles(stage.getState())[0].id);
    const before = structuredClone(stage.getState());
    click(stage, 'home'); click(stage, 'levels'); click(stage, 'open:1:2');
    expect(stage.snapshot().overlay).toBe('switch-confirm'); assertWechatTouchTargets(stage);
    click(stage, 'switch-cancel'); expect(stage.getState()).toEqual(before);
    click(stage, 'open:1:2'); click(stage, 'switch-confirm'); click(stage, 'tutorial-close');
    expect(stage.snapshot().puzzleId).toBe(REGIONAL_V7_PUZZLES[1].record.puzzleId);
    expect(stage.snapshot().trayOccupancy).toBe(0);
  });

  it('persists vibration and motion settings and reports source copy success or failure truthfully', async () => {
    const signals: string[] = [];
    const { stage, values } = setup(320, 568, 20, 568, undefined, { vibrate: (signal) => signals.push(signal), copyText: async () => false });
    click(stage, 'settings'); click(stage, 'toggle-vibration'); click(stage, 'toggle-motion');
    click(stage, 'sources'); click(stage, 'copy-source');
    await new Promise((resolve) => setTimeout(resolve, 0)); expect(stage.snapshot().status).toContain('复制失败');
    stage.openPuzzle(1, 1); take(stage, getExposedBoardTiles(stage.getState())[0].id);
    expect(signals).toEqual([]);
    const reloaded = setup(320, 568, 20, 568, values, { vibrate() {}, copyText: async () => true }).stage;
    expect(reloaded.snapshot().preferences).toMatchObject({ vibration: false, motion: false });
    click(reloaded, 'settings'); click(reloaded, 'sources'); click(reloaded, 'copy-source');
    await new Promise((resolve) => setTimeout(resolve, 0)); expect(reloaded.snapshot().status).toContain('已复制');
  });

  it('ignores invalid sessions without erasing historical progress or silently swapping puzzle identities', () => {
    const known = V7_SPECIES_MASTER[0].id, completed = REGIONAL_V7_PUZZLES[0].record.puzzleId;
    const values = new Map<string, unknown>([[WECHAT_STORAGE_KEY,
      { version: 1, discoveredSpeciesIds: [known], completedPuzzleIds: [completed] }],
    [WECHAT_SESSION_KEY, { version: 1, puzzleId: 'obsolete', actions: [] }]]);
    const { stage } = setup(320, 568, 20, 568, values);
    expect(stage.snapshot().hasSession).toBe(false); expect(stage.snapshot().status).toContain('无法恢复');
    expect(stage.snapshot().completedPuzzleIds).toContain(completed);
    expect(stage.snapshot().discoveredSpeciesIds).toEqual([known]);
    expect((values.get(WECHAT_SESSION_KEY) as { puzzleId: string }).puzzleId).toBe('obsolete');
  });

  it('keeps the game usable and makes write failures visible', () => {
    const stage = new WechatBirdStage(context(), { width: 320, height: 568, safeTop: 20, safeBottom: 568 },
      { get() { return undefined; }, set() { throw new Error('storage full'); } });
    click(stage, 'start-game'); click(stage, 'tutorial-close');
    take(stage, getExposedBoardTiles(stage.getState())[0].id);
    expect(stage.snapshot().trayOccupancy).toBe(1); expect(stage.snapshot().status).toContain('存档暂不可用');
  });
});

describe('bounded saved-session verification', () => {
  it('independently reconstructs a checkpoint for every current puzzle without stored engine state', () => {
    for (const puzzle of REGIONAL_V7_PUZZLES) {
      const { stage, values } = setup(); stage.openPuzzle(puzzle.record.tier, puzzle.record.stageIndex);
      const prefix = puzzle.level.winningSolution.slice(0, 12);
      for (const action of prefix) {
        if (action.type === 'take') take(stage, action.tileId); else compose(stage, action.birdId);
      }
      const restored = restoreWechatSession(values.get(WECHAT_SESSION_KEY));
      expect(restored?.state).toEqual(stage.getState());
      expect(restored?.history).toHaveLength(prefix.length);
    }
  });

  it('rejects illegal takes, duplicate consumption, wrong hashes/versions, oversized traces and invalid undo credits', () => {
    const { stage, values } = setup(); stage.openPuzzle(1, 1);
    const tile = getExposedBoardTiles(stage.getState())[0].id; take(stage, tile);
    const valid = values.get(WECHAT_SESSION_KEY) as Record<string, unknown>;
    expect(restoreWechatSession(valid)).not.toBeNull();
    for (const change of [{ boardHash: 'wrong' }, { rulesetVersion: 'old' }, { undoRemaining: 4 },
      { undoRemaining: -1 }, { actions: [{ type: 'take', tileId: 'unknown' }] },
      { actions: [{ type: 'take', tileId: tile }, { type: 'take', tileId: tile }] },
      { actions: [{ type: 'compose', birdId: 'bird:bailu' }] },
      { actions: Array(181).fill({ type: 'take', tileId: tile }) }]) {
      expect(restoreWechatSession({ ...valid, ...change })).toBeNull();
    }
    const blocked = stage.getState().boardTiles.find((item) => item.blockedBy.length > 0)!;
    expect(restoreWechatSession({ ...valid, actions: [{ type: 'take', tileId: blocked.id }] })).toBeNull();
  });
});
