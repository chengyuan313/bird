import { BIRD_CATALOG } from '../core/birdCatalog';
import {
  clearSelection,
  chooseOfferCharacter,
  composeSelectedBird,
  findFormableBirds,
  getSelectedBird,
  getSelectedCharacters,
  isRackFull,
  restartGame,
  toggleRackTile,
} from '../core/game';
import type { GameState } from '../core/types';

type StateUpdater = (nextState: GameState) => void;

function birdColor(key: string): string {
  const hash = Array.from(key).reduce((total, character) => total + character.charCodeAt(0), 0);
  return `hsl(${hash % 360} 42% 66%)`;
}
export function renderGame(root: HTMLElement, state: GameState, update: StateUpdater): void {
  const selectedBird = getSelectedBird(state);
  const selectedCharacters = getSelectedCharacters(state);
  const rackFull = isRackFull(state.rack);
  const formableBirds = rackFull ? findFormableBirds(state.rack) : [];
  const completedBird = state.lastCompletedBird
    ? BIRD_CATALOG.find((bird) => bird.id === state.lastCompletedBird?.birdId)
    : undefined;

  root.innerHTML = `
    <section class="game-shell" aria-label="字里有鸟游戏">
      <header class="topbar">
        <div>
          <p class="eyebrow">字里有鸟</p>
          <h1>选一个字，拼出鸟名。</h1>
        </div>
        <div class="score" aria-label="当前得分"><span>得分</span><strong>${state.score}</strong></div>
      </header>

      ${completedBird ? `
        <section class="bird-reveal" style="--bird-color: ${birdColor(completedBird.presentationKey)}" aria-live="polite">
          <span class="bird-mark" aria-hidden="true">●</span>
          <div><strong>${completedBird.name}</strong><small>+${state.lastCompletedBird?.score}${state.lastCompletedBird?.isNew ? ' · NEW BIRD' : ''}</small></div>
        </section>` : ''}

      <section class="panel rack-panel">
        <div class="section-heading"><h2>字架</h2><span>${state.rack.filter(Boolean).length} / 10</span></div>
        <div class="rack" role="group" aria-label="字架">
          ${state.rack.map((tile, index) => tile
            ? `<button class="rack-tile ${state.selectedRackTileIds.includes(tile.id) ? 'selected' : ''}" data-tile-id="${tile.id}" aria-pressed="${state.selectedRackTileIds.includes(tile.id)}">${tile.character}</button>`
            : `<span class="rack-slot" aria-label="空位 ${index + 1}"></span>`).join('')}
        </div>
        ${rackFull && formableBirds.length > 0 ? '<p class="notice">字架满了。先拼成一只鸟，腾出空位吧。</p>' : ''}
      </section>

      <section class="panel compose-panel">
        <div class="section-heading"><h2>拼鸟</h2><button class="text-button" data-action="clear" ${selectedCharacters.length === 0 ? 'disabled' : ''}>清空</button></div>
        <div class="composition" aria-label="当前组合">
          ${selectedCharacters.length > 0
            ? selectedCharacters.map((character) => `<span>${character}</span>`).join('<b>+</b>')
            : '<em>按顺序点选字架里的字</em>'}
        </div>
        <button class="compose-button" data-action="compose" ${selectedBird ? '' : 'disabled'}>拼成鸟</button>
      </section>

      <section class="offer-section">
        <div class="section-heading"><h2>选一个字</h2><span>其余会消失</span></div>
        <div class="offer">
          ${state.currentOffer.map((character) => `<button data-offer-character="${character}" ${rackFull || state.phase === 'game_over' ? 'disabled' : ''}>${character}</button>`).join('')}
        </div>
      </section>

      <section class="discoveries">
        <div class="section-heading"><h2>本局发现</h2><span>${state.discoveredBirdIds.length} 种</span></div>
        <div class="discovery-list">
          ${state.discoveredBirdIds.length === 0
            ? '<p>还没有鸟，试试两个字的名字。</p>'
            : state.discoveredBirdIds.map((id) => {
                const bird = BIRD_CATALOG.find((candidate) => candidate.id === id);
                return bird ? `<span style="--bird-color: ${birdColor(bird.presentationKey)}">${bird.name}</span>` : '';
              }).join('')}
        </div>
      </section>

      ${state.phase === 'game_over' ? `
        <div class="game-over" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
          <div>
            <p class="eyebrow">字架已满</p>
            <h2 id="game-over-title">无鸟可拼</h2>
            <p>本局得分 ${state.score}，发现 ${state.discoveredBirdIds.length} 种鸟。</p>
            <button data-action="restart">再来一局</button>
          </div>
        </div>` : ''}
    </section>`;

  root.querySelectorAll<HTMLElement>('[data-offer-character]').forEach((button) => {
    button.addEventListener('click', () => {
      update(chooseOfferCharacter(state, button.dataset.offerCharacter ?? ''));
    });
  });
  root.querySelectorAll<HTMLElement>('[data-tile-id]').forEach((button) => {
    button.addEventListener('click', () => update(toggleRackTile(state, button.dataset.tileId ?? '')));
  });
  root.querySelector<HTMLElement>('[data-action="clear"]')?.addEventListener('click', () => update(clearSelection(state)));
  root.querySelector<HTMLElement>('[data-action="compose"]')?.addEventListener('click', () => update(composeSelectedBird(state)));
  root.querySelector<HTMLElement>('[data-action="restart"]')?.addEventListener('click', () => update(restartGame(state)));
}
