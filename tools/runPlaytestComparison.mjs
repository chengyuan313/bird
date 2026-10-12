import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
if (process.argv.includes('--worker')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { runPlaytestComparison, comparisonWithoutTimings } = await server.ssrLoadModule('/tools/playtestComparison.ts');
    const report = runPlaytestComparison();
    const destination = fileURLToPath(new URL('./playtest-comparison.json', import.meta.url));
    if (process.argv.includes('--check')) {
      const committed = JSON.parse(readFileSync(destination, 'utf8'));
      if (JSON.stringify(comparisonWithoutTimings(committed)) !== JSON.stringify(comparisonWithoutTimings(report))) {
        throw new Error('Playtest comparison is not reproducible');
      }
    } else writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ groups: report.groups, rows: report.rows.length }));
  } finally { await server.close(); }
} else {
  const child = spawn(process.execPath, [script, '--worker', ...process.argv.slice(2)], { cwd: process.cwd(), stdio: 'inherit', timeout: 90_000 });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Playtest comparison stopped by ${signal}`);
    process.exitCode = code ?? 1;
  });
}
