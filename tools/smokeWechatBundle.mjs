import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../dist-wechat/game.js', import.meta.url), 'utf8');
const callbacks = {};
const storage = new Map();
const canvasContext = Object.fromEntries(['scale', 'fillRect', 'strokeRect', 'fillText', 'save', 'restore',
  'beginPath', 'rect', 'clip', 'moveTo', 'lineTo', 'arcTo', 'arc', 'closePath', 'fill', 'stroke',
  'setLineDash'].map((name) => [name, () => {}]));
canvasContext.createLinearGradient = () => ({ addColorStop() {} });
const canvas = { width: 0, height: 0, getContext: (kind) => kind === '2d' ? canvasContext : null };
const wx = {
  createCanvas: () => canvas,
  getWindowInfo: () => ({ windowWidth: 320, windowHeight: 568, pixelRatio: 2,
    safeArea: { top: 24, bottom: 544 } }),
  getSystemInfoSync: () => { throw new Error('Modern window-info API should be used'); },
  onTouchStart: (callback) => { callbacks.start = callback; },
  onTouchMove: (callback) => { callbacks.move = callback; },
  onTouchEnd: (callback) => { callbacks.end = callback; },
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
};
const sandbox = { wx, console };
try {
  runInNewContext(code, sandbox, { timeout: 5000, filename: 'wechat-game.js' });
} catch (error) {
  throw new Error(`WeChat bundle failed without browser globals: ${error.message}`);
}
if (canvas.width !== 640 || canvas.height !== 1136 || !callbacks.start || !callbacks.move || !callbacks.end) {
  throw new Error('Native WeChat canvas or touch handlers did not initialize');
}
if (typeof sandbox.document !== 'undefined' || typeof sandbox.window !== 'undefined') {
  throw new Error('Web DOM leaked into the WeChat runtime');
}
console.log('WeChat bundle smoke passed: 320×568 safe-area Canvas, 2× pixels, touch handlers, no DOM');
