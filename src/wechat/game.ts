import { WechatBirdStage, type WechatViewport, type WechatStore } from './stage';

interface WxTouch { clientX: number; clientY: number }
interface WxTouchEvent { touches?: WxTouch[]; changedTouches?: WxTouch[] }
interface WxWindowInfo {
  windowWidth: number;
  windowHeight: number;
  pixelRatio?: number;
  safeArea?: { top: number; bottom: number };
}
interface WxCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasRenderingContext2D | null;
  requestAnimationFrame?(callback: () => void): number;
}
interface WxGameApi {
  createCanvas(): WxCanvas;
  createImage?(): HTMLImageElement;
  vibrateShort?(options: { type: 'light' | 'medium' | 'heavy' }): void;
  getWindowInfo?(): WxWindowInfo;
  getSystemInfoSync(): WxWindowInfo;
  getMenuButtonBoundingClientRect?(): { top: number; left: number; height: number };
  onTouchStart(callback: (event: WxTouchEvent) => void): void;
  onTouchMove(callback: (event: WxTouchEvent) => void): void;
  onTouchEnd(callback: (event: WxTouchEvent) => void): void;
  onTouchCancel?(callback: (event: WxTouchEvent) => void): void;
  onWindowResize?(callback: () => void): void;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
}

declare const wx: WxGameApi;

function windowInfo(): WxWindowInfo {
  const modern = wx.getWindowInfo?.();
  if (modern?.safeArea) return modern;
  const system = wx.getSystemInfoSync();
  return modern ? { ...system, ...modern, safeArea: modern.safeArea ?? system.safeArea } : system;
}
function logicalViewport(info: WxWindowInfo): WechatViewport {
  return { width: info.windowWidth, height: info.windowHeight,
    safeTop: info.safeArea?.top ?? 0,
    safeBottom: info.safeArea?.bottom ?? info.windowHeight,
    menuButton: wx.getMenuButtonBoundingClientRect?.() };
}

// The first wx.createCanvas() is the visible game canvas. No DOM/WXML page,
// browser storage, remote scripts, or AppID are required by this entry point.
const canvas = wx.createCanvas();
const context = canvas.getContext('2d');
if (!context) throw new Error('WeChat Canvas 2D is unavailable');
const info = windowInfo();
const pixelRatio = Math.max(1, info.pixelRatio ?? 1);
canvas.width = Math.round(info.windowWidth * pixelRatio);
canvas.height = Math.round(info.windowHeight * pixelRatio);
context.scale(pixelRatio, pixelRatio);
const store: WechatStore = { get: (key) => wx.getStorageSync(key), set: (key, value) => wx.setStorageSync(key, value) };
const stage = new WechatBirdStage(context, logicalViewport(info), store,
  wx.createImage ? { createImage: () => wx.createImage!(), pathFor: (key) => `assets/png/ic_${key}@2x.png` } : undefined,
  { vibrate: (type) => wx.vibrateShort?.({ type }),
    requestFrame: (callback) => {
      if (canvas.requestAnimationFrame) canvas.requestAnimationFrame(callback);
      else setTimeout(callback, 16);
    } });
const firstTouch = (event: WxTouchEvent): WxTouch | undefined => event.changedTouches?.[0] ?? event.touches?.[0];
wx.onTouchStart((event) => {
  if ((event.touches?.length ?? 0) > 1) { stage.touchCancel(); return; }
  const touch = firstTouch(event); if (touch) stage.touchStart(touch.clientX, touch.clientY);
});
wx.onTouchMove((event) => {
  if ((event.touches?.length ?? 0) > 1) { stage.touchCancel(); return; }
  const touch = firstTouch(event); if (touch) stage.touchMove(touch.clientX, touch.clientY);
});
wx.onTouchEnd((event) => { const touch = firstTouch(event); if (touch) stage.touchEnd(touch.clientX, touch.clientY); });
wx.onTouchCancel?.(() => stage.touchCancel());
wx.onWindowResize?.(() => {
  const next = windowInfo();
  const ratio = Math.max(1, next.pixelRatio ?? 1);
  canvas.width = Math.round(next.windowWidth * ratio);
  canvas.height = Math.round(next.windowHeight * ratio);
  context.scale(ratio, ratio);
  stage.resize(logicalViewport(next));
});

export { stage };
