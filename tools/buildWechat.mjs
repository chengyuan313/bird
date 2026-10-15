import { build } from 'vite';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outdir = join(process.cwd(), 'dist-wechat');
await mkdir(outdir, { recursive: true });
await build({ configFile: false, publicDir: false, logLevel: 'warn',
  build: { outDir: outdir, emptyOutDir: true, minify: 'esbuild', target: 'es2022',
    lib: { entry: 'src/wechat/game.ts', name: 'BirdWechat', formats: ['iife'], fileName: () => 'game.js' },
    rollupOptions: { output: { banner: `if(typeof performance==='undefined'){globalThis.performance={now:()=>Date.now()}};if(typeof TextEncoder==='undefined'){globalThis.TextEncoder=class{encode(input){let bytes=[];for(const char of input){let c=char.codePointAt(0);if(c<128)bytes.push(c);else if(c<2048)bytes.push(192|(c>>6),128|(c&63));else if(c<65536)bytes.push(224|(c>>12),128|((c>>6)&63),128|(c&63));else bytes.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));}return new Uint8Array(bytes)}}}` } } } });
await writeFile(join(outdir, 'game.json'), JSON.stringify({ deviceOrientation: 'portrait' }, null, 2) + '\n', 'utf8');
await cp(join(process.cwd(), 'src/wechat/assets/png'), join(outdir, 'assets/png'), { recursive: true });
console.log(`Built native WeChat Mini Game at ${outdir}`);
