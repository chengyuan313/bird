# Certified Level 3 puzzle bank (V4.2)

`src/core/puzzleBank.json` is the versioned, source-controlled offline artifact. Generate it with
`node tools/runPuzzleBankGenerator.mjs` (or `pnpm run generate:bank`). The launcher runs generation
in a child process with a 100-second kill limit. The generator itself allows 90 seconds total,
205 candidate attempts, and 1 second for each candidate's engine replay. It scans legacy seeds
1–5, then `(seed, candidateIndex)` pairs `(6,0), (6,1), (7,0), ...` until 100 new boards pass.
It writes the certified subset even if a budget expires; the test suite requires 105 records,
so a partial bank cannot be published.

## Identity and reproducibility

The schema is `certified-puzzle-bank-v1`. The original five seeds use generator version
`solution-first-v3`, candidate index 0, and their exact historical character assignments and
winning traces. New boards use `solution-first-v4.2`. Both use vocabulary version
`beginner-36-v1`, geometry version `piachan-lv1-90-v1`, and the global recognition rules version
exported by `recognitionRegistry.ts`. Index 0 of the new generator intentionally uses the old
seed algorithm without changing its outputs; positive candidate indexes mix the seed with a
fixed 32-bit integer before sampling, ordering, and assignment. A future algorithm or vocabulary
change requires a new version string and a newly certified bank.

The `characters` string gives one Unicode code point for each tile in `PIACHAN_POSITIONS` order.
The board hash is lower-case SHA-256 over UTF-8 encoding of JSON array rows sorted by tile ID
using code-point order. Every row has exactly `[id,x,y,layer,blockedBySorted,character]`.
The puzzle ID is `puzzle:` plus lower-case SHA-256 over UTF-8 encoding of this fixed-order JSON
array: `[generatorVersion,generationVocabularyVersion,recognitionRulesVersion,geometryVersion,seed,candidateIndex,boardHash]`.
Neither hash depends on object property iteration or locale sorting. The artifact retains all
identity inputs and the full character assignment, and validation rejects duplicate IDs/hashes.
Each record also has a SHA-256 `certificateHash` over a fixed-order array containing its puzzle ID,
character assignment, sampled IDs, winning trace, evidence statuses, and diagnostics. This is an
accidental-corruption check, not an authenticated signature.

The compact winning trace uses `t` plus a base-36 `PIACHAN_POSITIONS` index for a take, and `c`
plus a canonical asset key for a composition. `sampledBirdIds` stores the canonical generation
birds with occurrence multiplicity. The browser reconstructs only from validated records and
never searches; an unknown or mismatched requested ID throws rather than loading a fallback.
New-puzzle selection walks the bank in artifact order and wraps around, always changing ID.
Retry loads the exact current ID, resetting progress without reshuffling.

## Publication evidence

Each record is marked `CONSTRUCTED_AND_REPLAY_VERIFIED`: its solution-first witness was checked
action by action through the same tile-selection and composition functions as gameplay. The
offline check verifies exposure, unique takes, character conservation and consumption, scoring,
species discovery, tray capacity, and an empty board/tray at `level_complete`. The dedicated
`tests/puzzle-bank.test.ts` independently regenerates and replays **every** artifact record at
build/test time. Runtime import checks schema and input versions, SHA-256 board/puzzle integrity,
the character multiset, trace structure, certification marker, legacy presence, and uniqueness.
An arbitrary external puzzle record is never accepted by game entry points.

Independent search was **not run** for this bank; its status is `NOT_RUN`, not `SOLVED` or
`PROVEN_UNSOLVABLE`. A constructed, engine-replayed witness proves that at least one win exists,
but neither independent solver discovery nor human difficulty. Diagnostics are descriptive:
initial exposure, sampled-species count, pairwise character overlap/density, maximum and mean
post-action tray occupancy, formable-composition counts initially and after takes 30/60/90,
and the cumulative count of unique accepted board assignments.
Mean occupancy is computed after every certificate action. These do not define difficulty tiers.
