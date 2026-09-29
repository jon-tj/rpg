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

        // Combat
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.aimX = -1; // last movement direction, used to aim attacks
        this.aimY = 0;
        this.invulnMs = 0;   // i-frames after taking a hit
        this.attackCooldownMs = 0;
        this.swingMs = 0;    // >0 while the swing effect is visible
        this.knockX = 0;     // knockback velocity, world px per ms
        this.knockY = 0;
    }

    static ATTACK_COOLDOWN = 380;
    static SWING_DURATION = 160;
    static INVULN_DURATION = 700;

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

        this.worldX += this.knockX * deltaTime;
        this.worldY += this.knockY * deltaTime;
        const decay = Math.pow(0.99, deltaTime);
        this.knockX *= decay;
        this.knockY *= decay;

        this.invulnMs = Math.max(0, this.invulnMs - deltaTime);
        this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaTime);
        this.swingMs = Math.max(0, this.swingMs - deltaTime);

        if (dx !== 0 || dy !== 0) {
            this.aimX = dx / len;
            this.aimY = dy / len;
            if (dx !== 0) this.facing = dx < 0 ? 'left' : 'right';
            this.setState('walk');
        } else {
            this.setState('idle');
        }

        this.frameId = this.animations[this.state].nextFrameId(deltaTime);
    }

    get alive() {
        return this.hp > 0;
    }

    // Centre of the body in world space, used for hit detection.
    get hitX() { return this.worldX; }
    get hitY() { return this.worldY + 8; }

    /** Starts a swing if off cooldown. Returns true when a new attack begins. */
    tryAttack() {
        if (this.attackCooldownMs > 0 || !this.alive) return false;
        this.attackCooldownMs = Player.ATTACK_COOLDOWN;
        this.swingMs = Player.SWING_DURATION;
        return true;
    }

    /** Applies damage unless invulnerable. Returns true if the hit landed. */
    takeDamage(amount, fromX, fromY, knockback = 0.6) {
        if (this.invulnMs > 0 || !this.alive) return false;
        this.hp = Math.max(0, this.hp - amount);
        this.invulnMs = Player.INVULN_DURATION;
        const dx = this.hitX - fromX;
        const dy = this.hitY - fromY;
        const len = Math.hypot(dx, dy) || 1;
        this.knockX = (dx / len) * knockback;
        this.knockY = (dy / len) * knockback;
        return true;
    }

    respawn(x, y) {
        this.worldX = x;
        this.worldY = y;
        this.hp = this.maxHp;
        this.knockX = this.knockY = 0;
        this.invulnMs = 1500;
    }

    // Y-sort key: the sprite's ground-contact ("foot") y in world space.
    // Player sprite is centered on worldY, so feet are half a sprite below it.
    get footY() {
        return this.worldY + (this.spritesheet.spriteHeight * this.scale) / 2;
    }

    draw(ctx, camera, screenCenterX, screenCenterY) {
        // Blink while invulnerable after a hit.
        if (this.invulnMs > 0 && Math.floor(this.invulnMs / 80) % 2 === 0) return;
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