import { createGameFromLevel, findFormableBirds, getExposedBoardTiles, composeBird, selectBoardTile } from '../src/core/game';
import { CERTIFIED_PUZZLE_BANK, levelFromCertifiedPuzzle } from '../src/core/puzzleBank';
import type { CertifiedPuzzleRecord } from '../src/core/puzzleBank';
import type { BirdComposition, GameState, LevelDefinition } from '../src/core/types';
import { runStrategyTrial } from './level3Evaluation';
import type { EvaluationStrategy, TrialResult } from './level3Evaluation';

export const DIFFICULTY_REPORT_VERSION = 'difficulty-v1';
export const STRATEGIES = ['always-compose', 'random-legal', 'capacity-aware', 'lookahead'] as const satisfies readonly EvaluationStrategy[];
export const TRIAL_SEEDS = [101] as const;
export const ACTION_BUDGET = 140;

export interface PuzzleDifficulty {
  puzzleId: string;
  boardHash: string;
  seed: number;
  features: {
    tileCount: number;
    layerCount: number;
    initialExposed: number;
    feasibleCompositions: number;
    ambiguousCharacters: number;
    competingCompositionPairs: number;
    witnessMaxTray: number;
    witnessHighPressureActions: number;
    checkpointLegalChoices: number[];
  };
  simulations: Record<(typeof STRATEGIES)[number], TrialResult[]>;
}

function counts(values: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function isFeasible(bird: BirdComposition, available: Map<string, number>): boolean {
  return [...counts(bird.characters)].every(([character, count]) => (available.get(character) ?? 0) >= count);
}

function legalChoiceCount(state: GameState): number {
  return findFormableBirds(state.tray, state.activeCompositions).length
    + (state.tray.some((tile) => tile === null) ? getExposedBoardTiles(state).length : 0);
}

/** These are diagnostics, not a claim about human solve probability. */
export function measurePuzzle(level: LevelDefinition): PuzzleDifficulty['features'] {
  if (!level.puzzleId) throw new Error('Certified puzzle identity required');
  const available = counts(level.tiles.map((tile) => tile.character));
  let state = createGameFromLevel(level);
  const feasible = state.activeCompositions.filter((bird) => isFeasible(bird, available));
  const characterUse = counts(feasible.flatMap((bird) => [...new Set(bird.characters)]));
  let competing = 0;
  for (let first = 0; first < feasible.length; first += 1) {
    for (let second = first + 1; second < feasible.length; second += 1) {
      if (feasible[first].characters.some((character) => feasible[second].characters.includes(character))) competing += 1;
    }
  }
  const checkpoints = [legalChoiceCount(state)];
  const checkpointActions = new Set([Math.floor(level.winningSolution.length / 3), Math.floor(level.winningSolution.length * 2 / 3)]);
  let maxTray = 0;
  let highPressureActions = 0;
  level.winningSolution.forEach((action, index) => {
    const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    if (next === state) throw new Error(`Invalid witness action ${index} for ${level.puzzleId}`);
    state = next;
    const occupied = state.tray.filter(Boolean).length;
    maxTray = Math.max(maxTray, occupied);
    if (occupied >= 8) highPressureActions += 1;
    if (checkpointActions.has(index + 1)) checkpoints.push(legalChoiceCount(state));
  });
  if (state.phase !== 'level_complete') throw new Error(`Witness did not complete ${level.puzzleId}`);
  return {
    tileCount: level.tiles.length,
    layerCount: new Set(level.tiles.map((tile) => tile.layer)).size,
    initialExposed: checkpoints[0],
    feasibleCompositions: feasible.length,
    ambiguousCharacters: [...characterUse.values()].filter((count) => count > 1).length,
    competingCompositionPairs: competing,
    witnessMaxTray: maxTray,
    witnessHighPressureActions: highPressureActions,
    checkpointLegalChoices: checkpoints,
  };
}

export function evaluatePuzzle(record: CertifiedPuzzleRecord): PuzzleDifficulty {
  const level = levelFromCertifiedPuzzle(record);
  const simulations = Object.fromEntries(STRATEGIES.map((strategy) => [strategy,
    TRIAL_SEEDS.map((trialSeed) => runStrategyTrial(level, strategy, trialSeed ^ record.seed, ACTION_BUDGET)),
  ])) as PuzzleDifficulty['simulations'];
  return { puzzleId: record.puzzleId, boardHash: record.boardHash, seed: record.seed, features: measurePuzzle(level), simulations };
}

export function evaluateBank(limit = CERTIFIED_PUZZLE_BANK.records.length) {
  return {
    reportVersion: DIFFICULTY_REPORT_VERSION,
    bankSchemaVersion: CERTIFIED_PUZZLE_BANK.schemaVersion,
    strategySeeds: TRIAL_SEEDS,
    actionBudget: ACTION_BUDGET,
    puzzles: CERTIFIED_PUZZLE_BANK.records.slice(0, limit).map(evaluatePuzzle),
  };
}
