import { describe, expect, it } from 'vitest';
import report from '../tools/parameterized-report.json';
import { GLOBAL_BIRD_COMPOSITIONS } from '../src/core/recognitionRegistry';
import { CERTIFIED_PUZZLE_BANK } from '../src/core/puzzleBank';
import { createGameFromLevel } from '../src/core/gameEngine';
import { replaySolution } from '../tools/level3Solver';
import {
  DIFFICULTY_PROFILES, DIFFICULTY_PROFILE_VERSION, generateExperimentalCandidate,
  profileCatalog, validateDifficultyProfile, validateFixedGeometry,
} from '../tools/parameterizedGeneration';
import type { PlacementMode } from '../tools/parameterizedGeneration';
import {
  EXPERIMENT_ACTION_BUDGET, EXPERIMENT_PLACEMENTS, EXPERIMENT_SEEDS, EXPERIMENT_STRATEGIES,
  EXPERIMENT_VERSION, classifySimulationError, classifyTrial, evaluateExperimentCell, simulate,
} from '../tools/parameterizedExperiment';

describe('offline parameterized difficulty generation', () => {
  it('versions and validates achievable profile targets', () => {
    for (const profile of DIFFICULTY_PROFILES) {
      expect(profile.version).toBe(DIFFICULTY_PROFILE_VERSION);
      expect(() => validateDifficultyProfile(profile)).not.toThrow();
      expect(profileCatalog(profile).length).toBeGreaterThanOrEqual(profile.minDistinctSpecies);
    }
    const base = DIFFICULTY_PROFILES[0];
    expect(() => validateDifficultyProfile({ ...base, version: 'future' as typeof DIFFICULTY_PROFILE_VERSION })).toThrow('Unsupported');
    expect(() => profileCatalog({ ...base, familiarPoolSize: 1 })).toThrow('Impossible vocabulary pool');
    expect(() => profileCatalog({ ...base, allowedNameLengths: [4] })).toThrow('Impossible name-length');
    expect(() => validateDifficultyProfile({ ...base, minOverlappingSpeciesPairs: 1000 })).toThrow('Impossible shared-character');
    expect(() => generateExperimentalCandidate(base, 0)).toThrow('Invalid experimental seed');
  });

  it('keeps exact 90-tile geometry, overlap semantics, and a mobile-fitting board', () => {
    expect(validateFixedGeometry()).toEqual({ tileCount: 90, layers: 4, initiallyExposed: 19, blockingEdges: 203,
      blockingEdgeDensity: 0.0507, widthPx: 308, heightPx: 308 });
    expect(validateFixedGeometry().widthPx).toBeLessThan(390 - 36);
  });

  it('generates deterministic, character-conserving, fully replayable candidates', () => {
    const profile = DIFFICULTY_PROFILES[1];
    const first = generateExperimentalCandidate(profile, 31, 'paired');
    const second = generateExperimentalCandidate(profile, 31, 'paired');
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const { candidate } = first;
    expect(candidate.level.tiles).toHaveLength(90);
    expect(candidate.level.tiles.map((tile) => tile.character).sort())
      .toEqual(candidate.sampledBirdIds.flatMap((id) => GLOBAL_BIRD_COMPOSITIONS.find((bird) => bird.id === id)!.characters).sort());
    expect(candidate.level.winningSolution.filter((action) => action.type === 'take')).toHaveLength(90);
    expect(replaySolution(candidate.level, candidate.level.winningSolution).phase).toBe('level_complete');
    expect(candidate.experimentId).toContain(candidate.boardHash);
    expect(CERTIFIED_PUZZLE_BANK.records.some((record) => record.boardHash === candidate.boardHash)).toBe(false);
  });

  it('changes vocabulary and witness pressure through independent controls', () => {
    const beginner = profileCatalog(DIFFICULTY_PROFILES[0]);
    const expert = profileCatalog(DIFFICULTY_PROFILES[2]);
    expect(beginner.every((bird) => bird.characterCount <= 3)).toBe(true);
    expect(expert.every((bird) => bird.characterCount >= 3)).toBe(true);
    const rows = report.cells.filter((cell) => cell.status === 'CERTIFIED');
    expect(rows.filter((cell) => cell.profileId === 'beginner').every((cell) => cell.vocabulary!.distinctDiscoverySpecies === 0)).toBe(true);
    const mean = (placement: string) => rows.filter((cell) => cell.placement === placement)
      .reduce((sum, cell) => sum + cell.features!.witnessMaxTray, 0) / 9;
    expect(mean('consecutive')).toBeLessThan(mean('paired'));
    expect(mean('paired')).toBeLessThan(mean('multi-name'));
    expect(rows.filter((cell) => cell.placement === 'consecutive').every((cell) => cell.witnessConcurrentNames === 1)).toBe(true);
    expect(rows.filter((cell) => cell.placement === 'paired').every((cell) => cell.witnessConcurrentNames === 2)).toBe(true);
    expect(rows.filter((cell) => cell.placement === 'multi-name').every((cell) => cell.witnessConcurrentNames === 3)).toBe(true);
  });

  it('changes spatial exposure trajectories without changing the blocker graph or content multiset', () => {
    const profile = DIFFICULTY_PROFILES[1];
    const variants = (['seeded-random', 'unlock-max', 'unlock-min'] as const)
      .map((order) => generateExperimentalCandidate(profile, 31, 'paired', order));
    expect(variants.every((variant) => variant.ok)).toBe(true);
    if (variants.some((variant) => !variant.ok)) return;
    const candidates = variants.map((variant) => variant.ok && variant.candidate).filter((candidate) => candidate !== false);
    expect(new Set(candidates.map((candidate) => candidate.boardHash)).size).toBe(3);
    expect(candidates.map((candidate) => candidate.sampledBirdIds.slice().sort())).toEqual(Array(3).fill(candidates[0].sampledBirdIds.slice().sort()));
    expect(candidates.map((candidate) => candidate.level.tiles.map((tile) => tile.blockedBy)))
      .toEqual(Array(3).fill(candidates[0].level.tiles.map((tile) => tile.blockedBy)));
    const random = report.cells.find((cell) => cell.profileId === 'standard' && cell.placement === 'paired' && cell.seed === 31)!;
    const maximum = report.spatialCells.find((cell) => cell.spatialOrder === 'unlock-max' && cell.seed === 31)!;
    const minimum = report.spatialCells.find((cell) => cell.spatialOrder === 'unlock-min' && cell.seed === 31)!;
    expect(maximum.features!.checkpointLegalChoices[1]).toBeGreaterThan(random.features!.checkpointLegalChoices[1]);
    expect(random.features!.checkpointLegalChoices[1]).toBeGreaterThan(minimum.features!.checkpointLegalChoices[1]);
    expect([random.features!.initialExposed, maximum.features!.initialExposed, minimum.features!.initialExposed]).toEqual([19, 19, 19]);
  });

  it('distinguishes simulation outcomes and never reads a witness in ordinary play', () => {
    expect(classifyTrial({ outcome: 'WIN' } as Parameters<typeof classifyTrial>[0])).toBe('WON');
    expect(classifyTrial({ outcome: 'LOSS' } as Parameters<typeof classifyTrial>[0])).toBe('LOST');
    expect(classifyTrial({ outcome: 'UNKNOWN' } as Parameters<typeof classifyTrial>[0])).toBe('UNKNOWN_BUDGET');
    expect(classifySimulationError(new Error('INVALID_ACTION: bad tile'))).toBe('INVALID_ACTION');
    expect(classifySimulationError(new Error('unexpected'))).toBe('ERROR');
    const candidate = generateExperimentalCandidate(DIFFICULTY_PROFILES[0], 31);
    expect(candidate.ok).toBe(true);
    if (!candidate.ok) return;
    const level = candidate.candidate.level;
    const unknown = simulate(level, 'always-compose', 31, 0);
    expect(unknown.status).toBe('UNKNOWN_BUDGET');
    expect(unknown.actions).toBe(0);
    expect(simulate(level, 'random-legal', 31)).toEqual(simulate({ ...level, winningSolution: [] }, 'random-legal', 31));
    expect(createGameFromLevel(level).activeCompositions).toHaveLength(103);
  });

  it('reproduces the benchmark contract and preserves all bank identities and hashes', () => {
    expect(report.version).toBe(EXPERIMENT_VERSION);
    expect(report.profileVersion).toBe(DIFFICULTY_PROFILE_VERSION);
    expect(report.seeds).toEqual(EXPERIMENT_SEEDS);
    expect(report.placements).toEqual(EXPERIMENT_PLACEMENTS);
    expect(report.strategies).toEqual(EXPERIMENT_STRATEGIES);
    expect(report.actionBudget).toBe(EXPERIMENT_ACTION_BUDGET);
    expect(report.summary).toEqual({ attempted: 33, replayCertified: 33, uniqueBoardHashes: 33, rejected: 0 });
    expect(report.sourceBankPuzzleIds).toEqual(CERTIFIED_PUZZLE_BANK.records.map((record) => record.puzzleId));
    expect(report.sourceBankBoardHashes).toEqual(CERTIFIED_PUZZLE_BANK.records.map((record) => record.boardHash));
    expect(report.cells).toHaveLength(27);
    expect(report.spatialCells).toHaveLength(6);
    expect(new Set([...report.cells, ...report.spatialCells].map((cell) => cell.boardHash)).size).toBe(33);
    for (const index of [0, 13, 26]) {
      const cell = report.cells[index];
      expect(cell).toEqual(evaluateExperimentCell(DIFFICULTY_PROFILES.find((profile) => profile.id === cell.profileId)!, cell.placement as PlacementMode, cell.seed, cell.spatialOrder as typeof DIFFICULTY_PROFILES[number]['spatialOrder']));
    }
  }, 30_000);
});
