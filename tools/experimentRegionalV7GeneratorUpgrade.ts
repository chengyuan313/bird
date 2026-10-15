import { composeBird, createGameFromLevel, selectBoardTile } from '../src/core/gameEngine';
import { createSeededRandom, fisherYates } from '../src/core/level3Generator';
import { boardHash, sha256Hex } from '../src/core/puzzleIdentity';
import { REGIONAL_V7_PUZZLES, type RegionalV7Puzzle } from '../src/core/regionalV7Puzzles';
import type { BirdComposition, BoardTileDefinition, LevelDefinition, WinningAction } from '../src/core/types';
import { tryVisibleUndo } from './experimentRegionalV7Rescue';

export const REGIONAL_V7_UPGRADE_EXPERIMENT_VERSION = 'regional-v7-interleaved-branches-1';
export const UPGRADE_CANDIDATES_PER_STAGE = 20;
export const UPGRADE_TRIALS_PER_SPLIT = 5;
export const UPGRADE_EVALUATION_STRATEGIES = ['word-seeking', 'word-cluster'] as const;
export type UpgradeMethod = 'interleaved' | 'branch-first';
type Planned = { type: 'take'; character: string; wordIndex: number } | { type: 'compose'; birdId: string };

function planWords(words: readonly string[], vocabulary: ReadonlyMap<string, BirdComposition>, method: UpgradeMethod): Planned[] {
  const actions: Planned[] = [];
  if (method === 'branch-first') {
    words.forEach((id, wordIndex) => {
      for (const character of vocabulary.get(id)!.characters) actions.push({ type: 'take', character, wordIndex });
      actions.push({ type: 'compose', birdId: id });
    });
    return actions;
  }
  for (let index = 0; index < words.length;) {
    const remaining = words.length - index;
    const group = words.slice(index, index + Math.min(remaining, remaining % 3 === 0 ? 3 : 2));
    group.forEach((id, localIndex) => actions.push({ type: 'take', character: vocabulary.get(id)!.characters[0], wordIndex: index + localIndex }));
    group.forEach((id, localIndex) => {
      for (const character of vocabulary.get(id)!.characters.slice(1)) {
        actions.push({ type: 'take', character, wordIndex: index + localIndex });
      }
      actions.push({ type: 'compose', birdId: id });
    });
    index += group.length;
  }
  return actions;
}

function chooseExposed(tiles: readonly BoardTileDefinition[], removed: ReadonlySet<string>,
  random: () => number, method: UpgradeMethod, wordIndex: number): BoardTileDefinition {
  const exposed = tiles.filter((tile) => !removed.has(tile.id) && tile.blockedBy.every((id) => removed.has(id)));
  if (!exposed.length) throw new Error('Invalid D5 geometry during upgrade');
  if (method === 'interleaved') return exposed[Math.floor(random() * exposed.length)];
  // Complete consecutive words on alternating left/right blocking branches.
  // Randomly select among the three extremal exposed options to avoid an ID sweep.
  const byBranch = fisherYates(exposed, random).sort((a, b) => wordIndex % 2 === 0 ? a.x - b.x : b.x - a.x);
  return byBranch[Math.floor(random() * Math.min(3, byBranch.length))];
}

export interface UpgradeCandidate {
  puzzle: RegionalV7Puzzle;
  method: UpgradeMethod;
  candidateIndex: number;
  maximumWitnessTray: number;
  witnessActions: number;
  boardHash: string;
}

export function constructUpgradeCandidate(original: RegionalV7Puzzle, candidateIndex: number): UpgradeCandidate {
  if (original.record.tier !== 5 || !Number.isSafeInteger(candidateIndex) ||
    candidateIndex < 0 || candidateIndex >= UPGRADE_CANDIDATES_PER_STAGE) throw new Error('Invalid D5 upgrade request');
  const method: UpgradeMethod = candidateIndex % 2 === 0 ? 'interleaved' : 'branch-first';
  const seed = original.record.seed ^ Math.imul(candidateIndex + 1, 0x7feb352d) ^ 0x75b;
  const random = createSeededRandom(seed);
  const words = fisherYates(original.record.wordOccurrences, random);
  const vocabulary = new Map(original.level.compositions!.map((bird) => [bird.id, bird]));
  const plan = planWords(words, vocabulary, method);
  const removed = new Set<string>();
  const characterById = new Map<string, string>();
  const winningSolution: WinningAction[] = [];
  const takeOrder: number[] = [];
  for (const step of plan) {
    if (step.type === 'compose') {
      winningSolution.push({ type: 'compose', birdId: step.birdId });
      continue;
    }
    const tile = chooseExposed(original.level.tiles, removed, random, method, step.wordIndex);
    removed.add(tile.id);
    characterById.set(tile.id, step.character);
    takeOrder.push(original.level.tiles.findIndex((item) => item.id === tile.id));
    winningSolution.push({ type: 'take', tileId: tile.id });
  }
  if (removed.size !== 90 || takeOrder.length !== 90) throw new Error('Incomplete D5 upgrade board');
  const tiles = original.level.tiles.map((tile) => ({ ...tile, character: characterById.get(tile.id)! }));
  const hash = boardHash(tiles);
  const puzzleId = `regional-v7-upgrade:${sha256Hex(JSON.stringify([REGIONAL_V7_UPGRADE_EXPERIMENT_VERSION,
    original.record.puzzleId, candidateIndex, method, hash, words]))}`;
  const level: LevelDefinition = { ...original.level, id: puzzleId, puzzleId,
    tiles, wordOccurrences: words, winningSolution };
  if (words.slice().sort().join('|') !== original.record.wordOccurrences.slice().sort().join('|') ||
    tiles.map((tile) => tile.character).sort().join('') !== original.level.tiles.map((tile) => tile.character).sort().join('') ||
    tiles.some((tile, index) => tile.id !== original.level.tiles[index].id || tile.x !== original.level.tiles[index].x ||
      tile.y !== original.level.tiles[index].y || tile.layer !== original.level.tiles[index].layer ||
      tile.blockedBy.join('|') !== original.level.tiles[index].blockedBy.join('|'))) throw new Error('D5 upgrade changed content or geometry');
  let state = createGameFromLevel(level);
  let maximumWitnessTray = 0;
  for (const action of winningSolution) {
    const next = action.type === 'take' ? selectBoardTile(state, action.tileId) : composeBird(state, action.birdId);
    if (next === state) throw new Error('D5 upgrade witness illegal');
    state = next;
    maximumWitnessTray = Math.max(maximumWitnessTray, state.tray.filter(Boolean).length);
  }
  if (state.phase !== 'level_complete' || maximumWitnessTray > 8) throw new Error('D5 upgrade witness exceeds bound');
  const record = { ...original.record, puzzleId, boardHash: hash, seed: original.record.seed,
    generatorVersion: REGIONAL_V7_UPGRADE_EXPERIMENT_VERSION, characters: tiles.map((tile) => tile.character).join(''),
    wordOccurrences: words, takeOrder };
  return { puzzle: { record, level }, method, candidateIndex, maximumWitnessTray,
    witnessActions: winningSolution.length, boardHash: hash };
}

function grade(puzzle: RegionalV7Puzzle, split: 'training' | 'holdout') {
  const startIndex = split === 'training' ? 0 : UPGRADE_TRIALS_PER_SPLIT;
  return UPGRADE_EVALUATION_STRATEGIES.flatMap((strategy) =>
    Array.from({ length: UPGRADE_TRIALS_PER_SPLIT }, (_, offset) => ({
      strategy, ...tryVisibleUndo(puzzle, startIndex + offset, strategy),
    })));
}

export function experimentRegionalV7GeneratorUpgrade() {
  const started = performance.now();
  const allCandidateHashes: string[] = [];
  const stages = REGIONAL_V7_PUZZLES.filter((puzzle) => puzzle.record.tier === 5).map((original) => {
    const attempted = UPGRADE_CANDIDATES_PER_STAGE;
    const failures: Array<{ candidateIndex: number; reason: string }> = [];
    const candidates: UpgradeCandidate[] = [];
    for (let index = 0; index < attempted; index++) {
      try { candidates.push(constructUpgradeCandidate(original, index)); }
      catch (error) { failures.push({ candidateIndex: index, reason: String(error) }); }
    }
    allCandidateHashes.push(...candidates.map((candidate) => candidate.boardHash));
    const methodDiagnostics = (['interleaved', 'branch-first'] as const).map((method) => {
      const accepted = candidates.filter((candidate) => candidate.method === method);
      return { method, attempted: attempted / 2, certified: accepted.length,
        failed: failures.filter((failure) => failure.candidateIndex % 2 === (method === 'interleaved' ? 0 : 1)).length,
        uniqueBoardHashes: new Set(accepted.map((candidate) => candidate.boardHash)).size,
        maximumWitnessTray: accepted.length ? Math.max(...accepted.map((candidate) => candidate.maximumWitnessTray)) : null };
    });
    if (!candidates.length) return { stageIndex: original.record.stageIndex, attempted, certified: 0,
      uniqueBoardHashes: 0, methodDiagnostics, failures, selected: null };
    const trained = candidates.map((candidate) => {
      const trials = grade(candidate.puzzle, 'training');
      return { candidate, trainingWins: trials.filter((trial) => trial.status === 'WIN').length };
    });
    const selected = trained.sort((a, b) => b.trainingWins - a.trainingWins || a.candidate.candidateIndex - b.candidate.candidateIndex)[0];
    const holdout = grade(selected.candidate.puzzle, 'holdout');
    const baseline = grade(original, 'holdout');
    return { stageIndex: original.record.stageIndex, attempted, certified: candidates.length,
      uniqueBoardHashes: new Set(candidates.map((candidate) => candidate.boardHash)).size, methodDiagnostics, failures,
      selected: { candidateIndex: selected.candidate.candidateIndex, method: selected.candidate.method,
        puzzleId: selected.candidate.puzzle.record.puzzleId, boardHash: selected.candidate.boardHash,
        maximumWitnessTray: selected.candidate.maximumWitnessTray, trainingWins: selected.trainingWins,
        holdout: UPGRADE_EVALUATION_STRATEGIES.map((strategy) => {
          const subset = holdout.filter((trial) => trial.strategy === strategy);
          const originalSubset = baseline.filter((trial) => trial.strategy === strategy);
          return { strategy, wins: subset.filter((trial) => trial.status === 'WIN').length,
            losses: subset.filter((trial) => trial.status === 'LOSS').length,
            unknown: subset.filter((trial) => trial.status === 'UNKNOWN').length,
            fullTrayDeadlocks: subset.filter((trial) => trial.deadlockCause === 'FULL_TRAY').length,
            totalForwardActions: subset.reduce((sum, trial) => sum + trial.forwardActions, 0),
            totalUndos: subset.reduce((sum, trial) => sum + trial.undos, 0),
            originalWins: originalSubset.filter((trial) => trial.status === 'WIN').length };
        }) },
    };
  });
  const holdoutWins = stages.reduce((sum, stage) => sum + (stage.selected?.holdout.reduce((acc, row) => acc + row.wins, 0) ?? 0), 0);
  const originalWins = stages.reduce((sum, stage) => sum + (stage.selected?.holdout.reduce((acc, row) => acc + row.originalWins, 0) ?? 0), 0);
  return { version: REGIONAL_V7_UPGRADE_EXPERIMENT_VERSION, durationMs: performance.now() - started,
    attempted: stages.reduce((sum, stage) => sum + stage.attempted, 0),
    certified: stages.reduce((sum, stage) => sum + stage.certified, 0),
    failed: stages.reduce((sum, stage) => sum + stage.failures.length, 0),
    uniqueBoardHashes: new Set(allCandidateHashes).size,
    holdoutWins, originalWins, passesHumanPrototypeGate: holdoutWins >= 30 && holdoutWins > originalWins &&
      stages.every((stage) => (stage.selected?.holdout.reduce((sum, row) => sum + row.wins, 0) ?? 0) >= 2),
    limits: { candidatesPerStage: UPGRADE_CANDIDATES_PER_STAGE, trainTrialsPerStrategy: UPGRADE_TRIALS_PER_SPLIT,
      holdoutTrialsPerStrategy: UPGRADE_TRIALS_PER_SPLIT, forwardActions: 180, undos: 20 },
    stages };
}
