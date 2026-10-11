import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { BEGINNER_DISCOVERY_BIRD_IDS } from '../src/core/contentSampler';
import { findFormableBirds, getExposedBoardTiles, createGameFromLevel } from '../src/core/gameEngine';
import { CERTIFIED_PUZZLE_BANK } from '../src/core/puzzleBank';
import type { LevelDefinition } from '../src/core/types';
import { measurePuzzle } from './difficultyEvaluation';
import { runStrategyTrial } from './level3Evaluation';
import type { EvaluationStrategy, TrialResult } from './level3Evaluation';
import {
  DIFFICULTY_PROFILES, DIFFICULTY_PROFILE_VERSION, generateExperimentalCandidate,
  validateFixedGeometry,
} from './parameterizedGeneration';
import type { DifficultyProfile, PlacementMode } from './parameterizedGeneration';
import type { SpatialOrder } from './parameterizedGeneration';

export const EXPERIMENT_VERSION = 'parameterized-generation-benchmark-v1';
export const EXPERIMENT_SEEDS = [31, 37, 43] as const;
export const EXPERIMENT_PLACEMENTS = ['consecutive', 'paired', 'multi-name'] as const satisfies readonly PlacementMode[];
export const EXPERIMENT_STRATEGIES = ['always-compose', 'random-legal', 'capacity-aware', 'lookahead'] as const satisfies readonly EvaluationStrategy[];
export const EXPERIMENT_ACTION_BUDGET = 140;
export type ExperimentOutcome = 'WON' | 'LOST' | 'UNKNOWN_BUDGET' | 'INVALID_ACTION' | 'ERROR';

export function classifyTrial(trial: TrialResult): ExperimentOutcome {
  return trial.outcome === 'WIN' ? 'WON' : trial.outcome === 'LOSS' ? 'LOST' : 'UNKNOWN_BUDGET';
}

export function classifySimulationError(error: unknown): 'INVALID_ACTION' | 'ERROR' {
  return error instanceof Error && error.message.startsWith('INVALID_ACTION:') ? 'INVALID_ACTION' : 'ERROR';
}

export function simulate(level: LevelDefinition, strategy: EvaluationStrategy, seed: number, budget = EXPERIMENT_ACTION_BUDGET) {
  try {
    const trial = runStrategyTrial({ ...level, winningSolution: [] }, strategy, seed, budget);
    return { status: classifyTrial(trial), actions: trial.actions, remainingTiles: trial.remainingTiles,
      maxTrayOccupancy: trial.maxTrayOccupancy, highPressureActions: trial.highPressureActions };
  } catch (error) {
    return { status: classifySimulationError(error), actions: 0, remainingTiles: level.tiles.length,
      maxTrayOccupancy: 0, highPressureActions: 0 };
  }
}

function vocabularyMetrics(level: LevelDefinition, sampledBirdIds: readonly string[]) {
  const birdById = new Map(BIRD_CATALOG.map((bird) => [bird.id, bird]));
  const distinct = new Set(sampledBirdIds);
  const discoveryIds = new Set<string>(BEGINNER_DISCOVERY_BIRD_IDS);
  const lengths = { two: 0, three: 0, four: 0 };
  for (const id of sampledBirdIds) {
    const length = birdById.get(id)!.characterCount;
    if (length === 2) lengths.two += 1;
    if (length === 3) lengths.three += 1;
    if (length === 4) lengths.four += 1;
  }
  const characterCounts = new Map<string, number>();
  for (const tile of level.tiles) characterCounts.set(tile.character, (characterCounts.get(tile.character) ?? 0) + 1);
  const initial = createGameFromLevel(level);
  const exposed = getExposedBoardTiles(initial);
  const exposedTray = exposed.map((tile) => ({ id: tile.id, character: tile.character }));
  return {
    distinctSpecies: distinct.size,
    distinctDiscoverySpecies: [...distinct].filter((id) => discoveryIds.has(id)).length,
    nameLengths: lengths,
    repeatedCharacterTypes: [...characterCounts.values()].filter((count) => count > 1).length,
    initialDistinctCharacters: new Set(exposed.map((tile) => tile.character)).size,
    /** An upper bound: 19 exposed tiles do not all fit in the ten-slot tray. */
    initialExposedCompositionUpperBound: findFormableBirds(exposedTray, initial.activeCompositions).length,
  };
}

export function evaluateExperimentCell(
  profile: DifficultyProfile, placement: PlacementMode, seed: number, spatialOrder = profile.spatialOrder,
) {
  const generated = generateExperimentalCandidate(profile, seed, placement, spatialOrder);
  if (!generated.ok) return { profileId: profile.id, placement, spatialOrder, seed, status: 'REJECTED' as const,
    reason: generated.reason, contentAttempts: generated.contentAttempts };
  const { candidate } = generated;
  const simulations = Object.fromEntries(EXPERIMENT_STRATEGIES.map((strategy) => [strategy,
    simulate(candidate.level, strategy, seed ^ 0x51f15e, EXPERIMENT_ACTION_BUDGET),
  ])) as Record<(typeof EXPERIMENT_STRATEGIES)[number], ReturnType<typeof simulate>>;
  return {
    profileId: profile.id, placement, spatialOrder, seed, status: 'CERTIFIED' as const,
    experimentId: candidate.experimentId, boardHash: candidate.boardHash,
    contentAttempts: candidate.contentAttempts, witnessActions: candidate.level.winningSolution.length,
    witnessConcurrentNames: candidate.witnessConcurrentNames,
    vocabulary: vocabularyMetrics(candidate.level, candidate.sampledBirdIds),
    features: measurePuzzle(candidate.level), simulations,
  };
}

export function runParameterizedExperiment() {
  const cells = DIFFICULTY_PROFILES.flatMap((profile) => EXPERIMENT_PLACEMENTS.flatMap((placement) =>
    EXPERIMENT_SEEDS.map((seed) => evaluateExperimentCell(profile, placement, seed))));
  const standard = DIFFICULTY_PROFILES.find((profile) => profile.id === 'standard')!;
  const spatialOrders: readonly SpatialOrder[] = ['unlock-max', 'unlock-min'];
  const spatialCells = spatialOrders.flatMap((order) => EXPERIMENT_SEEDS.map((seed) =>
    evaluateExperimentCell(standard, 'paired', seed, order)));
  const allCells = [...cells, ...spatialCells];
  const accepted = allCells.filter((cell) => cell.status === 'CERTIFIED');
  return {
    version: EXPERIMENT_VERSION,
    profileVersion: DIFFICULTY_PROFILE_VERSION,
    geometry: validateFixedGeometry(),
    sourceBankPuzzleIds: CERTIFIED_PUZZLE_BANK.records.map((record) => record.puzzleId),
    sourceBankBoardHashes: CERTIFIED_PUZZLE_BANK.records.map((record) => record.boardHash),
    seeds: EXPERIMENT_SEEDS,
    placements: EXPERIMENT_PLACEMENTS,
    strategies: EXPERIMENT_STRATEGIES,
    actionBudget: EXPERIMENT_ACTION_BUDGET,
    profiles: DIFFICULTY_PROFILES,
    summary: {
      attempted: allCells.length,
      replayCertified: accepted.length,
      uniqueBoardHashes: new Set(accepted.map((cell) => cell.boardHash)).size,
      rejected: allCells.length - accepted.length,
    },
    cells,
    spatialCells,
  };
}
