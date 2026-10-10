import { LEGACY_GAMEPLAY_BIRD_CATALOG } from '../src/core/birdCatalog';
import {
  composeBird,
  createGameFromLevel,
  findFormableBirds,
  getExposedBoardTiles,
  selectBoardTile,
} from '../src/core/game';
import type { GameState, LevelDefinition, WinningAction } from '../src/core/types';

export type SolverStatus = 'SOLVED' | 'UNSOLVABLE' | 'SEARCH_LIMIT_REACHED';

export interface SolverOptions {
  maxNodes: number;
  maxDurationMs: number;
}

export interface SolverResult {
  status: SolverStatus;
  actions: readonly WinningAction[];
  nodes: number;
  durationMs: number;
}

const DEFAULT_OPTIONS: SolverOptions = { maxNodes: 250_000, maxDurationMs: 5_000 };

function stateKey(state: GameState): string {
  const removed = state.boardTiles.map((tile) => tile.removed ? '1' : '0').join('');
  const tray = state.tray.flatMap((tile) => tile ? [tile.character] : []).sort().join('');
  return `${removed}|${tray}`;
}

function trayCount(state: GameState): number {
  return state.tray.filter(Boolean).length;
}

function takeScore(state: GameState, tileId: string): number {
  const before = new Set(getExposedBoardTiles(state).map((tile) => tile.id));
  const tile = state.boardTiles.find((candidate) => candidate.id === tileId)!;
  const next = selectBoardTile(state, tileId);
  const newlyExposed = getExposedBoardTiles(next).filter((candidate) => !before.has(candidate.id)).length;
  const completed = findFormableBirds(next.tray);
  const regionPenalty = tile.region === 'auxiliary' ? 25 : 0;
  return newlyExposed * 80
    + completed.reduce((best, bird) => Math.max(best, bird.score), 0) * 3
    - trayCount(next) * 4
    - regionPenalty;
}

export function solveLevel(
  level: LevelDefinition,
  options: Partial<SolverOptions> = {},
): SolverResult {
  const limits = { ...DEFAULT_OPTIONS, ...options };
  const started = performance.now();
  const visited = new Set<string>();
  let nodes = 0;
  let limitReached = false;

  function search(state: GameState, path: WinningAction[]): WinningAction[] | undefined {
    if (nodes >= limits.maxNodes || performance.now() - started >= limits.maxDurationMs) {
      limitReached = true;
      return undefined;
    }
    nodes += 1;
    if (state.phase === 'level_complete') return path;
    if (state.phase === 'game_over') return undefined;

    const key = stateKey(state);
    if (visited.has(key)) return undefined;
    visited.add(key);

    const formable = findFormableBirds(state.tray)
      .slice()
      .sort((first, second) => second.characters.length - first.characters.length || second.score - first.score);
    const exposed = getExposedBoardTiles(state)
      .map((tile) => ({ tile, score: takeScore(state, tile.id) }))
      .sort((first, second) => second.score - first.score)
      .map(({ tile }) => tile);

    const actions: Array<{ action: WinningAction; state: GameState }> = [];
    for (const bird of formable) {
      actions.push({
        action: { type: 'compose', birdId: bird.id },
        state: composeBird(state, bird.id),
      });
    }
    if (trayCount(state) < 10) {
      for (const tile of exposed) {
        actions.push({
          action: { type: 'take', tileId: tile.id },
          state: selectBoardTile(state, tile.id),
        });
      }
    }

    for (const candidate of actions) {
      if (candidate.state === state) continue;
      const solution = search(candidate.state, [...path, candidate.action]);
      if (solution) return solution;
      if (limitReached) return undefined;
    }
    return undefined;
  }

  const actions = search(createGameFromLevel(level), []);
  const durationMs = performance.now() - started;
  if (actions) return { status: 'SOLVED', actions, nodes, durationMs };
  return {
    status: limitReached ? 'SEARCH_LIMIT_REACHED' : 'UNSOLVABLE',
    actions: [],
    nodes,
    durationMs,
  };
}

export function replaySolution(level: LevelDefinition, actions: readonly WinningAction[]): GameState {
  let state = createGameFromLevel(level);
  for (const action of actions) {
    const next = action.type === 'take'
      ? selectBoardTile(state, action.tileId)
      : composeBird(state, action.birdId);
    if (next === state) throw new Error(`Illegal solver action: ${JSON.stringify(action)}`);
    state = next;
  }
  return state;
}

export function createUnverifiedLevel(
  id: string,
  label: string,
  tiles: LevelDefinition['tiles'],
): LevelDefinition {
  return { id, label, tiles, winningSolution: [] };
}

export function isCompositionAvailable(state: GameState, birdId: string): boolean {
  return findFormableBirds(state.tray, LEGACY_GAMEPLAY_BIRD_CATALOG).some((bird) => bird.id === birdId);
}
