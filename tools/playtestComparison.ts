import { CERTIFIED_PUZZLE_BANK } from '../src/core/puzzleBank';
import { GAMEPLAY_RULESET_VERSION } from '../src/core/gameEngine';
import { composeBird, createGameFromLevel, selectBoardTile } from '../src/core/gameEngine';
import { EXPERIMENT_GROUPS, levelFromPlaytestPuzzle, PLAYTEST_PUZZLES } from '../src/core/playtestBank';
import { measurePuzzle } from './difficultyEvaluation';
import type { EvaluationStrategy } from './level3Evaluation';
import { simulate } from './parameterizedExperiment';
import { DIFFICULTY_PROFILES, generateExperimentalCandidate } from './parameterizedGeneration';

export const PLAYTEST_COMPARISON_VERSION = 'playtest-comparison-v2';
export const PLAYTEST_ACTION_BUDGET = 140;
export const PLAYTEST_STRATEGIES = ['always-compose', 'random-legal', 'capacity-aware', 'lookahead', 'bounded-planner'] as const satisfies readonly EvaluationStrategy[];

export function runPlaytestComparison() {
  const profile = DIFFICULTY_PROFILES.find((item) => item.id === 'standard')!;
  const productionHashes = new Set(CERTIFIED_PUZZLE_BANK.records.map((record) => record.boardHash));
  const rows = PLAYTEST_PUZZLES.map((record) => {
    const generationStart = performance.now();
    const generated = generateExperimentalCandidate(profile, record.seed, record.placement as typeof profile.placement, 'seeded-random');
    const generationMs = performance.now() - generationStart;
    if (!generated.ok || generated.candidate.boardHash !== record.boardHash || generated.candidate.experimentId !== record.id) {
      throw new Error(`Experiment is not reproducible: ${record.id}`);
    }
    if (productionHashes.has(record.boardHash)) throw new Error('Experiment duplicates production puzzle');
    const level = levelFromPlaytestPuzzle(record.id);
    const certificationStart = performance.now();
    let state = createGameFromLevel(level);
    let witnessMaximumTray = 0;
    for (const action of level.winningSolution) {
      const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
      if (next === state) throw new Error(`Invalid experimental certificate ${record.id}`);
      state = next;
      witnessMaximumTray = Math.max(witnessMaximumTray, state.tray.filter(Boolean).length);
    }
    if (state.phase !== 'level_complete' || witnessMaximumTray > 10) throw new Error(`Failed experimental certificate ${record.id}`);
    const certificationMs = performance.now() - certificationStart;
    const features = measurePuzzle(level);
    const strategies = Object.fromEntries(PLAYTEST_STRATEGIES.map((strategy) => {
      return [strategy, simulate({ ...level, winningSolution: [] }, strategy, record.seed ^ 0x71b7, PLAYTEST_ACTION_BUDGET)];
    }));
    return {
      group: record.group, seed: record.seed, id: record.id, boardHash: record.boardHash,
      contentAttempts: record.contentAttempts, generationMs, certificationMs,
      replayCertified: true, features, strategies,
    };
  });
  return {
    version: PLAYTEST_COMPARISON_VERSION,
    gameplayRulesetVersion: GAMEPLAY_RULESET_VERSION,
    bankVersion: 'playtest-bank-v1',
    fixedInputs: { profileId: 'standard', spatialOrder: 'seeded-random', tileCount: 90,
      geometryId: 'piachan-90-v1', recognitionRegistryEntries: 103, playableCompositions: 'puzzle-scoped',
      seeds: [31, 37, 43, 47, 53], actionBudget: PLAYTEST_ACTION_BUDGET },
    strategies: PLAYTEST_STRATEGIES,
    groups: EXPERIMENT_GROUPS.map((group) => {
      const items = rows.filter((row) => row.group === group);
      return { group, attempted: items.length, accepted: items.length, rejected: 0,
        uniqueBoardHashes: new Set(items.map((row) => row.boardHash)).size,
        replayCertified: items.filter((row) => row.replayCertified).length,
        generationMs: items.reduce((sum, row) => sum + row.generationMs, 0),
        certificationMs: items.reduce((sum, row) => sum + row.certificationMs, 0) };
    }),
    rows,
  };
}

/** Wall-clock timings vary. Reproducibility compares all identities, inputs, and outcomes. */
export function comparisonWithoutTimings(report: ReturnType<typeof runPlaytestComparison>) {
  return { ...report,
    groups: report.groups.map(({ generationMs: _generationMs, certificationMs: _certificationMs, ...group }) => group),
    rows: report.rows.map(({ generationMs: _generationMs, certificationMs: _certificationMs, ...row }) => row) };
}
