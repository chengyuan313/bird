import './wechatPreview.css';
import { WechatBirdStage, type WechatViewport } from '../wechat/stage';

type Device = { width: number; height: number; safeTop: number; safeBottom: number };
const DEVICES: Record<string, Device> = {
  compact: { width: 320, height: 568, safeTop: 44, safeBottom: 534 },
  regular: { width: 390, height: 844, safeTop: 47, safeBottom: 810 },
};

export function previewScale(availableWidth: number, availableHeight: number, device: Device): number {
  return Math.max(0.1, Math.min(1,
    (availableWidth - 12) / device.width,
    (availableHeight - 12) / device.height));
}

export function mountWechatPreview(root: HTMLElement): void {
  document.documentElement.classList.add('wechat-preview-page');
  document.body.classList.add('wechat-preview-page');
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
  let device = DEVICES.compact;
  const viewport = (): WechatViewport => ({ width: device.width, height: device.height,
    safeTop: device.safeTop, safeBottom: device.safeBottom });
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
  const stage = new WechatBirdStage(context, viewport(), storage);
  function fit(): void {
    const scale = previewScale(center.clientWidth, center.clientHeight, device);
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
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    stage.touchStart(...point(event));
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons || event.pointerType === 'touch') stage.touchMove(...point(event));
  });
  canvas.addEventListener('pointerup', (event) => { event.preventDefault(); stage.touchEnd(...point(event)); });
  canvas.addEventListener('pointercancel', (event) => {
    const [x, y] = point(event); stage.touchMove(x + 8, y); stage.touchEnd(x + 8, y);
  });
  window.addEventListener('resize', fit);
  // The fixed scene itself has no page scrolling; only the board viewport pans.
  shell.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
  fit();
}
