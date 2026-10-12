import './styles.css';
import { createGame } from './core/game';
import type { GameState } from './core/types';
import { renderGame } from './ui/render';
import { PlaytestStatistics } from './ui/playtestStatistics';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element.');

if (window.location.pathname.endsWith('/preview/piachan')) {
  void import('./preview/piachanPreview').then(({ mountPiachanPreview }) => {
    mountPiachanPreview(root);
  });
} else {
  let state: GameState = createGame();
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* Local storage is optional. */ }
  const statistics = new PlaytestStatistics(storage);
  document.addEventListener('visibilitychange', () => statistics.setVisible(!document.hidden));
  window.addEventListener('pagehide', () => statistics.interrupt());

  function update(nextState: GameState): void {
    statistics.observe(state, nextState);
    state = nextState;
    renderGame(root!, state, update, statistics);
  }

  renderGame(root, state, update, statistics);
}
