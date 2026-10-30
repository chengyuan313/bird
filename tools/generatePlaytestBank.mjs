import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
if (process.argv.includes('--worker')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { DIFFICULTY_PROFILES, generateExperimentalCandidate } = await server.ssrLoadModule('/tools/parameterizedGeneration.ts');
    const { encodeWinningTrace } = await server.ssrLoadModule('/src/core/puzzleBank.ts');
    const profile = DIFFICULTY_PROFILES.find((item) => item.id === 'standard');
    const seeds = [31, 37, 43, 47, 53];
    const placements = { A: 'consecutive', B: 'paired', C: 'multi-name' };
    const records = [];
    const hashes = new Set();
    for (const seed of seeds) {
      for (const [group, placement] of Object.entries(placements)) {
        const result = generateExperimentalCandidate(profile, seed, placement, 'seeded-random');
        if (!result.ok) throw new Error(`Rejected ${group}/${seed}: ${result.reason}`);
        const { candidate } = result;
        if (hashes.has(candidate.boardHash)) throw new Error(`Duplicate board ${candidate.boardHash}`);
        hashes.add(candidate.boardHash);
        records.push({
          id: candidate.experimentId, group, seed, profileId: profile.id, placement,
          spatialOrder: 'seeded-random', boardHash: candidate.boardHash,
          characters: candidate.level.tiles.map((tile) => tile.character).join(''),
          sampledBirdIds: candidate.sampledBirdIds,
          winningTrace: encodeWinningTrace(candidate.level.winningSolution),
          contentAttempts: candidate.contentAttempts,
        });
      }
    }
    const output = JSON.stringify({ schemaVersion: 'playtest-bank-v1', generatorVersion: 'experimental-difficulty-v1', seeds, records }, null, 2) + '\n';
    const destination = fileURLToPath(new URL('../src/core/playtestBank.json', import.meta.url));
    if (process.argv.includes('--check')) {
      if (readFileSync(destination, 'utf8') !== output) throw new Error('Playtest bank is not reproducible');
    } else writeFileSync(destination, output);
    console.log(JSON.stringify({ candidates: records.length, accepted: records.length, uniqueBoardHashes: hashes.size }));
  } finally {
    await server.close();
  }
} else {
  const child = spawn(process.execPath, [script, '--worker', ...process.argv.slice(2)], { cwd: process.cwd(), stdio: 'inherit', timeout: 90_000 });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Playtest generation stopped by ${signal}`);
    process.exitCode = code ?? 1;
  });
}
