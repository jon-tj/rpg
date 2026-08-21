import { InputDevice } from './InputDevice.js';

const DEFAULT_KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    KeyE: 'interact',
};

// Actions that fire once on keydown rather than being held.
const EDGE_ACTIONS = new Set(['interact']);

export class KeyboardInputDevice extends InputDevice {
    constructor(keyMap = DEFAULT_KEY_MAP, target = window) {
        super();
        this.keyMap = keyMap;
        this.target = target;

        this._onKeyDown = (e) => {
            const action = this.keyMap[e.code];
            if (action) {
                if (EDGE_ACTIONS.has(action)) {
                    // Edge-triggered: set true on press, consumed by game loop.
                    if (!e.repeat) this.state[action] = true;
                } else {
                    this.state[action] = true;
                }
            }
        };
        this._onKeyUp = (e) => {
            const action = this.keyMap[e.code];
            if (action && !EDGE_ACTIONS.has(action)) this.state[action] = false;
        };
    }

    connect() {
        this.target.addEventListener('keydown', this._onKeyDown);
        this.target.addEventListener('keyup', this._onKeyUp);
    }

    disconnect() {
        this.target.removeEventListener('keydown', this._onKeyDown);
        this.target.removeEventListener('keyup', this._onKeyUp);
    }
}
