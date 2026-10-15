/// <reference types="vite/client" />
import './wechatPreview.css';
import { WechatBirdStage, type WechatViewport } from '../wechat/stage';
import type { RegionalTier } from '../core/regionalV7Data';

const iconPaths = import.meta.glob('../wechat/assets/png/ic_*@2x.png',
  { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

type Device = { width: number; height: number; safeTop: number; safeBottom: number };
const DEVICES: Record<string, Device> = {
  compact: { width: 320, height: 568, safeTop: 20, safeBottom: 568 },
  regular: { width: 390, height: 844, safeTop: 47, safeBottom: 810 },
};

export function previewScale(availableWidth: number, availableHeight: number, device: Device): number {
  return Math.max(0.1, Math.min(1,
    (availableWidth - 12) / device.width,
    (availableHeight - 12) / device.height));
}

export function mountWechatPreview(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const capture = params.get('capture') === '1';
  document.documentElement.classList.add('wechat-preview-page');
  document.body.classList.add('wechat-preview-page');
  if (capture) root.classList.add('wechat-preview-capture');
  root.innerHTML = `<main class="wechat-preview-shell">
    <header class="wechat-preview-toolbar">
      <div><strong>字里有鸟 · 微信小游戏界面模拟</strong><span>与微信 Canvas 版共用游戏舞台；此页不是微信真机验收</span></div>
      <div class="wechat-preview-actions">
        <button type="button" data-device="compact" aria-pressed="true">320 × 568</button>
        <button type="button" data-device="regular" aria-pressed="false">390 × 844</button>
        <a href="#">返回网页版</a>
      </div>
    </header>
    <div class="wechat-preview-center"><div class="wechat-preview-frame"><canvas aria-label="字里有鸟固定屏游戏舞台"></canvas></div></div>
  </main>`;
  const shell = root.querySelector<HTMLElement>('.wechat-preview-shell')!;
  root.querySelector<HTMLAnchorElement>('.wechat-preview-actions a')!.href =
    window.location.pathname.replace(/\/preview\/wechat\/?$/, '/');
  const center = root.querySelector<HTMLElement>('.wechat-preview-center')!;
  const frame = root.querySelector<HTMLElement>('.wechat-preview-frame')!;
  const canvas = frame.querySelector('canvas')!;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for the WeChat interface preview');
  let device = params.get('device') === 'regular' ? DEVICES.regular : DEVICES.compact;
  root.querySelectorAll<HTMLButtonElement>('[data-device]').forEach((button) =>
    button.setAttribute('aria-pressed', String(DEVICES[button.dataset.device!] === device)));
  const viewport = (): WechatViewport => ({ width: device.width, height: device.height,
    safeTop: device.safeTop, safeBottom: device.safeBottom,
    menuButton: { top: device.safeTop + 4, left: device.width - 94, height: 32 } });
  const storage = { get(key: string): unknown {
    try { return JSON.parse(window.localStorage.getItem(key) ?? 'null'); } catch { return undefined; }
  }, set(key: string, value: unknown): void {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Preview remains playable without persistence. */ }
  } };
  const pixelRatio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  function sizeCanvas(): void {
    canvas.width = Math.round(device.width * pixelRatio);
    canvas.height = Math.round(device.height * pixelRatio);
    canvas.style.width = `${device.width}px`;
    canvas.style.height = `${device.height}px`;
    context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
  sizeCanvas();
  const stage = new WechatBirdStage(context, viewport(), storage,
    { createImage: () => new window.Image(),
      pathFor: (key) => iconPaths[`../wechat/assets/png/ic_${key}@2x.png`] },
    { vibrate: () => {}, requestFrame: (callback) => { window.requestAnimationFrame(callback); } });
  const previewTier = Number(params.get('tier'));
  const previewStage = Number(params.get('stage'));
  if (Number.isInteger(previewTier) && previewTier >= 1 && previewTier <= 5 &&
    Number.isInteger(previewStage) && previewStage >= 1 && previewStage <= 5)
    stage.openPuzzle(previewTier as RegionalTier, previewStage);
  function fit(): void {
    const scale = capture
      ? Math.min(1, center.clientWidth / device.width, center.clientHeight / device.height)
      : previewScale(center.clientWidth, center.clientHeight, device);
    frame.style.width = `${device.width * scale}px`;
    frame.style.height = `${device.height * scale}px`;
    canvas.style.transform = `scale(${scale})`;
  }
  root.querySelectorAll<HTMLButtonElement>('[data-device]').forEach((button) => button.addEventListener('click', () => {
    device = DEVICES[button.dataset.device!] ?? DEVICES.compact;
    root.querySelectorAll<HTMLButtonElement>('[data-device]').forEach((item) =>
      item.setAttribute('aria-pressed', String(item === button)));
    sizeCanvas(); stage.resize(viewport()); fit();
  }));
  const point = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * device.width / rect.width,
      (event.clientY - rect.top) * device.height / rect.height];
  };
  const activePointers = new Set<number>();
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { stage.touchCancel(); return; }
    stage.touchStart(...point(event));
  });
  canvas.addEventListener('pointermove', (event) => {
    if (activePointers.size === 1 && (event.buttons || event.pointerType === 'touch')) stage.touchMove(...point(event));
  });
  canvas.addEventListener('pointerup', (event) => {
    event.preventDefault(); activePointers.delete(event.pointerId);
    if (activePointers.size === 0) stage.touchEnd(...point(event));
  });
  canvas.addEventListener('pointercancel', (event) => {
    activePointers.delete(event.pointerId); stage.touchCancel();
  });
  window.addEventListener('resize', fit);
  // The fixed scene itself has no page scrolling; only the board viewport pans.
  shell.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  fit();
}
