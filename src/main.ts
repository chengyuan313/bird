import './styles.css';
import { createGame, composeBird, findPlayableBirds, isBoardTileExposed, selectBoardTile } from './core/game';
import { createGameFromLevel } from './core/gameEngine';
import { getRegionalPuzzle, REGIONAL_PUZZLES } from './core/regionalPuzzles';
import { REGIONS, REGIONAL_SOURCES, speciesForRegion } from './core/regionalData';
import { REGIONAL_V7_TIERS, REGIONAL_V7_TILE_COUNTS, V7_DIFFICULTY_POOLS, V7_PLAYABLE_NAMES,
  V7_PROVINCIAL_MEMBERSHIPS, v7SpeciesForRegion, type RegionalTier } from './core/regionalV7Data';
import { geometryForTier } from './core/regionalV7Geometry';
import { getRegionalV7Puzzle, REGIONAL_V7_PUZZLES } from './core/regionalV7Puzzles';
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
  let mode: 'select' | 'home' | 'regional' | 'v7' | 'national' = regionId ? 'home' : 'select';
  let state: GameState = createGame();
  let nationalState: GameState = state;
  let stage = 1;
  let v7Tier: RegionalTier = 1;
  let v7Stage = 1;
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
      <div class="province-grid">${REGIONS.map((item) => { const v7 = v7SpeciesForRegion(item.id).length === 100; return `<button data-region-id="${item.id}" data-region-name="${item.name}" class="province-card ${item.status === 'playable' ? 'available' : ''}"><strong>${item.name}${v7 ? ' · V7精选100种' : ''}</strong><small>${item.status === 'playable' ? `${v7 ? '本游戏精选 100 种' : `历史预览 · 已收录 ${item.curatedPlayableSpeciesCount} 种`} · 已发现 ${(progress.discoveredSpeciesIds[item.id] ?? []).length} 种` : '鸟种资料整理中'}</small></button>`; }).join('')}</div>
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
    if (v7SpeciesForRegion(region.id).length === 100) { renderV7Home(); return; }
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
  function v7TierUnlocked(tier: RegionalTier): boolean {
    if (tier === 1) return true;
    const completed = new Set(progress.completedPuzzleIds[regionId!] ?? []);
    return REGIONAL_V7_PUZZLES.filter((item) => item.record.regionId === regionId && item.record.tier === tier - 1)
      .every((item) => completed.has(item.record.puzzleId));
  }
  function renderV7Home(): void {
    const region = REGIONS.find((item) => item.id === regionId)!;
    const memberships = v7SpeciesForRegion(region.id);
    const names = new Map(V7_PLAYABLE_NAMES.map((item) => [item.speciesId, item]));
    const discovered = new Set(progress.discoveredSpeciesIds[region.id] ?? []);
    const completed = new Set(progress.completedPuzzleIds[region.id] ?? []);
    const habitatStories = V7_PROVINCIAL_MEMBERSHIPS.filter((item) => item.regionId === region.id && item.habitat && item.habitatSourceUrl);
    root!.innerHTML = `<main class="province-shell v7-home"><p class="eyebrow">字里有鸟 · 四川探索</p><h1>${region.name} · 游戏精选100种</h1>
      <p class="province-subtitle">这100种来自有出处的四川鸟类记录，不是全省鸟类总数。分类名称仍按来源版本暂存，后续继续核对。</p>
      <div class="region-progress"><strong>已发现 ${memberships.filter((item) => discovered.has(item.speciesId)).length} / 100 种</strong><span>已完成 ${REGIONAL_V7_PUZZLES.filter((item) => completed.has(item.record.puzzleId)).length} / 25 局 · 五级词库逐步开放</span></div>
      <section class="region-section"><h2>五级探索</h2><p>每级新增20种鸟；完成本级五局后开放下一级。同级每局使用本级已开放鸟种中的一部分。</p>
      ${REGIONAL_V7_TIERS.map((tier) => { const pool = V7_DIFFICULTY_POOLS.find((item) => item.regionId === region.id && item.tier === tier)!;
        return `<div class="v7-tier"><h3>D${tier} · ${pool.speciesIds.length}种已解锁 · ${REGIONAL_V7_TILE_COUNTS[tier]}字</h3><div class="region-stage-list">
        ${REGIONAL_V7_PUZZLES.filter((item) => item.record.tier === tier).map((item) => `<button data-v7-tier="${tier}" data-v7-stage="${item.record.stageIndex}" ${v7TierUnlocked(tier) ? '' : 'disabled'}><strong>第${item.record.stageIndex}局</strong><small>${completed.has(item.record.puzzleId) ? '已完成 · 可重玩' : v7TierUnlocked(tier) ? '开始拼字' : '完成上一级五局后开放'}</small></button>`).join('')}
        </div></div>`; }).join('')}</section>
      <section class="region-section"><h2>四川地方记录</h2><p>代表物种并非都只分布在四川；以下生境资料只描述有独立出处的具体地点。</p>
      ${habitatStories.map((item) => `<article class="v7-story"><strong>${names.get(item.speciesId)?.name}</strong><span>${item.locality}：${item.habitat}</span><a href="${item.habitatSourceUrl}" target="_blank" rel="noopener noreferrer">生境资料</a></article>`).join('')}</section>
      <section class="region-section"><h2>本游戏精选鸟种</h2><p>可搜索100个入选名称；问号表示尚未在游戏中发现，名称和来源可先浏览。</p>
      <label for="v7-species-search">搜索鸟名</label><input id="v7-species-search" type="search" placeholder="输入鸟名" autocomplete="off">
      <div class="region-collection v7-collection">${memberships.map((item) => { const bird = names.get(item.speciesId)!; return `<article class="bird-card" data-v7-species="${bird.name}"><strong>${bird.name}${discovered.has(item.speciesId) ? ' · 已发现' : ' · ?'}</strong><small>D${V7_DIFFICULTY_POOLS.find((pool) => pool.newlyIntroducedSpeciesIds.includes(item.speciesId))?.tier} · ${discovered.has(item.speciesId) ? item.originalScientificName : '拼成后显示学名'}${item.regionalFeature ? ' · 四川清单重点' : ''}</small><a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">2020四川名录第${item.sourceRow}条</a></article>`; }).join('')}</div></section>
      <section class="region-section"><h2>历史预览</h2><p>保留旧版四川两关及原有完成记录，不计入V7的25局。</p><div class="region-stage-list">${[1, 2].map((number) => `<button data-v6-stage="${number}"><strong>旧版第${number}关</strong><small>历史谜题 · 可重玩</small></button>`).join('')}</div></section>
      <nav class="region-nav">${nav('select', 'select', '切换地区')}${nav('legacy', 'national', '全国教学与挑战')}</nav></main>`;
    root!.querySelector<HTMLInputElement>('#v7-species-search')!.addEventListener('input', (event) => {
      const query = (event.target as HTMLInputElement).value.trim();
      root!.querySelectorAll<HTMLElement>('[data-v7-species]').forEach((card) => { card.hidden = !card.dataset.v7Species?.includes(query); });
    });
    root!.querySelectorAll<HTMLButtonElement>('[data-v7-tier]').forEach((button) => button.addEventListener('click', () => {
      v7Tier = Number(button.dataset.v7Tier) as RegionalTier; v7Stage = Number(button.dataset.v7Stage);
      state = createGameFromLevel(getRegionalV7Puzzle(region.id, v7Tier, v7Stage)!.level); mode = 'v7'; render();
    }));
    root!.querySelectorAll<HTMLButtonElement>('[data-v6-stage]').forEach((button) => button.addEventListener('click', () => {
      stage = Number(button.dataset.v6Stage); state = createGameFromLevel(getRegionalPuzzle(region.id, stage)!.level);
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
  function renderV7Board(): void {
    const puzzle = getRegionalV7Puzzle(regionId!, v7Tier, v7Stage)!;
    const geometry = geometryForTier(v7Tier);
    const remaining = state.boardTiles.filter((tile) => !tile.removed).length;
    const formable = findPlayableBirds(state);
    const names = [...state.activeCompositions].sort((a, b) => a.name.localeCompare(b.name));
    root!.innerHTML = `<main class="province-shell regional-game v7-game" data-puzzle-id="${puzzle.record.puzzleId}">
      <nav class="region-nav">${nav('home', 'home', '← 四川主页')}${nav('select', 'select', '切换地区')}${nav('legacy', 'national', '全国教学与挑战')}</nav>
      <p class="eyebrow">四川 · D${v7Tier} · 第${v7Stage}局 / 5</p><h1>${puzzle.level.label}</h1>
      <p class="regional-meta">剩余 ${remaining} / ${state.boardTiles.length} 字 · 得分 ${state.score} · 已拼成 ${state.completedBirdCount} 只</p>
      <section class="board-panel"><div class="tile-board regional-tile-board v7-board"><div class="board-canvas" style="width:${geometry.width}px;height:${geometry.height}px">
      ${state.boardTiles.filter((tile) => !tile.removed).map((tile) => { const exposed = isBoardTileExposed(state, tile.id);
        return `<button class="board-tile ${exposed ? 'exposed' : 'blocked'}" data-board-tile-id="${tile.id}" style="left:${tile.x}px;top:${tile.y}px;z-index:${tile.layer}" ${exposed && state.phase === 'playing' && state.tray.some((slot) => slot === null) ? '' : 'disabled'} aria-label="${tile.character}${exposed ? '，可取' : '，被遮挡'}">${tile.character}</button>`; }).join('')}
      </div></div><p class="board-hint">亮起的字可以拿取；移开上层，露出下层。</p></section>
      <section class="tray-panel"><div class="section-heading"><h2>底部字槽</h2><span>${state.tray.filter(Boolean).length} / 10</span></div><div class="tray">${state.tray.map((tile) => tile ? `<span class="tray-tile">${tile.character}</span>` : '<span class="tray-slot"></span>').join('')}</div></section>
      <section class="compose-panel"><h2>可以拼成</h2><details class="v7-word-reference"><summary>本关可拼鸟名 · ${names.length}种</summary><div>${names.map((bird) => `<span>${bird.name} ×${state.remainingCompositionQuotas[bird.id] ?? 0}</span>`).join('')}</div></details>
      ${formable.length ? `<div class="bird-options">${formable.map((bird) => `<button class="bird-option" data-bird-id="${bird.id}"><strong>${bird.name}</strong><span>+${bird.score}</span></button>`).join('')}</div>` : '<p class="compose-empty">继续找字，拼出鸟名。</p>'}</section>
      ${state.phase !== 'playing' ? `<section class="region-result" role="status"><h2>${state.phase === 'level_complete' ? '完成四川谜题！' : '这次没能拼完'}</h2><p>${state.phase === 'level_complete' ? `得分 ${state.score} · 新发现已收入四川收藏。` : '重试会还原同一认证谜题。'}</p><button data-action="v7-retry">重试本局</button>${nav('home', 'home', '返回四川主页')}${state.phase === 'level_complete' && (v7Stage < 5 || v7Tier < 5) ? '<button data-action="v7-next">下一局</button>' : ''}</section>` : '<button class="plain-link" data-action="v7-retry">重试本局</button>'}
      <p class="puzzle-identity">谜题 ${puzzle.record.puzzleId.slice(0, 22)}… · 来源 <a href="https://html.rhhz.net/scdwzz/html/61796.htm" target="_blank" rel="noopener noreferrer">2020四川省鸟类名录</a></p></main>`;
    const viewport = root!.querySelector<HTMLElement>('.v7-board')!;
    const canvas = viewport.querySelector<HTMLElement>('.board-canvas')!;
    const fit = () => { const scale = Math.min(1, (viewport.clientWidth || geometry.width) / geometry.width);
      canvas.style.transform = `scale(${scale})`; viewport.style.height = `${geometry.height * scale}px`; };
    fit();
    if (typeof ResizeObserver !== 'undefined') { regionalObserver = new ResizeObserver(fit); regionalObserver.observe(viewport); }
    root!.querySelectorAll<HTMLButtonElement>('[data-board-tile-id]').forEach((button) => button.addEventListener('click', () => updateRegional(selectBoardTile(state, button.dataset.boardTileId!))));
    root!.querySelectorAll<HTMLButtonElement>('[data-bird-id]').forEach((button) => button.addEventListener('click', () => updateRegional(composeBird(state, button.dataset.birdId!))));
    root!.querySelectorAll('[data-action="v7-retry"]').forEach((button) => button.addEventListener('click', () => { state = createGameFromLevel(puzzle.level); render(); }));
    root!.querySelector('[data-action="v7-next"]')?.addEventListener('click', () => {
      if (v7Stage < 5) v7Stage++; else { v7Tier = (v7Tier + 1) as RegionalTier; v7Stage = 1; }
      state = createGameFromLevel(getRegionalV7Puzzle(regionId!, v7Tier, v7Stage)!.level); render();
    });
    bindNav();
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
    else if (mode === 'v7') renderV7Board();
    else renderNational();
  }
  render();
}
