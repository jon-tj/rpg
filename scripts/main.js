import { Renderer } from './renderer.js';
import { Player } from './entities/Player.js';
import { Store } from './data/Store.js';
import { Random } from './Random.js';

console.log(
    '\n ------------------------',
    '\n Welcome to the RPG game!',
    '\n Enjoy your adventure!',
    '\n ------------------------',
);

const canvases = document.querySelectorAll('canvas.layer');
const renderer = new Renderer(canvases, document.getElementById('game-container'));

const store = new Store();
const gameState = store.loadGameState();
const random = new Random(gameState.world.seed);
console.log('Random seed:', random.detUniform(0, 100));

const player = new Player();