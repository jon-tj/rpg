import { SheetAnimation } from '../animation/SheetAnimation.js';

export class NPC {
    constructor(spritesheet, worldX, worldY, dialogData = null, dialogCategory = null) {
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
        this.dialogData = dialogData;         // full JSON object
        this.dialogCategory = dialogCategory; // active category key
        this.karma = {};                      // { npcName: number }
        this.interactionRadius = 80;
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

    /** Get the dialog nodes for the active category. */
    getDialogNodes() {
        if (!this.dialogData || !this.dialogCategory) return null;
        return this.dialogData[this.dialogCategory] ?? null;
    }

    getKarma(name) {
        return this.karma[name] ?? 0;
    }

    addKarma(name, delta) {
        this.karma[name] = (this.karma[name] ?? 0) + delta;
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
