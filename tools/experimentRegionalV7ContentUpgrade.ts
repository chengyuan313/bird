import { createSeededRandom, fisherYates } from '../src/core/level3Generator';
import { sha256Hex } from '../src/core/puzzleIdentity';
import { V7_DIFFICULTY_POOLS, V7_PLAYABLE_NAMES, V7_PROVINCIAL_MEMBERSHIPS, V7_SPECIES_MASTER,
  V7_REGIONAL_COMPOSITIONS } from '../src/core/regionalV7Data';
import { REGIONAL_V7_PUZZLES, type RegionalV7Puzzle } from '../src/core/regionalV7Puzzles';
import { constructUpgradeCandidate, type UpgradeMethod } from './experimentRegionalV7GeneratorUpgrade';
import { tryVisibleUndo } from './experimentRegionalV7Rescue';

export const REGIONAL_V7_CONTENT_EXPERIMENT_VERSION = 'regional-v7-content-upgrade-1';
export const CONTENT_CANDIDATES_PER_STAGE = 20;
export const CONTENT_STRATEGIES = ['word-seeking', 'word-cluster'] as const;
export const CONTENT_TRAIN_TRIAL_INDICES = [101, 102, 103, 104, 105] as const;
export const CONTENT_VALIDATION_TRIAL_INDICES = [201, 202, 203, 204, 205] as const;
export const CONTENT_AUDIT_TRIAL_INDICES = [301, 302, 303, 304, 305] as const;
const MAX_CONTENT_ATTEMPTS = 100;
const d5Pool = V7_DIFFICULTY_POOLS.find((pool) => pool.regionId === 'CN-SC' && pool.tier === 5)!;
const nameById = new Map(V7_PLAYABLE_NAMES.map((name) => [name.id, name]));
const membershipById = new Map(V7_PROVINCIAL_MEMBERSHIPS.map((membership) => [membership.speciesId, membership]));
const speciesById = new Map(V7_SPECIES_MASTER.map((species) => [species.id, species]));
const featureIds = new Set(d5Pool.regionalFeatureSpeciesIds);
const d5Puzzles = REGIONAL_V7_PUZZLES.filter((puzzle) => puzzle.record.tier === 5);

function countLong(words: readonly string[]): number {
  return words.filter((id) => nameById.get(id)!.nameLength >= 5).length;
}

function wordLength(words: readonly string[]): number {
  return words.reduce((total, id) => total + nameById.get(id)!.nameLength, 0);
}

function charOverlap(candidate: string, words: readonly string[]): number {
  const existing = new Set(words.flatMap((id) => nameById.get(id)!.characters));
  return nameById.get(candidate)!.characters.filter((character) => existing.has(character)).length;
}

function generatedWords(stageIndex: number, candidateIndex: number): readonly string[] {
  const required = d5Pool.newlyIntroducedSpeciesIds.slice((stageIndex - 1) * 4, stageIndex * 4);
  if (required.length !== 4) throw new Error('Missing D5 introduced species');
  const method: UpgradeMethod = candidateIndex % 2 === 0 ? 'interleaved' : 'branch-first';
  const seed = 0x7512 ^ Math.imul(stageIndex, 0x9e3779b1) ^ Math.imul(candidateIndex + 1, 0x7feb352d);
  for (let attempt = 0; attempt < MAX_CONTENT_ATTEMPTS; attempt++) {
    const random = createSeededRandom(seed ^ Math.imul(attempt + 1, 0x45d9f3b));
    const words = [...required];
    const counts = new Map(words.map((id) => [id, 1]));
    const add = (id: string) => { words.push(id); counts.set(id, (counts.get(id) ?? 0) + 1); };
    const features = fisherYates(d5Pool.regionalFeatureSpeciesIds.filter((id) => !counts.has(id)), random);
    while (new Set(words.filter((id) => featureIds.has(id))).size < 2 && features.length) add(features.shift()!);
    if (new Set(words.filter((id) => featureIds.has(id))).size < 2) continue;
    const longOptions = fisherYates(d5Pool.speciesIds.filter((id) => nameById.get(id)!.nameLength >= 5 && !counts.has(id)), random);
    while (countLong(words) < 4 && longOptions.length) add(longOptions.shift()!);
    if (countLong(words) < 4 || wordLength(words) > 90) continue;
    // A minimizes shared-character pressure; B prioritizes short, quickly
    // completable vocabulary. Neither may violate source/length/identity rules.
    while (new Set(words).size < 20) {
      const options = fisherYates(d5Pool.speciesIds.filter((id) => !counts.has(id) &&
        wordLength(words) + nameById.get(id)!.nameLength <= 90 &&
        (nameById.get(id)!.nameLength < 5 || countLong(words) < 8)), random);
      options.sort((a, b) => method === 'interleaved'
        ? charOverlap(a, words) - charOverlap(b, words) || nameById.get(a)!.nameLength - nameById.get(b)!.nameLength
        : nameById.get(a)!.nameLength - nameById.get(b)!.nameLength || charOverlap(a, words) - charOverlap(b, words));
      if (!options.length) break;
      add(options[Math.floor(random() * Math.min(4, options.length))]);
    }
    if (new Set(words).size < 20 || wordLength(words) > 90) continue;
    while (wordLength(words) < 90) {
      const remaining = 90 - wordLength(words);
      const options = fisherYates(d5Pool.speciesIds.filter((id) => {
        const length = nameById.get(id)!.nameLength;
        return (counts.get(id) ?? 0) < 2 && length <= remaining && remaining - length !== 1 &&
          (length < 5 || countLong(words) < 8);
      }), random);
      options.sort((a, b) => method === 'interleaved'
        ? charOverlap(a, words) - charOverlap(b, words) || nameById.get(a)!.nameLength - nameById.get(b)!.nameLength
        : nameById.get(a)!.nameLength - nameById.get(b)!.nameLength || charOverlap(a, words) - charOverlap(b, words));
      if (!options.length) break;
      add(options[Math.floor(random() * Math.min(4, options.length))]);
    }
    if (wordLength(words) === 90 && countLong(words) >= 4 && countLong(words) <= 8) {
      return method === 'branch-first'
        ? fisherYates(words, random).sort((a, b) => nameById.get(a)!.nameLength - nameById.get(b)!.nameLength)
        : fisherYates(words, random);
    }
  }
  throw new Error(`Cannot construct D5 content after ${MAX_CONTENT_ATTEMPTS} bounded attempts`);
}

export function validateContentWords(words: readonly string[], stageIndex: number): void {
  const required = d5Pool.newlyIntroducedSpeciesIds.slice((stageIndex - 1) * 4, stageIndex * 4);
  const counts = new Map<string, number>();
  for (const id of words) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const name = nameById.get(id);
    const source = membershipById.get(id);
    const species = speciesById.get(id);
    if (!name || !d5Pool.speciesIds.includes(id) || !source || source.regionId !== 'CN-SC' ||
      !source.sourceUrl.startsWith('https://') || !species ||
      source.originalChineseName !== name.name || source.originalScientificName !== species.scientificName ||
      source.speciesId !== name.speciesId || name.nameLength < 2 || name.nameLength > 6 ||
      !name.characters.every((character) => /^\p{Script=Han}$/u.test(character))) throw new Error(`Unverified D5 word ${id}`);
  }
  if (wordLength(words) !== 90 || new Set(words).size < 20 || [...counts.values()].some((count) => count > 2) ||
    countLong(words) < 4 || countLong(words) > 8 ||
    new Set(words.filter((id) => featureIds.has(id))).size < 2 || required.some((id) => !counts.has(id))) {
    throw new Error(`Invalid D5 content constraints for stage ${stageIndex}`);
  }
}

export interface ContentCandidate {
  candidateIndex: number;
  method: UpgradeMethod;
  puzzle: RegionalV7Puzzle;
  wordCount: number;
  distinctWords: number;
  longOccurrences: number;
  maximumWitnessTray: number;
}

export function constructContentCandidate(original: RegionalV7Puzzle, candidateIndex: number): ContentCandidate {
  if (original.record.tier !== 5 || candidateIndex < 0 || candidateIndex >= CONTENT_CANDIDATES_PER_STAGE) {
    throw new Error('Invalid D5 content candidate');
  }
  const desiredWords = generatedWords(original.record.stageIndex, candidateIndex);
  validateContentWords(desiredWords, original.record.stageIndex);
  // constructUpgradeCandidate applies a deterministic shuffle to its input.
  // Invert that permutation so B retains its intentionally short-first order.
  const shuffleSeed = original.record.seed ^ Math.imul(candidateIndex + 1, 0x7feb352d) ^ 0x75b;
  const permutation = fisherYates(desiredWords.map((_, index) => index), createSeededRandom(shuffleSeed));
  const inputWords = Array<string>(desiredWords.length);
  permutation.forEach((sourceIndex, outputIndex) => { inputWords[sourceIndex] = desiredWords[outputIndex]; });
  const characters = inputWords.flatMap((id) => nameById.get(id)!.characters);
  if (characters.length !== 90) throw new Error('D5 content character budget mismatch');
  const templateTiles = original.level.tiles.map((tile, index) => ({ ...tile, character: characters[index] }));
  const templateId = `regional-v7-content-template:${sha256Hex(JSON.stringify([original.record.puzzleId, inputWords]))}`;
  const template: RegionalV7Puzzle = { record: { ...original.record, puzzleId: templateId,
    characters: templateTiles.map((tile) => tile.character).join(''), wordOccurrences: inputWords },
    level: { ...original.level, id: templateId, puzzleId: templateId, tiles: templateTiles,
      compositions: V7_REGIONAL_COMPOSITIONS, wordOccurrences: inputWords, winningSolution: [] } };
  const constructed = constructUpgradeCandidate(template, candidateIndex);
  const puzzleId = `regional-v7-content:${sha256Hex(JSON.stringify([REGIONAL_V7_CONTENT_EXPERIMENT_VERSION,
    original.record.puzzleId, candidateIndex, constructed.boardHash, desiredWords]))}`;
  const puzzle: RegionalV7Puzzle = { record: { ...constructed.puzzle.record, puzzleId,
    generatorVersion: REGIONAL_V7_CONTENT_EXPERIMENT_VERSION },
    level: { ...constructed.puzzle.level, id: puzzleId, puzzleId } };
  validateContentWords(puzzle.record.wordOccurrences, original.record.stageIndex);
  if (puzzle.record.wordOccurrences.join('|') !== desiredWords.join('|')) throw new Error('D5 word order inversion failed');
  return { candidateIndex, method: constructed.method, puzzle,
    wordCount: desiredWords.length, distinctWords: new Set(desiredWords).size,
    longOccurrences: countLong(desiredWords), maximumWitnessTray: constructed.maximumWitnessTray };
}

function evaluateSplit(puzzle: RegionalV7Puzzle, trialIndices: readonly number[]) {
  return CONTENT_STRATEGIES.flatMap((strategy) => trialIndices.map((trialIndex) => ({
    strategy, ...tryVisibleUndo(puzzle, trialIndex, strategy),
  })));
}

function summarize(trials: ReturnType<typeof evaluateSplit>) {
  return CONTENT_STRATEGIES.map((strategy) => {
    const subset = trials.filter((trial) => trial.strategy === strategy);
    return { strategy, wins: subset.filter((trial) => trial.status === 'WIN').length,
      losses: subset.filter((trial) => trial.status === 'LOSS').length,
      unknown: subset.filter((trial) => trial.status === 'UNKNOWN').length,
      fullTrayDeadlocks: subset.filter((trial) => trial.deadlockCause === 'FULL_TRAY').length,
      forwardActions: subset.reduce((sum, trial) => sum + trial.forwardActions, 0),
      undos: subset.reduce((sum, trial) => sum + trial.undos, 0),
      averageForwardActions: subset.reduce((sum, trial) => sum + trial.forwardActions, 0) / subset.length,
      averageUndos: subset.reduce((sum, trial) => sum + trial.undos, 0) / subset.length };
  });
}

function contentReview(puzzle: RegionalV7Puzzle) {
  const words = puzzle.record.wordOccurrences;
  const distinct = [...new Set(words)];
  const characterToNames = new Map<string, Set<string>>();
  for (const id of distinct) {
    for (const character of new Set(nameById.get(id)!.characters)) {
      const names = characterToNames.get(character) ?? new Set<string>();
      names.add(id);
      characterToNames.set(character, names);
    }
  }
  const sharedCharacterTypes = [...characterToNames.values()].filter((names) => names.size >= 2).length;
  const sharedWordPairs = distinct.flatMap((id, index) => distinct.slice(index + 1).map((other) =>
    nameById.get(id)!.characters.some((character) => nameById.get(other)!.characters.includes(character)))).filter(Boolean).length;
  const introduced = new Set(d5Pool.newlyIntroducedSpeciesIds.slice((puzzle.record.stageIndex - 1) * 4, puzzle.record.stageIndex * 4));
  return { sharedCharacterTypes, sharedWordPairs,
    introducedSpeciesIds: [...introduced],
    sourceUrl: V7_PROVINCIAL_MEMBERSHIPS[0].sourceUrl,
    words: distinct.map((id) => ({ id, name: nameById.get(id)!.name, scientificName: speciesById.get(id)!.scientificName,
      sourceRow: membershipById.get(id)!.sourceRow, occurrences: words.filter((word) => word === id).length,
      introducedD5: introduced.has(id), regionalFeature: featureIds.has(id),
      nameReview: speciesById.get(id)!.nameReview })) };
}

export function experimentRegionalV7ContentUpgrade() {
  const started = performance.now();
  const allHashes: string[] = [];
  const stages = d5Puzzles.map((original) => {
    const failures: Array<{ candidateIndex: number; reason: string }> = [];
    const candidates: ContentCandidate[] = [];
    for (let index = 0; index < CONTENT_CANDIDATES_PER_STAGE; index++) {
      try { candidates.push(constructContentCandidate(original, index)); }
      catch (error) { failures.push({ candidateIndex: index, reason: String(error) }); }
    }
    allHashes.push(...candidates.map((candidate) => candidate.puzzle.record.boardHash));
    const trainingCandidates = candidates.map((candidate) => {
      const trials = evaluateSplit(candidate.puzzle, CONTENT_TRAIN_TRIAL_INDICES);
      return { candidate, trainingWins: trials.filter((trial) => trial.status === 'WIN').length };
    });
    const selected = trainingCandidates.sort((a, b) => b.trainingWins - a.trainingWins ||
      a.candidate.candidateIndex - b.candidate.candidateIndex)[0];
    return { stageIndex: original.record.stageIndex, attempted: CONTENT_CANDIDATES_PER_STAGE,
      certified: candidates.length, failures,
      uniqueBoardHashes: new Set(candidates.map((candidate) => candidate.puzzle.record.boardHash)).size,
      trainingCandidates: trainingCandidates.map(({ candidate, trainingWins }) => ({
        candidateIndex: candidate.candidateIndex, method: candidate.method,
        puzzleId: candidate.puzzle.record.puzzleId, boardHash: candidate.puzzle.record.boardHash,
        wordCount: candidate.wordCount, distinctWords: candidate.distinctWords,
        longOccurrences: candidate.longOccurrences, maximumWitnessTray: candidate.maximumWitnessTray,
        trainingWins })),
      selected: selected ? { candidate: selected.candidate, trainingWins: selected.trainingWins } : null,
      original };
  });
  const validationRows = stages.map((stage) => {
    if (!stage.selected) return { stageIndex: stage.stageIndex, selectedPuzzleId: null, results: null, original: null };
    const results = summarize(evaluateSplit(stage.selected.candidate.puzzle, CONTENT_VALIDATION_TRIAL_INDICES));
    const baseline = summarize(evaluateSplit(stage.original, CONTENT_VALIDATION_TRIAL_INDICES));
    return { stageIndex: stage.stageIndex, selectedPuzzleId: stage.selected.candidate.puzzle.record.puzzleId,
      results, original: baseline };
  });
  const validationWins = validationRows.reduce((sum, row) => sum + (row.results?.reduce((n, result) => n + result.wins, 0) ?? 0), 0);
  const originalValidationWins = validationRows.reduce((sum, row) => sum + (row.original?.reduce((n, result) => n + result.wins, 0) ?? 0), 0);
  const validationGate = validationWins >= 30 && validationWins > originalValidationWins &&
    validationRows.every((row) => (row.results?.reduce((sum, result) => sum + result.wins, 0) ?? 0) >= 2);
  // Audit seeds are inaccessible until the validation gate passes. Never tune or
  // reselect candidates based on validation or audit outcomes.
  const auditRows = validationGate ? stages.map((stage) => ({ stageIndex: stage.stageIndex,
    results: stage.selected ? summarize(evaluateSplit(stage.selected.candidate.puzzle, CONTENT_AUDIT_TRIAL_INDICES)) : null,
    original: summarize(evaluateSplit(stage.original, CONTENT_AUDIT_TRIAL_INDICES)) })) : null;
  const auditWins = auditRows?.reduce((sum, row) => sum + (row.results?.reduce((n, result) => n + result.wins, 0) ?? 0), 0) ?? null;
  const originalAuditWins = auditRows?.reduce((sum, row) => sum + row.original.reduce((n, result) => n + result.wins, 0), 0) ?? null;
  return { version: REGIONAL_V7_CONTENT_EXPERIMENT_VERSION, durationMs: performance.now() - started,
    strategies: CONTENT_STRATEGIES, splits: { training: CONTENT_TRAIN_TRIAL_INDICES,
      validation: CONTENT_VALIDATION_TRIAL_INDICES, audit: CONTENT_AUDIT_TRIAL_INDICES },
    limits: { candidatesPerStage: CONTENT_CANDIDATES_PER_STAGE, internalContentAttempts: MAX_CONTENT_ATTEMPTS,
      forwardActions: 180, undos: 20 },
    attempted: stages.reduce((sum, stage) => sum + stage.attempted, 0),
    certified: stages.reduce((sum, stage) => sum + stage.certified, 0),
    failed: stages.reduce((sum, stage) => sum + stage.failures.length, 0),
    uniqueBoardHashes: new Set(allHashes).size,
    stages: stages.map(({ original: _original, selected, ...stage }) => ({ ...stage,
      selected: selected ? { candidateIndex: selected.candidate.candidateIndex,
        puzzleId: selected.candidate.puzzle.record.puzzleId, method: selected.candidate.method,
        trainingWins: selected.trainingWins, maximumWitnessTray: selected.candidate.maximumWitnessTray,
        contentReview: contentReview(selected.candidate.puzzle) } : null })),
    validationRows, validationWins, originalValidationWins, validationGate,
    auditRows, auditWins, originalAuditWins,
    passesHumanPrototypeGate: validationGate && auditWins !== null && auditWins >= 30 &&
      auditRows!.every((row) => (row.results?.reduce((sum, result) => sum + result.wins, 0) ?? 0) >= 2) };
}
