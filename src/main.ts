import './styles.css';
import { createGame, composeBird, findPlayableBirds, isBoardTileExposed, selectBoardTile } from './core/game';
import { createGameFromLevel } from './core/gameEngine';
import { getRegionalPuzzle, REGIONAL_PUZZLES } from './core/regionalPuzzles';
import { REGIONS, REGIONAL_SOURCES, speciesForRegion } from './core/regionalData';
import { BIRD_CATALOG } from './core/birdCatalog';
import { loadRegionalProgress, recordRegionalResult, saveRegionalProgress } from './core/regionalProgress';
import type { GameState } from './core/types';
import { renderGame } from './ui/render';
import { PlaytestStatistics } from './ui/playtestStatistics';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element.');

if (window.location.pathname.endsWith('/preview/piachan')) {
  void import('./preview/piachanPreview').then(({ mountPiachanPreview }) => mountPiachanPreview(root));
} else {
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* Optional storage. */ }
  const statistics = new PlaytestStatistics(storage);
  let progress = loadRegionalProgress(storage);
  let regionId = REGIONS.find((item) => item.id === progress.lastRegionId && item.status === 'playable')?.id ?? null;
  let mode: 'select' | 'home' | 'regional' | 'national' = regionId ? 'home' : 'select';
  let state: GameState = createGame();
  let nationalState: GameState = state;
  let stage = 1;
  let regionalObserver: ResizeObserver | null = null;
  document.addEventListener('visibilitychange', () => statistics.setVisible(!document.hidden));
  window.addEventListener('pagehide', () => statistics.interrupt());

  function nav(action: string, target: 'select' | 'home' | 'national', label: string): string {
    return `<button data-action="${action}" class="plain-link">${label}</button>`;
  }
  function bindNav(): void {
    root!.querySelectorAll<HTMLElement>('[data-action="select"]').forEach((button) => button.addEventListener('click', () => { statistics.interrupt(); mode = 'select'; render(); }));
    root!.querySelectorAll<HTMLElement>('[data-action="home"]').forEach((button) => button.addEventListener('click', () => { statistics.interrupt(); mode = 'home'; render(); }));
    root!.querySelectorAll<HTMLElement>('[data-action="legacy"]').forEach((button) => button.addEventListener('click', () => { statistics.interrupt(); state = nationalState; mode = 'national'; render(); }));
  }
  function renderSelection(): void {
    root!.innerHTML = `<main class="province-shell"><p class="eyebrow">字里有鸟 · 地域探索</p><h1>字里有鸟</h1>
      <p class="province-subtitle">从一座城市、一片山林，认识身边的鸟。</p><h2>选择你想探索的地区</h2>
      <label class="province-search-label" for="province-search">搜索地区</label><input id="province-search" type="search" placeholder="输入地区名称" autocomplete="off">
      <p id="province-note" class="province-note">${REGIONS.filter((item) => item.status === 'playable').map((item) => item.name).join('、')}已开放；其他地区的鸟种资料整理中。</p>
      <div class="province-grid">${REGIONS.map((item) => `<button data-region-id="${item.id}" data-region-name="${item.name}" class="province-card ${item.status === 'playable' ? 'available' : ''}"><strong>${item.name}</strong><small>${item.status === 'playable' ? `本游戏已收录 ${item.curatedPlayableSpeciesCount} 种 · 已发现 ${(progress.discoveredSpeciesIds[item.id] ?? []).length} 种` : '鸟种资料整理中'}</small></button>`).join('')}</div>
      ${nav('legacy', 'national', '进入全国教学与挑战')}</main>`;
    const input = root!.querySelector<HTMLInputElement>('#province-search')!;
    input.addEventListener('input', () => {
      const query = input.value.trim().toLocaleLowerCase();
      let shown = 0;
      root!.querySelectorAll<HTMLButtonElement>('[data-region-id]').forEach((button) => {
        const match = button.dataset.regionName?.toLocaleLowerCase().includes(query) || button.dataset.regionId?.toLocaleLowerCase().includes(query);
        button.hidden = !match;
        if (match) shown++;
      });
      root!.querySelector<HTMLElement>('#province-note')!.textContent = shown ? '已显示匹配地区。' : '没有找到匹配地区。';
    });
    root!.querySelectorAll<HTMLButtonElement>('[data-region-id]').forEach((button) => button.addEventListener('click', () => {
      const selected = REGIONS.find((item) => item.id === button.dataset.regionId)!;
      if (selected.status !== 'playable') { root!.querySelector<HTMLElement>('#province-note')!.textContent = `${selected.name}：鸟种资料整理中，暂未开放地区谜题。`; return; }
      regionId = selected.id;
      progress = { ...progress, lastRegionId: regionId };
      saveRegionalProgress(storage, progress);
      mode = 'home'; render();
    }));
    bindNav();
  }
  function renderHome(): void {
    const region = REGIONS.find((item) => item.id === regionId)!;
    const species = speciesForRegion(region.id);
    const discovered = new Set(progress.discoveredSpeciesIds[region.id] ?? []);
    const completed = new Set(progress.completedPuzzleIds[region.id] ?? []);
    const puzzles = REGIONAL_PUZZLES.filter((puzzle) => puzzle.regionId === region.id);
    const sourceScopes = [...new Set(species.map((item) => REGIONAL_SOURCES.find((source) => source.id === item.sourceId)?.scope).filter(Boolean))];
    root!.innerHTML = `<main class="province-shell"><p class="eyebrow">字里有鸟 · 地域探索</p><h1>${region.name}</h1>
      <p class="province-subtitle">从已核对的鸟名开始，拼字认识这片地区的鸟。</p>
      <div class="region-progress"><strong>本游戏已收录鸟种 ${species.length}</strong><span>已发现 ${species.filter((bird) => discovered.has(bird.speciesId)).length} 种 · 已完成 ${puzzles.filter((puzzle) => completed.has(puzzle.level.puzzleId!)).length} / ${puzzles.length} 关</span></div>
      <section class="region-section"><h2>地区谜题</h2><div class="region-stage-list">
      ${[1, 2].map((number) => { const puzzle = getRegionalPuzzle(region.id, number); const locked = number > 1 && !completed.has(getRegionalPuzzle(region.id, 1)?.level.puzzleId ?? '');
        return puzzle ? `<button data-stage="${number}" ${locked ? 'disabled' : ''}><strong>${number === 1 ? '初识 · 22 字' : '入门 · 33 字'}</strong><small>${completed.has(puzzle.level.puzzleId!) ? '已完成 · 可重玩' : locked ? '完成初识后开放' : '开始拼字'}</small></button>` : ''; }).join('')}</div></section>
      <section class="region-section"><h2>地区鸟种收藏</h2><p>本游戏已收录鸟种，并非完整地区鸟类名录。资料范围：${sourceScopes.join('；')}。</p><p>可拼鸟名：${species.map((item) => item.acceptedName).join('、')}</p><div class="region-collection">
      ${species.map((item) => `<article class="bird-card"><strong>${discovered.has(item.speciesId) ? item.acceptedName : '待发现'}</strong><small>${discovered.has(item.speciesId) ? item.scientificName : '拼成鸟名后解锁'}</small><a href="${item.evidenceReference}" target="_blank" rel="noopener noreferrer">地区记录来源</a></article>`).join('')}</div></section>
      <nav class="region-nav">${nav('select', 'select', '切换地区')}${nav('legacy', 'national', '全国教学与挑战')}</nav></main>`;
    root!.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => button.addEventListener('click', () => {
      stage = Number(button.dataset.stage);
      state = createGameFromLevel(getRegionalPuzzle(region.id, stage)!.level);
      mode = 'regional'; render();
    }));
    bindNav();
  }
  function renderRegional(): void {
    const puzzle = getRegionalPuzzle(regionId!, stage)!;
    const region = REGIONS.find((item) => item.id === regionId)!;
    const remaining = state.boardTiles.filter((tile) => !tile.removed).length;
    const formable = findPlayableBirds(state);
    root!.innerHTML = `<main class="province-shell regional-game" data-puzzle-id="${puzzle.level.puzzleId}"><nav class="region-nav">${nav('home', 'home', `← ${region.name}主页`)}${nav('select', 'select', '切换地区')}${nav('legacy', 'national', '全国教学与挑战')}</nav>
      <p class="eyebrow">${region.name} · 第 ${stage} 关</p><h1>${puzzle.level.label}</h1><p class="regional-meta">剩余 ${remaining} / ${state.boardTiles.length} 字 · 得分 ${state.score} · 已拼成 ${state.completedBirdCount} 只</p>
      <section class="board-panel"><div class="tile-board regional-tile-board"><div class="board-canvas" style="width:350px;height:258px">
      ${state.boardTiles.filter((tile) => !tile.removed).map((tile) => { const exposed = isBoardTileExposed(state, tile.id); return `<button class="board-tile ${exposed ? 'exposed' : 'blocked'}" data-board-tile-id="${tile.id}" style="left:${tile.x}px;top:${tile.y}px;z-index:${tile.layer}" ${exposed && state.phase === 'playing' && state.tray.some((slot) => slot === null) ? '' : 'disabled'} aria-label="${tile.character}${exposed ? '，可取' : '，被遮挡'}">${tile.character}</button>`; }).join('')}</div></div><p class="board-hint">亮起的字可以拿取；移开上层，露出下层。</p></section>
      <section class="tray-panel"><div class="section-heading"><h2>底部字槽</h2><span>${state.tray.filter(Boolean).length} / 10</span></div><div class="tray">${state.tray.map((tile) => tile ? `<span class="tray-tile">${tile.character}</span>` : '<span class="tray-slot"></span>').join('')}</div></section>
      <section class="compose-panel"><h2>可以拼成</h2><p>本关鸟名：${[...new Set(puzzle.level.wordOccurrences)].map((id) => BIRD_CATALOG.find((bird) => bird.id === id)?.name).join('、')}</p>${formable.length ? `<div class="bird-options">${formable.map((bird) => `<button class="bird-option" data-bird-id="${bird.id}"><strong>${bird.name}</strong><span>+${bird.score}</span></button>`).join('')}</div>` : '<p class="compose-empty">继续找字，拼出鸟名。</p>'}</section>
      ${state.phase !== 'playing' ? `<section class="region-result" role="status"><h2>${state.phase === 'level_complete' ? '完成地区谜题！' : '这次没能拼完'}</h2><p>${state.phase === 'level_complete' ? `得分 ${state.score} · 新发现会留在${region.name}收藏中。` : '重试会还原同一谜题。'}</p><button data-action="retry">重试本关</button>${nav('home', 'home', '返回地区主页')}${state.phase === 'level_complete' && stage === 1 ? '<button data-action="next">下一关</button>' : ''}</section>` : '<button class="plain-link" data-action="retry">重试本关</button>'}
      <p class="puzzle-identity">谜题 ${puzzle.level.puzzleId!.slice(0, 19)}… · 种子 ${puzzle.seed}</p></main>`;
    const viewport = root!.querySelector<HTMLElement>('.regional-tile-board')!;
    const canvas = viewport.querySelector<HTMLElement>('.board-canvas')!;
    const fit = () => { const scale = Math.min(1, (viewport.clientWidth || 350) / 350); canvas.style.transform = `scale(${scale})`; viewport.style.height = `${258 * scale}px`; };
    fit();
    if (typeof ResizeObserver !== 'undefined') { regionalObserver = new ResizeObserver(fit); regionalObserver.observe(viewport); }
    root!.querySelectorAll<HTMLButtonElement>('[data-board-tile-id]').forEach((button) => button.addEventListener('click', () => updateRegional(selectBoardTile(state, button.dataset.boardTileId!))));
    root!.querySelectorAll<HTMLButtonElement>('[data-bird-id]').forEach((button) => button.addEventListener('click', () => updateRegional(composeBird(state, button.dataset.birdId!))));
    root!.querySelectorAll('[data-action="retry"]').forEach((button) => button.addEventListener('click', () => { state = createGameFromLevel(puzzle.level); render(); }));
    root!.querySelector('[data-action="next"]')?.addEventListener('click', () => { stage = 2; state = createGameFromLevel(getRegionalPuzzle(regionId!, stage)!.level); render(); });
    bindNav();
  }
  function updateRegional(next: GameState): void {
    statistics.observe(state, next);
    state = next;
    progress = recordRegionalResult(progress, regionId!, state.puzzleId!, state.discoveredBirdIds, state.phase === 'level_complete');
    saveRegionalProgress(storage, progress);
    render();
  }
  function renderNational(): void {
    renderGame(root!, state, (next) => { statistics.observe(state, next); state = next; nationalState = next; renderNational(); }, statistics);
    const button = document.createElement('button');
    button.className = 'national-region-return';
    button.textContent = regionId ? '返回地区主页' : '选择地区';
    button.addEventListener('click', () => { statistics.interrupt(); mode = regionId ? 'home' : 'select'; render(); });
    root!.querySelector('.game-shell')?.prepend(button);
  }
  function render(): void {
    regionalObserver?.disconnect();
    regionalObserver = null;
    if (mode === 'select') renderSelection();
    else if (mode === 'home') renderHome();
    else if (mode === 'regional') renderRegional();
    else renderNational();
  }
  render();
}
