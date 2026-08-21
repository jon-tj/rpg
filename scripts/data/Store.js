export class Store {
    static storageKey = 'rpg-game-state.v3';
    static version = 3;

    constructor() {
        // Default game state structure
        this.state = {
            "version": Store.version,
            "world": {
                "seed": Math.random(),
            },
            "player": {
                "name": "Hero",
                "level": 1,
            },
            "inventory": {
                "cols": 4,
                "rows": 4,
                "slots": []
            },
            "npcs": {}
        };
    }

    loadGameState() {
        const savedState = localStorage.getItem(Store.storageKey);
        const parsedState = savedState ? JSON.parse(savedState) : null;

        const continueGame = parsedState && parsedState.version === Store.version;

        if (continueGame) {
            this.state = parsedState;
        } else {
            this.saveGameState();
        }

        return this.state;
    }

    saveGameState() {
        localStorage.setItem(Store.storageKey, JSON.stringify(this.state));
    }
}
