import { V7_DIFFICULTY_POOLS, V7_PROVINCIAL_MEMBERSHIPS, V7_SPECIES_MASTER } from '../core/regionalV7Data';
import { REGIONAL_V7_PUZZLES } from '../core/regionalV7Puzzles';
import { color, font } from './ui/ui-tokens';
import { roundRectPath } from './ui/ui-draw-recipes';

export type ExplorationScene = 'game' | 'landing' | 'levels' | 'collection' | 'species' | 'settings' | 'sources';
export interface ExplorationModel {
  scene: ExplorationScene;
  width: number;
  top: number;
  bottom: number;
  completed: readonly string[];
  discovered: readonly string[];
  page: number;
  tierFilter: number;
  discoveredOnly: boolean;
  speciesId: string | null;
  resumeLabel: string | null;
  vibration: boolean;
  motion: boolean;
  status: string;
}
export interface PagePainter {
  button(id: string, label: string, x: number, y: number, w: number, h: number, enabled?: boolean): void;
  text(text: string, x: number, y: number, size?: number, ink?: string): void;
}
export function collectionSpecies(model: Pick<ExplorationModel, 'tierFilter' | 'discoveredOnly' | 'discovered'>) {
  return V7_SPECIES_MASTER.filter((bird) => (!model.discoveredOnly || model.discovered.includes(bird.id)) &&
    (!model.tierFilter || V7_DIFFICULTY_POOLS[model.tierFilter - 1].newlyIntroducedSpeciesIds.includes(bird.id)));
}
export function explorationPageSize(top: number, bottom: number, collection: boolean): number {
  return Math.max(1, Math.floor((bottom - top - (collection ? 162 : 110)) / 52));
}
/** Full-screen pages share the approved paper/wood palette and fixed safe area.
 * Pagination keeps every interactive item >=44px without a scroll surface. */
export function drawExplorationPage(ctx: CanvasRenderingContext2D, m: ExplorationModel, p: PagePainter): void {
  const x = 16, w = m.width - 32, body = m.top + 56, footer = m.bottom - 52;
  const button = (id: string, label: string, y: number, enabled = true) => p.button(id, label, x, y, w, 44, enabled);
  const titles: Record<Exclude<ExplorationScene, 'game'>, string> = {
    landing: '字里有鸟', levels: '四川 · 探索关卡', collection: '四川 · 观察手册',
    species: '鸟类记录', settings: '设置', sources: '资料与致谢',
  };
  if (m.scene === 'game') return;
  if (m.scene !== 'landing') p.button('scene-back', '‹', 12, m.top, 44, 44);
  p.text(titles[m.scene], m.scene === 'landing' ? 20 : 66, m.top + 23, 19, color.ink);
  const pagination = (page: number, total: number) => {
    p.button('page-prev', '上一页', x, footer, 78, 44, page > 0);
    p.text(`${page + 1}/${total}`, m.width / 2 - 12, footer + 22, 12, color.muted);
    p.button('page-next', '下一页', m.width - 94, footer, 78, 44, page + 1 < total);
  };
  if (m.scene === 'landing') {
    p.text('从四川，开始一次观鸟', x, body + 8, 21, color.ink);
    p.text('点字成鸟 · 收集你的观察记录', x, body + 35, 13, color.muted);
    const completed = REGIONAL_V7_PUZZLES.filter((item) => m.completed.includes(item.record.puzzleId)).length;
    p.text(`已完成 ${completed}/25 局     已观察 ${m.discovered.length}/100 种`, x, body + 61, 14, color.teal);
    button(m.resumeLabel ? 'continue-game' : 'start-game', m.resumeLabel ? `继续 · ${m.resumeLabel}` : '开始探索', body + 84);
    button('levels', '探索关卡', body + 136);
    p.button('collection', '观察手册', x, body + 188, (w - 8) / 2, 44);
    p.button('settings', '设置与玩法', x + (w + 8) / 2, body + 188, (w - 8) / 2, 44);
    if (footer - body > 414) {
      const progressY = footer - 160;
      p.text('探索足迹', x, progressY - 24, 15, color.teal);
      for (let tier = 1; tier <= 5; tier++) {
        const count = REGIONAL_V7_PUZZLES.filter((item) => item.record.tier === tier && m.completed.includes(item.record.puzzleId)).length;
        const y = progressY + (tier - 1) * 28;
        p.text(`D${tier}`, x, y, 13, color.ink2);
        roundRectPath(ctx, x + 38, y - 4, w - 88, 8, 4); ctx.fillStyle = color.tray; ctx.fill();
        if (count) {
          roundRectPath(ctx, x + 38, y - 4, (w - 88) * count / 5, 8, 4); ctx.fillStyle = color.teal; ctx.fill();
        }
        p.text(`${count}/5`, m.width - 50, y, 12, color.muted);
      }
    }
    p.text(m.status || '四川精选 100 种 · 内测版', x, m.bottom - 16, 11, m.status ? color.ochreInk : color.muted);
  } else if (m.scene === 'levels') {
    p.text('内测全部开放 · ✓ 表示已完成', x, body + 5, 12, color.muted);
    const size = explorationPageSize(m.top, m.bottom, false);
    const pages = Math.ceil(25 / size), page = Math.min(m.page, pages - 1);
    REGIONAL_V7_PUZZLES.slice(page * size, page * size + size).forEach((item, i) => {
      const done = m.completed.includes(item.record.puzzleId);
      button(`open:${item.record.tier}:${item.record.stageIndex}`,
        `${done ? '✓ ' : ''}D${item.record.tier} · 第 ${item.record.stageIndex}/5 局   ${item.level.tiles.length} 字`, body + 26 + i * 52);
    });
    pagination(page, pages);
  } else if (m.scene === 'collection') {
    const half = (w - 8) / 2;
    p.button('filter-tier', m.tierFilter ? `初见于 D${m.tierFilter} ›` : '全部级别 ›', x, body, half, 44);
    p.button('filter-discovered', m.discoveredOnly ? '只看已观察 ✓' : '全部鸟类', x + half + 8, body, half, 44);
    const birds = collectionSpecies(m), size = explorationPageSize(m.top, m.bottom, true);
    const pages = Math.max(1, Math.ceil(birds.length / size)), page = Math.min(m.page, pages - 1);
    p.text(`${birds.length} 条记录 · 名称均可查看`, x, body + 61, 12, color.muted);
    birds.slice(page * size, page * size + size).forEach((bird, i) => button(`species:${bird.id}`,
      `${m.discovered.includes(bird.id) ? '已观察 · ' : '待观察 · '}${bird.chineseName}`, body + 80 + i * 52));
    if (!birds.length) p.text('暂时没有记录，完成一局来观察新鸟。', x, body + 107, 13, color.muted);
    pagination(page, pages);
  } else if (m.scene === 'species') {
    const bird = V7_SPECIES_MASTER.find((item) => item.id === m.speciesId)!;
    const evidence = V7_PROVINCIAL_MEMBERSHIPS.find((item) => item.speciesId === bird.id)!;
    p.text(bird.chineseName, x, body + 12, 27, color.ink);
    p.text(bird.scientificName, x, body + 42, 14, color.muted);
    p.text(m.discovered.includes(bird.id) ? '已记入观察手册' : '尚未观察 · 完成含此鸟的关卡后记录', x, body + 72, 13, color.teal);
    const tier = V7_DIFFICULTY_POOLS.find((pool) => pool.newlyIntroducedSpeciesIds.includes(bird.id))!.tier;
    p.text(`初见于 D${tier} · 四川省清单收录`, x, body + 101, 13, color.ink2);
    p.text(`来源：四川省鸟类名录（2020）序号 ${evidence.sourceRow}`, x, body + 130, 12, color.muted);
    p.text('沿用来源名称，分类信息待进一步审校。', x, body + 154, 12, color.muted);
    if (footer > body + 240 && evidence.habitat) {
      p.text(evidence.locality ?? '生境记录', x, body + 188, 14, color.ink2);
      p.text(evidence.habitat, x, body + 214, 12, color.muted);
    }
    if (footer > body + 240 && m.status) p.text(m.status, x, footer - 18, 12, color.teal);
    button('copy-source', m.status || '复制清单来源链接', footer);
  } else if (m.scene === 'settings') {
    button('toggle-vibration', `触感反馈：${m.vibration ? '开' : '关'}`, body);
    button('toggle-motion', `动态效果：${m.motion ? '开' : '关'}`, body + 52);
    button('help', '怎么玩 · 三步说明', body + 104);
    button('sources', '资料与致谢', body + 156);
    p.text(m.status || '进度仅保存在本机，暂不支持云同步。', x, m.bottom - 18, 11, m.status ? color.ochreInk : color.muted);
  } else if (m.scene === 'sources') {
    p.text('四川精选 100 种', x, body + 8, 20, color.ink);
    p.text('精选数不代表四川鸟类总数。', x, body + 38, 13, color.muted);
    p.text('省级记录来源', x, body + 77, 15, color.teal);
    p.text('《四川省鸟类名录的修订与更新》', x, body + 104, 13, color.ink2);
    p.text('四川动物 · 2020；逐条记录见观察手册。', x, body + 128, 12, color.muted);
    p.text('界面素材：用户提供的设计交付包。', x, body + 162, 12, color.muted);
    p.text('本版无鸟类照片、声音或激励广告。', x, body + 186, 12, color.muted);
    button('copy-source', m.status || '复制清单来源链接', footer);
  }
  // Small notebook edge keeps the pages visually related to the game board.
  ctx.save(); ctx.strokeStyle = color.pageEdge; ctx.lineWidth = 1;
  roundRectPath(ctx, 4, m.top - 2, m.width - 8, m.bottom - m.top, 16); ctx.stroke(); ctx.restore();
  ctx.font = `14px ${font.sans}`;
}
