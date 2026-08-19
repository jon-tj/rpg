import { Renderer } from './renderer.js';
import { Player } from './entities/Player.js';
import { Store } from './data/Store.js';
import { Random } from './Random.js';
import { Spritesheet } from './animation/Spritesheet.js';
import { KeyboardInputDevice } from './input/KeyboardInputDevice.js';
import { rasterize } from './world/Patches.js';

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

// World/floor on layer 0, entities on layer 1.
const worldCanvas = document.querySelector('canvas.layer[data-layer-id="0"]');
const worldCtx = worldCanvas.getContext('2d');
worldCtx.imageSmoothingEnabled = false;

const entityCanvas = document.querySelector('canvas.layer[data-layer-id="1"]');
const entityCtx = entityCanvas.getContext('2d');
entityCtx.imageSmoothingEnabled = false;

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function loadJSON(src) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to load ${src}: ${res.status}`);
    return res.json();
}

const input = new KeyboardInputDevice();
input.connect();

const [playerImage, overworldImage, tileDefs, worldMap] = await Promise.all([
    loadImage('assets/sprites/entities/player-4x2.png'),
    loadImage('assets/sprites/environment/overworld-4x4.png'),
    loadJSON('assets/tiles.json'),
    loadJSON('assets/maps/overworld.json'),
]);

const TILE_SIZE = 16;
const WORLD_SCALE = 4;
const TILE_SCREEN = TILE_SIZE * WORLD_SCALE;

const playerSheet = new Spritesheet(playerImage, 4, TILE_SIZE, TILE_SIZE);
const overworldSheet = new Spritesheet(overworldImage, 4, TILE_SIZE, TILE_SIZE);

// Registry of atlases so tiles.json can reference them by name.
const atlases = {
    'overworld-4x4': overworldSheet,
};

const player = new Player(playerSheet);

// Build the ground patch from the map + tile definitions.
// Variations are sampled deterministically at load time using Random.detUniform,
// so a given seed always produces the same layout but tiles don't flicker.
function buildGroundPatch(map, defs, rng) {
    // Rasterize all patches into a "x,y" → tileName cell map.
    // String keys are used because JS objects coerce keys to strings and Map
    // with array keys uses reference equality — neither works for tuple keys.
    const cells = new Map();
    const write = (x, y, name) => cells.set(`${x},${y}`, name);

    if (Array.isArray(map.patches)) {
        for (const p of map.patches) rasterize(p, write);
    }
    // Per-tile overrides win over patches.
    if (map.tiles) {
        for (const [key, name] of Object.entries(map.tiles)) cells.set(key, name);
    }

    const patch = [];
    for (const [key, name] of cells) {
        const [tx, ty] = key.split(',').map(Number);
        const def = defs[name];
        if (!def) {
            console.warn(`Tile "${name}" not found in tiles.json`);
            continue;
        }
        const variations = Math.max(1, def.variations ?? 1);
        // detUniform(0, variations - 1) → [0, variations); floor → 0..variations-1.
        const offset = Math.floor(rng.detUniform(0, variations - 1));
        patch.push({
            tx, ty,
            sheet: atlases[def.atlas],
            frameId: def.frameId + offset,
        });
    }
    return patch;
}

const groundPatch = buildGroundPatch(worldMap, tileDefs, random);

const camera = { x: 0, y: 0 };

function drawWorld() {
    const cx = worldCanvas.width / 2;
    const cy = worldCanvas.height / 2;
    worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
    for (const t of groundPatch) {
        const sx = Math.round(t.tx * TILE_SCREEN - camera.x + cx);
        const sy = Math.round(t.ty * TILE_SCREEN - camera.y + cy);
        t.sheet.draw(worldCtx, t.frameId, sx, sy, WORLD_SCALE);
    }
}

let last = performance.now();
function frame(now) {
    const dt = now - last;
    last = now;

    player.update(dt, input.state);
    camera.x = player.worldX;
    camera.y = player.worldY;

    // Player is fixed at screen center; world scrolls opposite.
    drawWorld();

    entityCtx.clearRect(0, 0, entityCanvas.width, entityCanvas.height);
    player.draw(entityCtx, camera, entityCanvas.width / 2, entityCanvas.height / 2);

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);