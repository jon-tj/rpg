import { pixelArt, silhouette } from './PixelArt.js';

// 16x16 ASCII sprites. Palette keys: k = outline, others per sprite.

const SLIME = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkggggkk....',
    '...kgwwgggggk...',
    '..kgwwggggggdk..',
    '..kggggggggddk..',
    '.kggkggggkgggdk.',
    '.kggkggggkgggdk.',
    '.kgggggggggdddk.',
    '.kdgggggggddddk.',
    '..kkkkkkkkkkkk..',
    '................',
];

const GOLEM = [
    '................',
    '....kk....kk....',
    '...ksk....ksk...',
    '...kskkkkkksk...',
    '..kssssssssssk..',
    '..ksrrssssrrsk..',
    '..ksrrssssrrsk..',
    '..kssssssssssk..',
    '..kssSkkkkSssk..',
    'kSSksssrrssskSSk',
    'kSSksssrrssskSSk',
    'kSSksssssssskSSk',
    '.kk.kssssssk.kk.',
    '...ksSSkkSSsk...',
    '...kSSk..kSSk...',
    '...kkkk..kkkk...',
];

const ALTAR = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '....kgppppgk....',
    '....kggppggk....',
    '...kkkkkkkkkk...',
    '....kssssssk....',
    '....ksSssSsk....',
    '....kssssssk....',
    '....ksSssSsk....',
    '..kkkkkkkkkkkk..',
    '..kSSSSSSSSSSk..',
];

export function buildCreatureArt() {
    return {
        slime: {
            normal: pixelArt(SLIME, { k: '#1b2a1b', g: '#5fcf5f', w: '#dfffd8', d: '#3a8f3f' }),
            flash:  silhouette(SLIME),
        },
        golem: {
            normal: pixelArt(GOLEM, { k: '#1a1a22', s: '#8a8f9e', S: '#5b5f6e', r: '#6cf0ff' }),
            // Phase 2: the stone heats up and the core burns red.
            enraged: pixelArt(GOLEM, { k: '#220a0a', s: '#b2553a', S: '#7a2e22', r: '#ffd23f' }),
            flash:  silhouette(GOLEM),
        },
        altar: {
            dormant: pixelArt(ALTAR, { k: '#15151c', g: '#6b6f7e', p: '#3b3450', s: '#9aa0ae', S: '#6b6f7e' }),
            active:  pixelArt(ALTAR, { k: '#15151c', g: '#6b6f7e', p: '#c07bff', s: '#9aa0ae', S: '#6b6f7e' }),
        },
    };
}
