import {
  advanceLevel,
  composeBird,
  findFormableBirds,
  isBoardTileExposed,
  isTrayFull,
  restartLevel,
  selectBoardTile,
  switchLevel3Board,
} from '../core/game';
import { AUTHORED_LEVELS, getLevel } from '../core/levels';
import type { BoardTile, GameState } from '../core/types';

type StateUpdater = (nextState: GameState) => void;

function birdColor(key: string): string {
  const hash = Array.from(key).reduce((total, character) => total + character.charCodeAt(0), 0);
  return `hsl(${hash % 360} 42% 66%)`;
}

export function getBoardTilePresentation(
  tile: BoardTile,
  exposed: boolean,
): { text: string; ariaLabel: string } {
  const hidden = tile.region === 'blind' && !exposed;
  return hidden
    ? { text: '？', ariaLabel: '隐藏字，被遮挡' }
    : {
        text: tile.character,
        ariaLabel: `${tile.character}${exposed ? '，可取' : '，被遮挡'}`,
      };
}

export function renderGame(root: HTMLElement, state: GameState, update: StateUpdater): void {
  const referenceWasOpen = root.querySelector<HTMLDetailsElement>('.bird-reference')?.open ?? false;
  const previousLevel = root.querySelector<HTMLElement>('.game-shell')?.dataset.levelId;
  const level = getLevel(state.levelId, state.levelSeed);
  const trayFull = isTrayFull(state.tray);
  const formableBirds = findFormableBirds(state.tray, state.activeCatalog);
  const remaining = state.boardTiles.filter((tile) => !tile.removed).length;
  const boardEmpty = remaining === 0;
  const completedBird = state.lastCompletedBird
    ? state.activeCatalog.find((bird) => bird.id === state.lastCompletedBird?.birdId)
    : undefined;

  root.innerHTML = `
    <section class="game-shell" data-level-id="${state.levelId}" aria-label="字里有鸟游戏">
      <header class="topbar">
        <div><p class="eyebrow">字里有鸟</p><h1>拨开字层，拼出鸟名。</h1></div>
        <div class="score"><span>${level.label} · 得分</span><strong>${state.score}</strong></div>
      </header>

      <nav class="level-tabs" aria-label="选择关卡">
        ${AUTHORED_LEVELS.map((candidate) => `<button data-level-id="${candidate.id}" class="${candidate.id === state.levelId ? 'active' : ''}">${candidate.label.replace('第', '').replace('关', '')}</button>`).join('')}
      </nav>

      ${completedBird ? `<section class="bird-reveal" style="--bird-color: ${birdColor(completedBird.assetKey)}" aria-live="polite"><span class="bird-mark">●</span><div><strong>${completedBird.name}</strong><small>+${state.lastCompletedBird?.score}${state.lastCompletedBird?.isNew ? ' · NEW BIRD' : ''}</small></div></section>` : ''}

      <section class="board-panel">
        <div class="section-heading"><h2>字层</h2><div class="board-meta"><span>剩余 ${remaining} / ${state.boardTiles.length}</span>${state.levelId === 'level-3' ? '<button class="new-board-compact" data-action="restart">重试本局</button><button class="new-board-compact" data-action="new-board">换一局</button>' : ''}</div></div>
        <div class="tile-board ${state.levelId === 'level-3' ? 'piachan-game-board' : ''}" aria-label="叠字棋盘">
          ${state.boardTiles.filter((tile) => !tile.removed).map((tile) => {
            const exposed = isBoardTileExposed(state, tile.id);
            const region = tile.region ?? 'main';
            const presentation = getBoardTilePresentation(tile, exposed);
            const hidden = region === 'blind' && !exposed;
            const tileSize = state.levelId === 'level-3' ? 44 : 61;
            const x = state.levelId === 'level-3' ? tile.x * tileSize / 2 : tile.x;
            const y = state.levelId === 'level-3' ? tile.y * tileSize / 2 : tile.y;
            return `<button class="board-tile region-${region} ${hidden ? 'hidden-character' : ''} ${exposed ? 'exposed' : 'blocked'}" style="left:${x}px;top:${y}px;z-index:${tile.layer}" data-board-tile-id="${tile.id}" ${exposed && !trayFull && state.phase === 'playing' ? '' : 'disabled'} aria-label="${presentation.ariaLabel}">${presentation.text}</button>`;
          }).join('')}
        </div>
        ${boardEmpty && state.phase === 'playing'
          ? '<p class="cleanup-notice">棋盘已清空，拼完字槽里的鸟。</p>'
          : '<p class="board-hint">亮起的字可以拿取；移开上层，露出下层。</p>'}
      </section>

      <section class="tray-panel">
        <div class="section-heading"><h2>底部字槽</h2><span>${state.tray.filter(Boolean).length} / 10</span></div>
        <div class="tray" role="group" aria-label="底部字槽">
          ${state.tray.map((tile, index) => tile
            ? `<span class="tray-tile">${tile.character}</span>`
            : `<span class="tray-slot" aria-label="空位 ${index + 1}"></span>`).join('')}
        </div>
        ${trayFull && formableBirds.length > 0 ? '<p class="notice">字槽满了。先拼成一只鸟，腾出空位吧。</p>' : ''}
      </section>

      <section class="compose-panel">
        <div class="section-heading"><h2>可以拼成</h2></div>
        ${formableBirds.length > 0
          ? `<div class="bird-options">${formableBirds.map((bird) => `<button class="bird-option" data-bird-id="${bird.id}"><strong>${bird.name}</strong><span>+${bird.score}</span></button>`).join('')}</div>`
          : '<p class="compose-empty">继续找字，拼出鸟名。</p>'}
      </section>

      ${state.levelId === 'level-3' ? `<details class="bird-reference" ${referenceWasOpen && previousLevel === state.levelId ? 'open' : ''}>
        <summary>本关鸟名 <span>${state.activeCatalog.length} 种</span></summary>
        <p>这些鸟名都可能由本关字块拼成。</p>
        <ul>${[...state.activeCatalog].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')).map((bird) => `<li class="${state.discoveredBirdIds.includes(bird.id) ? 'completed' : ''}">${bird.name}${state.discoveredBirdIds.includes(bird.id) ? '<small>已拼成</small>' : ''}</li>`).join('')}</ul>
      </details>` : ''}

      ${state.phase === 'game_over' ? `<div class="result-surface" role="dialog" aria-modal="true"><div><p class="eyebrow">${boardEmpty ? '棋盘已清空' : '字槽已满'}</p><h2>无鸟可拼</h2><p>${boardEmpty ? '字槽里的剩余字无法组成鸟名。' : '这次被字层困住了。换一种拿字顺序再试试。'}</p>${state.levelId === 'level-3' ? '<div class="result-actions"><button data-action="restart">重试本局</button><button class="secondary" data-action="new-board">换一局</button></div>' : '<button data-action="restart">重试本关</button>'}</div></div>` : ''}
      ${state.phase === 'level_complete' ? `<div class="result-surface" role="dialog" aria-modal="true"><div><p class="eyebrow">LEVEL COMPLETE</p><h2>${level.label}完成</h2><p>得分 ${state.score} · 拼成 ${state.completedBirdCount} 只鸟</p>${state.levelId === 'level-3' ? '<div class="result-actions"><button data-action="new-board">换一局</button><button class="secondary" data-action="restart">重试本局</button></div>' : '<div class="result-actions"><button data-action="next-level">下一关</button><button class="secondary" data-action="restart">重新挑战</button></div>'}</div></div>` : ''}
    </section>`;

  root.querySelectorAll<HTMLElement>('[data-board-tile-id]').forEach((button) => {
    button.addEventListener('click', () => update(selectBoardTile(state, button.dataset.boardTileId ?? '')));
  });
  root.querySelectorAll<HTMLElement>('[data-bird-id]').forEach((button) => {
    button.addEventListener('click', () => update(composeBird(state, button.dataset.birdId ?? '')));
  });
  root.querySelectorAll<HTMLButtonElement>('.level-tabs button[data-level-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const levelId = button.dataset.levelId ?? state.levelId;
      update(levelId === state.levelId ? state : restartLevel({ ...state, levelId }));
    });
  });
  root.querySelectorAll<HTMLElement>('[data-action="restart"]').forEach((button) => {
    button.addEventListener('click', () => update(restartLevel(state)));
  });
  root.querySelectorAll<HTMLElement>('[data-action="new-board"]').forEach((button) => {
    button.addEventListener('click', () => update(switchLevel3Board(state)));
  });
  root.querySelectorAll<HTMLElement>('[data-action="next-level"]').forEach((button) => {
    button.addEventListener('click', () => update(advanceLevel(state)));
  });
}
