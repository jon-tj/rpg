export class Random {
    constructor(seed = 12345) {
        this.seed = seed;
    }

    static randomId() {
        return Math.random().toString(36).substr(2, 9);
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    detUniform(min = 0, max = 1, seed = null) {
        if (seed !== null) {
            this.seed = seed;
        }
        const range = max - min + 1;
        this.seed = (this.seed * 9301 + 49297) % 233280;

        return this.seed / 233280 * range + min;
    }
}