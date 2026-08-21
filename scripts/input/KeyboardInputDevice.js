import { InputDevice } from './InputDevice.js';

const DEFAULT_KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    KeyE: 'interact',
    Digit1: 'option0', Digit2: 'option1', Digit3: 'option2',
    Digit4: 'option3', Digit5: 'option4',
};

// Actions that fire once on keydown rather than being held.
const EDGE_ACTIONS = new Set(['interact', 'option0', 'option1', 'option2', 'option3', 'option4']);

export class KeyboardInputDevice extends InputDevice {
    constructor(keyMap = DEFAULT_KEY_MAP, target = window) {
        super();
        this.keyMap = keyMap;
        this.target = target;

        this._onKeyDown = (e) => {
            const action = this.keyMap[e.code];
            if (action) {
                if (action.startsWith('option')) {
                    if (!e.repeat) this.state.optionSelect = parseInt(action.slice(6), 10);
                } else if (EDGE_ACTIONS.has(action)) {
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
