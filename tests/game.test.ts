import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  composeSelectedBird,
  createGame,
  findFormableBirds,
  getExposedBoardTiles,
  getSelectedCharacters,
  isBoardTileExposed,
  restartLevel,
  selectBoardTile,
  toggleTrayTile,
  TRAY_SIZE,
} from '../src/core/game';
import { AUTHORED_LEVELS } from '../src/core/levels';
import type { GameState, RackTile } from '../src/core/types';

function trayFrom(text: string): Array<RackTile | null> {
  const tiles = Array.from(text).map((character, index) => ({ id: `tray-${index}`, character }));
  return [...tiles, ...Array<RackTile | null>(Math.max(0, TRAY_SIZE - tiles.length)).fill(null)];
}

function selectTrayIndexes(state: GameState, indexes: number[]): GameState {
  return indexes.reduce((current, index) => {
    const tile = current.tray[index];
    return tile ? toggleTrayTile(current, tile.id) : current;
  }, state);
}

describe('layered board gameplay core', () => {
  it('does not allow a blocked board tile to be selected', () => {
    const state = createGame();
    const blocked = state.boardTiles.find((tile) => tile.blockedBy.length > 0)!;
    expect(isBoardTileExposed(state, blocked.id)).toBe(false);
    expect(selectBoardTile(state, blocked.id)).toBe(state);
  });

  it('moves an exposed tile into the tray exactly once', () => {
    const state = createGame();
    const exposed = getExposedBoardTiles(state)[0];
    const next = selectBoardTile(state, exposed.id);
    expect(next.tray.filter((tile) => tile?.id === exposed.id)).toHaveLength(1);
    expect(selectBoardTile(next, exposed.id)).toBe(next);
  });

  it('removing a blocker exposes the tile directly below', () => {
    const state = createGame();
    const below = state.boardTiles.find((tile) => tile.blockedBy.length === 1)!;
    const blockerId = below.blockedBy[0];
    expect(isBoardTileExposed(state, below.id)).toBe(false);
    expect(isBoardTileExposed(selectBoardTile(state, blockerId), below.id)).toBe(true);
  });

  it('keeps the tray capacity at 10 and rejects an eleventh tile', () => {
    const state = { ...createGame(), tray: trayFrom('大大大大大大大大大大') };
    const exposed = getExposedBoardTiles(state)[0];
    expect(state.tray).toHaveLength(10);
    expect(selectBoardTile(state, exposed.id)).toBe(state);
  });

  it('does not game over when a newly full tray has a formable bird', () => {
    const state = { ...createGame(), tray: trayFrom('喜鹊大大大大大大大') };
    const next = selectBoardTile(state, getExposedBoardTiles(state)[0].id);
    expect(next.tray.filter(Boolean)).toHaveLength(10);
    expect(findFormableBirds(next.tray).map((bird) => bird.name)).toContain('喜鹊');
    expect(next.phase).toBe('playing');
  });

  it('games over when a newly full tray has no formable bird', () => {
    const state = { ...createGame(), tray: trayFrom('大大大大大大大大大') };
    const next = selectBoardTile(state, getExposedBoardTiles(state)[0].id);
    expect(next.tray.filter(Boolean)).toHaveLength(10);
    expect(findFormableBirds(next.tray)).toEqual([]);
    expect(next.phase).toBe('game_over');
  });

  it('preserves the player-selected tray order', () => {
    const state = { ...createGame(), tray: trayFrom('喜鹊') };
    const selected = selectTrayIndexes(state, [1, 0]);
    expect(getSelectedCharacters(selected)).toEqual(['鹊', '喜']);
  });

  it('consumes only selected tray tiles for a valid bird', () => {
    const state = selectTrayIndexes({ ...createGame(), tray: trayFrom('喜鹊白') }, [0, 1]);
    const next = composeSelectedBird(state);
    expect(next.tray.map((tile) => tile?.character ?? '').join('')).toBe('白');
    expect(next.score).toBe(10);
    expect(next.completedBirdCount).toBe(1);
  });

  it('changes nothing for an invalid bird sequence', () => {
    const state = selectTrayIndexes({ ...createGame(), tray: trayFrom('喜白') }, [0, 1]);
    expect(composeSelectedBird(state)).toBe(state);
  });

  it('completes the level when the last board tile is removed', () => {
    const initial = createGame();
    const lastId = initial.boardTiles.at(-1)!.id;
    const state = {
      ...initial,
      boardTiles: initial.boardTiles.map((tile) => ({ ...tile, removed: tile.id !== lastId })),
    };
    expect(selectBoardTile(state, lastId).phase).toBe('level_complete');
  });

  it('restarting restores the exact authored level', () => {
    const initial = createGame('level-2');
    const played = selectBoardTile(initial, getExposedBoardTiles(initial)[0].id);
    expect(restartLevel({ ...played, score: 70 })).toEqual(initial);
  });

  it('keeps stable semantic bird IDs unchanged', () => {
    expect(BIRD_CATALOG.find((bird) => bird.name === '喜鹊')).toMatchObject({ id: 'bird:xique', assetKey: 'xique' });
    expect(BIRD_CATALOG.find((bird) => bird.name === '红腹锦鸡')).toMatchObject({ id: 'bird:hongfujinji', assetKey: 'hongfujinji' });
  });

  it('defines three authored levels at the requested sizes and depths', () => {
    expect(AUTHORED_LEVELS.map((level) => level.tiles.length)).toEqual([22, 33, 44]);
    expect(AUTHORED_LEVELS.map((level) => Math.max(...level.tiles.map((tile) => tile.layer)))).toEqual([2, 3, 4]);
  });

  it.each(AUTHORED_LEVELS)('$label has a replay-verified authored clear path', (level) => {
    let state = createGame(level.id);
    const stackKeys = [...new Set(level.tiles.map((tile) => tile.id.replace(/-tile-\d+$/, '')))];

    for (const stackKey of stackKeys) {
      const stackTiles = level.tiles.filter((tile) => tile.id.startsWith(`${stackKey}-tile-`));
      for (const tile of stackTiles) state = selectBoardTile(state, tile.id);
      if (state.phase === 'level_complete') break;
      for (const tile of stackTiles) state = toggleTrayTile(state, tile.id);
      state = composeSelectedBird(state);
    }

    expect(state.phase).toBe('level_complete');
    expect(state.boardTiles.every((tile) => tile.removed)).toBe(true);
  });
});
