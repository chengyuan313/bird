import {
  composeBird,
  createGameFromLevel,
  findFormableBirds,
  getExposedBoardTiles,
  selectBoardTile,
} from '../src/core/game';
import { createSeededRandom } from '../src/core/level3Generator';
import type { BirdComposition, GameState, LevelDefinition, WinningAction } from '../src/core/types';

export type EvaluationStrategy =
  | 'random-legal'
  | 'always-compose'
  | 'shortest'
  | 'highest-score'
  | 'clear-blockers'
  | 'capacity-aware'
  | 'lookahead';

export interface TrialResult {
  won: boolean;
  maxTrayOccupancy: number;
  compositions: number;
  remainingTiles: number;
}

export const EVALUATION_STRATEGIES: readonly EvaluationStrategy[] = [
  'random-legal',
  'always-compose',
  'shortest',
  'highest-score',
  'clear-blockers',
  'capacity-aware',
  'lookahead',
];

function trayCount(state: GameState): number {
  return state.tray.filter(Boolean).length;
}

function legalActions(state: GameState): WinningAction[] {
  return [
    ...findFormableBirds(state.tray, state.activeCompositions).map((bird): WinningAction => ({ type: 'compose', birdId: bird.id })),
    ...(trayCount(state) < 10
      ? getExposedBoardTiles(state).map((tile): WinningAction => ({ type: 'take', tileId: tile.id }))
      : []),
  ];
}

function applyAction(state: GameState, action: WinningAction): GameState {
  return action.type === 'take'
    ? selectBoardTile(state, action.tileId)
    : composeBird(state, action.birdId);
}

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

function birdFor(action: WinningAction, catalog: readonly BirdComposition[]): BirdComposition | undefined {
  return action.type === 'compose'
    ? catalog.find((bird) => bird.id === action.birdId)
    : undefined;
}

function takeExposureScore(state: GameState, action: WinningAction): number {
  if (action.type !== 'take') return -Infinity;
  const before = new Set(getExposedBoardTiles(state).map((tile) => tile.id));
  return getExposedBoardTiles(applyAction(state, action))
    .filter((tile) => !before.has(tile.id)).length;
}

function heuristic(state: GameState): number {
  if (state.phase === 'level_complete') return 1_000_000;
  if (state.phase === 'game_over') return -1_000_000 - state.boardTiles.filter((tile) => !tile.removed).length;
  return state.score * 3
    + findFormableBirds(state.tray, state.activeCompositions).reduce((sum, bird) => sum + bird.score, 0) * 4
    + getExposedBoardTiles(state).length * 3
    - trayCount(state) * 25
    - state.boardTiles.filter((tile) => !tile.removed).length;
}

function pickBest(
  actions: readonly WinningAction[],
  score: (action: WinningAction) => number,
  random: () => number,
): WinningAction {
  const scored = actions.map((action) => ({ action, score: score(action) }));
  const best = Math.max(...scored.map((item) => item.score));
  return choose(scored.filter((item) => item.score === best).map((item) => item.action), random);
}

function selectAction(
  state: GameState,
  strategy: EvaluationStrategy,
  random: () => number,
): WinningAction | undefined {
  const actions = legalActions(state);
  if (actions.length === 0) return undefined;
  if (strategy === 'random-legal') return choose(actions, random);

  const compose = actions.filter((action) => action.type === 'compose');
  const take = actions.filter((action) => action.type === 'take');
  if (strategy === 'always-compose' && compose.length > 0) return choose(compose, random);
  if (strategy === 'shortest' && compose.length > 0) {
    return pickBest(compose, (action) => -(birdFor(action, state.activeCompositions)?.characters.length ?? 0), random);
  }
  if (strategy === 'highest-score' && compose.length > 0) {
    return pickBest(compose, (action) => birdFor(action, state.activeCompositions)?.score ?? 0, random);
  }
  if (strategy === 'clear-blockers') {
    if (take.length > 0 && (trayCount(state) < 8 || compose.length === 0)) {
      return pickBest(take, (action) => takeExposureScore(state, action), random);
    }
    return pickBest(compose, (action) => birdFor(action, state.activeCompositions)?.characters.length ?? 0, random);
  }
  if (strategy === 'capacity-aware') {
    if (compose.length > 0 && (trayCount(state) >= 6 || take.length === 0)) {
      return pickBest(compose, (action) => birdFor(action, state.activeCompositions)?.characters.length ?? 0, random);
    }
    if (take.length > 0) {
      return pickBest(take, (action) => {
        const next = applyAction(state, action);
        return heuristic(next) + takeExposureScore(state, action) * 20;
      }, random);
    }
  }
  if (strategy === 'lookahead') {
    const candidates = actions
      .map((action) => ({ action, value: heuristic(applyAction(state, action)) }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 8)
      .map(({ action }) => action);
    return pickBest(candidates, (action) => {
      const next = applyAction(state, action);
      const replies = legalActions(next)
        .map((reply) => applyAction(next, reply))
        .sort((first, second) => heuristic(second) - heuristic(first))
        .slice(0, 6);
      return replies.length > 0 ? Math.max(...replies.map(heuristic)) : heuristic(next);
    }, random);
  }
  if (take.length > 0) return choose(take, random);
  return choose(compose, random);
}

export function runStrategyTrial(
  level: LevelDefinition,
  strategy: EvaluationStrategy,
  seed: number,
): TrialResult {
  const random = createSeededRandom(seed ^ 0x51f15e);
  let state = createGameFromLevel(level);
  let maximum = 0;
  let compositions = 0;
  for (let step = 0; step < 300 && state.phase === 'playing'; step += 1) {
    const action = selectAction(state, strategy, random);
    if (!action) break;
    state = applyAction(state, action);
    if (action.type === 'compose') compositions += 1;
    maximum = Math.max(maximum, trayCount(state));
  }
  return {
    won: state.phase === 'level_complete',
    maxTrayOccupancy: maximum,
    compositions,
    remainingTiles: state.boardTiles.filter((tile) => !tile.removed).length,
  };
}
