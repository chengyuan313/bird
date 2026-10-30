import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
if (process.argv.includes('--worker')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { evaluateBank } = await server.ssrLoadModule('/tools/difficultyEvaluation.ts');
    const start = performance.now();
    const limit = process.argv.includes('--limit') ? Number(process.argv[process.argv.indexOf('--limit') + 1]) : undefined;
    const report = evaluateBank(limit);
    const output = JSON.stringify(report, null, 2) + '\n';
    const destination = fileURLToPath(new URL('./difficulty-report.json', import.meta.url));
    if (process.argv.includes('--check')) {
      if (readFileSync(destination, 'utf8') !== output) throw new Error('Difficulty report is not reproducible');
    } else if (limit === undefined) writeFileSync(destination, output);
    console.log(JSON.stringify({ puzzles: report.puzzles.length, elapsedMs: Math.round(performance.now() - start), bytes: Buffer.byteLength(output) }));
  } finally {
    await server.close();
  }
} else {
  const child = spawn(process.execPath, [script, '--worker', ...process.argv.slice(2)], { cwd: process.cwd(), stdio: 'inherit', timeout: 100_000 });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Difficulty evaluation stopped by ${signal} after its 100-second process limit`);
    process.exitCode = code ?? 1;
  });
}
