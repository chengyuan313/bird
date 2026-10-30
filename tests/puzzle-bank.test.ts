import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BIRD_CATALOG } from '../src/core/birdCatalog';
import { composeBird, createGame, createGameFromLevel, findFormableBirds, isBoardTileExposed, restartLevel, selectBoardTile, switchLevel3Board, TRAY_SIZE } from '../src/core/game';
import { createPlayableLevel3, generatePiachanLevel3 } from '../src/core/level3Playable';
import { getLevel } from '../src/core/levels';
import { CERTIFIED_PUZZLE_BANK, decodeWinningTrace, getCertifiedPuzzle, getLegacyPuzzle, PUZZLE_BANK_LOAD_DURATION_MS, validatePuzzleBank } from '../src/core/puzzleBank';
import { boardHash, GENERATOR_VERSION, puzzleId, sha256Hex } from '../src/core/puzzleIdentity';
import { GLOBAL_BIRD_COMPOSITIONS } from '../src/core/recognitionRegistry';
import { PIACHAN_POSITIONS } from '../src/preview/piachanLayout';

function sorted(values: readonly string[]): string {
  return [...values].sort().join('');
}

describe('certified Level 3 puzzle bank', () => {
  it('contains 105 distinct identities and SHA-256 boards without a runtime search', () => {
    const records = CERTIFIED_PUZZLE_BANK.records;
    expect(records).toHaveLength(105);
    expect(records.filter((record) => record.generatorVersion === GENERATOR_VERSION)).toHaveLength(100);
    expect(new Set(records.map((record) => record.puzzleId)).size).toBe(records.length);
    expect(new Set(records.map((record) => record.boardHash)).size).toBe(records.length);
    expect(records.every((record) => record.independentSearchStatus === 'NOT_RUN')).toBe(true);
    expect(records.every((record) => record.witnessCertification === 'CONSTRUCTED_AND_REPLAY_VERIFIED')).toBe(true);
    expect(records.map((record) => record.diagnostics.uniqueBoardAssignmentsAtAcceptance))
      .toEqual(Array.from({ length: 105 }, (_, index) => index + 1));
    expect(PUZZLE_BANK_LOAD_DURATION_MS).toBeGreaterThanOrEqual(0);
    console.log(JSON.stringify({ puzzleBankRuntimeValidationMs: Number(PUZZLE_BANK_LOAD_DURATION_MS.toFixed(2)) }));
  });

  it('matches Node SHA-256 on Unicode and rejects corrupt or unsupported records', () => {
    for (const input of ['', '鸟', '斑鸠', 'abc', '喜鹊'.repeat(100)]) {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
    }
    const clean = structuredClone(CERTIFIED_PUZZLE_BANK);
    expect(() => validatePuzzleBank(clean)).not.toThrow();
    expect(() => validatePuzzleBank({ ...clean, schemaVersion: 'unsupported' })).toThrow('Unsupported puzzle-bank schema');
    expect(() => validatePuzzleBank({ ...clean, records: [{ ...clean.records[0], generatorVersion: 'future' }, ...clean.records.slice(1)] })).toThrow('Unsupported generator version');
    expect(() => validatePuzzleBank({ ...clean, records: [{ ...clean.records[0], recognitionRulesVersion: 'future' }, ...clean.records.slice(1)] })).toThrow('Unsupported puzzle input version');
    expect(() => validatePuzzleBank({ ...clean, records: [{ ...clean.records[0], witnessCertification: 'UNVERIFIED' }, ...clean.records.slice(1)] })).toThrow('Uncertified puzzle record');
    expect(() => validatePuzzleBank({ ...clean, records: [{ ...clean.records[0], characters: '错' + clean.records[0].characters.slice(1) }, ...clean.records.slice(1)] })).toThrow();
    const alteredTrace = clean.records[0].winningTrace.split(' ');
    [alteredTrace[0], alteredTrace[1]] = [alteredTrace[1], alteredTrace[0]];
    expect(() => validatePuzzleBank({ ...clean, records: [{ ...clean.records[0], winningTrace: alteredTrace.join(' ') }, ...clean.records.slice(1)] })).toThrow('Corrupted puzzle certificate');
    expect(() => validatePuzzleBank({ ...clean, records: [...clean.records, clean.records[0]] })).toThrow('Duplicate puzzle ID');
    expect(() => getCertifiedPuzzle('puzzle:not-real')).toThrow('Unknown certified puzzle ID');
  });

  it('preserves all five legacy boards and their exact historical traces', () => {
    for (const seed of [1, 2, 3, 4, 5] as const) {
      const historical = createPlayableLevel3(seed);
      const record = getLegacyPuzzle(seed);
      const loaded = getLevel('level-3', seed);
      expect(record.seed).toBe(seed);
      expect(record.candidateIndex).toBe(0);
      expect(loaded.tiles).toEqual(historical.tiles);
      expect(loaded.winningSolution).toEqual(historical.winningSolution);
      expect(getLevel('level-3', undefined, record.puzzleId).tiles).toEqual(historical.tiles);
    }
  });

  it('reproduces and engine-replays every certified board, action, score, and discovery', () => {
    const knownCompositions = new Map(GLOBAL_BIRD_COMPOSITIONS.map((bird) => [bird.id, bird]));
    const canonicalSpecies = new Set(BIRD_CATALOG.map((bird) => bird.id));
    for (const record of CERTIFIED_PUZZLE_BANK.records) {
      const loaded = getLevel('level-3', undefined, record.puzzleId);
      const regenerated = record.seed <= 5
        ? createPlayableLevel3(record.seed as 1 | 2 | 3 | 4 | 5)
        : generatePiachanLevel3(record.seed, record.candidateIndex);
      expect(loaded.tiles).toEqual(regenerated.tiles);
      expect(loaded.tiles).toHaveLength(90);
      expect(loaded.tiles.map((tile) => [tile.id, tile.x, tile.y, tile.layer, tile.blockedBy]))
        .toEqual(PIACHAN_POSITIONS.map((tile) => [tile.id, tile.x, tile.y, tile.layer, tile.blockedBy]));
      expect(boardHash(loaded.tiles)).toBe(record.boardHash);
      expect(puzzleId(record)).toBe(record.puzzleId);
      expect(sorted(loaded.tiles.map((tile) => tile.character)))
        .toBe(sorted(record.sampledBirdIds.flatMap((id) => BIRD_CATALOG.find((bird) => bird.id === id)!.characters)));
      expect(loaded.winningSolution).toEqual(decodeWinningTrace(record.winningTrace));
      let state = createGameFromLevel(loaded);
      const taken = new Set<string>();
      let maximum = 0;
      let occupancyTotal = 0;
      let takeCount = 0;
      const checkpoints = [findFormableBirds(state.tray).length];
      for (const action of loaded.winningSolution) {
        const before = state;
        if (action.type === 'take') {
          expect(isBoardTileExposed(before, action.tileId)).toBe(true);
          expect(taken.has(action.tileId)).toBe(false);
          taken.add(action.tileId);
          state = selectBoardTile(before, action.tileId);
          takeCount += 1;
        } else {
          const bird = knownCompositions.get(action.birdId)!;
          expect(bird).toBeDefined();
          expect(findFormableBirds(before.tray).some((option) => option.id === bird.id)).toBe(true);
          state = composeBird(before, action.birdId);
          const consumed = before.tray.flatMap((tile) => tile && !state.tray.some((remaining) => remaining?.id === tile.id)
            ? [tile.character] : []);
          expect(sorted(consumed)).toBe(sorted(bird.characters));
          expect(state.score).toBe(before.score + bird.score);
          expect(state.discoveredBirdIds.every((id) => canonicalSpecies.has(id))).toBe(true);
          expect(state.discoveredBirdIds.length).toBe(new Set(state.discoveredBirdIds).size);
          if (bird.classification === 'group') expect(state.discoveredBirdIds).toEqual(before.discoveredBirdIds);
        }
        expect(state).not.toBe(before);
        const occupied = state.tray.filter(Boolean).length;
        expect(occupied).toBeLessThanOrEqual(TRAY_SIZE);
        maximum = Math.max(maximum, occupied);
        occupancyTotal += occupied;
        if (action.type === 'take' && [30, 60, 90].includes(takeCount)) checkpoints.push(findFormableBirds(state.tray).length);
      }
      expect(taken.size).toBe(90);
      expect(state.phase).toBe('level_complete');
      expect(state.boardTiles.every((tile) => tile.removed)).toBe(true);
      expect(state.tray.every((tile) => tile === null)).toBe(true);
      expect(maximum).toBe(record.diagnostics.maximumTrayOccupancy);
      expect(Number((occupancyTotal / loaded.winningSolution.length).toFixed(3))).toBe(record.diagnostics.averageTrayOccupancy);
      expect(checkpoints).toEqual(record.diagnostics.checkpointFormableCompositions);
    }
  }, 90_000);

  it('retries the same identity and switches to a different certified layout', () => {
    const initial = createGame('level-3', 2);
    expect(initial.puzzleId).toBe(getLegacyPuzzle(2).puzzleId);
    const firstTake = initial.boardTiles.find((tile) => isBoardTileExposed(initial, tile.id))!;
    const progressed = selectBoardTile(initial, firstTake.id);
    const retried = restartLevel(progressed);
    expect(retried.puzzleId).toBe(initial.puzzleId);
    expect(retried.levelSeed).toBe(initial.levelSeed);
    expect(retried.boardTiles).toEqual(initial.boardTiles);
    expect(retried.score).toBe(0);
    expect(retried.discoveredBirdIds).toEqual([]);
    expect(retried.tray.every((tile) => tile === null)).toBe(true);
    const next = switchLevel3Board(initial);
    expect(next.puzzleId).not.toBe(initial.puzzleId);
    expect(next.boardTiles.map((tile) => tile.character)).not.toEqual(initial.boardTiles.map((tile) => tile.character));
    const fifth = createGame('level-3', 5);
    const firstNew = switchLevel3Board(fifth);
    expect(firstNew.levelSeed).toBe(6);
    expect(firstNew.puzzleId).toBe(CERTIFIED_PUZZLE_BANK.records[5].puzzleId);
    expect(firstNew.boardTiles).toEqual(restartLevel(firstNew).boardTiles);
    expect(switchLevel3Board(firstNew).puzzleId).not.toBe(firstNew.puzzleId);
    expect(() => createGame('level-3', 999)).toThrow('Unverified Level 3 seed');
    expect(() => createGame('level-3', undefined, 'puzzle:not-real')).toThrow('Unknown certified puzzle ID');
    expect(() => createGame('level-1', undefined, initial.puzzleId)).toThrow('Puzzle ID is only valid for Level 3');
    expect(() => createGame('level-3', 2, next.puzzleId)).toThrow('Puzzle ID and seed do not match');
  });
});
