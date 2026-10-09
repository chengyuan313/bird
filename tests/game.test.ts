import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
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
import { getBoardTilePresentation } from '../src/ui/render';
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
      expect(findFormableBirds(state.tray).map((bird) => bird.id)).toContain(action.birdId);
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
    expect(tileById.size).toBe(level.tiles.length);

    for (const tile of level.tiles) {
      for (const blockerId of tile.blockedBy) {
        const blocker = tileById.get(blockerId);
        expect(blocker).toBeDefined();
        expect(blocker!.layer).toBeGreaterThan(tile.layer);
        const overlaps = blocker!.x < tile.x + 61
          && blocker!.x + 61 > tile.x
          && blocker!.y < tile.y + 61
          && blocker!.y + 61 > tile.y;
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
      name: '白白鹭',
      characters: ['白', '白', '鹭'],
      score: 30,
      assetKey: 'test-repeat',
    };
    expect(findFormableBirds(trayFrom('白鹭'), [repeatedBird])).toEqual([]);
    expect(findFormableBirds(trayFrom('鹭白白'), [repeatedBird])).toEqual([repeatedBird]);

    const composed = composeBird(
      { ...createGame(), tray: trayFrom('白鹭白白') },
      repeatedBird.id,
      [repeatedBird],
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

describe('authored levels and winning paths', () => {
  it('keeps the requested tile counts and true logical depths', () => {
    expect(AUTHORED_LEVELS.map((level) => level.tiles.length)).toEqual([22, 33, 59]);
    expect(AUTHORED_LEVELS.map((level) => Math.max(...level.tiles.map((tile) => tile.layer)))).toEqual([2, 3, 7]);
  });

  it('gives Level 3 the intended main, auxiliary, and blind proportions', () => {
    const level = AUTHORED_LEVELS[2];
    const counts = level.tiles.reduce<Record<string, number>>((total, tile) => {
      const region = tile.region ?? 'main';
      total[region] = (total[region] ?? 0) + 1;
      return total;
    }, {});
    expect(counts).toEqual({ main: 40, auxiliary: 12, blind: 7 });
  });

  it('keeps only the top blind-stack character visible initially', () => {
    const state = createGame('level-3');
    const blindTiles = state.boardTiles.filter((tile) => tile.region === 'blind');
    expect(blindTiles.filter((tile) => isBoardTileExposed(state, tile.id)).map((tile) => tile.id))
      .toEqual(['l3-q01']);
    expect(blindTiles.filter((tile) => !isBoardTileExposed(state, tile.id))).toHaveLength(6);
    const hidden = blindTiles.find((tile) => tile.id === 'l3-q02')!;
    const presentation = getBoardTilePresentation(hidden, false);
    expect(presentation).toEqual({ text: '？', ariaLabel: '隐藏字，被遮挡' });
    expect(`${presentation.text}${presentation.ariaLabel}`).not.toContain(hidden.character);
  });

  it('interleaves Level 3 birds across blockers, regions, and depths', () => {
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
      return new Set(tiles.map((tile) => tile.region ?? 'main')).size > 1
        && new Set(tiles.map((tile) => tile.layer)).size > 1;
    })).toBe(true);
  });

  it('starts generated Level 3 with multiple exposed choices and an empty tray', () => {
    const state = createGame('level-3');
    const exposed = getExposedBoardTiles(state);
    expect(exposed.length).toBeGreaterThan(10);
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
