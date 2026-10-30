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
  onHide: (callback) => { callbacks.hide = callback; },
  onShow: (callback) => { callbacks.show = callback; },
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
};
const sandbox = { wx, console, setTimeout: () => 0 };
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
const stage = sandbox.BirdWechat?.stage;
if (!stage || stage.snapshot().scene !== 'landing' || !callbacks.hide || !callbacks.show)
  throw new Error('WeChat home scene or lifecycle handlers did not initialize');
const click = (id) => {
  const hit = stage.snapshot().controls.find((item) => item.id === id);
  if (!hit) throw new Error(`Missing native control ${id}`);
  const touch = { clientX: hit.x + hit.width / 2, clientY: hit.y + hit.height / 2 };
  callbacks.start({ touches: [touch] }); callbacks.end({ changedTouches: [touch] });
};
click('start-game'); click('tutorial-close');
const tile = stage.snapshot().visibleTileHits[0];
const touch = { clientX: tile.x + tile.width / 2, clientY: tile.y + tile.height / 2 };
callbacks.start({ touches: [touch] }); callbacks.end({ changedTouches: [touch] });
if (stage.snapshot().overlay === 'tile-picker') {
  const pick = stage.snapshot().controls.find((item) => item.id.startsWith('pick:'));
  click(pick.id);
}
if (stage.snapshot().trayOccupancy !== 1) throw new Error('Native touch did not take a tile');
callbacks.hide(); callbacks.show();
if (!storage.get('bird.wechat.session.v1')?.actions.length || stage.snapshot().trayOccupancy !== 1)
  throw new Error('Native hide/show did not preserve the session');
click('home'); click('collection');
if (stage.snapshot().scene !== 'collection') throw new Error('Native collection could not be opened');
const restarted = { wx, console, setTimeout: () => 0 };
runInNewContext(code, restarted, { timeout: 5000, filename: 'wechat-cold-restart.js' });
if (restarted.BirdWechat?.stage.snapshot().scene !== 'landing' ||
  !restarted.BirdWechat.stage.snapshot().hasSession || restarted.BirdWechat.stage.snapshot().trayOccupancy !== 1)
  throw new Error('Native cold restart did not restore the legal saved checkpoint');
console.log('WeChat bundle smoke passed: home, tutorial, tile touch, hide/show checkpoint, collection, cold restart; 320×568, 2× pixels, no DOM');
