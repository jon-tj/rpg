// A basic melee enemy: wanders near its spawn point, chases the player once
// they come close, and gives up if dragged too far from home.
export class Monster {
    /**
     * @param {string} id - Stable id (used to persist kills).
     * @param {object} def - Stats from monsters.json.
     * @param {object} art - { normal, flash } sprite images.
     * @param {number} worldX - Spawn x (foot position).
     * @param {number} worldY - Spawn y (foot position).
     */
    constructor(id, def, art, worldX, worldY) {
        this.id = id;
        this.def = def;
        this.art = art;
        this.spawnX = worldX;
        this.spawnY = worldY;
        this.worldX = worldX;
        this.worldY = worldY; // foot position; the sprite sits on top of it
        this.scale = def.scale ?? 4;
        this.maxHp = def.hp;
        this.hp = def.hp;
        this.radius = def.radius ?? 24;
        this.state = 'idle'; // 'idle' | 'chase' | 'return'
        this.flashMs = 0;
        this.knockX = 0;
        this.knockY = 0;
        this.wanderMs = 0;
        this.wanderX = 0;
        this.wanderY = 0;
        this.animMs = Math.random() * 1000; // desync the bounce between slimes
        this.facing = 1;
    }

    get alive() {
        return this.hp > 0;
    }

    get footY() {
        return this.worldY;
    }

    // Centre of the body in world space, used for hit detection.
    get hitX() { return this.worldX; }
    get hitY() { return this.worldY - (this.def.bodyHeight ?? 40) / 2; }

    reset() {
        this.worldX = this.spawnX;
        this.worldY = this.spawnY;
        this.hp = this.maxHp;
        this.state = 'idle';
        this.knockX = this.knockY = 0;
    }

    takeHit(amount, fromX, fromY) {
        this.hp = Math.max(0, this.hp - amount);
        this.flashMs = 120;
        this.state = 'chase';
        const dx = this.hitX - fromX;
        const dy = this.hitY - fromY;
        const len = Math.hypot(dx, dy) || 1;
        this.knockX = (dx / len) * 0.7;
        this.knockY = (dy / len) * 0.7;
    }

    update(dt, player) {
        this.animMs += dt;
        this.flashMs = Math.max(0, this.flashMs - dt);

        const toPlayer = Math.hypot(player.hitX - this.hitX, player.hitY - this.hitY);
        const fromHome = Math.hypot(this.worldX - this.spawnX, this.worldY - this.spawnY);
        const aggro = this.def.aggroRadius ?? 300;
        const leash = this.def.leashRadius ?? 700;

        if (!player.alive) this.state = 'return';
        else if (this.state === 'idle' && toPlayer < aggro) this.state = 'chase';
        else if (this.state === 'chase' && fromHome > leash) this.state = 'return';
        else if (this.state === 'return' && fromHome < 8) this.state = 'idle';

        let mx = 0, my = 0, speed = this.def.speed;
        if (this.state === 'chase') {
            mx = player.hitX - this.hitX;
            my = player.hitY - this.hitY;
        } else if (this.state === 'return') {
            mx = this.spawnX - this.worldX;
            my = this.spawnY - this.worldY;
            // Heal up while walking home so kiting isn't free.
            this.hp = Math.min(this.maxHp, this.hp + dt * 0.02);
        } else {
            this.wanderMs -= dt;
            if (this.wanderMs <= 0) {
                this.wanderMs = 1200 + Math.random() * 1800;
                const moving = Math.random() < 0.6 && fromHome < 120;
                const a = Math.random() * Math.PI * 2;
                this.wanderX = moving ? Math.cos(a) : (this.spawnX - this.worldX) / (fromHome || 1);
                this.wanderY = moving ? Math.sin(a) : (this.spawnY - this.worldY) / (fromHome || 1);
                if (!moving && fromHome < 8) this.wanderX = this.wanderY = 0;
            }
            mx = this.wanderX;
            my = this.wanderY;
            speed *= 0.35;
        }

        const len = Math.hypot(mx, my);
        if (len > 1) {
            this.worldX += (mx / len) * speed * dt;
            this.worldY += (my / len) * speed * dt;
            if (Math.abs(mx) > 1) this.facing = mx < 0 ? -1 : 1;
        }

        this.worldX += this.knockX * dt;
        this.worldY += this.knockY * dt;
        const decay = Math.pow(0.985, dt);
        this.knockX *= decay;
        this.knockY *= decay;

        // Contact damage
        if (player.alive && toPlayer < this.radius + 18) {
            player.takeDamage(this.def.damage, this.hitX, this.hitY);
        }
    }

    draw(ctx, camera, cx, cy) {
        const img = this.flashMs > 0 ? this.art.flash : this.art.normal;
        // Squash-and-stretch bounce, anchored at the feet.
        const t = this.animMs / (this.state === 'chase' ? 140 : 260);
        const squash = 1 + Math.sin(t) * 0.08;
        const w = img.width * this.scale * (2 - squash);
        const h = img.height * this.scale * squash;
        const sx = Math.round(this.worldX - camera.x + cx);
        const sy = Math.round(this.worldY - camera.y + cy);

        drawShadow(ctx, sx, sy, this.radius);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(this.facing, 1);
        ctx.drawImage(img, -w / 2, -h + (this.def.footPadding ?? 0) * this.scale * squash, w, h);
        ctx.restore();

        if (this.hp < this.maxHp) {
            drawHpBar(ctx, sx, sy - (this.def.bodyHeight ?? 40) - 14, 44, this.hp / this.maxHp);
        }
    }
}

export function drawShadow(ctx, sx, sy, radius) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, radius, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
}

export function drawHpBar(ctx, centerX, y, width, frac) {
    const x = Math.round(centerX - width / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 1, y - 1, width + 2, 7);
    ctx.fillStyle = frac > 0.5 ? '#6fdc5a' : frac > 0.25 ? '#f2c14e' : '#e5533d';
    ctx.fillRect(x, y, Math.round(width * frac), 5);
}
