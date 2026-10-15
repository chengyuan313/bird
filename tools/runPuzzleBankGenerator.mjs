import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
if (process.argv.includes('--worker')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { generatePuzzleBank } = await server.ssrLoadModule('/tools/generatePuzzleBank.ts');
    generatePuzzleBank();
  } finally {
    await server.close();
  }
} else {
  const child = spawn(process.execPath, [script, '--worker'], { cwd: process.cwd(), stdio: 'inherit', timeout: 100_000 });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Puzzle-bank generation stopped by ${signal} after its 100-second process limit`);
    process.exitCode = code ?? 1;
  });
}
