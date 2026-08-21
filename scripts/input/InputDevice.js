// Abstract input device. Subclasses populate `this.state` with the current
// per-frame input snapshot and implement connect/disconnect for lifecycle.
export class InputDevice {
    constructor() {
        this.state = {
            left: false,
            right: false,
            up: false,
            down: false,
            interact: false,
        };
    }

    connect() {}
    disconnect() {}
}
