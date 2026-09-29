import { drawShadow } from './Monster.js';

// Summoning altar. Interacting with it while holding the required token
// consumes the token and calls `onSummon`; the glow shows when it's usable.
export class Altar {
    constructor(id, art, worldX, footY) {
        this.id = id;
        this.art = art;
        this.worldX = worldX;
        this.footY = footY;
        this.scale = 5;
        this.interactionRadius = 90;
        this.interactIcon = 'auto_awesome';
        this.glowing = false;
        this.animMs = 0;
        this.onInteract = null;
    }

    update(dt) {
        this.animMs += dt;
    }

    isPlayerInRange(player) {
        return Math.hypot(this.worldX - player.worldX, this.footY - player.footY) <= this.interactionRadius;
    }

    draw(ctx, camera, cx, cy) {
        const img = this.glowing ? this.art.active : this.art.dormant;
        const w = img.width * this.scale;
        const h = img.height * this.scale;
        const sx = Math.round(this.worldX - camera.x + cx);
        const sy = Math.round(this.footY - camera.y + cy);
        drawShadow(ctx, sx, sy, 34);
        ctx.drawImage(img, sx - w / 2, sy - h, w, h);

        if (this.glowing) {
            const pulse = 0.35 + Math.sin(this.animMs / 250) * 0.15;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(192, 123, 255, ${pulse})`;
            ctx.beginPath();
            ctx.arc(sx, sy - h + 7.5 * this.scale, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    getIconScreenPos(camera, cx, cy) {
        const h = this.art.dormant.height * this.scale;
        return {
            x: Math.round(this.worldX - camera.x + cx),
            y: Math.round(this.footY - camera.y + cy - h + 20),
        };
    }
}
