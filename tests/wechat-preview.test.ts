import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { mountWechatPreview, previewScale } from '../src/preview/wechatPreview';

describe('browser shell for the native WeChat stage', () => {
  it('fits both logical phone sizes inside the available fixed viewport', () => {
    for (const device of [{ width: 320, height: 568, safeTop: 44, safeBottom: 534 },
      { width: 390, height: 844, safeTop: 47, safeBottom: 810 }]) {
      const scale = previewScale(360, 600, device);
      expect(device.width * scale).toBeLessThanOrEqual(360);
      expect(device.height * scale).toBeLessThanOrEqual(600);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });
  it('mounts one fixed Canvas and switches logical device sizes without a web-game page', () => {
    const dom = new JSDOM('<main id="app"></main>', { url: 'https://example.test/bird/?preview=wechat' });
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
    const context = { setTransform() {}, fillRect() {}, strokeRect() {}, save() {}, restore() {},
      beginPath() {}, rect() {}, clip() {}, fillText() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {},
      closePath() {}, fill() {}, stroke() {}, setLineDash() {},
      createLinearGradient: () => ({ addColorStop() {} }) } as unknown as CanvasRenderingContext2D;
    const originalGetContext = dom.window.HTMLCanvasElement.prototype.getContext;
    dom.window.HTMLCanvasElement.prototype.getContext = (() => context) as unknown as typeof originalGetContext;
    try {
      const root = dom.window.document.querySelector<HTMLElement>('#app')!;
      mountWechatPreview(root);
      const canvas = root.querySelector('canvas')!;
      expect(canvas.width).toBeGreaterThanOrEqual(320);
      expect(canvas.height).toBeGreaterThanOrEqual(568);
      expect(dom.window.document.documentElement.classList.contains('wechat-preview-page')).toBe(true);
      expect(root.querySelectorAll('canvas')).toHaveLength(1);
      root.querySelector<HTMLButtonElement>('[data-device="regular"]')!.click();
      expect(canvas.width).toBeGreaterThanOrEqual(390);
      expect(canvas.height).toBeGreaterThanOrEqual(844);
      expect(root.querySelector('[data-device="regular"]')!.getAttribute('aria-pressed')).toBe('true');
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
      dom.window.close();
    }
  });
});
