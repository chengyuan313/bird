import historicalDifficulty from './difficulty-report.json';
import historicalPlaytest from './playtest-comparison.json';
import { GAMEPLAY_RULESET_VERSION, createGameFromLevel, findPlayableBirds, selectBoardTile, composeBird } from '../src/core/gameEngine';
import { CERTIFIED_PUZZLE_BANK, levelFromCertifiedPuzzle } from '../src/core/puzzleBank';
import { PLAYTEST_PUZZLES } from '../src/core/playtestBank';
import { evaluatePuzzle } from './difficultyEvaluation';
import { runPlaytestComparison } from './playtestComparison';

type Outcome = 'WIN' | 'LOSS' | 'UNKNOWN';

function tally(outcomes: readonly Outcome[]) {
  return { wins: outcomes.filter((outcome) => outcome === 'WIN').length,
    losses: outcomes.filter((outcome) => outcome === 'LOSS').length,
    unknown: outcomes.filter((outcome) => outcome === 'UNKNOWN').length };
}

function newEarlyCompositionCount(record: (typeof CERTIFIED_PUZZLE_BANK.records)[number]): number {
  const level = levelFromCertifiedPuzzle(record);
  let state = createGameFromLevel(level);
  let takes = 0;
  for (const action of level.winningSolution) {
    state = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    if (action.type === 'take' && ++takes === 30) return findPlayableBirds(state).length;
  }
  throw new Error(`Missing 30-tile checkpoint: ${record.puzzleId}`);
}

/** Historical JSON is retained unchanged; compare only matching immutable puzzle IDs and fixed strategy budgets. */
export function comparePuzzleQuotaPolicy() {
  const currentProduction = CERTIFIED_PUZZLE_BANK.records.map(evaluatePuzzle);
  const oldProduction = historicalDifficulty.puzzles;
  if (oldProduction.length !== currentProduction.length || oldProduction.some((row, index) =>
    row.puzzleId !== currentProduction[index].puzzleId || row.boardHash !== currentProduction[index].boardHash)) {
    throw new Error('Production comparison puzzle identities differ');
  }
  const production = Object.fromEntries(Object.keys(currentProduction[0].simulations).map((strategy) => {
    const oldTrials = oldProduction.flatMap((row) => row.simulations[strategy as keyof typeof row.simulations]);
    const newTrials = currentProduction.flatMap((row) => row.simulations[strategy as keyof typeof row.simulations]);
    return [strategy, { old: tally(oldTrials.map((trial) => trial.outcome as Outcome)),
      current: tally(newTrials.map((trial) => trial.outcome)),
      oldMeanMaxTray: oldTrials.reduce((sum, trial) => sum + trial.maxTrayOccupancy, 0) / oldTrials.length,
      currentMeanMaxTray: newTrials.reduce((sum, trial) => sum + trial.maxTrayOccupancy, 0) / newTrials.length }];
  }));
  const currentPlaytest = runPlaytestComparison();
  if (historicalPlaytest.rows.length !== currentPlaytest.rows.length || historicalPlaytest.rows.some((row, index) =>
    row.id !== currentPlaytest.rows[index].id || row.boardHash !== currentPlaytest.rows[index].boardHash)) {
    throw new Error('Experimental comparison puzzle identities differ');
  }
  const experimental = Object.fromEntries(currentPlaytest.strategies.map((strategy) => {
    const oldTrials = historicalPlaytest.rows.map((row) => row.strategies[strategy]);
    const newTrials = currentPlaytest.rows.map((row) => row.strategies[strategy]);
    const normalize = (status: string): Outcome => status === 'WON' ? 'WIN' : status === 'LOST' ? 'LOSS' : 'UNKNOWN';
    return [strategy, { old: tally(oldTrials.map((trial) => normalize(trial.status))),
      current: tally(newTrials.map((trial) => normalize(trial.status))),
      oldMeanMaxTray: oldTrials.reduce((sum, trial) => sum + trial.maxTrayOccupancy, 0) / oldTrials.length,
      currentMeanMaxTray: newTrials.reduce((sum, trial) => sum + trial.maxTrayOccupancy, 0) / newTrials.length }];
  }));
  const oldEarly = CERTIFIED_PUZZLE_BANK.records.map((record) => record.diagnostics.checkpointFormableCompositions[1]);
  const newEarly = CERTIFIED_PUZZLE_BANK.records.map(newEarlyCompositionCount);
  return { gameplayRulesetVersion: GAMEPLAY_RULESET_VERSION, productionPuzzleCount: currentProduction.length,
    experimentalPuzzleCount: PLAYTEST_PUZZLES.length, production, experimental,
    earlyCompositionOptionsAt30Takes: {
      oldMean: oldEarly.reduce((sum, count) => sum + count, 0) / oldEarly.length,
      currentMean: newEarly.reduce((sum, count) => sum + count, 0) / newEarly.length,
    } };
}
