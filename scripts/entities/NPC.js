import { SheetAnimation } from '../animation/SheetAnimation.js';

export class NPC {
    constructor(spritesheet, worldX, worldY, dialog = []) {
        this.spritesheet = spritesheet;

        this.animations = {
            idle: new SheetAnimation(4, 4, 4, true),
        };

        this.state = 'idle';
        this.facing = 'left';
        this.worldX = worldX;
        this.worldY = worldY;
        this.scale = 4;
        this.frameId = this.animations.idle.startIndex;
        this.dialog = dialog;
        this.interactionRadius = 80; // world pixels
    }

    update(dt) {
        this.frameId = this.animations[this.state].nextFrameId(dt);
    }

    get footY() {
        return this.worldY + (this.spritesheet.spriteHeight * this.scale) / 2;
    }

    isPlayerInRange(player) {
        const dx = this.worldX - player.worldX;
        const dy = this.worldY - player.worldY;
        return Math.hypot(dx, dy) <= this.interactionRadius;
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
            this.facing === 'right',
        );
    }

    /** Returns the screen position above the NPC's head for the interaction icon. */
    getIconScreenPos(camera, screenCenterX, screenCenterY) {
        const spriteW = this.spritesheet.spriteWidth * this.scale;
        const spriteH = this.spritesheet.spriteHeight * this.scale;
        const sx = Math.round(this.worldX - camera.x + screenCenterX);
        const sy = Math.round(this.worldY - camera.y + screenCenterY - spriteH / 2 - 12);
        return { x: sx, y: sy };
    }
}
