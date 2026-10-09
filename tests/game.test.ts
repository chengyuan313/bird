import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  composeSelectedBird,
  createGame,
  evaluateTerminalState,
  getExposedBoardTiles,
  getSelectedBird,
  isBoardTileExposed,
  restartLevel,
  selectBoardTile,
  toggleTrayTile,
  TRAY_SIZE,
} from '../src/core/game';
import { AUTHORED_LEVELS } from '../src/core/levels';
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
  let selected: string[] = [];
  for (const action of level.winningSolution) {
    if (action.type === 'select') selected.push(action.tileId);
    if (action.type === 'compose') {
      groups.push({ birdId: action.birdId, tileIds: selected });
      selected = [];
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
    } else if (action.type === 'select') {
      expect(state.tray.some((tile) => tile?.id === action.tileId)).toBe(true);
      state = toggleTrayTile(state, action.tileId);
      expect(state.selectedTrayTileIds.at(-1)).toBe(action.tileId);
    } else {
      expect(getSelectedBird(state)?.id).toBe(action.birdId);
      consumedIds.push(...state.selectedTrayTileIds);
      state = composeSelectedBird(state);
      expect(state.selectedTrayTileIds).toEqual([]);
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
        expect(overlaps).toBe(true);
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
    let state = withEmptyBoard({ ...createGame(), tray: trayFrom('喜鹊'), phase: 'playing' });
    state = toggleTrayTile(state, 'tray-0');
    state = toggleTrayTile(state, 'tray-1');
    const next = composeSelectedBird(state);
    expect(next.tray.every((tile) => tile === null)).toBe(true);
    expect(next.phase).toBe('level_complete');
  });

  it('keeps a full tray playable when at least one bird is formable', () => {
    const state = { ...createGame(), tray: trayFrom('喜鹊大大大大大大大大') };
    expect(evaluateTerminalState(state.boardTiles, state.tray)).toBe('playing');
  });
});

describe('authored levels and winning paths', () => {
  it('keeps the requested tile counts and true logical depths', () => {
    expect(AUTHORED_LEVELS.map((level) => level.tiles.length)).toEqual([22, 33, 44]);
    expect(AUTHORED_LEVELS.map((level) => Math.max(...level.tiles.map((tile) => tile.layer)))).toEqual([2, 3, 4]);
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
