import './piachanPreview.css';
import {
  PIACHAN_POSITIONS,
  createPiachanPreviewState,
  isPiachanTileExposed,
  remainingPiachanTiles,
  removePiachanTile,
  type PiachanPreviewState,
} from './piachanLayout';

const PLACEHOLDER_CHARACTERS = Array.from('山水林田云月风花鸟竹禾雨石川木日星空海青');
const TILE_SIZES = [36, 44] as const;
type TileSize = typeof TILE_SIZES[number];

export function mountPiachanPreview(root: HTMLElement): void {
  document.title = 'Piachan 布局预览 · 字里有鸟';
  document.body.classList.add('piachan-preview-page');
  let state: PiachanPreviewState = createPiachanPreviewState();
  let tileSize: TileSize = new URLSearchParams(window.location.search).get('scale') === '44' ? 44 : 36;

  function render(): void {
    const boardSize = tileSize * 7;
    const tiles = PIACHAN_POSITIONS
      .map((tile, sourceIndex) => ({ tile, sourceIndex }))
      .filter(({ tile }) => !state.removedIds.has(tile.id))
      .map(({ tile, sourceIndex }) => {
        const exposed = isPiachanTileExposed(state, tile.id);
        const character = PLACEHOLDER_CHARACTERS[sourceIndex % PLACEHOLDER_CHARACTERS.length];
        return `
          <button
            class="piachan-tile ${exposed ? 'is-exposed' : 'is-blocked'}"
            type="button"
            data-tile-id="${tile.id}"
            data-layer="${tile.layer}"
            aria-label="${character}，第 ${tile.layer} 层，${exposed ? '可移除' : '被遮挡'}"
            ${exposed ? '' : 'disabled'}
            style="--tile-size:${tileSize}px;left:${tile.x * tileSize / 2}px;top:${tile.y * tileSize / 2}px;z-index:${tile.layer}"
          >
            <span>${character}</span><small>L${tile.layer}</small>
          </button>
        `;
      }).join('');

    root.innerHTML = `
      <main class="piachan-preview-shell" data-removed-count="${state.removedIds.size}" data-tile-size="${tileSize}">
        <header class="piachan-preview-header">
          <div>
            <p class="piachan-preview-eyebrow">GEOMETRY PREVIEW · PIA​CHAN LV1</p>
            <h1>四层叠牌布局</h1>
          </div>
          <div class="piachan-remaining"><strong>${remainingPiachanTiles(state)}</strong><span>剩余</span></div>
        </header>
        <div class="piachan-toolbar" aria-label="预览控制">
          <div class="piachan-scale-control" role="group" aria-label="牌面尺寸">
            ${TILE_SIZES.map((size) => `
              <button type="button" data-scale="${size}" aria-pressed="${size === tileSize}">${size} px</button>
            `).join('')}
          </div>
          <button class="piachan-reset" type="button">重置 90 块</button>
        </div>
        <section class="piachan-board-frame" aria-label="Piachan 90 块布局预览">
          <div class="piachan-board" style="width:${boardSize}px;height:${boardSize}px">
            ${tiles}
          </div>
        </section>
        <div class="piachan-legend" aria-label="状态图例">
          <span><i class="legend-exposed"></i>可移除</span>
          <span><i class="legend-blocked"></i>被上层覆盖</span>
          <span>层数 29 / 24 / 25 / 12</span>
        </div>
        <p class="piachan-preview-note">临时汉字仅用于检查层叠与点击。此页面不连接鸟名、字槽、计分或关卡玩法。</p>
      </main>
    `;

    root.querySelectorAll<HTMLButtonElement>('[data-tile-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = removePiachanTile(state, button.dataset.tileId ?? '');
        if (next === state) return;
        state = next;
        render();
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((button) => {
      button.addEventListener('click', () => {
        const requested = Number(button.dataset.scale);
        if (requested !== 36 && requested !== 44) return;
        tileSize = requested;
        render();
      });
    });
    root.querySelector<HTMLButtonElement>('.piachan-reset')?.addEventListener('click', () => {
      state = createPiachanPreviewState();
      render();
    });
  }

  render();
}
