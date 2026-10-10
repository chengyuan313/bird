import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG, LEGACY_GAMEPLAY_BIRD_CATALOG, compositionForBird } from '../src/core/birdCatalog';
import {
  advanceLevel,
  composeBird,
  createGame,
  evaluateTerminalState,
  findFormableBirds,
  getExposedBoardTiles,
  isBoardTileExposed,
  restartLevel,
  selectBoardTile,
  TRAY_SIZE,
} from '../src/core/game';
import { AUTHORED_LEVELS } from '../src/core/levels';
import { replaySolution } from '../tools/level3Solver';
import { getBoardTilePresentation, renderGame } from '../src/ui/render';
import type {
  GameState,
  LevelDefinition,
  RackTile,
} from '../src/core/types';

function trayFrom(text: string): Array<RackTile | null> {
  const tiles = Array.from(text).map((character, index) => ({ id: `tray-${index}`, character }));
  return [...tiles, ...Array<RackTile | null>(Math.max(0, TRAY_SIZE - tiles.length)).fill(null)];
}

function withEmptyBoard(state: GameState): GameState {
  return {
    ...state,
    boardTiles: state.boardTiles.map((tile) => ({ ...tile, removed: true })),
  };
}

describe('victory progression', () => {
  it('advances through Levels 1 and 2 into the beginner Level 3 pool', () => {
    let state = createGame('level-1');
    expect(advanceLevel(state)).toBe(state);
    for (const expectedNext of ['level-2', 'level-3']) {
      const level = AUTHORED_LEVELS.find((candidate) => candidate.id === state.levelId)!;
      state = replaySolution(level, level.winningSolution);
      expect(state.phase).toBe('level_complete');
      state = advanceLevel(state);
      expect(state.levelId).toBe(expectedNext);
      expect(state.score).toBe(0);
      expect(state.tray.every((tile) => tile === null)).toBe(true);
      expect(state.boardTiles.every((tile) => !tile.removed)).toBe(true);
    }
    expect(state.activeCatalog.length).toBeGreaterThanOrEqual(18);
    expect(state.activeCatalog.length).toBeLessThanOrEqual(22);
    const completed = replaySolution(AUTHORED_LEVELS[2], AUTHORED_LEVELS[2].winningSolution);
    expect(advanceLevel(completed)).toBe(completed);
  });
});

function renderMarkup(state: GameState): string {
  const root = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
  renderGame(root, state, () => undefined);
  return root.innerHTML;
}

describe('progression and bird-reference presentation', () => {
  it('shows next level first on Level 1 and 2 victories', () => {
    for (const id of ['level-1', 'level-2']) {
      const state = replaySolution(AUTHORED_LEVELS.find((level) => level.id === id)!, AUTHORED_LEVELS.find((level) => level.id === id)!.winningSolution);
      const markup = renderMarkup(state);
      expect(markup).toContain('data-action="next-level">下一关');
      expect(markup).toContain('class="secondary" data-action="restart">重新挑战');
      expect(markup).not.toContain('class="bird-reference"');
    }
  });

  it('lists only sampled Chinese names and marks completed birds without changing state', () => {
    const initial = createGame('level-3', 1);
    const before = JSON.stringify(initial);
    const markup = renderMarkup(initial);
    expect(markup).toContain('<details class="bird-reference" >');
    expect(markup).toContain(`本关鸟名 · 点此查看 <span>${initial.activeCompositions.length} 种</span>`);
    for (const bird of initial.activeCatalog) expect(markup).toContain(`<li class="">${bird.name}</li>`);
    expect(markup).not.toContain('scientificName');
    expect(JSON.stringify(initial)).toBe(before);

    const completed = replaySolution(AUTHORED_LEVELS[2], AUTHORED_LEVELS[2].winningSolution);
    const victory = renderMarkup(completed);
    expect(victory).toContain('data-action="new-board">换一局');
    expect(victory).toContain('class="secondary" data-action="restart">重试本局');
    expect(victory).toContain('<small>已拼成</small>');
  });
});

function solutionGroups(level: LevelDefinition): Array<{ birdId: string; tileIds: string[] }> {
  const groups: Array<{ birdId: string; tileIds: string[] }> = [];
  let taken: string[] = [];
  for (const action of level.winningSolution) {
    if (action.type === 'take') taken.push(action.tileId);
    if (action.type === 'compose') {
      groups.push({ birdId: action.birdId, tileIds: taken });
      taken = [];
    }
  }
  return groups;
}

function replayWinningSolution(level: LevelDefinition): {
  state: GameState;
  maxTrayCount: number;
  takenIds: string[];
  consumedIds: string[];
} {
  let state = createGame(level.id);
  let maxTrayCount = 0;
  const takenIds: string[] = [];
  const consumedIds: string[] = [];

  for (const action of level.winningSolution) {
    if (action.type === 'take') {
      expect(isBoardTileExposed(state, action.tileId)).toBe(true);
      const previousTrayCount = state.tray.filter(Boolean).length;
      const next = selectBoardTile(state, action.tileId);
      expect(next).not.toBe(state);
      expect(next.tray.filter(Boolean)).toHaveLength(previousTrayCount + 1);
      state = next;
      takenIds.push(action.tileId);
      maxTrayCount = Math.max(maxTrayCount, state.tray.filter(Boolean).length);
    } else {
      expect(findFormableBirds(state.tray, state.activeCompositions).map((bird) => bird.id)).toContain(action.birdId);
      const beforeIds = state.tray.flatMap((tile) => tile ? [tile.id] : []);
      state = composeBird(state, action.birdId);
      const afterIds = new Set(state.tray.flatMap((tile) => tile ? [tile.id] : []));
      consumedIds.push(...beforeIds.filter((id) => !afterIds.has(id)));
    }
  }

  return { state, maxTrayCount, takenIds, consumedIds };
}

describe('interconnected layered board', () => {
  it('rejects blocked tiles and accepts exposed tiles', () => {
    const state = createGame();
    const blocked = state.boardTiles.find((tile) => tile.blockedBy.length > 0)!;
    const exposed = getExposedBoardTiles(state)[0];
    expect(selectBoardTile(state, blocked.id)).toBe(state);
    expect(selectBoardTile(state, exposed.id)).not.toBe(state);
  });

  it('removing a blocker exposes previously blocked tiles', () => {
    const state = createGame('level-1');
    expect(isBoardTileExposed(state, 'l1-n01')).toBe(false);
    expect(isBoardTileExposed(state, 'l1-n02')).toBe(false);
    const next = selectBoardTile(state, 'l1-u01');
    expect(isBoardTileExposed(next, 'l1-n01')).toBe(true);
    expect(isBoardTileExposed(next, 'l1-n02')).toBe(true);
  });

  it('contains cross-bird blocking in real level data', () => {
    const hasCrossBirdBlock = AUTHORED_LEVELS.some((level) => {
      const groupByTile = new Map<string, number>();
      solutionGroups(level).forEach((group, groupIndex) => {
        group.tileIds.forEach((tileId) => groupByTile.set(tileId, groupIndex));
      });
      return level.tiles.some((tile) => tile.blockedBy.some(
        (blockerId) => groupByTile.get(blockerId) !== groupByTile.get(tile.id),
      ));
    });
    expect(hasCrossBirdBlock).toBe(true);
  });

  it('has one blocker that reveals multiple tiles and tiles with multiple blockers', () => {
    const level = AUTHORED_LEVELS[0];
    const blockedCounts = new Map<string, number>();
    level.tiles.forEach((tile) => tile.blockedBy.forEach((id) => {
      blockedCounts.set(id, (blockedCounts.get(id) ?? 0) + 1);
    }));
    expect([...blockedCounts.values()].some((count) => count >= 2)).toBe(true);
    expect(level.tiles.some((tile) => tile.blockedBy.length >= 2)).toBe(true);
  });

  it('distributes a single bird name across separate regions and depths', () => {
    const level = AUTHORED_LEVELS[0];
    const tileById = new Map(level.tiles.map((tile) => [tile.id, tile]));
    const distributed = solutionGroups(level).some((group) => {
      const tiles = group.tileIds.map((id) => tileById.get(id)!);
      return tiles.some((first) => tiles.some((second) =>
        first.layer !== second.layer && Math.hypot(first.x - second.x, first.y - second.y) > 100,
      ));
    });
    expect(distributed).toBe(true);
  });

  it.each(AUTHORED_LEVELS)('$label has valid, acyclic, visually overlapping blockers', (level) => {
    const tileById = new Map(level.tiles.map((tile) => [tile.id, tile]));
    const tileSize = level.id === 'level-3' ? 44 : 61;
    expect(tileById.size).toBe(level.tiles.length);

    for (const tile of level.tiles) {
      for (const blockerId of tile.blockedBy) {
        const blocker = tileById.get(blockerId);
        expect(blocker).toBeDefined();
        expect(blocker!.layer).toBeGreaterThan(tile.layer);
        const scale = level.id === 'level-3' ? tileSize / 2 : 1;
        const overlaps = blocker!.x * scale < tile.x * scale + tileSize
          && blocker!.x * scale + tileSize > tile.x * scale
          && blocker!.y * scale < tile.y * scale + tileSize
          && blocker!.y * scale + tileSize > tile.y * scale;
        expect(overlaps, `${blockerId} must overlap ${tile.id}`).toBe(true);
      }
    }
  });
});

describe('terminal-state evaluation', () => {
  it('does not declare victory while an empty board still has tray tiles', () => {
    const state = withEmptyBoard({ ...createGame(), tray: trayFrom('大') });
    expect(evaluateTerminalState(state.boardTiles, state.tray)).not.toBe('level_complete');
  });

  it('keeps an empty board playable while the tray has a valid bird', () => {
    const state = withEmptyBoard({ ...createGame(), tray: trayFrom('喜鹊') });
    expect(evaluateTerminalState(state.boardTiles, state.tray)).toBe('playing');
  });

  it('games over on an empty board with an impossible non-empty tray', () => {
    const state = withEmptyBoard({ ...createGame(), tray: trayFrom('大') });
    expect(evaluateTerminalState(state.boardTiles, state.tray)).toBe('game_over');
  });

  it('completes only when both board and tray are empty', () => {
    const state = withEmptyBoard(createGame());
    expect(evaluateTerminalState(state.boardTiles, state.tray)).toBe('level_complete');
  });

  it('games over when the final board tile fills the tray without a formable bird', () => {
    const initial = createGame();
    const finalTile = initial.boardTiles.find((tile) => tile.character === '喜')!;
    const state = {
      ...initial,
      tray: trayFrom('大大大大大大大大大'),
      boardTiles: initial.boardTiles.map((tile) => ({ ...tile, removed: tile.id !== finalTile.id })),
    };
    expect(selectBoardTile(state, finalTile.id).phase).toBe('game_over');
  });

  it('composing the final bird immediately completes the level', () => {
    const state = withEmptyBoard({ ...createGame(), tray: trayFrom('喜鹊'), phase: 'playing' });
    const next = composeBird(state, 'bird:xique');
    expect(next.tray.every((tile) => tile === null)).toBe(true);
    expect(next.phase).toBe('level_complete');
  });

  it('keeps a full tray playable when at least one bird is formable', () => {
    const state = { ...createGame(), tray: trayFrom('喜鹊大大大大大大大大') };
    expect(evaluateTerminalState(state.boardTiles, state.tray)).toBe('playing');
  });
});

describe('automatic recognition and one-tap composition', () => {
  it('recognizes one bird regardless of tray order', () => {
    expect(findFormableBirds(trayFrom('鹊喜')).map((bird) => bird.id)).toContain('bird:xique');
  });

  it('recognizes multiple simultaneous options', () => {
    const ids = findFormableBirds(trayFrom('红隼腹锦鸡')).map((bird) => bird.id);
    expect(ids).toContain('bird:hongsun');
    expect(ids).toContain('bird:hongfujinji');
  });

  it('respects duplicate-character quantities during recognition', () => {
    const repeatedBird = {
      id: 'bird:test-repeat',
      speciesId: 'bird:test-repeat',
      name: '白白鹭',
      characters: ['白', '白', '鹭'],
      score: 30,
      assetKey: 'test-repeat',
    };
    expect(findFormableBirds(trayFrom('白鹭'), [repeatedBird])).toEqual([]);
    expect(findFormableBirds(trayFrom('鹭白白'), [repeatedBird])).toEqual([repeatedBird]);

    const composed = composeBird(
      { ...createGame(), tray: trayFrom('白鹭白白'), activeCompositions: [repeatedBird] },
      repeatedBird.id,
    );
    expect(composed.tray.map((tile) => tile?.character ?? null).slice(0, 4)).toEqual([
      null, null, null, '白',
    ]);
  });

  it('consumes the earliest matching tiles and preserves unrelated characters', () => {
    const state = { ...createGame(), tray: trayFrom('白隼鹭白') };
    const next = composeBird(state, 'bird:bailu');
    expect(next.tray.map((tile) => tile?.character ?? null).slice(0, 4)).toEqual([
      null, '隼', null, '白',
    ]);
  });

  it('lets the player choose a short or long bird without auto-consuming either', () => {
    const state = { ...createGame(), tray: trayFrom('红隼腹锦鸡') };
    const short = composeBird(state, 'bird:hongsun');
    expect(short.tray.flatMap((tile) => tile ? [tile.character] : [])).toEqual(['腹', '锦', '鸡']);
    expect(state.score).toBe(0);

    const long = composeBird(state, 'bird:hongfujinji');
    expect(long.tray.flatMap((tile) => tile ? [tile.character] : [])).toEqual(['隼']);
  });

  it('keeps expanded species unavailable in Levels 1 and 2', () => {
    const tray = trayFrom('家燕');
    expect(findFormableBirds(tray).map((bird) => bird.id)).not.toContain('bird:jiayan');
    expect(findFormableBirds(tray, BIRD_CATALOG.map(compositionForBird)).map((bird) => bird.id)).toContain('bird:jiayan');
    const state = { ...createGame(), tray };
    expect(composeBird(state, 'bird:jiayan')).toBe(state);
    expect(composeBird({ ...state, activeCompositions: BIRD_CATALOG.map(compositionForBird) }, 'bird:jiayan').tray.every((tile) => tile === null)).toBe(true);
    expect(LEGACY_GAMEPLAY_BIRD_CATALOG.map((bird) => bird.id)).toContain('bird:xiaobailu');
  });

  it('returns the original state for invalid and unformable bird requests', () => {
    const state = { ...createGame(), tray: trayFrom('喜') };
    expect(composeBird(state, 'bird:not-real')).toBe(state);
    expect(composeBird(state, 'bird:xique')).toBe(state);
  });

  it('updates score, completed count, and discovery state', () => {
    const state = { ...createGame(), tray: trayFrom('喜鹊') };
    const next = composeBird(state, 'bird:xique');
    expect(next).toMatchObject({
      score: 10,
      completedBirdCount: 1,
      discoveredBirdIds: ['bird:xique'],
      lastCompletedBird: { birdId: 'bird:xique', score: 10, isNew: true },
    });
  });

  it('works during board-empty cleanup', () => {
    const state = withEmptyBoard({ ...createGame(), tray: trayFrom('喜鹊大'), phase: 'playing' });
    const next = composeBird(state, 'bird:xique');
    expect(next.tray.flatMap((tile) => tile ? [tile.character] : [])).toEqual(['大']);
    expect(next.phase).toBe('game_over');
  });
});

describe('explicit Level 2 bird-name compositions', () => {
  it.each([
    ['bird:dashanque', ['l2-z04', 'l2-z05', 'l2-z10', 'l2-z11', 'l2-m05', 'l2-m10']],
    ['composition:maque', ['l2-z09', 'l2-z10', 'l2-z11', 'l2-m09', 'l2-m10']],
    ['bird:shumaque', ['l2-z08', 'l2-z09', 'l2-z10', 'l2-z11', 'l2-m08', 'l2-m09', 'l2-m10']],
    ['bird:shanmaque', ['l2-z04', 'l2-z05', 'l2-z09', 'l2-z10', 'l2-z11', 'l2-m05', 'l2-m09', 'l2-m10']],
  ])('can reach and compose %s through legal Level 2 tile takes', (id, tileIds) => {
    let state = createGame('level-2');
    for (const tileId of tileIds) {
      expect(isBoardTileExposed(state, tileId)).toBe(true);
      state = selectBoardTile(state, tileId);
      expect(state.phase).toBe('playing');
    }
    expect(findFormableBirds(state.tray, state.activeCompositions).map((bird) => bird.id)).toContain(id);
    const next = composeBird(state, id);
    expect(next).not.toBe(state);
    expect(next.completedBirdCount).toBe(1);
    expect(next.boardTiles.filter((tile) => tile.removed)).toHaveLength(tileIds.length);
  });

  it.each([
    ['bird:dashanque', '大山雀', 30],
    ['composition:maque', '麻雀', 10],
    ['bird:shumaque', '树麻雀', 30],
    ['bird:shanmaque', '山麻雀', 30],
  ])('recognizes and consumes %s from its exact spelling', (id, spelling, score) => {
    const state = { ...createGame('level-2'), tray: trayFrom(String(spelling)) };
    expect(findFormableBirds(state.tray, state.activeCompositions).map((bird) => bird.id)).toContain(id);
    const next = composeBird(state, String(id));
    expect(next).not.toBe(state);
    expect(next.tray.every((tile) => tile === null)).toBe(true);
    expect(next.score).toBe(score);
    expect(next.completedBirdCount).toBe(1);
  });

  it('offers all four spellings from a shared-character tray without auto-consuming', () => {
    const state = { ...createGame('level-2'), tray: trayFrom('大树山麻雀') };
    expect(findFormableBirds(state.tray, state.activeCompositions).map((bird) => bird.id))
      .toEqual(expect.arrayContaining(['bird:dashanque', 'composition:maque', 'bird:shumaque', 'bird:shanmaque']));
    expect(state.tray.filter(Boolean)).toHaveLength(5);
    expect(state.score).toBe(0);
  });

  it('maps 麻雀 and 树麻雀 to one discovery, but 山麻雀 to another', () => {
    const initial = { ...createGame('level-2'), tray: trayFrom('树麻雀麻雀') };
    const tree = composeBird(initial, 'bird:shumaque');
    expect(tree.discoveredBirdIds).toEqual(['bird:shumaque']);
    expect(tree.lastCompletedBird?.isNew).toBe(true);
    const alias = composeBird(tree, 'composition:maque');
    expect(alias.discoveredBirdIds).toEqual(['bird:shumaque']);
    expect(alias.lastCompletedBird).toMatchObject({ birdId: 'composition:maque', score: 10, isNew: false });
    expect(alias.completedBirdCount).toBe(2);
    expect(alias.score).toBe(40);

    const mountain = composeBird({ ...createGame('level-2'), tray: trayFrom('山麻雀') }, 'bird:shanmaque');
    expect(mountain.discoveredBirdIds).toEqual(['bird:shanmaque']);
    expect(mountain.discoveredBirdIds).not.toEqual(tree.discoveredBirdIds);
  });

  it('keeps board-empty cleanup playable until the alias is consumed', () => {
    const state = withEmptyBoard({ ...createGame('level-2'), tray: trayFrom('麻雀') });
    expect(evaluateTerminalState(state.boardTiles, state.tray, state.activeCompositions)).toBe('playing');
    const next = composeBird(state, 'composition:maque');
    expect(next.phase).toBe('level_complete');
    expect(next.tray.every((tile) => tile === null)).toBe(true);
  });

  it('rejects incomplete spellings and keeps non-Level-2 vocabularies closed', () => {
    const state = { ...createGame('level-2'), tray: trayFrom('麻') };
    expect(findFormableBirds(state.tray, state.activeCompositions).some((bird) => bird.id === 'composition:maque')).toBe(false);
    expect(composeBird(state, 'composition:maque')).toBe(state);
    const level1 = { ...createGame('level-1'), tray: trayFrom('大山雀麻') };
    expect(composeBird(level1, 'bird:dashanque')).toBe(level1);
    expect(composeBird(level1, 'composition:maque')).toBe(level1);
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(createGame('level-3', seed).activeCompositions.some((bird) => bird.id === 'composition:maque')).toBe(false);
    }
  });
});

describe('authored levels and winning paths', () => {
  it('keeps the requested tile counts and true logical depths', () => {
    expect(AUTHORED_LEVELS.map((level) => level.tiles.length)).toEqual([22, 33, 90]);
    expect(AUTHORED_LEVELS.map((level) => Math.max(...level.tiles.map((tile) => tile.layer)))).toEqual([2, 3, 4]);
  });

  it('uses the connected Piachan board without auxiliary or blind regions', () => {
    const level = AUTHORED_LEVELS[2];
    const counts = level.tiles.reduce<Record<string, number>>((total, tile) => {
      const region = tile.region ?? 'main';
      total[region] = (total[region] ?? 0) + 1;
      return total;
    }, {});
    expect(counts).toEqual({ main: 90 });
  });

  it('shows covered Piachan characters without blind-stack masking', () => {
    const state = createGame('level-3');
    expect(state.boardTiles.some((tile) => tile.region === 'blind')).toBe(false);
    const covered = state.boardTiles.find((tile) => !isBoardTileExposed(state, tile.id))!;
    expect(getBoardTilePresentation(covered, false).text).toBe(covered.character);
  });

  it('interleaves Level 3 birds across blockers and depths', () => {
    const level = AUTHORED_LEVELS[2];
    const tileById = new Map(level.tiles.map((tile) => [tile.id, tile]));
    const groupByTile = new Map<string, number>();
    const groups = solutionGroups(level);
    groups.forEach((group, index) => group.tileIds.forEach((id) => groupByTile.set(id, index)));

    expect(level.tiles.some((tile) => tile.blockedBy.some(
      (blockerId) => groupByTile.get(blockerId) !== groupByTile.get(tile.id),
    ))).toBe(true);
    expect(groups.some((group) => {
      const tiles = group.tileIds.map((id) => tileById.get(id)!);
      return new Set(tiles.map((tile) => tile.layer)).size > 1;
    })).toBe(true);
  });

  it('starts generated Level 3 with multiple exposed choices and an empty tray', () => {
    const state = createGame('level-3');
    const exposed = getExposedBoardTiles(state);
    expect(exposed.length).toBeGreaterThanOrEqual(8);
    expect(state.tray.every((tile) => tile === null)).toBe(true);
    expect(findFormableBirds(state.tray)).toHaveLength(0);
  });

  it.each(AUTHORED_LEVELS)('$label solution obeys exposure and capacity and consumes every tile', (level) => {
    const result = replayWinningSolution(level);
    const expectedIds = level.tiles.map((tile) => tile.id).sort();
    expect(result.maxTrayCount).toBeLessThanOrEqual(TRAY_SIZE);
    expect(result.takenIds.sort()).toEqual(expectedIds);
    expect(result.consumedIds.sort()).toEqual(expectedIds);
    expect(result.state.boardTiles.every((tile) => tile.removed)).toBe(true);
    expect(result.state.tray.every((tile) => tile === null)).toBe(true);
    expect(result.state.phase).toBe('level_complete');
  });

  it('keeps stable semantic bird IDs unchanged', () => {
    expect(BIRD_CATALOG.find((bird) => bird.name === '喜鹊')).toMatchObject({
      id: 'bird:xique', assetKey: 'xique',
    });
    expect(BIRD_CATALOG.find((bird) => bird.name === '红腹锦鸡')).toMatchObject({
      id: 'bird:hongfujinji', assetKey: 'hongfujinji',
    });
  });

  it('restarting restores the exact authored level', () => {
    const initial = createGame('level-2');
    const played = selectBoardTile(initial, getExposedBoardTiles(initial)[0].id);
    expect(restartLevel({ ...played, score: 70 })).toEqual(initial);
  });
});
