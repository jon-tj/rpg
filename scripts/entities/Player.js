import { SheetAnimation } from '../animation/SheetAnimation.js';

export class Player {
    constructor(spritesheet) {
        this.spritesheet = spritesheet;

        // Sheet layout: 4 cols x 2 rows.
        // Row 0 (ids 0..3) = walk (facing left in the source art).
        // Row 1 (ids 4..7) = idle.
        this.animations = {
            walk: new SheetAnimation(0, 4, 9, true),
            idle: new SheetAnimation(4, 4, 4, true),
        };

        this.state = 'idle';
        this.facing = 'left'; // matches source art; flip when facing right
        this.worldX = 0; // world-space pixels
        this.worldY = 0;
        this.speed = 0.25; // world pixels per ms
        this.scale = 4;
        this.frameId = this.animations.idle.startIndex;
    }

    /** Hot-swap the spritesheet (must share the same frame layout). */
    setSpritesheet(spritesheet) {
        this.spritesheet = spritesheet;
    }

    setState(state) {
        if (this.state !== state) {
            this.state = state;
            const a = this.animations[state];
            a.currentFrame = 0;
            a.elapsedTime = 0;
        }
    }

    update(deltaTime, input) {
        const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

        // Normalize diagonals so total speed is constant.
        const len = Math.hypot(dx, dy) || 1;
        this.worldX += (dx / len) * this.speed * deltaTime;
        this.worldY += (dy / len) * this.speed * deltaTime;

        if (dx !== 0 || dy !== 0) {
            if (dx !== 0) this.facing = dx < 0 ? 'left' : 'right';
            this.setState('walk');
        } else {
            this.setState('idle');
        }

        this.frameId = this.animations[this.state].nextFrameId(deltaTime);
    }

    // Y-sort key: the sprite's ground-contact ("foot") y in world space.
    // Player sprite is centered on worldY, so feet are half a sprite below it.
    get footY() {
        return this.worldY + (this.spritesheet.spriteHeight * this.scale) / 2;
    }

    draw(ctx, camera, screenCenterX, screenCenterY) {
        const spriteSize = this.spritesheet.spriteWidth * this.scale;
        const screenX = Math.round(this.worldX - camera.x + screenCenterX - spriteSize / 2);
        const screenY = Math.round(this.worldY - camera.y + screenCenterY - spriteSize / 2);
        this.spritesheet.draw(
            ctx,
            this.frameId,
            screenX,
            screenY,
            this.scale,
            this.facing === 'right', // source art faces left, so flip when right
        );
    }
}