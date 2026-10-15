import { describe, expect, it } from 'vitest';
import {
  composeBird,
  createGame,
  evaluateTerminalState,
  findFormableBirds,
  getExposedBoardTiles,
  selectBoardTile,
  TRAY_SIZE,
} from '../src/core/game';
import type { BirdComposition, GameState } from '../src/core/types';

const STATE_BUDGET = 750;

function trayTiles(state: GameState) {
  return state.tray.filter((tile) => tile !== null);
}

function assertTransition(before: GameState, after: GameState, action: { type: 'take'; tileId: string } | { type: 'compose'; composition: BirdComposition }): void {
  expect(after).not.toBe(before);
  const prior = trayTiles(before);
  const next = trayTiles(after);
  expect(next.length).toBeLessThanOrEqual(TRAY_SIZE);
  expect(new Set(next.map((tile) => tile.id)).size).toBe(next.length);
  expect(new Set(after.discoveredBirdIds).size).toBe(after.discoveredBirdIds.length);
  expect(after.phase).toBe(evaluateTerminalState(after.boardTiles, after.tray, after.activeCompositions, after.remainingCompositionQuotas));
  const removedBefore = before.boardTiles.filter((tile) => tile.removed).length;
  const removedAfter = after.boardTiles.filter((tile) => tile.removed).length;

  if (action.type === 'take') {
    expect(removedAfter).toBe(removedBefore + 1);
    expect(next.map((tile) => tile.id)).toEqual([...prior.map((tile) => tile.id), action.tileId]);
    expect(after.score).toBe(before.score);
  } else {
    expect(removedAfter).toBe(removedBefore);
    expect(after.score - before.score).toBe(action.composition.score);
    const nextIds = new Set(next.map((tile) => tile.id));
    const consumed = prior.filter((tile) => !nextIds.has(tile.id));
    expect(consumed).toHaveLength(action.composition.characters.length);
    expect(consumed.map((tile) => tile.character).sort()).toEqual([...action.composition.characters].sort());
    expect(next.every((tile) => prior.some((previous) => previous.id === tile.id))).toBe(true);
    expect(after.completedBirdCount).toBe(before.completedBirdCount + 1);
  }
}

function key(state: GameState): string {
  return [
    state.boardTiles.map((tile) => Number(tile.removed)).join(''),
    trayTiles(state).map((tile) => tile.id).join(','),
    state.discoveredBirdIds.join(','),
    state.score,
  ].join('|');
}

describe('bounded legal-state enumeration', () => {
  it.each(['level-1', 'level-2'])('%s preserves tile, tray, scoring, and discovery invariants', (levelId) => {
    const initial = createGame(levelId);
    const queue = [initial];
    const seen = new Set([key(initial)]);
    let transitions = 0;
    for (let index = 0; index < queue.length && index < STATE_BUDGET; index += 1) {
      const state = queue[index];
      if (state.phase !== 'playing') continue;
      const actions = [
        ...getExposedBoardTiles(state).filter(() => trayTiles(state).length < TRAY_SIZE).map((tile) => ({ type: 'take' as const, tileId: tile.id })),
        ...findFormableBirds(state.tray, state.activeCompositions).map((composition) => ({ type: 'compose' as const, composition })),
      ];
      for (const action of actions) {
        const next = action.type === 'take'
          ? selectBoardTile(state, action.tileId)
          : composeBird(state, action.composition.id);
        assertTransition(state, next, action);
        transitions += 1;
        const nextKey = key(next);
        if (!seen.has(nextKey)) {
          seen.add(nextKey);
          queue.push(next);
        }
      }
    }
    expect(Math.min(queue.length, STATE_BUDGET)).toBe(STATE_BUDGET);
    expect(transitions).toBeGreaterThan(STATE_BUDGET);
  }, 15_000);

  it('preserves legal transitions across all five prevalidated Level 3 seeds', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const queue = [createGame('level-3', seed)];
      const seen = new Set([key(queue[0])]);
      let transitions = 0;
      for (let index = 0; index < queue.length && index < 30; index += 1) {
        const state = queue[index];
        if (state.phase !== 'playing') continue;
        const actions = [
          ...getExposedBoardTiles(state).filter(() => trayTiles(state).length < TRAY_SIZE).map((tile) => ({ type: 'take' as const, tileId: tile.id })),
          ...findFormableBirds(state.tray, state.activeCompositions).map((composition) => ({ type: 'compose' as const, composition })),
        ];
        for (const action of actions) {
          const next = action.type === 'take'
            ? selectBoardTile(state, action.tileId)
            : composeBird(state, action.composition.id);
          assertTransition(state, next, action);
          transitions += 1;
          const nextKey = key(next);
          if (!seen.has(nextKey)) {
            seen.add(nextKey);
            queue.push(next);
          }
        }
      }
      expect(transitions).toBeGreaterThan(30);
    }
  }, 15_000);
});
