import { Renderer } from './Renderer.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Store } from './data/Store.js';
import { Random } from './Random.js';
import { Spritesheet } from './animation/Spritesheet.js';
import { KeyboardInputDevice } from './input/KeyboardInputDevice.js';
import { Dialog } from './ui/Dialog.js';
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

const entityCanvas = document.querySelector('canvas.layer[data-layer-id="1"]');
const entityCtx = entityCanvas.getContext('2d');

// Re-applies the DPR transform + disables smoothing on a context.
// Must run each frame because changing canvas.width/height on resize resets both.
function prepareCtx(ctx) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
}

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

const [playerImage, overworldImage, oakImage, tileDefs, propDefs, worldMap, haraldDialog] = await Promise.all([
    loadImage('assets/sprites/entities/player-4x2.png'),
    loadImage('assets/sprites/environment/overworld-4x4.png'),
    loadImage('assets/sprites/environment/oaktree-2x1.png'),
    loadJSON('assets/tiles.json'),
    loadJSON('assets/props.json'),
    loadJSON('assets/maps/overworld.json'),
    loadJSON('assets/interactions/dialogs/overworld-harald.json'),
]);

const TILE_SIZE = 16;
const WORLD_SCALE = 4;
const TILE_SCREEN = TILE_SIZE * WORLD_SCALE;

const playerSheet = new Spritesheet(playerImage, 4, TILE_SIZE, TILE_SIZE);
const overworldSheet = new Spritesheet(overworldImage, 4, TILE_SIZE, TILE_SIZE);
// Tree sprite size is data-driven from props.json (`spriteSize` in tiles).
const [oakW, oakH] = propDefs.oak.spriteSize.map(n => n * TILE_SIZE);
const oakSheet = new Spritesheet(oakImage, 2, oakW, oakH);

// Registry of atlases so tiles.json / props.json can reference them by name.
const atlases = {
    'overworld-4x4': overworldSheet,
    'oaktree-2x1':   oakSheet,
};

const player = new Player(playerSheet);

const npc = new NPC(playerSheet, 3 * TILE_SCREEN, -2 * TILE_SCREEN, haraldDialog, 'on the road');

const gameContainer = document.getElementById('game-container');
const dialog = new Dialog(gameContainer);
const interactIcon = document.getElementById('interact-icon');

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

// Build static prop instances from map.props. Each entry groups multiple
// instances of the same prop type via a `points` array, matching the patch
// schema convention. Every prop is anchored at its FOOT position
// (bottom-center of the sprite in world space), which is what gets Y-sorted
// against dynamic entities each frame.
function buildProps(map, defs, rng) {
    if (!Array.isArray(map.props)) return [];
    const out = [];
    for (const p of map.props) {
        const def = defs[p.type];
        if (!def) {
            console.warn(`Prop "${p.type}" not found in props.json`);
            continue;
        }
        const sheet = atlases[def.atlas];
        const variations = Math.max(1, def.variations ?? 1);
        for (const [tx, ty] of p.points) {
            const offset = Math.floor(rng.detUniform(0, variations - 1));
            out.push({
                worldX: tx * TILE_SCREEN,
                footY:  ty * TILE_SCREEN,
                sheet,
                frameId: def.frameId + offset,
            });
        }
    }
    // Pre-sort by footY so per-frame rendering can merge with dynamic entities in O(N).
    out.sort((a, b) => a.footY - b.footY);
    return out;
}

const props = buildProps(worldMap, propDefs, random);

// Dynamic entities are re-sorted each frame. Kept small on purpose — grow as needed.
const entities = [player, npc];

const camera = { x: 0, y: 0 };

function drawWorld() {
    prepareCtx(worldCtx);
    const cx = worldCanvas.clientWidth / 2;
    const cy = worldCanvas.clientHeight / 2;
    worldCtx.clearRect(0, 0, worldCanvas.clientWidth, worldCanvas.clientHeight);
    for (const t of groundPatch) {
        const sx = Math.round(t.tx * TILE_SCREEN - camera.x + cx);
        const sy = Math.round(t.ty * TILE_SCREEN - camera.y + cy);
        t.sheet.draw(worldCtx, t.frameId, sx, sy, WORLD_SCALE);
    }
}

function drawProp(prop, cx, cy) {
    const sw = prop.sheet.spriteWidth * WORLD_SCALE;
    const sh = prop.sheet.spriteHeight * WORLD_SCALE;
    // Prop is anchored at foot (bottom-center) in world space.
    const sx = Math.round(prop.worldX - camera.x + cx - sw / 2);
    const sy = Math.round(prop.footY  - camera.y + cy - sh);
    prop.sheet.draw(entityCtx, prop.frameId, sx, sy, WORLD_SCALE);
}

function drawEntities() {
    prepareCtx(entityCtx);
    entityCtx.clearRect(0, 0, entityCanvas.clientWidth, entityCanvas.clientHeight);

    const cx = entityCanvas.clientWidth / 2;
    const cy = entityCanvas.clientHeight / 2;

    // Sort just the small dynamic-entity list, then merge with the pre-sorted
    // static props. O(N) per frame in total (N = props + entities visible).
    entities.sort((a, b) => a.footY - b.footY);

    let i = 0, j = 0;
    while (i < props.length && j < entities.length) {
        if (props[i].footY <= entities[j].footY) drawProp(props[i++], cx, cy);
        else entities[j++].draw(entityCtx, camera, cx, cy);
    }
    while (i < props.length)   drawProp(props[i++], cx, cy);
    while (j < entities.length) entities[j++].draw(entityCtx, camera, cx, cy);
}

let last = performance.now();
function frame(now) {
    const dt = now - last;
    last = now;

    player.update(dt, input.state);
    npc.update(dt);

    // Handle E interaction
    const inRange = npc.isPlayerInRange(player);
    if (input.state.interact) {
        input.state.interact = false;
        if (dialog.active) {
            dialog.advance();
        } else if (inRange) {
            const nodes = npc.getDialogNodes();
            if (nodes) dialog.open(nodes, npc, 0);
        }
    }

    // Handle number key option selection
    if (input.state.optionSelect >= 0) {
        const idx = input.state.optionSelect;
        input.state.optionSelect = -1;
        if (dialog.active) dialog.selectOption(idx);
    }

    // Show/hide interaction icon
    if (inRange && !dialog.active) {
        interactIcon.style.display = '';
    } else {
        interactIcon.style.display = 'none';
    }

    camera.x = player.worldX;
    camera.y = player.worldY;

    // Player is fixed at screen center; world scrolls opposite.
    drawWorld();
    drawEntities();

    // Position interaction icon in screen space
    if (interactIcon.style.display !== 'none') {
        const cx = entityCanvas.clientWidth / 2;
        const cy = entityCanvas.clientHeight / 2;
        const pos = npc.getIconScreenPos(camera, cx, cy);
        interactIcon.style.left = pos.x + 'px';
        interactIcon.style.top = pos.y + 'px';
    }

    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
