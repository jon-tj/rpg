// Always-on combat HUD: player health, boss health bar and short toasts.
export class Hud {
    constructor(container) {
        this.root = document.createElement('div');
        this.root.id = 'hud';
        this.root.innerHTML = `
            <div class="hud-hp">
                <span class="material-icons">favorite</span>
                <div class="hud-bar"><div class="hud-fill"></div></div>
                <span class="hud-hp-text"></span>
            </div>
            <div class="hud-boss" style="display:none;">
                <div class="hud-boss-name"></div>
                <div class="hud-bar"><div class="hud-fill"></div></div>
            </div>
            <div class="hud-toast"></div>
            <div class="hud-hint">Space / J — attack</div>
        `;
        container.appendChild(this.root);

        this.hpFill = this.root.querySelector('.hud-hp .hud-fill');
        this.hpText = this.root.querySelector('.hud-hp-text');
        this.boss = this.root.querySelector('.hud-boss');
        this.bossName = this.root.querySelector('.hud-boss-name');
        this.bossFill = this.root.querySelector('.hud-boss .hud-fill');
        this.toastEl = this.root.querySelector('.hud-toast');
        this._toastTimer = null;
        this._lastHp = null;
    }

    setPlayerHp(hp, max) {
        const rounded = Math.ceil(hp);
        if (rounded === this._lastHp) return;
        this._lastHp = rounded;
        this.hpFill.style.width = `${(hp / max) * 100}%`;
        this.hpText.textContent = `${rounded} / ${max}`;
    }

    showBoss(name) {
        this.bossName.textContent = name;
        this.boss.style.display = '';
        this.boss.classList.remove('enraged');
    }

    setBossHp(frac, phase) {
        this.bossFill.style.width = `${Math.max(0, frac) * 100}%`;
        this.boss.classList.toggle('enraged', phase === 2);
    }

    hideBoss() {
        this.boss.style.display = 'none';
    }

    toast(text, ms = 2600) {
        this.toastEl.textContent = text;
        this.toastEl.classList.add('visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.toastEl.classList.remove('visible'), ms);
    }
}
