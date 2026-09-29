import { drawShadow } from './Monster.js';

// Two-phase boss.
//   Phase 1: stalks the player and periodically winds up a straight-line charge.
//   Phase 2 (below half HP): roars (briefly invulnerable), turns molten, moves
//   and charges faster, and fires rings of projectiles between charges.
export class Boss {
    constructor(def, art, worldX, worldY) {
        this.def = def;
        this.art = art;
        this.name = def.name;
        this.worldX = worldX;
        this.worldY = worldY; // foot position
        this.scale = def.scale ?? 6;
        this.maxHp = def.hp;
        this.hp = def.hp;
        this.radius = def.radius ?? 40;
        this.phase = 1;
        this.state = 'intro'; // intro | chase | windup | charge | recover | roar
        this.stateMs = 1200;
        this.chargeTimerMs = 2500;
        this.volleyTimerMs = 1500;
        this.volleyCount = 0;
        this.chargeX = 0;
        this.chargeY = 0;
        this.flashMs = 0;
        this.animMs = 0;
        this.facing = 1;
    }

    get alive() {
        return this.hp > 0;
    }

    get invulnerable() {
        return this.state === 'intro' || this.state === 'roar';
    }

    get footY() {
        return this.worldY;
    }

    get hitX() { return this.worldX; }
    get hitY() { return this.worldY - (this.def.bodyHeight ?? 90) / 2; }

    takeHit(amount) {
        if (this.invulnerable) return false;
        this.hp = Math.max(0, this.hp - amount);
        this.flashMs = 100;
        return true;
    }

    _enter(state, ms) {
        this.state = state;
        this.stateMs = ms;
    }

    /**
     * @param {number} dt
     * @param {Player} player
     * @param {object} fx - { fire(x, y, vx, vy, damage), shake(amount), announce(text) }
     */
    update(dt, player, fx) {
        this.animMs += dt;
        this.flashMs = Math.max(0, this.flashMs - dt);
        this.stateMs -= dt;

        const p2 = this.phase === 2;
        const dx = player.hitX - this.hitX;
        const dy = player.hitY - this.hitY;
        const dist = Math.hypot(dx, dy) || 1;

        if (this.phase === 1 && this.hp <= this.maxHp / 2) {
            this.phase = 2;
            this._enter('roar', 1400);
            fx.shake(14);
            fx.announce(`${this.name} is enraged!`);
            return;
        }

        switch (this.state) {
        case 'intro':
        case 'roar':
            if (this.stateMs <= 0) this._enter('chase', 0);
            break;

        case 'chase': {
            const speed = this.def.speed * (p2 ? 1.5 : 1);
            this.worldX += (dx / dist) * speed * dt;
            this.worldY += (dy / dist) * speed * dt;
            this.facing = dx < 0 ? -1 : 1;
            this.chargeTimerMs -= dt;
            if (this.chargeTimerMs <= 0) this._enter('windup', p2 ? 450 : 750);
            break;
        }

        case 'windup':
            if (this.stateMs <= 0) {
                // Lock the direction at the end of the wind-up so it's dodgeable.
                this.chargeX = dx / dist;
                this.chargeY = dy / dist;
                this.facing = dx < 0 ? -1 : 1;
                this._enter('charge', p2 ? 650 : 550);
            }
            break;

        case 'charge': {
            const speed = this.def.chargeSpeed * (p2 ? 1.2 : 1);
            this.worldX += this.chargeX * speed * dt;
            this.worldY += this.chargeY * speed * dt;
            if (this.stateMs <= 0) {
                fx.shake(6);
                this._enter('recover', p2 ? 400 : 750);
                if (p2) this._fireRing(fx, 10, this.def.projectileSpeed * 0.8);
            }
            break;
        }

        case 'recover':
            if (this.stateMs <= 0) {
                this.chargeTimerMs = p2 ? 2200 : 3000;
                this._enter('chase', 0);
            }
            break;
        }

        // Phase 2 projectile volleys, fired whenever not mid-charge.
        if (p2 && this.state !== 'roar' && this.state !== 'charge') {
            this.volleyTimerMs -= dt;
            if (this.volleyTimerMs <= 0) {
                this.volleyTimerMs = 2000;
                this.volleyCount++;
                if (this.volleyCount % 2) {
                    this._fireRing(fx, 14, this.def.projectileSpeed);
                } else {
                    // Aimed spread of three.
                    const a = Math.atan2(dy, dx);
                    for (const off of [-0.25, 0, 0.25]) {
                        const s = this.def.projectileSpeed * 1.3;
                        fx.fire(this.hitX, this.hitY, Math.cos(a + off) * s, Math.sin(a + off) * s, this.def.projectileDamage);
                    }
                }
            }
        }

        // Contact damage — heavier while charging.
        if (player.alive && dist < this.radius + 20 && this.state !== 'intro') {
            const charging = this.state === 'charge';
            const dmg = charging ? this.def.chargeDamage : this.def.damage;
            if (player.takeDamage(dmg, this.hitX, this.hitY, charging ? 1.2 : 0.7) && charging) fx.shake(8);
        }
    }

    _fireRing(fx, count, speed) {
        const offset = (this.volleyCount % 2) * (Math.PI / count);
        for (let i = 0; i < count; i++) {
            const a = offset + (i / count) * Math.PI * 2;
            fx.fire(this.hitX, this.hitY, Math.cos(a) * speed, Math.sin(a) * speed, this.def.projectileDamage);
        }
    }

    draw(ctx, camera, cx, cy) {
        let img = this.phase === 2 ? this.art.enraged : this.art.normal;
        if (this.flashMs > 0) img = this.art.flash;
        // Roar flickers between the two palettes.
        if (this.state === 'roar' && Math.floor(this.animMs / 90) % 2) img = this.art.normal;

        const w = img.width * this.scale;
        const h = img.height * this.scale;
        let sx = Math.round(this.worldX - camera.x + cx);
        const sy = Math.round(this.worldY - camera.y + cy);

        drawShadow(ctx, sx, sy, this.radius * 1.1);

        // Tremble during wind-up / roar as a tell.
        if (this.state === 'windup' || this.state === 'roar') sx += Math.round(Math.sin(this.animMs * 0.08) * 3);
        // Slow idle breathing.
        const breathe = this.state === 'chase' ? Math.round(Math.sin(this.animMs / 300) * 2) : 0;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(this.facing, 1);
        ctx.drawImage(img, -w / 2, -h + breathe, w, h);
        ctx.restore();

        // Wind-up telegraph: a line showing where the charge will go.
        if (this.state === 'windup') {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = this.phase === 2 ? '#ff7a3d' : '#6cf0ff';
            ctx.lineWidth = 6;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            const hy = this.hitY - camera.y + cy;
            ctx.arc(sx, hy, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}
