import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url);
if (process.argv.includes('--worker')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { experimentRegionalV7GeneratorUpgrade } = await server.ssrLoadModule('/tools/experimentRegionalV7GeneratorUpgrade.ts');
    console.log(JSON.stringify(experimentRegionalV7GeneratorUpgrade(), null, 2));
  } finally { await server.close(); }
} else {
  const child = spawn(process.execPath, [script, '--worker'], { cwd: process.cwd(), stdio: 'inherit', timeout: 90_000 });
  child.on('error', (error) => { console.error(error); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`V7 generator upgrade experiment stopped by ${signal} after 90 seconds`);
    process.exitCode = code ?? 1;
  });
}
