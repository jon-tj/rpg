import { Monster } from '../entities/Monster.js';
import { Boss } from '../entities/Boss.js';
import { Altar } from '../entities/Altar.js';

const ATTACK_REACH = 44;   // how far in front of the player the swing is centred
const ATTACK_RADIUS = 46;
const BASE_DAMAGE = 10;
const SWORD_DAMAGE = 25;
const PROJECTILE_RADIUS = 9;
const REGEN_DELAY = 3000;  // ms without taking damage or being chased
const REGEN_RATE = 0.006;  // hp per ms (6 hp/s)

/**
 * Owns everything fight-related: monster encounters, the altar + boss,
 * projectiles, player attacks, damage numbers and screen shake.
 *
 * Persistent progress lives in `state` (a slice of the saved game state):
 *   { slain: string[], rewarded: { [encounterId]: true }, bossDefeated: bool }
 */
export class CombatSystem {
    constructor({ map, monsterDefs, art, tileScreen, state, inventory, hud, spawnPoint, onProgress }) {
        this.monsterDefs = monsterDefs;
        this.art = art;
        this.state = state;
        this.inventory = inventory;
        this.hud = hud;
        this.spawnPoint = spawnPoint;
        this.tileScreen = tileScreen;
        this.onProgress = onProgress ?? (() => {});

        this.state.slain ??= [];
        this.state.rewarded ??= {};

        this.encounters = [];
        this.monsters = [];
        for (const enc of map.encounters ?? []) {
            const def = monsterDefs[enc.monster];
            const members = enc.points.map(([tx, ty], i) =>
                new Monster(`${enc.id}#${i}`, def, art[def.art], tx * tileScreen, ty * tileScreen));
            const alive = members.filter(m => !this.state.slain.includes(m.id));
            this.monsters.push(...alive);
            this.encounters.push({ ...enc, members });
        }

        this.altarDef = map.altar ?? null;
        this.altar = null;
        if (this.altarDef) {
            const [tx, ty] = this.altarDef.point;
            this.altar = new Altar('altar', art.altar, tx * tileScreen, ty * tileScreen);
            this.altar.onInteract = () => this._useAltar();
        }

        this.boss = null;
        this.projectiles = [];
        this.floaters = [];   // floating damage numbers
        this.shakeAmount = 0;
        this.rewardRetryMs = 0;
        this.calmMs = 0;
        this.lastPlayerHp = null;

        // Hooks handed to the boss so it can affect the world.
        this.fx = {
            fire: (x, y, vx, vy, damage) => this.projectiles.push({ x, y, vx, vy, damage, lifeMs: 3500 }),
            shake: (amount) => { this.shakeAmount = Math.max(this.shakeAmount, amount); },
            announce: (text) => this.hud.toast(text),
        };

        // Handle any reward that couldn't be delivered last session (full bag).
        this._grantPendingRewards();
    }

    /** Entities that should be Y-sorted and drawn with the rest of the world. */
    drawables() {
        const out = [...this.monsters];
        if (this.boss) out.push(this.boss);
        if (this.altar) out.push(this.altar);
        return out;
    }

    interactables() {
        return this.altar ? [this.altar] : [];
    }

    /** Camera offset for screen shake this frame. */
    shakeOffset() {
        if (this.shakeAmount < 0.5) return { x: 0, y: 0 };
        return {
            x: (Math.random() * 2 - 1) * this.shakeAmount,
            y: (Math.random() * 2 - 1) * this.shakeAmount,
        };
    }

    update(dt, input, player) {
        // Cap dt so a backgrounded tab doesn't teleport everything on return.
        dt = Math.min(dt, 50);

        this.shakeAmount *= Math.pow(0.99, dt);
        if (this.altar) {
            this.altar.update(dt);
            this.altar.glowing = !this.boss && this.inventory.hasItem(this.altarDef.requires);
        }

        if (input.attack) {
            input.attack = false;
            if (player.tryAttack()) this._resolveAttack(player);
        }

        for (const m of this.monsters) m.update(dt, player);
        if (this.boss) {
            this.boss.update(dt, player, this.fx);
            this.hud.setBossHp(this.boss.hp / this.boss.maxHp, this.boss.phase);
        }
        this._updateProjectiles(dt, player);

        for (const f of this.floaters) f.ageMs += dt;
        this.floaters = this.floaters.filter(f => f.ageMs < 800);

        if (this.rewardRetryMs > 0) {
            this.rewardRetryMs -= dt;
            if (this.rewardRetryMs <= 0) this._grantPendingRewards();
        }

        this._regenerate(dt, player);
        if (!player.alive) this._onPlayerDeath(player);
        this.hud.setPlayerHp(player.hp, player.maxHp);
    }

    // Slowly heal once the player is out of combat.
    _regenerate(dt, player) {
        const inCombat = this.boss || this.monsters.some(m => m.state === 'chase');
        if (inCombat || (this.lastPlayerHp !== null && player.hp < this.lastPlayerHp)) this.calmMs = 0;
        else this.calmMs += dt;
        if (this.calmMs > REGEN_DELAY && player.alive) {
            player.hp = Math.min(player.maxHp, player.hp + REGEN_RATE * dt);
        }
        this.lastPlayerHp = player.hp;
    }

    _resolveAttack(player) {
        const ax = player.hitX + player.aimX * ATTACK_REACH;
        const ay = player.hitY + player.aimY * ATTACK_REACH;
        const damage = this.inventory.hasItem('sword') ? SWORD_DAMAGE : BASE_DAMAGE;

        for (const m of this.monsters) {
            if (Math.hypot(m.hitX - ax, m.hitY - ay) <= ATTACK_RADIUS + m.radius) {
                m.takeHit(damage, player.hitX, player.hitY);
                this._floater(m.hitX, m.hitY - 20, damage);
                if (!m.alive) this._onMonsterKilled(m);
            }
        }
        this.monsters = this.monsters.filter(m => m.alive);

        const b = this.boss;
        if (b && Math.hypot(b.hitX - ax, b.hitY - ay) <= ATTACK_RADIUS + b.radius) {
            if (b.takeHit(damage)) {
                this._floater(b.hitX, b.hitY - 40, damage);
                this.fx.shake(2);
                if (!b.alive) this._onBossDefeated();
            } else {
                this._floater(b.hitX, b.hitY - 40, 'immune');
            }
        }
    }

    _updateProjectiles(dt, player) {
        for (const p of this.projectiles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.lifeMs -= dt;
            if (player.alive && Math.hypot(p.x - player.hitX, p.y - player.hitY) < PROJECTILE_RADIUS + 16) {
                if (player.takeDamage(p.damage, p.x, p.y, 0.4)) p.lifeMs = 0;
            }
        }
        this.projectiles = this.projectiles.filter(p => p.lifeMs > 0);
    }

    _floater(x, y, value) {
        this.floaters.push({ x, y, text: String(value), ageMs: 0 });
    }

    _onMonsterKilled(m) {
        this.state.slain.push(m.id);
        const enc = this.encounters.find(e => e.members.includes(m));
        if (enc) {
            const left = enc.members.filter(x => x.alive).length;
            if (left > 0) this.hud.toast(`${left} ${this.monsterDefs[enc.monster].name.toLowerCase()}${left === 1 ? '' : 's'} left`, 1400);
        }
        this._grantPendingRewards();
        this.onProgress();
    }

    // Hands out rewards for every cleared encounter that hasn't paid out yet.
    _grantPendingRewards() {
        for (const enc of this.encounters) {
            if (this.state.rewarded[enc.id] || !enc.reward) continue;
            if (!enc.members.every(m => this.state.slain.includes(m.id))) continue;

            const leftover = this.inventory.addItem(enc.reward.item, enc.reward.quantity ?? 1);
            if (leftover > 0) {
                this.hud.toast('Your bag is full — make room to receive your reward.');
                this.rewardRetryMs = 3000;
                continue;
            }
            this.state.rewarded[enc.id] = true;
            this.hud.toast(enc.reward.message ?? 'You received a reward!', 4000);
            this.onProgress();
        }
    }

    _useAltar() {
        if (this.boss) return;
        const req = this.altarDef.requires;
        if (!this.inventory.hasItem(req)) {
            this.hud.toast(this.state.bossDefeated
                ? 'The altar lies quiet. Its guardian has fallen.'
                : 'The altar has an empty socket. Something must be offered here…');
            return;
        }
        this.inventory.removeItem(req, 1);
        this._spawnBoss();
        this.onProgress();
    }

    _spawnBoss() {
        const def = this.monsterDefs[this.altarDef.boss];
        const [ox, oy] = this.altarDef.bossOffset ?? [0, -3];
        const t = this.tileScreen;
        this.boss = new Boss(def, this.art[def.art], this.altar.worldX + ox * t, this.altar.footY + oy * t);
        this.hud.showBoss(def.name);
        this.hud.setBossHp(1, 1);
        this.hud.toast(`${def.name} awakens!`);
        this.fx.shake(10);
    }

    _onBossDefeated() {
        const reward = this.altarDef.reward;
        this.hud.hideBoss();
        this.projectiles = [];
        this.boss = null;
        this.state.bossDefeated = true;
        this.fx.shake(16);
        if (reward) {
            const leftover = this.inventory.addItem(reward.item, reward.quantity ?? 1);
            if (leftover > 0) this.hud.toast('Victory! (Your bag was too full to take the reward.)', 4000);
            else this.hud.toast(reward.message ?? 'Victory!', 4500);
        } else {
            this.hud.toast('Victory!', 4000);
        }
        this.onProgress();
    }

    _onPlayerDeath(player) {
        this.hud.toast('You were defeated… You wake up back at the village.', 3500);
        // A failed boss attempt refunds the token so the fight can be retried.
        if (this.boss) {
            this.boss = null;
            this.hud.hideBoss();
            this.inventory.addItem(this.altarDef.requires, 1);
        }
        this.projectiles = [];
        for (const m of this.monsters) m.reset();
        player.respawn(this.spawnPoint.x, this.spawnPoint.y);
        this.onProgress();
    }

    /** Effects drawn above world entities: sword swing, projectiles, numbers. */
    drawOverlay(ctx, camera, cx, cy, player) {
        const toX = x => Math.round(x - camera.x + cx);
        const toY = y => Math.round(y - camera.y + cy);

        if (player.swingMs > 0) {
            const t = 1 - player.swingMs / player.constructor.SWING_DURATION;
            const angle = Math.atan2(player.aimY, player.aimX);
            const sweep = 1.1;
            const start = angle - sweep + t * sweep * 0.6;
            ctx.save();
            ctx.globalAlpha = 1 - t * 0.7;
            ctx.strokeStyle = this.inventory.hasItem('sword') ? '#e8f4ff' : '#ffe2b0';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(toX(player.hitX), toY(player.hitY), ATTACK_REACH + 6, start, start + sweep * 1.4);
            ctx.stroke();
            ctx.restore();
        }

        for (const p of this.projectiles) {
            const x = toX(p.x), y = toY(p.y);
            ctx.fillStyle = 'rgba(255, 110, 40, 0.35)';
            ctx.beginPath(); ctx.arc(x, y, PROJECTILE_RADIUS + 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath(); ctx.arc(x, y, PROJECTILE_RADIUS, 0, Math.PI * 2); ctx.fill();
        }

        ctx.save();
        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        for (const f of this.floaters) {
            const k = f.ageMs / 800;
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = f.text === 'immune' ? '#9ab' : '#fff';
            const x = toX(f.x), y = toY(f.y) - k * 30;
            ctx.strokeText(f.text, x, y);
            ctx.fillText(f.text, x, y);
        }
        ctx.restore();
    }
}
