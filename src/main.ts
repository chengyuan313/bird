import './styles.css';
import { createGame } from './core/game';
import type { GameState } from './core/types';
import { renderGame } from './ui/render';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app root element.');

let state: GameState = createGame();

function update(nextState: GameState): void {
  state = nextState;
  renderGame(root!, state, update);
}

renderGame(root, state, update);
