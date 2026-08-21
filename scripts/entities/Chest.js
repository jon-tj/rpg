export class Chest {
    constructor(id, spritesheet, frameId, worldX, footY, inventory) {
        this.id = id;
        this.spritesheet = spritesheet;
        this.frameId = frameId;
        this.worldX = worldX;
        this.footY = footY;
        this.inventory = inventory;
        this.scale = 4;
        this.interactionRadius = 80;
        this.interactIcon = 'inventory_2';
        this.onInteract = null;
    }

    isPlayerInRange(player) {
        const dx = this.worldX - player.worldX;
        const dy = this.footY - player.worldY;
        return Math.hypot(dx, dy) <= this.interactionRadius;
    }

    draw(ctx, camera, screenCenterX, screenCenterY) {
        const sw = this.spritesheet.spriteWidth * this.scale;
        const sh = this.spritesheet.spriteHeight * this.scale;
        // Anchored at foot (bottom-center), matching static props.
        const sx = Math.round(this.worldX - camera.x + screenCenterX - sw / 2);
        const sy = Math.round(this.footY - camera.y + screenCenterY - sh);
        this.spritesheet.draw(ctx, this.frameId, sx, sy, this.scale);
    }

    getIconScreenPos(camera, screenCenterX, screenCenterY) {
        const sh = this.spritesheet.spriteHeight * this.scale;
        return {
            x: Math.round(this.worldX - camera.x + screenCenterX),
            y: Math.round(this.footY - camera.y + screenCenterY - sh - 12),
        };
    }
}
