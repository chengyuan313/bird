import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
if (process.argv.includes('--worker')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { runParameterizedExperiment } = await server.ssrLoadModule('/tools/parameterizedExperiment.ts');
    const started = performance.now();
    const report = runParameterizedExperiment();
    const evaluationMs = Math.round(performance.now() - started);
    const output = JSON.stringify(report, null, 2) + '\n';
    const destination = fileURLToPath(new URL('./parameterized-report.json', import.meta.url));
    if (process.argv.includes('--check')) {
      if (readFileSync(destination, 'utf8') !== output) throw new Error('Parameterized report is not reproducible');
    } else writeFileSync(destination, output);
    const { generateExperimentalCandidate } = await server.ssrLoadModule('/tools/parameterizedGeneration.ts');
    const generationStarted = performance.now();
    for (const profile of report.profiles) {
      for (const placement of report.placements) {
        for (const seed of report.seeds) generateExperimentalCandidate(profile, seed, placement);
      }
    }
    const standard = report.profiles.find((profile) => profile.id === 'standard');
    for (const spatialOrder of ['unlock-max', 'unlock-min']) {
      for (const seed of report.seeds) generateExperimentalCandidate(standard, seed, 'paired', spatialOrder);
    }
    const generationReplayMs = Math.round(performance.now() - generationStarted);
    console.log(JSON.stringify({ ...report.summary, evaluationMs,
      generationReplayMs, bytes: Buffer.byteLength(output), memoryMiB: Math.round(process.memoryUsage().rss / 1048576) }));
  } finally {
    await server.close();
  }
} else {
  const child = spawn(process.execPath, [script, '--worker', ...process.argv.slice(2)], {
    cwd: process.cwd(), stdio: 'inherit', timeout: 100_000,
  });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Parameterized evaluation stopped by ${signal} after its 100-second limit`);
    process.exitCode = code ?? 1;
  });
}
